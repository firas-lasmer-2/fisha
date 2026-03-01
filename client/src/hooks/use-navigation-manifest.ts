import { useQuery } from "@tanstack/react-query";
import type { FeatureSurface, JourneyRole, NavigationManifestResponse } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

type UseNavigationManifestOptions = {
  surface: FeatureSurface;
  routePath?: string;
  role?: JourneyRole;
  enabled?: boolean;
};

function buildManifestUrl(surface: FeatureSurface, role: JourneyRole, routePath?: string) {
  const params = new URLSearchParams({ surface, role });
  if (routePath) {
    params.set("routePath", routePath);
  }
  return `/api/navigation/manifest?${params.toString()}`;
}

export function useNavigationManifest({
  surface,
  routePath,
  role,
  enabled = true,
}: UseNavigationManifestOptions) {
  const { user } = useAuth();
  const effectiveRole = role || ((user?.role as JourneyRole | undefined) ?? "visitor");
  const queryKey = buildManifestUrl(surface, effectiveRole, routePath);

  const query = useQuery<NavigationManifestResponse>({
    queryKey: [queryKey],
    enabled,
  });

  return {
    ...query,
    role: effectiveRole,
    primaryPaths: query.data?.primaryPaths || [],
    secondaryPaths: query.data?.secondaryPaths || [],
  };
}
