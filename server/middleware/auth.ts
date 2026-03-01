/**
 * Authentication and role-based authorization middleware.
 * Extracted from server/routes.ts to be importable by domain route modules.
 */

import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../supabase";
import { getCachedProfile } from "../auth-cache";

const PLATFORM_ROLES = ["client", "therapist", "listener", "moderator", "admin"] as const;
type PlatformRole = (typeof PLATFORM_ROLES)[number];

function normalizePlatformRole(value: unknown): PlatformRole {
  const role = String(value || "").trim().toLowerCase();
  if ((PLATFORM_ROLES as readonly string[]).includes(role)) return role as PlatformRole;
  return "client";
}

export async function extractUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return { id: user.id, email: user.email };
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  extractUser(req)
    .then((user) => {
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      (req as any).user = user;
      next();
    })
    .catch(() => res.status(401).json({ message: "Unauthorized" }));
}

export function requireRoles(roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authUser = (req as any).user as { id: string } | undefined;
    if (!authUser?.id) return res.status(401).json({ message: "Unauthorized" });

    const profile = await getCachedProfile(authUser.id);
    if (!profile) return res.status(403).json({ message: "Forbidden" });

    const userRole = normalizePlatformRole(profile.role);
    const allowedRoles = roles
      .map((r) => String(r || "").trim())
      .flatMap((r) => {
        if (["therapist", "doctor", "graduated_doctor", "premium_doctor"].includes(r)) return ["therapist" as PlatformRole];
        if ((PLATFORM_ROLES as readonly string[]).includes(r)) return [r as PlatformRole];
        return [];
      });

    if (allowedRoles.length === 0 || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    (req as any).profile = profile;
    next();
  };
}
