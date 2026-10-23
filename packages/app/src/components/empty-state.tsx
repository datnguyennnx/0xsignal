import { memo } from "react";
import { cn } from "cn";

type EmptyVariant = "table" | "panel" | "chart";

interface EmptyStateProps {
  variant?: EmptyVariant;
  title?: string | undefined;
  description?: string | undefined;
  className?: string;
}

const VARIANT_DEFAULTS: Record<EmptyVariant, string> = {
  table: "No data available",
  panel: "No data available",
  chart: "No data",
};

export const EmptyState = memo(function EmptyState({
  variant = "table",
  title,
  description,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 text-center px-6 py-8 flex-1 min-h-[clamp(12rem,28dvh,18rem)]",
        className,
      )}
    >
      <h3 className="text-sm font-medium text-muted-foreground tracking-tight">
        {title ?? VARIANT_DEFAULTS[variant]}
      </h3>
      {description !== undefined && description !== "" && (
        <p className="text-xs text-muted-foreground max-w-[clamp(17rem,70vw,20rem)] leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
});
