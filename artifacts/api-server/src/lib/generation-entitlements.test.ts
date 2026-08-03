import assert from "node:assert/strict";
import test from "node:test";
import { deriveGenerationBalance, GENERATION_COST_POLICY } from "./generation-entitlement-policy";

test("versioned policy charges one for either preview mode", () => {
  assert.match(GENERATION_COST_POLICY.version, /^free-first-v\d+$/);
  assert.deepEqual(GENERATION_COST_POLICY.costs, { "2D":1, "3D":1 });
});
test("derives grants, reservation, capture, release, expiry and reversal", () => {
  const future=new Date(Date.now()+10000), past=new Date(0);
  const balance=deriveGenerationBalance([
    {transactionType:"FREE_FIRST_SKIN",quantity:1},{transactionType:"ADMIN_GRANT",quantity:3},
    {transactionType:"CAPTURE",quantity:1},{transactionType:"RELEASE",quantity:1},
    {transactionType:"PROMOTION",quantity:2,expiresAt:past},{transactionType:"CHARGEBACK_REVERSAL",quantity:1},
    {transactionType:"PROMOTION",quantity:1,expiresAt:future,status:"REVERSED"},
  ],1);
  assert.deepEqual(balance,{totalGranted:4,currentlyReserved:1,captured:1,released:1,expired:2,refundedOrReversed:1,currentlyAvailable:1});
});
test("balance never reports negative availability",()=>assert.equal(deriveGenerationBalance([{transactionType:"FREE_FIRST_SKIN",quantity:1},{transactionType:"CAPTURE",quantity:2}]).currentlyAvailable,0));
