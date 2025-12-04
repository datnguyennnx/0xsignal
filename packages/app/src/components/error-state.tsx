import { Button } from "@/components/ui/button";
import { cn } from "@/core/utils/cn";

interface ErrorStateProps {
  title?: string;
  description?: string;
  retryAction?: () => void;
  type?: "general" | "rate-limit";
  className?: string;
}

export function ErrorState({
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
        "flex flex-col items-center justify-center text-center h-[calc(100vh-12rem)] animate-in fade-in duration-300",
        className
      )}
    >
      <h3 className="text-base font-medium tracking-tight mb-3">
        {isRateLimit ? "System Cooling Down" : title}
      </h3>

      <p className="text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
        {isRateLimit
          ? "High data velocity detected. The stream has been temporarily paused to preserve integrity."
          : description}
      </p>

      {retryAction && (
        <Button variant="outline" onClick={retryAction} size="sm" className="min-w-[120px] h-9">
          {isRateLimit ? "Reconnect" : "Retry"}
        </Button>
      )}
    </div>
  );
}
