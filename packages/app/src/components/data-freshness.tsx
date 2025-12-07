import { useEffect, useState } from "react";
import { cn } from "@/core/utils/cn";

interface DataFreshnessProps {
  timestamp?: Date | string | number | null;
  className?: string;
}

const formatTimeAgo = (date: Date): string => {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString();
};

export function DataFreshness({ timestamp, className }: DataFreshnessProps) {
  const [timeAgo, setTimeAgo] = useState<string>("");

  useEffect(() => {
    if (!timestamp) return;
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const update = () => setTimeAgo(formatTimeAgo(date));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [timestamp]);

  if (!timestamp || !timeAgo) return null;

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  return (
    <span
      className={cn("text-[10px] text-muted-foreground/60 tabular-nums", className)}
      title={date.toLocaleString()}
    >
      {timeAgo}
    </span>
  );
}

interface EstimateBadgeProps {
  className?: string;
  tooltip?: string;
}

export function EstimateBadge({ className, tooltip }: EstimateBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1 py-0.5 text-[8px] font-mono font-medium",
        "rounded border border-warn/30 text-warn/80",
        className
      )}
      title={tooltip ?? "Estimated value"}
    >
      EST
    </span>
  );
}
