import { memo } from "react";
import { cn } from "@/core/utils/cn";

interface SparklineProps {
  data: readonly number[];
  className?: string;
  positive: boolean;
}

export const Sparkline = memo(function Sparkline({ data, className, positive }: SparklineProps) {
  if (!data || data.length === 0) {
    return <div className={cn("w-24 h-8 bg-muted/30 rounded", className)} />;
  }

  const width = 96;
  const height = 32;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const color = positive ? "var(--gain)" : "var(--loss)";

  return (
    <svg
      className={cn("w-24 h-8", className)}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <path
        d={pathD}
        fill="none"
        style={{ stroke: color }}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});
