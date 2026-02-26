/**
 * Google OAuth2 + Calendar API integration for Shifa.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID       — OAuth2 client id
 *   GOOGLE_CLIENT_SECRET   — OAuth2 client secret
 *   GOOGLE_REDIRECT_URI    — must match one of the authorised redirect URIs
 *                            e.g. https://yourdomain.com/api/doctor/google/callback
 *   TOKEN_ENCRYPTION_KEY   — 64 hex chars (32 bytes) for AES-256-GCM
 */

import crypto from "crypto";

// ─── Encryption helpers ───────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivHex, tagHex, encHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

// ─── OAuth2 helpers ───────────────────────────────────────────────────────────

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
].join(" ");

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI must be set");
  }
  return { clientId, clientSecret, redirectUri };
}

/** Generate the Google OAuth consent URL. `state` is the therapist user ID. */
export function generateGoogleAuthUrl(therapistId: string): string {
  const { clientId, redirectUri } = getOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",          // force refresh_token to always be issued
    state: therapistId,
  });
  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/** Exchange authorization code for access + refresh tokens. */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!data.access_token || !data.refresh_token) {
    throw new Error("Google did not return refresh_token. Ensure prompt=consent and access_type=offline.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/** Refresh an expired access token using the stored refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const { clientId, clientSecret } = getOAuthConfig();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/** Revoke a token (access or refresh) with Google. Best-effort — does not throw. */
export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" });
  } catch {
    // best-effort
  }
}

// ─── Calendar / Meet event creation ──────────────────────────────────────────

export interface CreateMeetEventOptions {
  title: string;
  description?: string;
  startIso: string;       // ISO 8601
  durationMinutes: number;
  attendeeEmails?: string[];
  timeZone?: string;
}

export interface MeetEventResult {
  eventId: string;
  meetLink: string;
  htmlLink: string;       // link to Google Calendar event
}

/**
 * Create a Google Calendar event with conferencing (Meet link).
 * `accessToken` must be valid (not expired).
 */
export async function createCalendarEvent(
  accessToken: string,
  opts: CreateMeetEventOptions,
): Promise<MeetEventResult> {
  const start = new Date(opts.startIso);
  const end = new Date(start.getTime() + opts.durationMinutes * 60_000);
  const tz = opts.timeZone ?? "Africa/Tunis";

  const body = {
    summary: opts.title,
    description: opts.description ?? "",
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
    attendees: (opts.attendeeEmails ?? []).map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar API error (${res.status}): ${text}`);
  }

  const data = await res.json() as {
    id: string;
    htmlLink: string;
    conferenceData?: {
      entryPoints?: { entryPointType: string; uri: string }[];
    };
  };

  const meetEntry = data.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === "video",
  );

  if (!meetEntry?.uri) {
    throw new Error("Google Calendar did not return a Meet link");
  }

  return {
    eventId: data.id,
    meetLink: meetEntry.uri,
    htmlLink: data.htmlLink,
  };
}

// ─── Check if Google integration is available ────────────────────────────────

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI &&
    process.env.TOKEN_ENCRYPTION_KEY,
  );
}
