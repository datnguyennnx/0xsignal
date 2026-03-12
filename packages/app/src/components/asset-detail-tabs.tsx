"use client";

import { cn } from "@/core/utils/cn";
import { BookOpen, Radio, Zap } from "lucide-react";

export type AssetDetailTab = "orderbook" | "insight";

interface AssetDetailTabsProps {
  activeTab: AssetDetailTab;
  onTabChange: (tab: AssetDetailTab) => void;
  className?: string;
}

const tabs = [
  {
    id: "orderbook" as const,
    label: "Orderbook",
    icon: BookOpen,
  },
  {
    id: "insight" as const,
    label: "Insight",
    icon: Zap,
  },
];

export function AssetDetailTabs({ activeTab, onTabChange, className }: AssetDetailTabsProps) {
  return (
    <div className={cn("inline-flex items-center gap-1 p-0.5 bg-muted/50 rounded-lg", className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md",
              "transition-all duration-150 ease-out",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              isActive
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
