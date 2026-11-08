import type { ReactNode } from "react";
import { cn } from "cn";

interface MetricItemProps {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "positive" | "negative";
}

export function MetricItem({ label, value, tone = "neutral" }: MetricItemProps) {
  return (
    <div className={cn("flex flex-col")}>
      <span className="type-label tracking-wider text-muted-foreground font-medium uppercase leading-none mb-1">
        {label}
      </span>
      <span
        className={cn(
          "type-data font-semibold tabular-nums leading-none whitespace-nowrap",
          tone === "positive" && "text-gain",
          tone === "negative" && "text-loss",
        )}
      >
        {value}
      </span>
    </div>
  );
}
