import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import {
  GENERATION_COST_POLICY,
  type GenerationMode,
  type GenerationCreditType,
} from "./generation-entitlement-policy";
export {
  GENERATION_COST_POLICY,
  deriveGenerationBalance,
} from "./generation-entitlement-policy";

export const entitlementErrorCodes = [
  "AUTH_REQUIRED",
  "NO_GENERATION_CREDITS",
  "CREDIT_RESERVATION_FAILED",
  "GENERATION_ALREADY_EXISTS",
  "GENERATION_IN_PROGRESS",
  "CREDIT_CAPTURE_FAILED",
  "CREDIT_RELEASE_FAILED",
  "ENTITLEMENT_CONFIGURATION_ERROR",
] as const;
export type EntitlementErrorCode = (typeof entitlementErrorCodes)[number];
export class EntitlementError extends Error {
  constructor(
    public readonly code: EntitlementErrorCode,
    public readonly requestId: string,
    public readonly generationId: string | undefined,
    public readonly stage: string,
    public readonly retryable: boolean,
    message: string,
    public readonly diagnosticCode: string,
  ) {
    super(message);
  }
  toJSON() {
    return {
      code: this.code,
      requestId: this.requestId,
      generationId: this.generationId,
      stage: this.stage,
      retryable: this.retryable,
      message: this.message,
      diagnosticCode: this.diagnosticCode,
    };
  }
}

type DbClient = {
  query: (text: string, values?: unknown[]) => Promise<any>;
  release: () => void;
};
const modeType = (mode: GenerationMode): GenerationCreditType =>
  mode === "2D" ? "GENERATION_2D" : "GENERATION_3D";
const safeKey = (value: string) => /^[A-Za-z0-9:_-]{8,200}$/.test(value);

async function tx<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface Reservation {
  reservationId: string;
  generationId: string;
  userId: string;
  requestedMode: GenerationMode;
  creditType: GenerationCreditType;
  status: "ACTIVE" | "CAPTURED" | "RELEASED" | "EXPIRED";
  expiresAt: Date;
  existing: boolean;
}
export type GenerationReplay =
  | { state: "IN_PROGRESS" }
  | { state: "COMPLETED"; response: unknown }
  | { state: "FAILED"; safeError: Record<string, unknown> };

export class GenerationEntitlementService {
  async ensureFreeFirstEntitlement(userId: string): Promise<void> {
    await tx(async (c) => {
      await c.query(
        "INSERT INTO entitlement_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING",
        [userId],
      );
      await c.query(
        "SELECT user_id FROM entitlement_accounts WHERE user_id=$1 FOR UPDATE",
        [userId],
      );
      await c.query(
        `INSERT INTO entitlement_transactions(user_id,credit_type,transaction_type,quantity,source,source_id,idempotency_key,metadata)
        VALUES($1,'GENERATION_2D','FREE_FIRST_SKIN',1,'ACCOUNT_ELIGIBILITY',$1,$2,'{"policyVersion":"free-first-v1","fungibleGenerationPreview":true}') ON CONFLICT DO NOTHING`,
        [userId, `free-first:${userId}`],
      );
      await c.query(
        "UPDATE entitlement_accounts SET free_first_granted_at=COALESCE(free_first_granted_at,now()) WHERE user_id=$1",
        [userId],
      );
    });
  }

  async reserveGenerationCredit(input: {
    userId: string;
    clientRequestId: string;
    idempotencyKey: string;
    generationId: string;
    requestedMode: GenerationMode;
    requestId: string;
  }): Promise<Reservation> {
    if (
      ![input.clientRequestId, input.idempotencyKey, input.generationId].every(
        safeKey,
      )
    )
      throw new EntitlementError(
        "CREDIT_RESERVATION_FAILED",
        input.requestId,
        input.generationId,
        "reservation",
        false,
        "We could not start this skin safely.",
        "INVALID_CORRELATION_KEY",
      );
    try {
      return await tx(async (c) => {
        await c.query(
          "INSERT INTO entitlement_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING",
          [input.userId],
        );
        await c.query(
          "SELECT user_id FROM entitlement_accounts WHERE user_id=$1 FOR UPDATE",
          [input.userId],
        );
        const existing = await c.query(
          "SELECT * FROM generation_credit_reservations WHERE idempotency_key=$1 OR (user_id=$2 AND client_request_id=$3)",
          [input.idempotencyKey, input.userId, input.clientRequestId],
        );
        if (existing.rows[0]) {
          const r = existing.rows[0];
          if (
            r.user_id !== input.userId ||
            r.generation_id !== input.generationId ||
            r.idempotency_key !== input.idempotencyKey ||
            r.client_request_id !== input.clientRequestId
          )
            throw new EntitlementError(
              "GENERATION_ALREADY_EXISTS",
              input.requestId,
              input.generationId,
              "reservation",
              false,
              "That request was already used.",
              "IDEMPOTENCY_SCOPE_MISMATCH",
            );
          return this.mapReservation(r, true);
        }
        const totals = await c.query(
          `SELECT
          COALESCE(SUM(CASE WHEN transaction_type IN ('FREE_FIRST_SKIN','PURCHASE','PROMOTION','ADMIN_GRANT','REFUND','SUPPORT_ADJUSTMENT') AND (expires_at IS NULL OR expires_at>now()) THEN quantity ELSE 0 END),0)::int granted,
          COALESCE(SUM(CASE WHEN transaction_type='CAPTURE' THEN quantity ELSE 0 END),0)::int captured,
          COALESCE(SUM(CASE WHEN transaction_type IN ('EXPIRATION','CHARGEBACK_REVERSAL') THEN quantity ELSE 0 END),0)::int removed
          FROM entitlement_transactions WHERE user_id=$1 AND credit_type IN ('GENERATION_2D','GENERATION_3D') AND status='POSTED'`,
          [input.userId],
        );
        const active = await c.query(
          "SELECT COALESCE(SUM(quantity),0)::int reserved FROM generation_credit_reservations WHERE user_id=$1 AND status='ACTIVE' AND expires_at>now()",
          [input.userId],
        );
        if (
          totals.rows[0].granted -
            totals.rows[0].captured -
            totals.rows[0].removed -
            active.rows[0].reserved <
          GENERATION_COST_POLICY.costs[input.requestedMode]
        )
          throw new EntitlementError(
            "NO_GENERATION_CREDITS",
            input.requestId,
            input.generationId,
            "reservation",
            false,
            "You need more skin credits.",
            "AVAILABLE_BALANCE_ZERO",
          );
        const reservationId = randomUUID();
        const transactionId = randomUUID();
        const expiresAt = new Date(
          Date.now() + GENERATION_COST_POLICY.reservationTtlMs,
        );
        await c.query(
          `INSERT INTO entitlement_transactions(transaction_id,user_id,credit_type,transaction_type,quantity,source,source_id,idempotency_key,generation_id,expires_at,metadata) VALUES($1,$2,$3,'RESERVATION',$4,'GENERATION_START',$5,$6,$7,$8,$9)`,
          [
            transactionId,
            input.userId,
            modeType(input.requestedMode),
            GENERATION_COST_POLICY.costs[input.requestedMode],
            input.clientRequestId,
            `reserve:${input.idempotencyKey}`,
            input.generationId,
            expiresAt,
            { policyVersion: GENERATION_COST_POLICY.version },
          ],
        );
        await c.query(
          `INSERT INTO generation_credit_reservations(reservation_id,user_id,generation_id,client_request_id,idempotency_key,requested_mode,credit_type,quantity,policy_version,reservation_transaction_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            reservationId,
            input.userId,
            input.generationId,
            input.clientRequestId,
            input.idempotencyKey,
            input.requestedMode,
            modeType(input.requestedMode),
            GENERATION_COST_POLICY.costs[input.requestedMode],
            GENERATION_COST_POLICY.version,
            transactionId,
            expiresAt,
          ],
        );
        await c.query(
          "INSERT INTO generation_request_results(generation_id,user_id,state) VALUES($1,$2,'IN_PROGRESS')",
          [input.generationId, input.userId],
        );
        return {
          reservationId,
          generationId: input.generationId,
          userId: input.userId,
          requestedMode: input.requestedMode,
          creditType: modeType(input.requestedMode),
          status: "ACTIVE",
          expiresAt,
          existing: false,
        };
      });
    } catch (error) {
      if (error instanceof EntitlementError) throw error;
      throw new EntitlementError(
        "CREDIT_RESERVATION_FAILED",
        input.requestId,
        input.generationId,
        "reservation",
        true,
        "We could not reserve a skin credit. Please try again.",
        "SERIALIZABLE_RESERVATION_FAILED",
      );
    }
  }

  private mapReservation(r: any, existing = false): Reservation {
    return {
      reservationId: r.reservation_id,
      generationId: r.generation_id,
      userId: r.user_id,
      requestedMode: r.requested_mode,
      creditType: r.credit_type,
      status: r.status,
      expiresAt: r.expires_at,
      existing,
    };
  }
  async getReservationByGeneration(userId: string, generationId: string) {
    const r = await pool.query(
      "SELECT * FROM generation_credit_reservations WHERE user_id=$1 AND generation_id=$2",
      [userId, generationId],
    );
    return r.rows[0] ? this.mapReservation(r.rows[0]) : null;
  }

  async getGenerationReplay(
    userId: string,
    generationId: string,
  ): Promise<GenerationReplay | null> {
    const result = await pool.query(
      "SELECT state,response,safe_error FROM generation_request_results WHERE user_id=$1 AND generation_id=$2",
      [userId, generationId],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (row.state === "COMPLETED")
      return { state: "COMPLETED", response: row.response };
    if (row.state === "FAILED")
      return { state: "FAILED", safeError: row.safe_error };
    return { state: "IN_PROGRESS" };
  }

  async completeGeneration(
    userId: string,
    generationId: string,
    response: unknown,
  ): Promise<void> {
    const result = await pool.query(
      `UPDATE generation_request_results SET state='COMPLETED',response=$3,safe_error=NULL,completed_at=now()
       WHERE user_id=$1 AND generation_id=$2 AND state='IN_PROGRESS'`,
      [userId, generationId, response],
    );
    if (result.rowCount !== 1) {
      const replay = await this.getGenerationReplay(userId, generationId);
      if (replay?.state !== "COMPLETED")
        throw new Error("generation replay completion conflict");
    }
  }

  async failGeneration(
    userId: string,
    generationId: string,
    safeError: Record<string, unknown>,
  ): Promise<void> {
    await pool.query(
      `UPDATE generation_request_results SET state='FAILED',response=NULL,safe_error=$3,completed_at=now()
       WHERE user_id=$1 AND generation_id=$2 AND state='IN_PROGRESS'`,
      [userId, generationId, safeError],
    );
  }

  private async finalize(
    userId: string,
    generationId: string,
    kind: "CAPTURE" | "RELEASE",
    reason: string,
    requestId: string,
  ): Promise<Reservation> {
    try {
      return await tx(async (c) => {
        const found = await c.query(
          "SELECT * FROM generation_credit_reservations WHERE user_id=$1 AND generation_id=$2 FOR UPDATE",
          [userId, generationId],
        );
        const r = found.rows[0];
        if (!r) throw new Error("missing");
        if (r.status !== "ACTIVE") return this.mapReservation(r, true);
        const id = randomUUID();
        await c.query(
          `INSERT INTO entitlement_transactions(transaction_id,user_id,credit_type,transaction_type,quantity,source,source_id,idempotency_key,generation_id,metadata) VALUES($1,$2,$3,$4,$5,'GENERATION_FINALIZATION',$6,$7,$6,$8)`,
          [
            id,
            userId,
            r.credit_type,
            kind,
            r.quantity,
            generationId,
            `${kind.toLowerCase()}:${r.reservation_id}`,
            { reason: reason.slice(0, 120), reservationId: r.reservation_id },
          ],
        );
        await c.query(
          "UPDATE generation_credit_reservations SET status=$1,finalization_transaction_id=$2,finalized_at=now() WHERE reservation_id=$3",
          [kind === "CAPTURE" ? "CAPTURED" : "RELEASED", id, r.reservation_id],
        );
        r.status = kind === "CAPTURE" ? "CAPTURED" : "RELEASED";
        return this.mapReservation(r);
      });
    } catch (error) {
      if (error instanceof EntitlementError) throw error;
      throw new EntitlementError(
        kind === "CAPTURE" ? "CREDIT_CAPTURE_FAILED" : "CREDIT_RELEASE_FAILED",
        requestId,
        generationId,
        "finalization",
        true,
        kind === "CAPTURE"
          ? "Your skin is safe, but we could not finish the credit yet."
          : "This try did not use a credit, but cleanup needs another try.",
        `${kind}_TRANSACTION_FAILED`,
      );
    }
  }
  captureGenerationCredit(
    userId: string,
    generationId: string,
    requestId: string,
  ) {
    return this.finalize(userId, generationId, "CAPTURE", "READY", requestId);
  }
  releaseGenerationCredit(
    userId: string,
    generationId: string,
    reason: string,
    requestId: string,
  ) {
    return this.finalize(userId, generationId, "RELEASE", reason, requestId);
  }
  async reconcileAbandonedReservations() {
    const rows = await pool.query(
      "SELECT user_id,generation_id FROM generation_credit_reservations WHERE status='ACTIVE' AND expires_at<now()",
    );
    for (const r of rows.rows) {
      await this.releaseGenerationCredit(
        r.user_id,
        r.generation_id,
        "reservation_expired",
        "reconciler",
      );
      await this.failGeneration(r.user_id, r.generation_id, {
        code: "GENERATION_EXPIRED",
        message: "This try did not use a credit.",
        stage: "reconciliation",
        retryable: true,
        diagnosticCode: "RESERVATION_EXPIRED",
        requestId: "reconciler",
        generationId: r.generation_id,
      });
    }
    return rows.rowCount ?? 0;
  }

  async getSafeEntitlementSummary(userId: string) {
    await this.ensureFreeFirstEntitlement(userId);
    const q = await pool.query(
      `SELECT transaction_type,credit_type,quantity,created_at,expires_at,status FROM entitlement_transactions WHERE user_id=$1 AND status='POSTED' ORDER BY created_at DESC`,
      [userId],
    );
    const active = await pool.query(
      "SELECT requested_mode,quantity FROM generation_credit_reservations WHERE user_id=$1 AND status='ACTIVE' AND expires_at>now()",
      [userId],
    );
    const now = new Date();
    const grant = q.rows
      .filter(
        (r) =>
          [
            "FREE_FIRST_SKIN",
            "PURCHASE",
            "PROMOTION",
            "ADMIN_GRANT",
            "REFUND",
            "SUPPORT_ADJUSTMENT",
          ].includes(r.transaction_type) &&
          (!r.expires_at || new Date(r.expires_at) > now),
      )
      .reduce((n, r) => n + r.quantity, 0);
    const captured = q.rows
      .filter((r) => r.transaction_type === "CAPTURE")
      .reduce((n, r) => n + r.quantity, 0);
    const removed = q.rows
      .filter((r) =>
        ["EXPIRATION", "CHARGEBACK_REVERSAL"].includes(r.transaction_type),
      )
      .reduce((n, r) => n + r.quantity, 0);
    const reserved = active.rows.reduce((n, r) => n + r.quantity, 0);
    const available = Math.max(0, grant - captured - removed - reserved);
    return {
      freeFirst: q.rows.some((r) => r.transaction_type === "FREE_FIRST_SKIN")
        ? captured > 0
          ? "consumed"
          : available > 0
            ? "available"
            : "reserved"
        : "unavailable",
      availableGenerationCredits: { "2D": available, "3D": available },
      currentlyReserved: reserved,
      canGenerate: {
        "2D": available >= GENERATION_COST_POLICY.costs["2D"],
        "3D": available >= GENERATION_COST_POLICY.costs["3D"],
      },
      recentActivity: q.rows
        .filter((r) =>
          [
            "FREE_FIRST_SKIN",
            "PROMOTION",
            "ADMIN_GRANT",
            "RESERVATION",
            "CAPTURE",
            "RELEASE",
          ].includes(r.transaction_type),
        )
        .slice(0, 10)
        .map((r) => ({
          kind:
            r.transaction_type === "CAPTURE"
              ? "skin_used"
              : r.transaction_type === "RELEASE"
                ? "try_returned"
                : r.transaction_type === "RESERVATION"
                  ? "skin_started"
                  : "credit_added",
          mode: r.credit_type === "GENERATION_3D" ? "3D" : "2D",
          createdAt: r.created_at,
        })),
    };
  }
  getAvailableCredits(userId: string) {
    return this.getSafeEntitlementSummary(userId);
  }
  async grantAdministrativeCredits(input: {
    userId: string;
    creditType: GenerationCreditType;
    quantity: number;
    idempotencyKey: string;
    actorId: string;
    promotionCodeId?: string;
    expiresAt?: Date;
  }) {
    if (
      !Number.isSafeInteger(input.quantity) ||
      input.quantity < 1 ||
      input.quantity > 100 ||
      !safeKey(input.idempotencyKey)
    )
      throw new Error("invalid grant");
    await pool.query(
      `INSERT INTO entitlement_transactions(user_id,credit_type,transaction_type,quantity,source,source_id,idempotency_key,promotion_code_id,expires_at,metadata) VALUES($1,$2,$3,$4,'SECURE_ADMIN',$5,$6,$7,$8,$9) ON CONFLICT(idempotency_key) DO NOTHING`,
      [
        input.userId,
        input.creditType,
        input.promotionCodeId ? "PROMOTION" : "ADMIN_GRANT",
        input.quantity,
        input.actorId,
        input.idempotencyKey,
        input.promotionCodeId ?? null,
        input.expiresAt ?? null,
        { actorId: input.actorId },
      ],
    );
  }
}
export const generationEntitlements = new GenerationEntitlementService();
