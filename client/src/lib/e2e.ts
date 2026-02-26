const KEYPAIR_PRIVATE_PREFIX = "shifa:e2e:private:";
const KEYPAIR_PUBLIC_PREFIX = "shifa:e2e:public:";

type EncryptedPayload = {
  v: 1;
  alg: "AES-GCM";
  iv: string;
  ct: string;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importPrivateKey(jwkJson: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    JSON.parse(jwkJson),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"],
  );
}

async function importPublicKeyFromSpki(spkiBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    base64ToArrayBuffer(spkiBase64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"],
  );
}

export async function ensureUserKeyPair(userId: string): Promise<{ publicKeySpki: string }> {
  const privateKeyStorageKey = `${KEYPAIR_PRIVATE_PREFIX}${userId}`;
  const publicKeyStorageKey = `${KEYPAIR_PUBLIC_PREFIX}${userId}`;
  const existingPrivate = localStorage.getItem(privateKeyStorageKey);
  const existingPublic = localStorage.getItem(publicKeyStorageKey);

  if (existingPrivate && existingPublic) {
    return { publicKeySpki: existingPublic };
  }

  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicSpki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const publicKeySpki = arrayBufferToBase64(publicSpki);

  localStorage.setItem(privateKeyStorageKey, JSON.stringify(privateJwk));
  localStorage.setItem(publicKeyStorageKey, publicKeySpki);

  return { publicKeySpki };
}

export async function generateConversationKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function wrapConversationKey(
  conversationKey: CryptoKey,
  userPublicKeySpki: string,
): Promise<string> {
  const publicKey = await importPublicKeyFromSpki(userPublicKeySpki);
  const rawKey = await crypto.subtle.exportKey("raw", conversationKey);
  const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, rawKey);
  return arrayBufferToBase64(wrapped);
}

export async function unwrapConversationKey(
  userId: string,
  wrappedConversationKey: string,
): Promise<CryptoKey> {
  const privateKeyStorageKey = `${KEYPAIR_PRIVATE_PREFIX}${userId}`;
  const privateKeyJson = localStorage.getItem(privateKeyStorageKey);
  if (!privateKeyJson) {
    throw new Error("Missing private key");
  }

  const privateKey = await importPrivateKey(privateKeyJson);
  const rawKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToArrayBuffer(wrappedConversationKey),
  );

  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"],
  );
}

export function isEncryptedPayload(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as Partial<EncryptedPayload>;
    return parsed?.alg === "AES-GCM" && parsed?.v === 1 && !!parsed?.iv && !!parsed?.ct;
  } catch {
    return false;
  }
}

export async function encryptMessageContent(content: string, conversationKey: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(content);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    conversationKey,
    plaintext,
  );

  const payload: EncryptedPayload = {
    v: 1,
    alg: "AES-GCM",
    iv: arrayBufferToBase64(iv.buffer),
    ct: arrayBufferToBase64(ciphertext),
  };

  return JSON.stringify(payload);
}

export async function decryptMessageContent(content: string, conversationKey: CryptoKey): Promise<string> {
  const payload = JSON.parse(content) as EncryptedPayload;
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToArrayBuffer(payload.iv),
    },
    conversationKey,
    base64ToArrayBuffer(payload.ct),
  );

  return new TextDecoder().decode(plaintext);
}

