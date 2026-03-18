import { memo } from "react";
import { X } from "lucide-react";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
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
  description: string;
  color: string;
}

const FEATURES: FeatureConfig[] = [
  {
    id: "marketStructure",
    label: "Market Structure",
    description: "HH/HL/LH/LL swings, BOS & ChoCH",
    color: "bg-foreground/80",
  },
  {
    id: "fvg",
    label: "Fair Value Gaps",
    description: "Imbalance zones",
    color: "bg-amber-500/60",
  },
  {
    id: "orderBlocks",
    label: "Order Blocks",
    description: "Supply/demand zones",
    color: "bg-primary/60",
  },
  {
    id: "liquidity",
    label: "Liquidity Zones",
    description: "BSL/SSL clusters",
    color: "bg-muted-foreground/60",
  },
  {
    id: "ote",
    label: "OTE Zones",
    description: "61.8%-78.6% Fibonacci",
    color: "bg-amber-400/50",
  },
  {
    id: "displacement",
    label: "Displacement",
    description: "Strong momentum candles",
    color: "bg-foreground/40",
  },
];

export const ICTControls = memo(function ICTControls({
  visibility,
  onToggle,
  isOpen,
  onClose,
}: ICTControlsProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-lg shadow-lg z-99999 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium">ICT Analysis</span>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-3 space-y-1">
        {FEATURES.map((feature) => (
          <Button
            key={feature.id}
            variant="ghost"
            className={cn(
              "interactive-toggle flex items-center justify-between w-full py-2 px-3 rounded-md transition-all duration-200 h-auto",
              visibility[feature.id] ? "bg-primary/10" : "hover:bg-muted/50"
            )}
            onClick={() => onToggle(feature.id)}
          >
            <div className="flex items-center gap-2.5">
              <span className={cn("w-2 h-2 rounded-full shrink-0", feature.color)} />
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium">{feature.label}</span>
                <span className="text-[10px] text-muted-foreground">{feature.description}</span>
              </div>
            </div>
          </Button>
        ))}
      </div>

      <div className="px-4 py-2 bg-muted/30">
        <p className="text-[10px] text-muted-foreground">Best on 15m, 1H, 4H timeframes</p>
        <p className="text-[9px] text-muted-foreground/60 mt-0.5">ICT by Michael J. Huddleston</p>
      </div>
    </div>
  );
});
