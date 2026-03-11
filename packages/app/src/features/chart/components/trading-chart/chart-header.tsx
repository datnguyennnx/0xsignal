import { memo, useCallback, useMemo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { DEFAULT_INTERVALS, ALL_INTERVALS } from "./constants";

interface ChartHeaderProps {
  symbol: string;
  interval: string;
  displayCandle: ChartDataPoint | null;
  onIntervalChange: (interval: string) => void;
  children?: React.ReactNode;
}

export const ChartHeader = memo(function ChartHeader({
  symbol,
  interval,
  displayCandle,
  onIntervalChange,
  children,
}: ChartHeaderProps) {
  const isDefaultInterval = useMemo(
    () => DEFAULT_INTERVALS.some((int) => int.value === interval),
    [interval]
  );

  const nonDefaultIntervals = useMemo(
    () => ALL_INTERVALS.filter((int) => !DEFAULT_INTERVALS.some((d) => d.value === int.value)),
    []
  );

  const handleIntervalChange = useCallback(
    (newInterval: string) => {
      onIntervalChange(newInterval);
    },
    [onIntervalChange]
  );

  return (
    <div className="hidden sm:flex items-center justify-between gap-4 px-4 py-2.5 border-b border-border/50 bg-card">
      <div className="flex items-center gap-4">
        <h3 className="text-sm font-semibold">{symbol}</h3>
        <div className="flex items-center gap-1">
          {DEFAULT_INTERVALS.map((int) => (
            <button
              key={int.value}
              onClick={() => handleIntervalChange(int.value)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded transition-colors",
                interval === int.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              {int.label}
            </button>
          ))}
          {/* Dropdown for non-default intervals */}
          {nonDefaultIntervals.length > 0 && (
            <select
              value={isDefaultInterval ? "" : interval}
              onChange={(e) => {
                if (e.target.value) handleIntervalChange(e.target.value);
              }}
              className={cn(
                "bg-transparent text-xs font-medium rounded px-2 py-1 cursor-pointer outline-none transition-colors",
                isDefaultInterval
                  ? "text-muted-foreground hover:text-foreground"
                  : "bg-primary text-primary-foreground"
              )}
            >
              {isDefaultInterval && (
                <option value="" disabled className="bg-card">
                  More
                </option>
              )}
              {nonDefaultIntervals.map((int) => (
                <option key={int.value} value={int.value} className="bg-card">
                  {int.label}
                </option>
              ))}
            </select>
          )}
        </div>
        {displayCandle && (
          <div className="hidden lg:flex items-center gap-3 text-xs border-l border-border/50 pl-4">
            <span className="text-muted-foreground">
              O <span className="font-mono tabular-nums">{displayCandle.open.toFixed(2)}</span>
            </span>
            <span className="text-muted-foreground">
              H{" "}
              <span className="font-mono tabular-nums text-gain">
                {displayCandle.high.toFixed(2)}
              </span>
            </span>
            <span className="text-muted-foreground">
              L{" "}
              <span className="font-mono tabular-nums text-loss">
                {displayCandle.low.toFixed(2)}
              </span>
            </span>
            <span className="text-muted-foreground">
              C{" "}
              <span
                className={cn(
                  "font-mono tabular-nums",
                  displayCandle.close >= displayCandle.open ? "text-gain" : "text-loss"
                )}
              >
                {displayCandle.close.toFixed(2)}
              </span>
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
});
