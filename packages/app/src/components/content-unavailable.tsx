import { memo } from "react";
import { SearchX, BarChart3, AlertCircle, FileX } from "lucide-react";
import { cn } from "@/core/utils/cn";

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
    description: "Your search returned no matching items.",
  },
  "no-data": {
    icon: FileX,
    title: "No Data",
    description: "Data for this panel is unavailable.",
  },
  unavailable: {
    icon: AlertCircle,
    title: "Content Unavailable",
    description: "This content could not be loaded.",
  },
  empty: {
    icon: BarChart3,
    title: "Nothing Here",
    description: "There is no content to display.",
  },
  error: {
    icon: AlertCircle,
    title: "Unable to Load",
    description: "An error occurred while loading content.",
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

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-10 flex-1 min-h-0",
        className
      )}
    >
      <Icon
        size={iconSize}
        strokeWidth={1}
        className="text-muted-foreground/25 mb-3"
        aria-hidden="true"
      />
      <h3 className="text-sm font-semibold text-muted-foreground tracking-tight mb-1">
        {title ?? config.title}
      </h3>
      {(description ?? config.description) && (
        <p className="text-xs text-muted-foreground/50 max-w-[280px] leading-relaxed">
          {description ?? config.description}
        </p>
      )}
    </div>
  );
});
