import type { JourneyRole, NavigationResolution, User } from "@shared/schema";

type AuthUserLike = Pick<User, "role" | "onboardingCompleted">;
type AppRole = JourneyRole | (string & {});

const CANONICAL_HOME_BY_ROLE: Record<string, string> = {
  visitor: "/support",
  client: "/dashboard",
  therapist: "/therapist-dashboard",
  listener: "/listener/dashboard",
  moderator: "/admin/listeners",
  admin: "/admin/dashboard",
};

export function canonicalHomeRouteForRole(role: AppRole | null | undefined): string {
  if (!role) return CANONICAL_HOME_BY_ROLE.client;
  return CANONICAL_HOME_BY_ROLE[role] || CANONICAL_HOME_BY_ROLE.client;
}

export function canonicalPublicStartRoute(): string {
  return CANONICAL_HOME_BY_ROLE.visitor;
}

export function shouldShowWelcomeContinuation(user: AuthUserLike | null | undefined): boolean {
  if (typeof window === "undefined" || !user) return false;
  return user.role === "client"
    && Boolean(user.onboardingCompleted)
    && localStorage.getItem("shifa-show-welcome") === "1";
}

export function getStoredWelcomePath(): "peer" | "therapist" | "wellness" | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem("shifa-welcome-path");
  if (value === "peer" || value === "therapist" || value === "wellness") {
    return value;
  }
  return null;
}

export function clearStoredWelcomeContinuation() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("shifa-show-welcome");
}

export function postAuthRouteForUser(user: AuthUserLike | null | undefined): string {
  if (!user) return canonicalHomeRouteForRole("client");
  if ((user.role === "client" || user.role === "listener") && !user.onboardingCompleted) {
    return "/onboarding";
  }
  if (shouldShowWelcomeContinuation(user)) {
    return "/welcome";
  }
  return canonicalHomeRouteForRole(user.role);
}

export function normalizeNavigationPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  const [pathname] = trimmed.split("?");
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export async function fetchNavigationResolution(
  path: string,
  role?: AppRole | null,
): Promise<NavigationResolution> {
  const params = new URLSearchParams({ path: normalizeNavigationPath(path) });
  if (role) {
    params.set("role", role);
  }

  const response = await fetch(`/api/navigation/resolve?${params.toString()}`);
  const payload = await response.json();
  if (!response.ok && response.status !== 404) {
    throw new Error(payload?.message || "Failed to resolve navigation target");
  }
  return payload;
}
