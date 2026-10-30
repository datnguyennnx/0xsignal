import { memo, type ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "cn";

type EmptyVariant = "table" | "panel" | "chart";

interface EmptyStateProps {
  variant?: EmptyVariant;
  title?: string | undefined;
  description?: string | undefined;
  className?: string;
  /** Stretch to the parent's box instead of reserving a min-height floor. */
  fill?: boolean;
  action?: ReactNode;
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
  fill = false,
  action,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 text-center flex-1",
        fill
          ? "h-full min-h-0 min-w-0 overflow-y-auto overscroll-none scrollbar-none px-6 py-6"
          : "px-6 py-8 min-h-[clamp(12rem,28dvh,18rem)]",
        className,
      )}
    >
      {fill && (
        <span className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
          <Inbox className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
      )}
      <h3 className="text-sm font-medium text-muted-foreground tracking-tight">
        {title ?? VARIANT_DEFAULTS[variant]}
      </h3>
      {description !== undefined && description !== "" && (
        <p
          className={cn(
            "text-xs text-muted-foreground leading-relaxed",
            fill ? "max-w-full" : "max-w-[clamp(17rem,70vw,20rem)]",
          )}
        >
          {description}
        </p>
      )}
      {action !== undefined && <div className="mt-2">{action}</div>}
    </div>
  );
});
