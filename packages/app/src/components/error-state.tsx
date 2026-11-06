import { memo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

interface ErrorStateProps {
  title?: string;
  description?: string;
  retryAction?: (() => void) | undefined;
  className?: string;
}

export const ErrorState = memo(function ErrorState({
  title = "Unable to load data",
  description = "An unexpected error occurred. Please try again.",
  retryAction,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center min-h-[clamp(12rem,28dvh,18rem)]",
        className,
      )}
    >
      <h3 className="text-sm font-semibold tracking-tight mb-3">{title}</h3>

      <p className="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">{description}</p>

      {retryAction && (
        <Button
          variant="outline"
          onClick={retryAction}
          size="sm"
          className="min-w-[clamp(7rem,10vw,7.5rem)] h-9"
        >
          Retry
        </Button>
      )}
    </div>
  );
});
