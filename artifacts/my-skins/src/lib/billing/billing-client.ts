import { getBillingState as getBillingStateApi } from "@workspace/api-client-react";

export async function createCheckoutSession(plan: "pro" | "team" | "enterprise" = "pro") {
  const response = await fetch("/api/payments/create-checkout-session", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  return response.json();
}

export async function getBillingState() {
  return getBillingStateApi();
}
