import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { canonicalHomeRouteForRole } from "@/lib/navigation";

interface RoleGuardProps {
  roles: string[];
  children: React.ReactNode;
}

/**
 * Wraps a route to ensure the authenticated user has one of the allowed roles.
 * Redirects to the user's canonical home page if the role check fails.
 * Must be used inside AuthGuard (user is guaranteed to be logged in at this point).
 */
export function RoleGuard({ roles, children }: RoleGuardProps) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !roles.includes(user.role ?? "")) {
    navigate(canonicalHomeRouteForRole(user?.role));
    return null;
  }

  return <>{children}</>;
}
