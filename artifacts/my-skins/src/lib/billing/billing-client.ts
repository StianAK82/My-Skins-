export async function createCheckoutSession() {
  const response = await fetch("/api/payments/create-checkout-session", {
    method: "POST",
    credentials: "include",
  });
  return response.json();
}
