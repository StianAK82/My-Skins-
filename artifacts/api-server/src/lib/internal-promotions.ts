import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import {
  genericPromotionMessage,
  hashPromotionCode,
  normalizePromotionCode,
  promotionGrantsSchema,
  resolvePromotionGrants,
  type PromotionMode,
} from "./internal-promotions-core";

type DbClient = {
  query(text: string, values?: unknown[]): Promise<any>;
  release(): void;
};
async function serializable<T>(
  work: (client: DbClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const promotionErrorCodes = [
  "PROMO_INVALID",
  "PROMO_EXPIRED",
  "PROMO_DISABLED",
  "PROMO_NOT_STARTED",
  "PROMO_ALREADY_REDEEMED",
  "PROMO_USER_LIMIT_REACHED",
  "PROMO_TOTAL_LIMIT_REACHED",
  "PROMO_NOT_ELIGIBLE",
  "PROMO_MODE_REQUIRED",
  "PROMO_MODE_NOT_ALLOWED",
  "PROMO_REDEMPTION_IN_PROGRESS",
  "PROMO_CONFIGURATION_ERROR",
  "PROMO_RATE_LIMITED",
] as const;
export type PromotionErrorCode = (typeof promotionErrorCodes)[number];
export class PromotionError extends Error {
  constructor(
    public code: PromotionErrorCode,
    public requestId: string,
    public stage: string,
    public diagnosticCode: string,
    public retryable = false,
    public redemptionId?: string,
  ) {
    super(genericPromotionMessage());
  }
  toSafeJSON() {
    return {
      code: "PROMO_INVALID",
      requestId: this.requestId,
      redemptionId: this.redemptionId,
      stage: this.stage,
      retryable: this.retryable,
      message: genericPromotionMessage(),
      diagnosticCode: this.diagnosticCode,
    };
  }
}

const keyPattern = /^[A-Za-z0-9:_-]{8,200}$/;
function pepper() {
  const value = process.env.PROMOTION_CODE_PEPPER;
  if (!value) throw new Error("PROMOTION_CODE_PEPPER missing");
  return value;
}

export class InternalPromotionService {
  async redeem(input: {
    userId: string;
    code: string;
    idempotencyKey: string;
    selectedMode?: PromotionMode;
    requestId: string;
  }) {
    if (!keyPattern.test(input.idempotencyKey))
      throw new PromotionError(
        "PROMO_INVALID",
        input.requestId,
        "validation",
        "INVALID_IDEMPOTENCY_KEY",
      );
    let hash: string;
    try {
      hash = hashPromotionCode(normalizePromotionCode(input.code), pepper());
    } catch {
      throw new PromotionError(
        "PROMO_INVALID",
        input.requestId,
        "validation",
        "CODE_NORMALIZATION_FAILED",
      );
    }
    return serializable(async (c) => {
      const replay = await c.query(
        `SELECT r.redemption_id,r.promotion_code_id,r.selected_mode,r.ledger_transaction_ids,c.normalized_code_hash
        FROM internal_promotion_redemptions r JOIN internal_promotion_campaigns c USING(promotion_code_id) WHERE r.idempotency_key=$1`,
        [input.idempotencyKey],
      );
      if (replay.rows[0]) {
        const row = replay.rows[0];
        if (
          row.normalized_code_hash !== hash ||
          row.selected_mode !== (input.selectedMode ?? null) ||
          row.promotion_code_id == null
        )
          throw new PromotionError(
            "PROMO_INVALID",
            input.requestId,
            "idempotency",
            "IDEMPOTENCY_SCOPE_MISMATCH",
          );
        const replayGrants = await c.query(
          "SELECT credit_type,quantity,expires_at FROM entitlement_transactions WHERE transaction_id=ANY($1::uuid[]) ORDER BY created_at",
          [row.ledger_transaction_ids],
        );
        return {
          redemptionId: row.redemption_id,
          ledgerTransactionIds: row.ledger_transaction_ids,
          grants: replayGrants.rows.map(
            (grant: {
              credit_type: string;
              quantity: number;
              expires_at: Date | null;
            }) => ({
              creditType: grant.credit_type,
              quantity: grant.quantity,
              expiresAt: grant.expires_at,
            }),
          ),
          existing: true,
        };
      }
      const campaignResult = await c.query(
        "SELECT * FROM internal_promotion_campaigns WHERE normalized_code_hash=$1 FOR UPDATE",
        [hash],
      );
      const campaign = campaignResult.rows[0];
      if (!campaign)
        throw new PromotionError(
          "PROMO_INVALID",
          input.requestId,
          "lookup",
          "CAMPAIGN_NOT_FOUND",
        );
      const now = new Date();
      if (!campaign.active || campaign.disabled_at)
        throw new PromotionError(
          "PROMO_DISABLED",
          input.requestId,
          "eligibility",
          "CAMPAIGN_DISABLED",
        );
      if (campaign.starts_at && now < campaign.starts_at)
        throw new PromotionError(
          "PROMO_NOT_STARTED",
          input.requestId,
          "eligibility",
          "CAMPAIGN_NOT_STARTED",
        );
      if (campaign.expires_at && now >= campaign.expires_at)
        throw new PromotionError(
          "PROMO_EXPIRED",
          input.requestId,
          "eligibility",
          "CAMPAIGN_EXPIRED",
        );
      if (
        campaign.maximum_total_redemptions != null &&
        campaign.current_redemption_projection >=
          campaign.maximum_total_redemptions
      )
        throw new PromotionError(
          "PROMO_TOTAL_LIMIT_REACHED",
          input.requestId,
          "limits",
          "TOTAL_LIMIT_REACHED",
        );
      const user = await c.query("SELECT email FROM users WHERE id=$1", [
        input.userId,
      ]);
      const email = user.rows[0]?.email as string | undefined;
      if (
        campaign.allowed_user_ids?.length &&
        !campaign.allowed_user_ids.includes(input.userId)
      )
        throw new PromotionError(
          "PROMO_NOT_ELIGIBLE",
          input.requestId,
          "eligibility",
          "USER_NOT_ALLOWED",
        );
      if (campaign.allowed_email_domains?.length) {
        const domain = email?.split("@").pop()?.toLowerCase();
        if (
          !domain ||
          !campaign.allowed_email_domains
            .map((d: string) => d.toLowerCase())
            .includes(domain)
        )
          throw new PromotionError(
            "PROMO_NOT_ELIGIBLE",
            input.requestId,
            "eligibility",
            "EMAIL_DOMAIN_NOT_ALLOWED",
          );
      }
      if (campaign.allowed_asset_mode === "EITHER" && !input.selectedMode)
        throw new PromotionError(
          "PROMO_MODE_REQUIRED",
          input.requestId,
          "mode",
          "SELECTED_MODE_REQUIRED",
        );
      if (
        campaign.allowed_asset_mode !== "EITHER" &&
        input.selectedMode &&
        input.selectedMode !== campaign.allowed_asset_mode
      )
        throw new PromotionError(
          "PROMO_MODE_NOT_ALLOWED",
          input.requestId,
          "mode",
          "SELECTED_MODE_NOT_ALLOWED",
        );
      const selectedMode = (input.selectedMode ??
        campaign.allowed_asset_mode) as PromotionMode;
      const count = await c.query(
        "SELECT count(*)::int count FROM internal_promotion_redemptions WHERE promotion_code_id=$1 AND user_id=$2 AND status='COMPLETED'",
        [campaign.promotion_code_id, input.userId],
      );
      if (count.rows[0].count >= campaign.maximum_redemptions_per_user)
        throw new PromotionError(
          "PROMO_USER_LIMIT_REACHED",
          input.requestId,
          "limits",
          "USER_LIMIT_REACHED",
        );
      let grants;
      try {
        grants = resolvePromotionGrants(
          promotionGrantsSchema.parse(campaign.granted_credits),
          selectedMode,
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes("MODE"))
          throw new PromotionError(
            "PROMO_MODE_REQUIRED",
            input.requestId,
            "mode",
            "SELECTED_MODE_REQUIRED",
          );
        throw new PromotionError(
          "PROMO_CONFIGURATION_ERROR",
          input.requestId,
          "configuration",
          "INVALID_GRANT_CONFIGURATION",
        );
      }
      const redemptionId = randomUUID();
      const transactionIds: string[] = [];
      for (const [index, grant] of grants.entries()) {
        const id = randomUUID();
        transactionIds.push(id);
        const expiresAt =
          grant.expiresAt ??
          campaign.credit_expires_at ??
          (campaign.credit_lifetime_seconds
            ? new Date(now.getTime() + campaign.credit_lifetime_seconds * 1000)
            : null);
        await c.query(
          `INSERT INTO entitlement_transactions(transaction_id,user_id,credit_type,transaction_type,quantity,source,source_id,idempotency_key,promotion_code_id,expires_at,metadata)
        VALUES($1,$2,$3,'PROMOTION',$4,'INTERNAL_PROMOTION',$5,$6,$7,$8,$9)`,
          [
            id,
            input.userId,
            grant.creditType,
            grant.quantity,
            redemptionId,
            `promotion:${redemptionId}:${index}`,
            campaign.promotion_code_id,
            expiresAt,
            { campaignName: campaign.campaign_name, selectedMode },
          ],
        );
      }
      await c.query(
        `INSERT INTO internal_promotion_redemptions(redemption_id,promotion_code_id,user_id,idempotency_key,selected_mode,ledger_transaction_ids,request_id) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          redemptionId,
          campaign.promotion_code_id,
          input.userId,
          input.idempotencyKey,
          selectedMode,
          transactionIds,
          input.requestId,
        ],
      );
      await c.query(
        "UPDATE internal_promotion_campaigns SET current_redemption_projection=current_redemption_projection+1 WHERE promotion_code_id=$1",
        [campaign.promotion_code_id],
      );
      return {
        redemptionId,
        ledgerTransactionIds: transactionIds,
        grants: grants.map((g) => ({
          creditType: g.creditType,
          quantity: g.quantity,
          expiresAt: g.expiresAt,
        })),
        existing: false,
      };
    });
  }

  async recent(userId: string) {
    const result = await pool.query(
      `SELECT redemption_id,redeemed_at,selected_mode,status FROM internal_promotion_redemptions WHERE user_id=$1 ORDER BY redeemed_at DESC LIMIT 20`,
      [userId],
    );
    return result.rows.map((r) => ({
      redemptionId: r.redemption_id,
      redeemedAt: r.redeemed_at,
      selectedMode: r.selected_mode,
      status: r.status,
    }));
  }
  async createCampaign(
    adminId: string,
    input: {
      code: string;
      campaignName: string;
      description?: string;
      active?: boolean;
      startsAt?: Date;
      expiresAt?: Date;
      maximumTotalRedemptions?: number;
      maximumRedemptionsPerUser?: number;
      allowedAssetMode: "TWO_D" | "THREE_D" | "EITHER";
      allowedUserIds?: string[];
      allowedEmailDomains?: string[];
      grantedCredits: unknown;
      creditExpiresAt?: Date;
      creditLifetimeSeconds?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    const normalized = normalizePromotionCode(input.code);
    const hash = hashPromotionCode(normalized, pepper());
    const grants = promotionGrantsSchema.parse(input.grantedCredits);
    const result = await pool.query(
      `INSERT INTO internal_promotion_campaigns(normalized_code_hash,masked_display_label,campaign_name,description,active,starts_at,expires_at,maximum_total_redemptions,maximum_redemptions_per_user,allowed_asset_mode,allowed_user_ids,allowed_email_domains,granted_credits,credit_expires_at,credit_lifetime_seconds,created_by_user_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING promotion_code_id,campaign_name,active,masked_display_label`,
      [
        hash,
        `${normalized.slice(0, 2)}***${normalized.slice(-2)}`,
        input.campaignName,
        input.description ?? "",
        input.active ?? false,
        input.startsAt ?? null,
        input.expiresAt ?? null,
        input.maximumTotalRedemptions ?? null,
        input.maximumRedemptionsPerUser ?? 1,
        input.allowedAssetMode,
        input.allowedUserIds ?? null,
        input.allowedEmailDomains ?? null,
        grants,
        input.creditExpiresAt ?? null,
        input.creditLifetimeSeconds ?? null,
        adminId,
        input.metadata ?? {},
      ],
    );
    return result.rows[0];
  }
  async setActive(promotionCodeId: string, active: boolean) {
    const result = await pool.query(
      "UPDATE internal_promotion_campaigns SET active=$2,disabled_at=CASE WHEN $2 THEN NULL ELSE now() END WHERE promotion_code_id=$1 RETURNING promotion_code_id,campaign_name,active,disabled_at",
      [promotionCodeId, active],
    );
    return result.rows[0] ?? null;
  }
  async metrics(promotionCodeId: string) {
    const result = await pool.query(
      `SELECT c.promotion_code_id,c.campaign_name,c.active,c.current_redemption_projection,count(t.transaction_id)::int granted_transactions,COALESCE(sum(t.quantity),0)::int granted_units FROM internal_promotion_campaigns c LEFT JOIN entitlement_transactions t ON t.promotion_code_id=c.promotion_code_id AND t.transaction_type='PROMOTION' WHERE c.promotion_code_id=$1 GROUP BY c.promotion_code_id`,
      [promotionCodeId],
    );
    return result.rows[0] ?? null;
  }
  async reverseRedemption(
    adminId: string,
    redemptionId: string,
    requestId: string,
  ) {
    return serializable(async (c) => {
      const redemption = await c.query(
        "SELECT * FROM internal_promotion_redemptions WHERE redemption_id=$1 FOR UPDATE",
        [redemptionId],
      );
      const row = redemption.rows[0];
      if (!row || row.status !== "COMPLETED")
        throw new Error("redemption cannot be reversed");
      for (const [index, originalId] of row.ledger_transaction_ids.entries()) {
        const original = await c.query(
          "SELECT * FROM entitlement_transactions WHERE transaction_id=$1",
          [originalId],
        );
        const tx = original.rows[0];
        await c.query(
          `INSERT INTO entitlement_transactions(user_id,credit_type,transaction_type,quantity,source,source_id,idempotency_key,promotion_code_id,reversed_by_transaction_id,metadata) VALUES($1,$2,'CHARGEBACK_REVERSAL',$3,'PROMOTION_REVERSAL',$4,$5,$6,$7,$8)`,
          [
            row.user_id,
            tx.credit_type,
            tx.quantity,
            redemptionId,
            `promotion-reversal:${redemptionId}:${index}`,
            row.promotion_code_id,
            originalId,
            { adminId, requestId },
          ],
        );
      }
      await c.query(
        "UPDATE internal_promotion_redemptions SET status='REVERSED',reversed_at=now() WHERE redemption_id=$1",
        [redemptionId],
      );
      return { redemptionId, status: "REVERSED" };
    });
  }
}
export const internalPromotions = new InternalPromotionService();
