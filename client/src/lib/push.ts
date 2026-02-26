import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { apiRequest } from "@/lib/queryClient";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function hasFirebaseConfig(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId,
  );
}

const SW_CACHE_KEY = "shifa-firebase-config";
const SW_PATH = "/firebase-messaging-sw.js";

async function writeConfigToCache(): Promise<void> {
  try {
    const cache = await caches.open(SW_CACHE_KEY);
    const response = new Response(JSON.stringify(firebaseConfig), {
      headers: { "Content-Type": "application/json" },
    });
    await cache.put("config", response);
  } catch {
    // Non-fatal — SW will fall back to no-op if config missing
  }
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!("serviceWorker" in navigator)) return undefined;
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH);
    await navigator.serviceWorker.ready;
    return reg;
  } catch {
    return undefined;
  }
}

export async function registerPushNotifications(): Promise<void> {
  if (!hasFirebaseConfig()) return;
  if (!("Notification" in window)) return;
  if (!(await isSupported())) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  // Write config to cache so the service worker can read it
  await writeConfigToCache();

  const serviceWorkerRegistration = await registerServiceWorker();

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration,
  });

  if (!token) return;

  await apiRequest("POST", "/api/notifications/register", {
    token,
    deviceType: "web",
  });
}

