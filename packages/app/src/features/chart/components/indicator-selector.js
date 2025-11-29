import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import { AVAILABLE_INDICATORS, INDICATOR_PRESETS, INDICATOR_INFO } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { X, Check, ChevronDown, Eye, EyeOff, Minus, Plus, HelpCircle } from "lucide-react";
// Memoized active indicator item
const ActiveIndicatorItem = memo(function ActiveIndicatorItem({ indicator, onToggle, onRemove }) {
  return _jsxs("div", {
    className: "flex items-center gap-2 px-2 py-1.5 rounded bg-background border border-border",
    children: [
      _jsx("span", {
        className: "w-2 h-2 rounded-full shrink-0",
        style: { backgroundColor: indicator.color },
      }),
      _jsx("span", {
        className: "text-xs font-medium flex-1 truncate",
        children: indicator.config.id.toUpperCase(),
      }),
      _jsx(Button, {
        variant: "ghost",
        size: "icon-sm",
        className: "h-6 w-6",
        onClick: onToggle,
        children: indicator.visible
          ? _jsx(Eye, { className: "w-3.5 h-3.5" })
          : _jsx(EyeOff, { className: "w-3.5 h-3.5 opacity-50" }),
      }),
      _jsx(Button, {
        variant: "ghost",
        size: "icon-sm",
        className: "h-6 w-6 hover:text-destructive",
        onClick: onRemove,
        children: _jsx(X, { className: "w-3.5 h-3.5" }),
      }),
    ],
  });
});
// Memoized indicator row
const IndicatorRow = memo(function IndicatorRow({
  indicator,
  info,
  isActive,
  activeIndicator,
  isExpanded,
  onToggleExpand,
  onQuickAdd,
  onCustomAdd,
  onRemove,
  customPeriod,
  onPeriodChange,
  presets,
}) {
  const hasParams = indicator.defaultParams && "period" in indicator.defaultParams;
  const hasPresets = presets.length > 0;
  const handleDecrement = useCallback(
    () => onPeriodChange(Math.max(1, customPeriod - 1)),
    [customPeriod, onPeriodChange]
  );
  const handleIncrement = useCallback(
    () => onPeriodChange(customPeriod + 1),
    [customPeriod, onPeriodChange]
  );
  const handleInputChange = useCallback(
    (e) => onPeriodChange(Math.max(1, Number(e.target.value))),
    [onPeriodChange]
  );
  if (!hasParams || !hasPresets) {
    return _jsxs("div", {
      className: "flex items-center gap-1",
      children: [
        _jsxs("button", {
          onClick: () => onQuickAdd(),
          className: cn(
            "flex-1 flex items-center justify-between px-2 py-2 rounded transition-colors text-left",
            isActive ? "bg-primary/10" : "hover:bg-muted"
          ),
          children: [
            _jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                isActive &&
                  activeIndicator?.color &&
                  _jsx("span", {
                    className: "w-2 h-2 rounded-full",
                    style: { backgroundColor: activeIndicator.color },
                  }),
                _jsx("span", { className: "text-xs font-medium", children: indicator.name }),
              ],
            }),
            isActive
              ? _jsx(Check, { className: "w-3.5 h-3.5 text-primary" })
              : _jsx(Plus, { className: "w-3.5 h-3.5 text-muted-foreground" }),
          ],
        }),
        info && _jsx(InfoTooltip, { info: info }),
      ],
    });
  }
  return _jsxs(Collapsible, {
    open: isExpanded,
    onOpenChange: onToggleExpand,
    children: [
      _jsxs("div", {
        className: "flex items-center gap-1",
        children: [
          _jsx(CollapsibleTrigger, {
            asChild: true,
            children: _jsxs("button", {
              className: cn(
                "flex-1 flex items-center justify-between px-2 py-2 rounded transition-colors",
                isActive ? "bg-primary/10" : "hover:bg-muted",
                isExpanded && "bg-muted"
              ),
              children: [
                _jsxs("div", {
                  className: "flex items-center gap-2",
                  children: [
                    isActive &&
                      activeIndicator?.color &&
                      _jsx("span", {
                        className: "w-2 h-2 rounded-full",
                        style: { backgroundColor: activeIndicator.color },
                      }),
                    _jsx("span", { className: "text-xs font-medium", children: indicator.name }),
                    isActive &&
                      _jsxs("span", {
                        className: "text-[10px] text-muted-foreground",
                        children: [
                          "(",
                          activeIndicator?.params.period || indicator.defaultParams?.period,
                          ")",
                        ],
                      }),
                  ],
                }),
                _jsx(ChevronDown, {
                  className: cn(
                    "w-3.5 h-3.5 text-muted-foreground transition-transform",
                    isExpanded && "rotate-180"
                  ),
                }),
              ],
            }),
          }),
          info && _jsx(InfoTooltip, { info: info }),
        ],
      }),
      _jsx(CollapsibleContent, {
        children: _jsxs("div", {
          className: "px-2 py-2 bg-muted/50 space-y-2 rounded-b",
          children: [
            _jsx("div", {
              className: "grid grid-cols-4 gap-1",
              children: presets.map((period) =>
                _jsxs(
                  Tooltip,
                  {
                    children: [
                      _jsx(TooltipTrigger, {
                        asChild: true,
                        children: _jsx(Button, {
                          variant: "outline",
                          size: "sm",
                          className: "h-8 text-xs",
                          onClick: () => onQuickAdd(period),
                          children: period,
                        }),
                      }),
                      info?.presetHints?.[period] &&
                        _jsx(TooltipContent, {
                          side: "bottom",
                          className: "text-[10px]",
                          children: info.presetHints[period],
                        }),
                    ],
                  },
                  period
                )
              ),
            }),
            _jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                _jsxs("div", {
                  className:
                    "flex-1 flex items-center border border-border rounded overflow-hidden bg-background",
                  children: [
                    _jsx(Button, {
                      variant: "ghost",
                      size: "icon-sm",
                      className: "h-8 w-8 rounded-none",
                      onClick: handleDecrement,
                      children: _jsx(Minus, { className: "w-3 h-3" }),
                    }),
                    _jsx("input", {
                      type: "number",
                      value: customPeriod,
                      onChange: handleInputChange,
                      className:
                        "w-12 text-center text-xs py-1.5 bg-transparent border-none focus:outline-none",
                      min: 1,
                    }),
                    _jsx(Button, {
                      variant: "ghost",
                      size: "icon-sm",
                      className: "h-8 w-8 rounded-none",
                      onClick: handleIncrement,
                      children: _jsx(Plus, { className: "w-3 h-3" }),
                    }),
                  ],
                }),
                _jsx(Button, {
                  size: "sm",
                  className: "h-8",
                  onClick: onCustomAdd,
                  children: "Add",
                }),
              ],
            }),
            isActive &&
              _jsx(Button, {
                variant: "ghost",
                size: "sm",
                className:
                  "w-full h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10",
                onClick: onRemove,
                children: "Remove",
              }),
          ],
        }),
      }),
    ],
  });
});
// Memoized info tooltip
const InfoTooltip = memo(function InfoTooltip({ info }) {
  return _jsxs(Tooltip, {
    children: [
      _jsx(TooltipTrigger, {
        asChild: true,
        children: _jsx(Button, {
          variant: "ghost",
          size: "icon-sm",
          className: "h-7 w-7 shrink-0",
          children: _jsx(HelpCircle, { className: "w-3.5 h-3.5 text-muted-foreground" }),
        }),
      }),
      _jsxs(TooltipContent, {
        side: "left",
        className: "max-w-[200px] space-y-1 p-2",
        children: [
          _jsx("p", {
            className: "font-mono text-[10px] text-muted-foreground",
            children: info.formula,
          }),
          _jsx("p", { className: "text-[10px]", children: info.interpretation }),
        ],
      }),
    ],
  });
});
export function IndicatorSelector({
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  onToggleIndicator,
  isOpen,
  onClose,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [customPeriod, setCustomPeriod] = useState(14);
  const containerRef = useRef(null);
  // Click outside handler
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);
  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);
  // Memoized indicator groups
  const { overlayIndicators, oscillatorIndicators } = useMemo(
    () => ({
      overlayIndicators: AVAILABLE_INDICATORS.filter((i) => i.overlayOnPrice),
      oscillatorIndicators: AVAILABLE_INDICATORS.filter((i) => !i.overlayOnPrice),
    }),
    []
  );
  // Memoized active indicator lookup
  const activeIndicatorMap = useMemo(() => {
    const map = new Map();
    for (const ind of activeIndicators) {
      const baseId = ind.config.id.split("-")[0];
      if (!map.has(baseId)) map.set(baseId, ind);
    }
    return map;
  }, [activeIndicators]);
  const isActive = useCallback(
    (id) => activeIndicators.some((i) => i.config.id.startsWith(id)),
    [activeIndicators]
  );
  // Stable callbacks
  const handleQuickAdd = useCallback(
    (indicator, period) => {
      const params = period ? { ...indicator.defaultParams, period } : indicator.defaultParams;
      onAddIndicator(indicator, params);
      setExpandedId(null);
    },
    [onAddIndicator]
  );
  const handleCustomAdd = useCallback(
    (indicator) => {
      onAddIndicator(indicator, { ...indicator.defaultParams, period: customPeriod });
      setExpandedId(null);
      setCustomPeriod(14);
    },
    [onAddIndicator, customPeriod]
  );
  if (!isOpen) return null;
  return _jsxs("div", {
    ref: containerRef,
    className:
      "absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden",
    children: [
      _jsxs("div", {
        className: "flex items-center justify-between px-4 py-3 border-b border-border",
        children: [
          _jsx("span", { className: "text-sm font-medium", children: "Indicators" }),
          _jsx(Button, {
            variant: "ghost",
            size: "icon-sm",
            onClick: onClose,
            children: _jsx(X, { className: "w-4 h-4" }),
          }),
        ],
      }),
      _jsxs("div", {
        className: "max-h-[420px] overflow-y-auto",
        children: [
          activeIndicators.length > 0 &&
            _jsx("div", {
              className: "px-3 py-2 border-b border-border bg-muted/30 space-y-1",
              children: activeIndicators.map((ind) =>
                _jsx(
                  ActiveIndicatorItem,
                  {
                    indicator: ind,
                    onToggle: () => onToggleIndicator(ind.config.id),
                    onRemove: () => onRemoveIndicator(ind.config.id),
                  },
                  ind.config.id
                )
              ),
            }),
          _jsxs("div", {
            className: "p-2",
            children: [
              _jsx("div", {
                className:
                  "px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider",
                children: "Overlays",
              }),
              overlayIndicators.map((indicator) =>
                _jsx(
                  IndicatorRow,
                  {
                    indicator: indicator,
                    info: INDICATOR_INFO[indicator.id],
                    isActive: isActive(indicator.id),
                    activeIndicator: activeIndicatorMap.get(indicator.id),
                    isExpanded: expandedId === indicator.id,
                    onToggleExpand: () =>
                      setExpandedId(expandedId === indicator.id ? null : indicator.id),
                    onQuickAdd: (period) => handleQuickAdd(indicator, period),
                    onCustomAdd: () => handleCustomAdd(indicator),
                    onRemove: () => onRemoveIndicator(indicator.id),
                    customPeriod: customPeriod,
                    onPeriodChange: setCustomPeriod,
                    presets: INDICATOR_PRESETS[indicator.id] || [],
                  },
                  indicator.id
                )
              ),
            ],
          }),
          _jsxs("div", {
            className: "p-2 border-t border-border",
            children: [
              _jsx("div", {
                className:
                  "px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider",
                children: "Oscillators",
              }),
              oscillatorIndicators.map((indicator) =>
                _jsx(
                  IndicatorRow,
                  {
                    indicator: indicator,
                    info: INDICATOR_INFO[indicator.id],
                    isActive: isActive(indicator.id),
                    activeIndicator: activeIndicatorMap.get(indicator.id),
                    isExpanded: expandedId === indicator.id,
                    onToggleExpand: () =>
                      setExpandedId(expandedId === indicator.id ? null : indicator.id),
                    onQuickAdd: (period) => handleQuickAdd(indicator, period),
                    onCustomAdd: () => handleCustomAdd(indicator),
                    onRemove: () => onRemoveIndicator(indicator.id),
                    customPeriod: customPeriod,
                    onPeriodChange: setCustomPeriod,
                    presets: INDICATOR_PRESETS[indicator.id] || [],
                  },
                  indicator.id
                )
              ),
            ],
          }),
        ],
      }),
    ],
  });
}
//# sourceMappingURL=indicator-selector.js.map
