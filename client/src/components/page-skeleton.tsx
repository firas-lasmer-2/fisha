import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";

interface PageSkeletonProps {
  variant: "list" | "grid" | "detail" | "dashboard";
  /** Number of items for list/grid variants. Defaults to 3 for list, 6 for grid. */
  count?: number;
}

/**
 * Standardized loading skeleton layouts.
 * Use instead of ad-hoc Skeleton arrangements to maintain consistent loading UX.
 */
export function PageSkeleton({ variant, count }: PageSkeletonProps) {
  const { t } = useI18n();
  const loadingLabel = t("a11y.loading") === "a11y.loading" ? "Loading..." : t("a11y.loading");

  if (variant === "list") {
    const n = count ?? 3;
    return (
      <div className="space-y-4" aria-busy="true" aria-label={loadingLabel}>
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-4 rounded-xl border bg-card">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "grid") {
    const n = count ?? 6;
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label={loadingLabel}>
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="space-y-6" aria-busy="true" aria-label={loadingLabel}>
        <div className="flex items-start gap-4">
          <Skeleton className="h-20 w-20 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    );
  }

  // dashboard
  return (
    <div className="space-y-6" aria-busy="true" aria-label={loadingLabel}>
      {/* Hero banner */}
      <Skeleton className="h-32 w-full rounded-2xl" />
      {/* Stat row */}
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      {/* Chart area */}
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
