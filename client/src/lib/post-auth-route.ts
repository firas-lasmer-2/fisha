type AuthUserLike = {
  role?: string | null;
  onboardingCompleted?: boolean | null;
};

export function homeRouteForRole(role: string | null | undefined): string {
  if (role === "listener") return "/listener/dashboard";
  if (role === "therapist") return "/therapist-dashboard";
  if (role === "moderator" || role === "admin") return "/admin/listeners";
  return "/dashboard";
}

export function postAuthRouteForUser(user: AuthUserLike | null | undefined): string {
  if (!user) return "/dashboard";
  const role = user.role;

  if (role === "client" && !user.onboardingCompleted) {
    return "/onboarding";
  }

  return homeRouteForRole(role);
}
