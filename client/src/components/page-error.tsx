import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface PageErrorProps {
  error?: Error | null;
  resetFn?: () => void;
  /** Optional override for the error title */
  title?: string;
}

/**
 * Per-query error card with bilingual text and optional retry button.
 * Use when a React Query fetch fails and you want a user-facing error message
 * instead of throwing to the ErrorBoundary.
 *
 * Usage:
 *   const { data, isError, error, refetch } = useQuery(...)
 *   if (isError) return <PageError error={error} resetFn={refetch} />
 */
export function PageError({ error, resetFn, title }: PageErrorProps) {
  const { t } = useI18n();
  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const heading = title ?? tr("error.something_went_wrong", "Something went wrong");
  const detail = error?.message;

  return (
    <div role="alert" aria-live="assertive" className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
      <div className="mx-auto h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
      </div>
      <p className="font-semibold text-sm">{heading}</p>
      {detail && (
        <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">{detail}</p>
      )}
      {resetFn && (
        <Button size="sm" variant="outline" onClick={resetFn}>
          {tr("common.try_again", "Try again")}
        </Button>
      )}
    </div>
  );
}
