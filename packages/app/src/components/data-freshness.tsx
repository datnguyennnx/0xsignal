import { useEffect, useState, useMemo } from "react";
import { cn } from "@/core/utils/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock } from "lucide-react";

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

  if (seconds < 60) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString();
};

/** Get staleness level based on age in minutes */
const getStalenessLevel = (
  ageMinutes: number,
  thresholds: { fresh: number; stale: number } = { fresh: 5, stale: 15 }
): "fresh" | "stale" | "very_stale" => {
  if (ageMinutes < thresholds.fresh) return "fresh";
  if (ageMinutes < thresholds.stale) return "stale";
  return "very_stale";
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
      className={cn("text-muted-foreground/60 tabular-nums", className)}
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
        "inline-flex font-mono font-medium",
        "rounded border border-warn/30 text-warn/80",
        className
      )}
      title={tooltip ?? "Estimated value"}
    >
      EST
    </span>
  );
}

interface DataAgeBadgeProps {
  /** Timestamp of when data was fetched */
  timestamp?: Date | string | number | null;
  /** Custom thresholds in minutes */
  thresholds?: { fresh: number; stale: number };
  /** Additional class names */
  className?: string;
  /** Show icon */
  showIcon?: boolean;
  /** Compact mode - only show when stale */
  compactMode?: boolean;
}

/**
 * DataAgeBadge - Shows data age with color-coded staleness indicator
 * - Fresh (<5min): Hidden in compact mode, green otherwise
 * - Stale (5-15min): Yellow warning
 * - Very Stale (>15min): Red warning
 */
export function DataAgeBadge({
  timestamp,
  thresholds = { fresh: 5, stale: 15 },
  className,
  showIcon = true,
  compactMode = true,
}: DataAgeBadgeProps) {
  const [ageString, setAgeString] = useState<string>("");
  const [stalenessLevel, setStalenessLevel] = useState<"fresh" | "stale" | "very_stale">("fresh");

  useEffect(() => {
    if (!timestamp) return;

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    const update = () => {
      const now = Date.now();
      const diff = now - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      setStalenessLevel(getStalenessLevel(minutes, thresholds));

      if (minutes < 1) {
        setAgeString("Just now");
      } else if (minutes < 60) {
        setAgeString(`${minutes}m ago`);
      } else if (hours < 24) {
        setAgeString(`${hours}h ago`);
      } else {
        setAgeString(`${days}d ago`);
      }
    };

    update();
    const interval = setInterval(update, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [timestamp, thresholds]);

  // No timestamp = no badge
  if (!timestamp) return null;

  // In compact mode, hide when data is fresh
  if (compactMode && stalenessLevel === "fresh") return null;

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const tooltipText =
    stalenessLevel === "fresh"
      ? `Data is fresh (updated ${ageString})`
      : stalenessLevel === "stale"
        ? `Data may be outdated (last updated ${ageString})`
        : `Data is stale - showing cached data from ${date.toLocaleString()}`;

  const colorClasses = {
    fresh: "text-gain/70 border-gain/20 bg-gain/5",
    stale: "text-warn/80 border-warn/30 bg-warn/5",
    very_stale: "text-loss/80 border-loss/30 bg-loss/5",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-mono border cursor-help",
            colorClasses[stalenessLevel],
            className
          )}
        >
          {showIcon && <Clock size={10} className="opacity-70" />}
          <span className="tabular-nums">{ageString}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[10px] max-w-48">
        <p>{tooltipText}</p>
        {stalenessLevel !== "fresh" && (
          <p className="text-muted-foreground mt-1">
            Data will auto-refresh when rate limits allow
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/** Hook to track data freshness */
export function useDataFreshness(timestamp?: Date | string | number | null) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  return useMemo(() => {
    if (!timestamp) return { ageMinutes: 0, isStale: false, isVeryStale: false };

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const ageMinutes = Math.floor((now - date.getTime()) / 60000);

    return {
      ageMinutes,
      isStale: ageMinutes >= 5,
      isVeryStale: ageMinutes >= 15,
      timestamp: date,
    };
  }, [timestamp, now]);
}
