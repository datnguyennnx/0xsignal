import { memo, useState, useCallback, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/utils/cn";
import type { WyckoffVisibility, WyckoffFeature } from "../types";

interface WyckoffButtonProps {
  visibility: WyckoffVisibility;
  onToggle: (feature: WyckoffFeature) => void;
  isLoading?: boolean;
  className?: string;
}

interface FeatureConfig {
  id: WyckoffFeature;
  label: string;
  description: string;
  color: string;
}

const FEATURES: FeatureConfig[] = [
  {
    id: "tradingRange",
    label: "Trading Range",
    description: "Accumulation/Distribution range",
    color: "bg-foreground/80",
  },
  {
    id: "climaxes",
    label: "Climaxes",
    description: "SC/BC volume spikes",
    color: "bg-foreground/50",
  },
  {
    id: "springs",
    label: "Springs/Upthrusts",
    description: "False breakouts and tests",
    color: "bg-foreground/30",
  },
  {
    id: "effortResult",
    label: "Effort vs Result",
    description: "Volume divergences",
    color: "bg-foreground/60",
  },
  {
    id: "phases",
    label: "Phases",
    description: "Wyckoff phase markers",
    color: "bg-foreground/40",
  },
];

export const WyckoffButton = memo(function WyckoffButton({
  visibility,
  onToggle,
  isLoading = false,
  className,
}: WyckoffButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeCount = Object.values(visibility).filter(Boolean).length;

  const handleToggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) handleClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Button
        variant={isOpen ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        className={cn(
          "gap-1.5 text-xs font-medium min-h-11 sm:min-h-8 tap-highlight",
          activeCount > 0 && !isOpen && "border-primary/50 bg-primary/5",
          isLoading && "computing-pulse"
        )}
      >
        <span>Wyckoff</span>
        {activeCount > 0 && (
          <span className="text-[10px] text-muted-foreground">{activeCount}</span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border/30 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-medium">Wyckoff Analysis</span>
            <Button variant="ghost" size="icon-sm" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-3 space-y-1">
            {FEATURES.map((feature) => (
              <Button
                key={feature.id}
                variant="ghost"
                className={cn(
                  "interactive-toggle flex items-center justify-between w-full py-2 px-3 rounded-xl transition-all duration-200 h-auto",
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
            <p className="text-[10px] text-muted-foreground">Best on 1H, 4H, Daily timeframes</p>
            <p className="text-[9px] text-muted-foreground/60 mt-0.5">
              Wyckoff Method by Richard D. Wyckoff
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
