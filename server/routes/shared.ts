/**
 * Shared route helpers extracted from server/routes.ts.
 *
 * These were previously defined as inner closures inside `registerRoutes`.
 * Extracting them here lets domain route modules import them without circular deps.
 */

import { supabaseAdmin } from "../supabase";
import { storage } from "../storage";
import { sendPushToTokens } from "../notifications";
import { mapProfile, type User } from "@shared/schema";

// ---- Platform role normalisation ----

export const PLATFORM_ROLES = ["client", "therapist", "listener", "moderator", "admin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];
export type JourneyRole = PlatformRole | "visitor";

export function normalizePlatformRole(value: unknown): PlatformRole {
  const role = String(value || "").trim().toLowerCase();
  if ((PLATFORM_ROLES as readonly string[]).includes(role)) return role as PlatformRole;
  return "client";
}

export const normalizeRole = normalizePlatformRole;

// ---- Profile helpers ----

export const fallbackProfile = (authUser: { id: string; email?: string }, role = "client"): User => ({
  role: normalizePlatformRole(role),
  id: authUser.id,
  email: authUser.email || null,
  firstName: null,
  lastName: null,
  profileImageUrl: null,
  phone: null,
  publicKey: null,
  languagePreference: "ar",
  governorate: null,
  bio: null,
  isAnonymous: false,
  displayName: null,
  onboardingCompleted: false,
  createdAt: null,
  updatedAt: null,
});

export const upsertProfileSafely = async (payload: {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  phone?: string | null;
}) => {
  const nowIso = new Date().toISOString();
  const upsertPayload: Record<string, any> = {
    id: payload.id,
    email: payload.email ?? null,
    role: normalizeRole(payload.role),
    updated_at: nowIso,
    created_at: nowIso,
  };
  if (payload.firstName !== undefined) upsertPayload.first_name = payload.firstName;
  if (payload.lastName !== undefined) upsertPayload.last_name = payload.lastName;
  if (payload.phone !== undefined) upsertPayload.phone = payload.phone;

  const { data: upsertedRow, error: upsertError } = await supabaseAdmin
    .from("profiles")
    .upsert(upsertPayload, { onConflict: "id", ignoreDuplicates: false })
    .select("*")
    .single();

  if (!upsertError && upsertedRow) return upsertedRow;

  if ((upsertError as any)?.code === "23505" && String((upsertError as any)?.message || "").includes("profiles_email_key")) {
    const { data: retryRow, error: retryError } = await supabaseAdmin
      .from("profiles")
      .upsert({ ...upsertPayload, email: null }, { onConflict: "id", ignoreDuplicates: false })
      .select("*")
      .single();
    if (!retryError && retryRow) return retryRow;
  }

  if (upsertError) {
    const { data: existingRow } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", payload.id)
      .maybeSingle();
    if (existingRow) return existingRow;
  }

  throw upsertError || new Error("Profile upsert failed");
};

export const ensureProfile = async (authUser: { id: string; email?: string }): Promise<User> => {
  const existing = await storage.getUser(authUser.id);
  if (existing) return existing;

  try {
    const row = await upsertProfileSafely({ id: authUser.id, email: authUser.email || null, role: "client" });
    return mapProfile(row);
  } catch (error: any) {
    console.error("Failed to ensure profile", { userId: authUser.id, message: error?.message });
    return fallbackProfile(authUser);
  }
};

export const ensureTherapistProfile = async (userId: string): Promise<void> => {
  const user = await storage.getUser(userId);
  if (!user) return;
  if (normalizePlatformRole(user.role) !== "therapist") return;

  const existing = await storage.getTherapistProfile(userId);
  if (existing) return;

  try {
    await storage.createTherapistProfile({ userId });
  } catch {
    const recovered = await storage.getTherapistProfile(userId);
    if (recovered) return;
    throw new Error("Failed to create therapist profile");
  }
};

export const markOnboardingCompleted = async (userId: string, preferredLanguage?: string | null) => {
  const updatePayload: Record<string, any> = {
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  };
  if (preferredLanguage && ["ar", "fr"].includes(preferredLanguage)) {
    updatePayload.language_preference = preferredLanguage;
  }
  await supabaseAdmin.from("profiles").update(updatePayload).eq("id", userId);
};

export const notifyUser = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) => {
  try {
    storage.createNotification(userId, data?.type ?? "general", title, body, data).catch(() => undefined);
    const tokens = await storage.getFcmTokensByUser(userId);
    await sendPushToTokens(tokens, { title, body, data });
  } catch {
    // Ignore push failures — never block API responses
  }
};

export const listModeratorIds = async (): Promise<string[]> => {
  const { data: rows } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("role", ["moderator", "admin"]);
  return (rows || []).map((row) => String((row as any).id));
};
