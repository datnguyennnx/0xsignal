import { memo } from "react";
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
        "flex flex-col items-center justify-center text-center min-h-[50dvh]",
        className,
      )}
    >
      <h3 className="text-sm font-semibold tracking-tight mb-3">
        {isRateLimit ? "System Cooling Down" : title}
      </h3>

      <p className="text-xs text-muted-foreground/60 max-w-md mb-6 leading-relaxed">
        {isRateLimit
          ? "High data velocity detected. The stream has been temporarily paused to preserve integrity."
          : description}
      </p>

      {retryAction && (
        <Button
          variant="outline"
          onClick={retryAction}
          size="sm"
          className="min-w-[clamp(7rem,10vw,7.5rem)] h-9 min-h-[44px]"
        >
          {isRateLimit ? "Reconnect" : "Retry"}
        </Button>
      )}
    </div>
  );
});
