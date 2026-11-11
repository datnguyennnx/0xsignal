import { Component, type ReactNode, type ErrorInfo } from "react";
import { Button } from "@/components/ui/button";
import { StateArt } from "@/components/state-art";
import { pickErrorQuip } from "@/lib/error-quips";
import { RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  resetKey?: unknown;
}

interface State {
  hasError: boolean;
  prevResetKey: unknown;
  quip: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, prevResetKey: props.resetKey, quip: pickErrorQuip() };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true, quip: pickErrorQuip() };
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
        <div className="flex flex-1 min-h-full flex-col items-center justify-center px-4 py-10 text-center">
          <div className="flex flex-col items-center gap-4 max-w-md">
            <StateArt size="lg" />

            <div className="space-y-2">
              <h3 className="type-title font-semibold">Something went wrong</h3>
              <p className="type-body text-muted-foreground">{this.state.quip}</p>
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
