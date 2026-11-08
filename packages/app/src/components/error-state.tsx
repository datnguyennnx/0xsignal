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
      <h3 className="type-title font-semibold mb-3">{title}</h3>

      <p className="type-body text-muted-foreground max-w-(--measure-form) mb-6">{description}</p>

      {retryAction && (
        <Button variant="outline" onClick={retryAction}>
          Retry
        </Button>
      )}
    </div>
  );
});
