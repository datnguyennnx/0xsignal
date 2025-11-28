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

export function QueryError({
  title,
  message = "Connection failed. Check your network and try again.",
  onRetry,
}: ErrorProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-lg sm:text-xl font-semibold">{title}</h1>
      <div className="rounded-lg border border-border bg-muted/30 p-6">
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded hover:bg-foreground/90 transition-colors"
          >
            Retry
          </button>
        )}
        {!onRetry && (
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded hover:bg-foreground/90 transition-colors"
          >
            Reload Page
          </button>
        )}
      </div>
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
