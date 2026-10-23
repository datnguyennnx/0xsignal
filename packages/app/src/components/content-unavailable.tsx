import { memo } from "react";
import { SearchX, BarChart3, AlertCircle, FileX } from "lucide-react";
import { cn } from "cn";

type UnavailableVariant = "empty" | "no-results" | "no-data" | "error" | "unavailable";

interface ContentUnavailableProps {
  variant?: UnavailableVariant;
  title?: string;
  description?: string;
  className?: string;
  iconSize?: number;
}

const VARIANT_DEFAULTS: Record<
  UnavailableVariant,
  { icon: typeof BarChart3; title: string; description?: string }
> = {
  "no-results": {
    icon: SearchX,
    title: "No Results",
    description: "Nothing here matches your search. Clear the search or broaden your filters.",
  },
  "no-data": {
    icon: FileX,
    title: "No Data",
    description: "This panel has no data to show yet. Check back once new activity arrives.",
  },
  unavailable: {
    icon: AlertCircle,
    title: "Content Unavailable",
    description: "This section is not available right now. Reload the page to try again.",
  },
  empty: {
    icon: BarChart3,
    title: "Nothing Here",
    description: "This area has no content yet. Add an item to get started.",
  },
  error: {
    icon: AlertCircle,
    title: "Unable to Load",
    description: "This section failed to load. Reload the page to try again.",
  },
};

export const ContentUnavailable = memo(function ContentUnavailable({
  variant = "empty",
  title,
  description,
  className,
  iconSize = 28,
}: ContentUnavailableProps) {
  const config = VARIANT_DEFAULTS[variant];
  const Icon = config.icon;
  const body = description ?? config.description;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-10 flex-1 min-h-[clamp(12rem,28dvh,18rem)]",
        className,
      )}
    >
      <Icon
        size={iconSize}
        strokeWidth={1}
        className="text-muted-foreground/60 mb-3"
        aria-hidden="true"
      />
      <h3 className="text-sm font-semibold text-muted-foreground tracking-tight mb-1">
        {title ?? config.title}
      </h3>
      {body !== undefined && body !== "" && (
        <p className="text-xs text-muted-foreground max-w-[clamp(17rem,70vw,17.5rem)] leading-relaxed">
          {body}
        </p>
      )}
    </div>
  );
});
