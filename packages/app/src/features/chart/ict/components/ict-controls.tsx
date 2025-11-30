// ICT Controls Panel
// Toggle controls for ICT visualization features

import { memo } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { ICTVisibility, ICTFeature } from "../types";

interface ICTControlsProps {
  visibility: ICTVisibility;
  onToggle: (feature: ICTFeature) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface FeatureConfig {
  id: ICTFeature;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
}

const FEATURES: FeatureConfig[] = [
  {
    id: "marketStructure",
    label: "Market Structure",
    shortLabel: "MS",
    description: "HH/HL/LH/LL swings, BOS & ChoCH events",
    color: "bg-foreground/80",
  },
  {
    id: "fvg",
    label: "Fair Value Gaps",
    shortLabel: "FVG",
    description: "Imbalance zones from 3-candle patterns",
    color: "bg-warn/60",
  },
  {
    id: "orderBlocks",
    label: "Order Blocks",
    shortLabel: "OB",
    description: "Supply/demand zones at reversal points",
    color: "bg-primary/60",
  },
  {
    id: "liquidity",
    label: "Liquidity Zones",
    shortLabel: "LIQ",
    description: "Equal highs/lows clusters (BSL/SSL)",
    color: "bg-muted-foreground/60",
  },
  {
    id: "ote",
    label: "OTE Zones",
    shortLabel: "OTE",
    description: "Optimal Trade Entry (61.8%-78.6% Fib)",
    color: "bg-primary/40",
  },
  {
    id: "displacement",
    label: "Displacement",
    shortLabel: "DISP",
    description: "Strong momentum candles (ATR multiple)",
    color: "bg-foreground/40",
  },
];

const FeatureToggle = memo(function FeatureToggle({
  feature,
  isActive,
  onToggle,
}: {
  feature: FeatureConfig;
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onToggle}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded transition-colors w-full text-left",
            isActive ? "bg-primary/10" : "hover:bg-muted"
          )}
        >
          <span className={cn("w-2 h-2 rounded-full shrink-0", feature.color)} />
          <span className="text-xs font-medium flex-1">{feature.label}</span>
          {isActive ? (
            <Eye className="w-3.5 h-3.5 text-primary" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[200px]">
        <p className="text-xs">{feature.description}</p>
      </TooltipContent>
    </Tooltip>
  );
});

export const ICTControls = memo(function ICTControls({
  visibility,
  onToggle,
  isOpen,
  onClose,
}: ICTControlsProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-99999 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium">ICT Analysis</span>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-2 space-y-0.5">
        {FEATURES.map((feature) => (
          <FeatureToggle
            key={feature.id}
            feature={feature}
            isActive={visibility[feature.id]}
            onToggle={() => onToggle(feature.id)}
          />
        ))}
      </div>

      <div className="px-4 py-2 border-t border-border bg-muted/30">
        <p className="text-[10px] text-muted-foreground">ICT concepts by Michael J. Huddleston</p>
      </div>
    </div>
  );
});
