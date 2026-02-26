/**
 * Flouci payment gateway integration.
 * Docs: https://developers.flouci.com/api
 *
 * Required env vars:
 *   FLOUCI_APP_TOKEN   — your application token (public)
 *   FLOUCI_APP_SECRET  — your application secret (private, for webhook verification)
 */

const FLOUCI_API_BASE = "https://developers.flouci.com/api";

export interface FlouciPaymentResult {
  paymentId: string;
  redirectUrl: string;
}

export async function createFlouciPayment(
  amountMillimes: number,   // amount in millimes (1 TND = 1000 millimes)
  transactionId: string | number,
  successUrl: string,
  failUrl: string,
): Promise<FlouciPaymentResult> {
  const appToken = process.env.FLOUCI_APP_TOKEN;
  const appSecret = process.env.FLOUCI_APP_SECRET;

  if (!appToken || !appSecret) {
    throw new Error("FLOUCI_APP_TOKEN and FLOUCI_APP_SECRET must be set");
  }

  const body = {
    app_token: appToken,
    app_secret: appSecret,
    amount: amountMillimes,
    accept_card: true,
    session_timeout_secs: 1200,
    success_link: successUrl,
    fail_link: failUrl,
    developer_tracking_id: String(transactionId),
  };

  const res = await fetch(`${FLOUCI_API_BASE}/generate_payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Flouci API error ${res.status}: ${text}`);
  }

  const data = await res.json() as {
    result?: { link?: string; payment_id?: string };
    Success?: boolean;
  };

  const link = data?.result?.link;
  const paymentId = data?.result?.payment_id;

  if (!link || !paymentId) {
    throw new Error(`Flouci returned unexpected payload: ${JSON.stringify(data)}`);
  }

  return { paymentId, redirectUrl: link };
}
