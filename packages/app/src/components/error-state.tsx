import { memo } from "react";
import { Button } from "@/components/ui/button";
import { StateArt } from "@/components/state-art";
import { cn } from "cn";

interface ErrorStateProps {
  title?: string;
  description?: string;
  retryAction?: (() => void) | undefined;
  retryLabel?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const ErrorState = memo(function ErrorState({
  title = "Unable to load data",
  description = "An unexpected error occurred. Please try again.",
  retryAction,
  retryLabel = "Retry",
  className,
  size = "md",
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center min-h-[clamp(12rem,28dvh,18rem)]",
        className,
      )}
    >
      <StateArt size={size} className="mb-4" />

      <h3 className="type-title font-semibold mb-3">{title}</h3>

      <p className="type-body text-muted-foreground max-w-(--measure-form) mb-6">{description}</p>

      {retryAction && (
        <Button variant="outline" onClick={retryAction}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
});
