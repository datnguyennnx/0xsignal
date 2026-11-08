import { Component, type ReactNode, type ErrorInfo } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export { PageLoader } from "./page-loader";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  resetKey?: unknown;
}

interface State {
  hasError: boolean;
  prevResetKey: unknown;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, prevResetKey: props.resetKey };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (state.prevResetKey !== props.resetKey) {
      return { hasError: false, prevResetKey: props.resetKey };
    }
    return null;
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined && this.props.fallback !== null) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[clamp(20rem,50dvh,40rem)] px-4 text-center">
          <div className="flex flex-col items-center gap-4 max-w-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-icon-lg text-destructive" />
            </div>

            <div className="space-y-2">
              <h3 className="type-title font-semibold">Unable to load this view</h3>
              <p className="type-body text-muted-foreground">
                Reload the page, or use Try again to retry this section.
              </p>
            </div>

            <Button variant="outline" onClick={this.handleReset} className="gap-2">
              <RefreshCw className="size-icon" />
              Try again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
