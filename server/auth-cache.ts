/**
 * Server-side profile cache for auth middleware.
 * Extracted from server/routes.ts to be shared across route modules.
 */

import { storage } from "./storage";
import type { User } from "@shared/schema";

export const profileCache = new Map<string, { profile: User; ts: number }>();
export const PROFILE_CACHE_TTL_MS = 60_000;

export function invalidateProfileCache(userId: string) {
  profileCache.delete(userId);
}

export async function getCachedProfile(userId: string): Promise<User | undefined> {
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.ts < PROFILE_CACHE_TTL_MS) return cached.profile;
  const profile = await storage.getUser(userId);
  if (profile) profileCache.set(userId, { profile, ts: Date.now() });
  return profile ?? undefined;
}
