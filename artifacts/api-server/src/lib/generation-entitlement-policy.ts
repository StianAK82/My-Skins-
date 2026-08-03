export type GenerationMode = "2D" | "3D";
export type GenerationCreditType = "GENERATION_2D" | "GENERATION_3D";
export const GENERATION_COST_POLICY = Object.freeze({ version: "free-first-v1", costs: { "2D": 1, "3D": 1 } as const, reservationTtlMs: 15 * 60_000 });
export function deriveGenerationBalance(rows: Array<{ transactionType:string; quantity:number; expiresAt?:Date|null; status?:string }>, activeReserved=0, now=new Date()) {
  const posted=rows.filter(r=>r.status!=="REVERSED");
  const granted=posted.filter(r=>["FREE_FIRST_SKIN","PURCHASE","PROMOTION","ADMIN_GRANT","REFUND","SUPPORT_ADJUSTMENT"].includes(r.transactionType) && (!r.expiresAt || r.expiresAt>now)).reduce((n,r)=>n+r.quantity,0);
  const captured=posted.filter(r=>r.transactionType==="CAPTURE").reduce((n,r)=>n+r.quantity,0);
  const released=posted.filter(r=>r.transactionType==="RELEASE").reduce((n,r)=>n+r.quantity,0);
  const expired=posted.filter(r=>r.transactionType==="EXPIRATION" || (r.expiresAt != null && r.expiresAt<=now && ["FREE_FIRST_SKIN","PURCHASE","PROMOTION","ADMIN_GRANT"].includes(r.transactionType))).reduce((n,r)=>n+r.quantity,0);
  const reversed=posted.filter(r=>r.transactionType==="CHARGEBACK_REVERSAL").reduce((n,r)=>n+r.quantity,0);
  return { totalGranted:granted, currentlyReserved:activeReserved, captured, released, expired, refundedOrReversed:reversed, currentlyAvailable:Math.max(0,granted-captured-activeReserved-reversed) };
}
