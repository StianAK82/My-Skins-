import { Router, type IRouter } from "express";
import { generationEntitlements, EntitlementError } from "../lib/generation-entitlements";

const router: IRouter = Router();
router.get("/entitlements/generation-summary", async (req, res) => {
  const requestId = String(req.id ?? "request-unknown");
  if (!req.isAuthenticated()) { res.status(401).json(new EntitlementError("AUTH_REQUIRED",requestId,undefined,"authentication",false,"Please sign in to see your skin credits.","SESSION_REQUIRED").toJSON()); return; }
  try { res.json(await generationEntitlements.getSafeEntitlementSummary(req.user.id)); }
  catch (error) { req.log.error({error},"entitlement.summary.failed"); res.status(500).json(new EntitlementError("ENTITLEMENT_CONFIGURATION_ERROR",requestId,undefined,"summary",true,"We could not check your skin credits.","SUMMARY_QUERY_FAILED").toJSON()); }
});
export default router;
