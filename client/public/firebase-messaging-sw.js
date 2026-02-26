// Firebase Messaging Service Worker
// Config is written to CacheStorage by push.ts before getToken() is called,
// because service workers cannot access import.meta.env.

const CACHE_KEY = "shifa-firebase-config";

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

async function getConfig() {
  const cache = await caches.open(CACHE_KEY);
  const res = await cache.match("config");
  if (!res) return null;
  return res.json();
}

async function init() {
  const config = await getConfig();
  if (!config) return;

  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const { title, body, icon } = payload.notification || {};
    self.registration.showNotification(title || "شفاء", {
      body: body || "",
      icon: icon || "/favicon.ico",
    });
  });
}

init();
