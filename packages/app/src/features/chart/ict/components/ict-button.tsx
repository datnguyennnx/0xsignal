import { useState, useCallback, memo, useRef, useEffect } from "react";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
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

  const activeCount = Object.values(visibility).filter(Boolean).length;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Button
        variant={isOpen ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        className={cn(
          "gap-1.5 text-xs font-medium",
          activeCount > 0 && !isOpen && "border-primary/50 bg-primary/5"
        )}
      >
        <span>ICT</span>
        {activeCount > 0 && (
          <span className="text-[10px] text-muted-foreground">{activeCount}</span>
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
