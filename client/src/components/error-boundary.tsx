import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// ── Inner class that catches errors ──────────────────────────────────────────

interface CoreProps {
  children: ReactNode;
  fallback: (error: Error, reset: () => void) => ReactNode;
}

interface CoreState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryCore extends Component<CoreProps, CoreState> {
  state: CoreState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): CoreState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}

// ── Fallback UI (functional — can use hooks) ──────────────────────────────────

function ErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const { t, isRTL } = useI18n();
  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="min-h-screen flex flex-col items-center justify-center gap-5 p-8 text-center bg-background"
    >
      <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
      </div>

      <div className="space-y-2 max-w-sm">
        <h1 className="text-xl font-semibold text-foreground">
          {tr("error.unexpected", "Something went wrong")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {tr("error.unexpected_desc", "An unexpected error occurred. Please reload the page or go back to the home screen.")}
        </p>
        {process.env.NODE_ENV === "development" && (
          <p className="text-xs text-destructive font-mono bg-destructive/5 rounded p-2 text-start mt-2 break-all">
            {error.message}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 mt-2">
        <a
          href="/"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-input bg-background text-sm font-medium hover:bg-muted transition-colors"
        >
          <Home className="h-4 w-4" aria-hidden />
          {tr("error.go_home", "Go to home")}
        </a>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          onClick={onReset}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          {tr("error.reload", "Reload")}
        </button>
      </div>
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundaryCore
      fallback={(error, reset) => <ErrorFallback error={error} onReset={reset} />}
    >
      {children}
    </ErrorBoundaryCore>
  );
}
