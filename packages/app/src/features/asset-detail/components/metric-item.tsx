import { cn } from "@/core/utils/cn";

interface MetricItemProps {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}

export function MetricItem({ label, value, tone = "neutral" }: MetricItemProps) {
  return (
    <div className={cn("flex flex-col")}>
      <span className="text-[10px] tracking-wider text-muted-foreground/60 font-medium uppercase leading-none mb-1">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums leading-none whitespace-nowrap",
          tone === "positive" && "text-gain",
          tone === "negative" && "text-loss",
          tone === "neutral" && "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
