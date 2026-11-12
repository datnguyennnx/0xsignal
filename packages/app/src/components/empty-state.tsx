import { memo, type ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "cn";

type EmptyVariant = "table" | "panel" | "chart";

interface EmptyStateProps {
  variant?: EmptyVariant;
  /** Names the object and the next step; there is no generic fallback. */
  title: string;
  description?: string | undefined;
  className?: string;
  /** Stretch to the parent's box instead of reserving a min-height floor. */
  fill?: boolean;
  action?: ReactNode;
}

export const EmptyState = memo(function EmptyState({
  title,
  description,
  className,
  fill = false,
  action,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 text-center",
        fill
          ? "h-full min-h-0 min-w-0 overflow-y-auto overscroll-none scrollbar-none p-panel"
          : "p-panel min-h-[clamp(12rem,28dvh,18rem)]",
        className,
      )}
    >
      {fill && (
        <span className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          <Inbox className="size-icon" aria-hidden="true" />
        </span>
      )}
      <h3 className="type-control font-medium text-muted-foreground">{title}</h3>
      {description !== undefined && description !== "" && (
        <p
          className={cn(
            "type-body text-muted-foreground",
            fill ? "max-w-full" : "max-w-(--measure-form)",
          )}
        >
          {description}
        </p>
      )}
      {action !== undefined && <div className="mt-2">{action}</div>}
    </div>
  );
});
