type AuthUserLike = {
  role?: string | null;
  onboardingCompleted?: boolean | null;
};

export function homeRouteForRole(role: string | null | undefined): string {
  if (role === "therapist") return "/therapist-dashboard";
  if (role === "listener") return "/listener/dashboard";
  return "/workflow";
}

export function postAuthRouteForUser(user: AuthUserLike | null | undefined): string {
  if (!user) return "/workflow";
  const role = user.role;

  // Both clients and listeners go through onboarding before reaching their home
  if ((role === "client" || role === "listener") && !user.onboardingCompleted) {
    return "/onboarding";
  }

  return homeRouteForRole(role);
}
