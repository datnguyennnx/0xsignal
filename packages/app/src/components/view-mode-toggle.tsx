"use client";

import { cn } from "@/core/utils/cn";
import { TrendingDown, TrendingUp, Layers } from "lucide-react";

export type ViewMode = "both" | "asks" | "bids";

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

const viewModeConfig = {
  both: {
    label: "All",
    icon: Layers,
    activeColor: "text-foreground",
    hoverColor: "hover:text-foreground",
  },
  asks: {
    label: "Asks",
    icon: TrendingDown,
    activeColor: "text-loss",
    hoverColor: "hover:text-loss",
  },
  bids: {
    label: "Bids",
    icon: TrendingUp,
    activeColor: "text-gain",
    hoverColor: "hover:text-gain",
  },
};

export function ViewModeToggle({ mode, onChange, className }: ViewModeToggleProps) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 p-0.5 bg-muted/40 rounded-lg", className)}>
      {(Object.keys(viewModeConfig) as ViewMode[]).map((key) => {
        const config = viewModeConfig[key];
        const Icon = config.icon;
        const isActive = mode === key;

        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-xl active:scale-[0.97]",
              "transition-all duration-150 ease-out",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              isActive
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:bg-muted/60",
              isActive && key !== "both" && config.activeColor,
              !isActive && config.hoverColor
            )}
          >
            <Icon className="h-3 w-3" />
            <span>{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
