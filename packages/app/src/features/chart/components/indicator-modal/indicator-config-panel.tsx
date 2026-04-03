/**
 * @overview Indicator Configuration Panel
 *
 * It manages the form state for updating or adding specific indicator instances.
 * It handles the reconciliation between form inputs and existing active indicators (to detect "Update" vs "Add" actions).
 */
import { useMemo, useState, useCallback } from "react";
import {
  createIndicatorInstanceId,
  normalizeIndicatorParams,
  type ActiveIndicator,
  type IndicatorConfig,
} from "@0xsignal/shared";
import { Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentUnavailable } from "@/components/content-unavailable";
import { IndicatorParamField } from "./indicator-param-field";
import { cn } from "@/core/utils/cn";
import { parseFormValues, toFormValues, getInstanceLabel } from "./utils";

interface IndicatorConfigPanelProps {
  indicator: IndicatorConfig;
  activeIndicators: ActiveIndicator[];
  onApply: (params: Record<string, number>) => void;
  onRemoveInstance: (instanceId: string) => void;
}

export function IndicatorConfigPanel({
  indicator,
  activeIndicators,
  onApply,
  onRemoveInstance,
}: IndicatorConfigPanelProps) {
  // Track selected instance - null means "new/default"
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(() => {
    if (activeIndicators.length > 0) {
      return activeIndicators[0].instanceId;
    }
    return null;
  });

  // Derive form values from selected instance or defaults - no effect needed
  const selectedInstance = useMemo(
    () => activeIndicators.find((i) => i.instanceId === selectedInstanceId) ?? null,
    [activeIndicators, selectedInstanceId]
  );

  const formValues = useMemo(
    () =>
      selectedInstance ? toFormValues(indicator, selectedInstance.params) : toFormValues(indicator),
    [indicator, selectedInstance]
  );

  const parsedParamsForCurrentForm = useMemo(
    () => parseFormValues(indicator, formValues),
    [indicator, formValues]
  );

  const derivedInstanceId = useMemo(
    () => createIndicatorInstanceId(indicator, parsedParamsForCurrentForm),
    [indicator, parsedParamsForCurrentForm]
  );

  const matchingActiveInstance = useMemo(
    () => activeIndicators.find((entry) => entry.instanceId === derivedInstanceId),
    [activeIndicators, derivedInstanceId]
  );

  const handleApply = useCallback(() => {
    onApply(normalizeIndicatorParams(indicator, parsedParamsForCurrentForm));
  }, [indicator, parsedParamsForCurrentForm, onApply]);

  const handleSelectExisting = useCallback((instance: ActiveIndicator) => {
    setSelectedInstanceId(instance.instanceId);
  }, []);

  const handleResetToDefault = useCallback(() => {
    setSelectedInstanceId(null);
  }, []);

  const activeCount = activeIndicators.length;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background">
      <div className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
              Inspector
            </h3>
            <p className="text-xs font-bold mt-1">Settings</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter opacity-30">
              Active
            </p>
            <p className="text-sm font-black tabular-nums leading-none">{activeCount}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-2 scrollbar-none overscroll-none">
        <div className="space-y-6">
          {activeIndicators.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">
                Configurations
              </label>
              <div className="flex flex-wrap gap-1.5">
                {activeIndicators.map((inst) => (
                  <button
                    key={inst.instanceId}
                    type="button"
                    onClick={() => handleSelectExisting(inst)}
                    className={cn(
                      "px-3 py-2 rounded text-[10px] font-mono transition-all min-h-[44px]",
                      selectedInstanceId === inst.instanceId
                        ? "bg-foreground text-background font-bold shadow-sm"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {getInstanceLabel(inst)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className={cn(
                    "px-3 py-2 rounded text-[10px] font-mono transition-all min-h-[44px]",
                    !selectedInstanceId
                      ? "bg-foreground/10 text-foreground font-bold"
                      : "bg-muted/50 text-muted-foreground/60 hover:text-foreground hover:bg-muted"
                  )}
                >
                  + New
                </button>
              </div>
            </div>
          )}

          {indicator.params.length > 0 ? (
            <div className="space-y-8 pt-2">
              {indicator.params.map((paramDef) => (
                <IndicatorParamField
                  key={paramDef.key}
                  definition={paramDef}
                  value={formValues[paramDef.key] ?? ""}
                  onValueChange={() => {
                    // When user edits a field, switch to "new" mode since params no longer match any instance
                    if (selectedInstanceId) setSelectedInstanceId(null);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[200px]">
              <ContentUnavailable
                variant="empty"
                title="Fixed Model"
                description="This strategy utilizes fixed institutional logic and does not require manual parameter adjustment."
              />
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 min-h-[44px] text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            onClick={() =>
              matchingActiveInstance && onRemoveInstance(matchingActiveInstance.instanceId)
            }
            disabled={!matchingActiveInstance}
          >
            <Minus className="w-3 h-3 mr-2" />
            Delete
          </Button>

          <Button
            size="sm"
            className="h-9 min-h-[44px] text-[10px] font-bold uppercase tracking-widest bg-foreground text-background hover:bg-foreground/80 rounded"
            onClick={handleApply}
          >
            <Plus className="w-3 h-3 mr-2" />
            {matchingActiveInstance ? "Update" : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}
