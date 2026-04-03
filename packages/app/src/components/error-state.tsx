/**
 * @overview Error State View
 *
 * Dedicated screen for handling higher-level error contexts like rate limiting.
 * Provides clear user messaging and a reconnection logic.
 */
import { memo } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/utils/cn";

interface ErrorStateProps {
  title?: string;
  description?: string;
  retryAction?: () => void;
  type?: "general" | "rate-limit";
  className?: string;
}

export const ErrorState = memo(function ErrorState({
  title = "Unable to load data",
  description = "An unexpected error occurred. Please try again.",
  retryAction,
  type = "general",
  className,
}: ErrorStateProps) {
  const isRateLimit = type === "rate-limit";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center min-h-[50dvh] animate-in fade-in duration-300",
        className
      )}
    >
      <AlertCircle
        size={28}
        strokeWidth={1.5}
        className="text-muted-foreground/40 mb-4"
        aria-hidden="true"
      />
      <h3 className="text-sm font-semibold tracking-tight mb-3">
        {isRateLimit ? "System Cooling Down" : title}
      </h3>

      <p className="text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
        {isRateLimit
          ? "High data velocity detected. The stream has been temporarily paused to preserve integrity."
          : description}
      </p>

      {retryAction && (
        <Button
          variant="outline"
          onClick={retryAction}
          size="sm"
          className="min-w-[120px] h-9 min-h-[44px]"
        >
          {isRateLimit ? "Reconnect" : "Retry"}
        </Button>
      )}
    </div>
  );
});
