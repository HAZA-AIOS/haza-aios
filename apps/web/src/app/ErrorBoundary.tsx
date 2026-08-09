import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("HAZA AIOS application error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center p-6">
          <section
            className="max-w-md text-center"
            role="alert"
            aria-live="assertive"
          >
            <h1 className="text-2xl font-bold">
              Something went wrong
            </h1>

            <p className="mt-2 text-muted-foreground">
              Please refresh the application and try again.
            </p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}