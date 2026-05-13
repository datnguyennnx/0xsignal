/**
 * @overview Generic analysis toggle button with dropdown controls.
 *
 * Replaces ICTButton/ICTControls/WyckoffButton — the same dropdown pattern
 * with different feature configs and footer text.
 */
import { memo, useState, useCallback, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/utils/cn";

export interface AnalysisFeature {
  id: string;
  label: string;
  description: string;
  color: string;
}

interface AnalysisButtonProps {
  label: string;
  features: readonly AnalysisFeature[];
  visibility: Record<string, boolean>;
  onToggle: (feature: string) => void;
  isLoading?: boolean;
  footerText?: string;
  footerSubtext?: string;
  className?: string;
}

export const AnalysisButton = memo(function AnalysisButton({
  label,
  features,
  visibility,
  onToggle,
  isLoading = false,
  footerText,
  footerSubtext,
  className,
}: AnalysisButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) handleClose();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, handleClose]);

  const activeCount = features.filter((f) => visibility[f.id]).length;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Button
        variant={isOpen ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        className={cn(
          "gap-1.5 text-xs font-medium min-h-11 sm:min-h-8 tap-highlight border-border/50 bg-background/70 hover:bg-muted/40 focus-visible:ring-ring/25",
          isOpen && "bg-foreground text-background hover:bg-foreground/90",
          activeCount > 0 && !isOpen && "border-primary/50 bg-primary/5",
          isLoading && "computing-pulse"
        )}
      >
        <span>{label}</span>
        {activeCount > 0 && (
          <span className="text-[clamp(0.5625rem,0.5rem+0.15vw,0.6875rem)] text-muted-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-16px)] bg-popover text-popover-foreground border border-border/40 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-medium">{label} Analysis</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="min-h-[44px] min-w-[44px] p-2"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-3 space-y-1">
            {features.map((feature) => (
              <Button
                key={feature.id}
                variant="ghost"
                className={cn(
                  "interactive-toggle flex items-center justify-between w-full py-3 px-3 rounded-xl transition-all duration-200 h-auto min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring/25",
                  visibility[feature.id]
                    ? "bg-foreground/10 text-foreground"
                    : "hover:bg-muted/50 text-foreground"
                )}
                onClick={() => onToggle(feature.id)}
              >
                <div className="flex items-center gap-2.5">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", feature.color)} />
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-medium">{feature.label}</span>
                    <span className="text-[clamp(0.5625rem,0.5rem+0.15vw,0.6875rem)] text-muted-foreground">
                      {feature.description}
                    </span>
                  </div>
                </div>
              </Button>
            ))}
          </div>

          {(footerText || footerSubtext) && (
            <div className="px-4 py-2 bg-muted/25 border-t border-border/30">
              {footerText && (
                <p className="text-[clamp(0.5625rem,0.5rem+0.15vw,0.6875rem)] text-muted-foreground">
                  {footerText}
                </p>
              )}
              {footerSubtext && (
                <p className="text-[clamp(0.5rem,0.45rem+0.12vw,0.5625rem)] text-muted-foreground/60 mt-0.5">
                  {footerSubtext}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
