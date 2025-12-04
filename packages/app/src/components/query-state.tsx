// Query State Components - shared loading/error UI

interface LoadingProps {
  message?: string;
  context?: string;
}

export function QueryLoading({ message = "Loading", context }: LoadingProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-foreground/20 border-t-foreground mx-auto" />
        <div>
          <p className="text-sm text-foreground">{message}</p>
          {context && <p className="text-xs text-muted-foreground mt-1">{context}</p>}
        </div>
      </div>
    </div>
  );
}

interface ErrorProps {
  title: string;
  message?: string;
  onRetry?: () => void;
}

import { ErrorState } from "@/components/error-state";

export function QueryError({
  title,
  message = "Connection failed. Check your network and try again.",
  onRetry,
}: ErrorProps) {
  return (
    <div className="container-fluid">
      <ErrorState
        title={title}
        description={message}
        retryAction={onRetry || (() => window.location.reload())}
      />
    </div>
  );
}

interface EmptyProps {
  title?: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export function QueryEmpty({ title, message, action }: EmptyProps) {
  return (
    <div className="py-12 text-center">
      {title && <p className="text-sm font-medium mb-1">{title}</p>}
      <p className="text-xs text-muted-foreground">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
