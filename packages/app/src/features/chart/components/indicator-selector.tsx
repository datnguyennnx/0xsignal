import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import {
  AVAILABLE_INDICATORS,
  INDICATOR_PRESETS,
  INDICATOR_INFO,
  type ActiveIndicator,
  type IndicatorConfig,
  type IndicatorInfo,
} from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { X, Check, ChevronDown, Eye, EyeOff, Minus, Plus, HelpCircle } from "lucide-react";

interface IndicatorSelectorProps {
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (indicator: IndicatorConfig, params?: Record<string, number>) => void;
  onRemoveIndicator: (indicatorId: string) => void;
  onToggleIndicator: (indicatorId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

// Memoized active indicator item
const ActiveIndicatorItem = memo(function ActiveIndicatorItem({
  indicator,
  onToggle,
  onRemove,
}: {
  indicator: ActiveIndicator;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-background border border-border">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: indicator.color }}
      />
      <span className="text-xs font-medium flex-1 truncate">
        {indicator.config.id.toUpperCase()}
      </span>
      <Button variant="ghost" size="icon-sm" className="h-6 w-6" onClick={onToggle}>
        {indicator.visible ? (
          <Eye className="w-3.5 h-3.5" />
        ) : (
          <EyeOff className="w-3.5 h-3.5 opacity-50" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-6 w-6 hover:text-destructive"
        onClick={onRemove}
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
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
}: {
  indicator: IndicatorConfig;
  info?: IndicatorInfo;
  isActive: boolean;
  activeIndicator?: ActiveIndicator;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onQuickAdd: (period?: number) => void;
  onCustomAdd: () => void;
  onRemove: () => void;
  customPeriod: number;
  onPeriodChange: (v: number) => void;
  presets: readonly number[];
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
    (e: React.ChangeEvent<HTMLInputElement>) => onPeriodChange(Math.max(1, Number(e.target.value))),
    [onPeriodChange]
  );

  if (!hasParams || !hasPresets) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => onQuickAdd()}
          className={cn(
            "flex-1 flex items-center justify-between px-2 py-2 rounded transition-colors text-left",
            isActive ? "bg-primary/10" : "hover:bg-muted"
          )}
        >
          <div className="flex items-center gap-2">
            {isActive && activeIndicator?.color && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: activeIndicator.color }}
              />
            )}
            <span className="text-xs font-medium">{indicator.name}</span>
          </div>
          {isActive ? (
            <Check className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
        {info && <InfoTooltip info={info} />}
      </div>
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div className="flex items-center gap-1">
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex-1 flex items-center justify-between px-2 py-2 rounded transition-colors",
              isActive ? "bg-primary/10" : "hover:bg-muted",
              isExpanded && "bg-muted"
            )}
          >
            <div className="flex items-center gap-2">
              {isActive && activeIndicator?.color && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: activeIndicator.color }}
                />
              )}
              <span className="text-xs font-medium">{indicator.name}</span>
              {isActive && (
                <span className="text-[10px] text-muted-foreground">
                  ({activeIndicator?.params.period || indicator.defaultParams?.period})
                </span>
              )}
            </div>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-muted-foreground transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>
        {info && <InfoTooltip info={info} />}
      </div>

      <CollapsibleContent>
        <div className="px-2 py-2 bg-muted/50 space-y-2 rounded-b">
          <div className="grid grid-cols-4 gap-1">
            {presets.map((period) => (
              <Tooltip key={period}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => onQuickAdd(period)}
                  >
                    {period}
                  </Button>
                </TooltipTrigger>
                {info?.presetHints?.[period] && (
                  <TooltipContent side="bottom" className="text-[10px]">
                    {info.presetHints[period]}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center border border-border rounded overflow-hidden bg-background">
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 rounded-none"
                onClick={handleDecrement}
              >
                <Minus className="w-3 h-3" />
              </Button>
              <input
                type="number"
                value={customPeriod}
                onChange={handleInputChange}
                className="w-12 text-center text-xs py-1.5 bg-transparent border-none focus:outline-none"
                min={1}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 rounded-none"
                onClick={handleIncrement}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <Button size="sm" className="h-8" onClick={onCustomAdd}>
              Add
            </Button>
          </div>

          {isActive && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onRemove}
            >
              Remove
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

// Memoized info tooltip
const InfoTooltip = memo(function InfoTooltip({ info }: { info: IndicatorInfo }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0">
          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[200px] space-y-1 p-2">
        <p className="font-mono text-[10px] text-muted-foreground">{info.formula}</p>
        <p className="text-[10px]">{info.interpretation}</p>
      </TooltipContent>
    </Tooltip>
  );
});

export function IndicatorSelector({
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  onToggleIndicator,
  isOpen,
  onClose,
}: IndicatorSelectorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [customPeriod, setCustomPeriod] = useState<number>(14);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
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
    const map = new Map<string, ActiveIndicator>();
    for (const ind of activeIndicators) {
      const baseId = ind.config.id.split("-")[0];
      if (!map.has(baseId)) map.set(baseId, ind);
    }
    return map;
  }, [activeIndicators]);

  const isActive = useCallback(
    (id: string) => activeIndicators.some((i) => i.config.id.startsWith(id)),
    [activeIndicators]
  );

  // Stable callbacks
  const handleQuickAdd = useCallback(
    (indicator: IndicatorConfig, period?: number) => {
      const params = period ? { ...indicator.defaultParams, period } : indicator.defaultParams;
      onAddIndicator(indicator, params);
      setExpandedId(null);
    },
    [onAddIndicator]
  );

  const handleCustomAdd = useCallback(
    (indicator: IndicatorConfig) => {
      onAddIndicator(indicator, { ...indicator.defaultParams, period: customPeriod });
      setExpandedId(null);
      setCustomPeriod(14);
    },
    [onAddIndicator, customPeriod]
  );

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-lg shadow-lg z-[99999] overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium">Indicators</span>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {activeIndicators.length > 0 && (
          <div className="px-3 py-2 border-b border-border bg-muted/30 space-y-1">
            {activeIndicators.map((ind) => (
              <ActiveIndicatorItem
                key={ind.config.id}
                indicator={ind}
                onToggle={() => onToggleIndicator(ind.config.id)}
                onRemove={() => onRemoveIndicator(ind.config.id)}
              />
            ))}
          </div>
        )}

        <div className="p-2">
          <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Overlays
          </div>
          {overlayIndicators.map((indicator) => (
            <IndicatorRow
              key={indicator.id}
              indicator={indicator}
              info={INDICATOR_INFO[indicator.id]}
              isActive={isActive(indicator.id)}
              activeIndicator={activeIndicatorMap.get(indicator.id)}
              isExpanded={expandedId === indicator.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === indicator.id ? null : indicator.id)
              }
              onQuickAdd={(period) => handleQuickAdd(indicator, period)}
              onCustomAdd={() => handleCustomAdd(indicator)}
              onRemove={() => onRemoveIndicator(indicator.id)}
              customPeriod={customPeriod}
              onPeriodChange={setCustomPeriod}
              presets={INDICATOR_PRESETS[indicator.id] || []}
            />
          ))}
        </div>

        <div className="p-2 border-t border-border">
          <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Oscillators
          </div>
          {oscillatorIndicators.map((indicator) => (
            <IndicatorRow
              key={indicator.id}
              indicator={indicator}
              info={INDICATOR_INFO[indicator.id]}
              isActive={isActive(indicator.id)}
              activeIndicator={activeIndicatorMap.get(indicator.id)}
              isExpanded={expandedId === indicator.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === indicator.id ? null : indicator.id)
              }
              onQuickAdd={(period) => handleQuickAdd(indicator, period)}
              onCustomAdd={() => handleCustomAdd(indicator)}
              onRemove={() => onRemoveIndicator(indicator.id)}
              customPeriod={customPeriod}
              onPeriodChange={setCustomPeriod}
              presets={INDICATOR_PRESETS[indicator.id] || []}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
