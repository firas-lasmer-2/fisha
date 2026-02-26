/**
 * Konnect (formerly D17) payment gateway integration.
 * Docs: https://api.konnect.network/api/v2/docs
 *
 * Required env vars:
 *   KONNECT_API_KEY    — your API key (x-api-key header)
 *   KONNECT_WALLET_ID  — your receiver wallet ID
 */

const KONNECT_API_BASE = "https://api.konnect.network/api/v2";

export interface KonnectPaymentResult {
  paymentRef: string;
  redirectUrl: string;
}

export async function createKonnectPayment(
  amountMillimes: number,   // amount in millimes (1 TND = 1000 millimes)
  transactionId: string | number,
  successUrl: string,
  failureUrl: string,
): Promise<KonnectPaymentResult> {
  const apiKey = process.env.KONNECT_API_KEY;
  const walletId = process.env.KONNECT_WALLET_ID;

  if (!apiKey || !walletId) {
    throw new Error("KONNECT_API_KEY and KONNECT_WALLET_ID must be set");
  }

  const body = {
    receiverWalletId: walletId,
    token: "TND",
    amount: amountMillimes,
    type: "immediate",
    description: `Shifa session payment — ref ${transactionId}`,
    acceptedPaymentMethods: ["wallet", "bank_card", "e-DINAR"],
    lifespan: 20,
    checkoutForm: true,
    addPaymentFeesToAmount: false,
    orderId: String(transactionId),
    successUrl,
    failUrl: failureUrl,
    theme: "light",
    silentWebhook: true,
  };

  const res = await fetch(`${KONNECT_API_BASE}/payments/init-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Konnect API error ${res.status}: ${text}`);
  }

  const data = await res.json() as {
    paymentRef?: string;
    payUrl?: string;
  };

  const { paymentRef, payUrl } = data;

  if (!paymentRef || !payUrl) {
    throw new Error(`Konnect returned unexpected payload: ${JSON.stringify(data)}`);
  }

  return { paymentRef, redirectUrl: payUrl };
}
