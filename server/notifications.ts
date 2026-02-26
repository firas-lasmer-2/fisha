import admin from "firebase-admin";

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

let firebaseInitialized = false;

function parseServiceAccount(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  }
}

function getMessaging() {
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountRaw) return null;

  if (!firebaseInitialized) {
    const serviceAccount = parseServiceAccount(serviceAccountRaw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseInitialized = true;
  }

  return admin.messaging();
}

export async function sendPushToTokens(tokens: string[], payload: PushPayload): Promise<void> {
  if (tokens.length === 0) return;

  const messaging = getMessaging();
  if (!messaging) return;

  await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data,
  });
}
