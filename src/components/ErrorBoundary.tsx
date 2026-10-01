import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

import { reportClientError } from "@/services/errorReporting";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientError("react", error, info.componentStack ?? undefined);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <section className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600">
              The error was reported. Reload the page to continue.
            </p>
            <button
              className="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload page
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
