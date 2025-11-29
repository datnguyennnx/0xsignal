import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, memo } from "react";
import { Settings2 } from "lucide-react";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IndicatorSelector } from "./indicator-selector";
export const IndicatorButton = memo(function IndicatorButton({
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  onToggleIndicator,
  className,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const handleToggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const handleClose = useCallback(() => setIsOpen(false), []);
  const indicatorCount = activeIndicators.length;
  return _jsxs("div", {
    className: cn("relative", className),
    children: [
      _jsxs(Button, {
        variant: isOpen ? "default" : "outline",
        size: "sm",
        onClick: handleToggle,
        className: "gap-2",
        children: [
          _jsx(Settings2, { className: "w-3.5 h-3.5" }),
          _jsx("span", { children: "Indicators" }),
          indicatorCount > 0 &&
            _jsx(Badge, {
              variant: isOpen ? "secondary" : "default",
              className: cn("px-1.5 py-0 text-[10px] h-4", isOpen && "bg-primary-foreground/20"),
              children: indicatorCount,
            }),
        ],
      }),
      _jsx(IndicatorSelector, {
        activeIndicators: activeIndicators,
        onAddIndicator: onAddIndicator,
        onRemoveIndicator: onRemoveIndicator,
        onToggleIndicator: onToggleIndicator,
        isOpen: isOpen,
        onClose: handleClose,
      }),
    ],
  });
});
//# sourceMappingURL=indicator-button.js.map
