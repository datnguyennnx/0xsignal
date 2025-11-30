// ICT Button - Toggle for ICT analysis panel
// Similar to IndicatorButton for consistency

import { useState, useCallback, memo, useRef, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ICTVisibility, ICTFeature } from "../types";
import { ICTControls } from "./ict-controls";

interface ICTButtonProps {
  visibility: ICTVisibility;
  onToggle: (feature: ICTFeature) => void;
  className?: string;
}

export const ICTButton = memo(function ICTButton({
  visibility,
  onToggle,
  className,
}: ICTButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, handleClose]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  const activeCount = Object.values(visibility).filter(Boolean).length;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Button
        variant={isOpen ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        className="gap-2"
      >
        <TrendingUp className="w-3.5 h-3.5" />
        <span>ICT</span>
        {activeCount > 0 && (
          <Badge
            variant={isOpen ? "secondary" : "default"}
            className={cn("px-1.5 py-0 text-[10px] h-4", isOpen && "bg-primary-foreground/20")}
          >
            {activeCount}
          </Badge>
        )}
      </Button>

      <ICTControls
        visibility={visibility}
        onToggle={onToggle}
        isOpen={isOpen}
        onClose={handleClose}
      />
    </div>
  );
});
