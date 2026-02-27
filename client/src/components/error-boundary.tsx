import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-background"
          dir="rtl"
        >
          <div className="text-5xl">⚠️</div>
          <h1 className="text-2xl font-semibold text-foreground">
            حدث خطأ غير متوقع
          </h1>
          <p className="text-muted-foreground max-w-sm">
            نعتذر عن هذا الخطأ. يرجى تحديث الصفحة أو العودة لاحقاً.
          </p>
          <button
            className="mt-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            onClick={() => window.location.reload()}
          >
            تحديث الصفحة
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
