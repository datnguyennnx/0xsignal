/**
 * @overview Indicator Configuration Panel
 *
 * It manages the form state for updating or adding specific indicator instances.
 * It handles the reconciliation between form inputs and existing active indicators (to detect "Update" vs "Add" actions).
 */
import { useEffect, useMemo, useState, useCallback } from "react";
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
import { parseFormValues, toFormValues } from "./utils";

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
  const [formValues, setFormValues] = useState<Record<string, string>>(() =>
    toFormValues(indicator)
  );

  const parsedParams = useMemo(
    () => parseFormValues(indicator, formValues),
    [indicator, formValues]
  );

  const selectedInstanceId = useMemo(
    () => createIndicatorInstanceId(indicator, parsedParams),
    [indicator, parsedParams]
  );

  const selectedInstance = useMemo(
    () => activeIndicators.find((entry) => entry.instanceId === selectedInstanceId),
    [activeIndicators, selectedInstanceId]
  );

  useEffect(() => {
    if (activeIndicators.length === 0) {
      setFormValues(toFormValues(indicator));
      return;
    }

    if (selectedInstance) return;
    setFormValues(toFormValues(indicator, activeIndicators[0].params));
  }, [indicator, activeIndicators, selectedInstance]);

  const updateField = useCallback((key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleApply = useCallback(() => {
    onApply(normalizeIndicatorParams(indicator, parsedParams));
  }, [indicator, parsedParams, onApply]);

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
        <div className="space-y-8">
          {indicator.params.length > 0 ? (
            <div className="space-y-8">
              {indicator.params.map((paramDef) => (
                <IndicatorParamField
                  key={paramDef.key}
                  definition={paramDef}
                  value={formValues[paramDef.key] ?? ""}
                  onValueChange={(next) => updateField(paramDef.key, next)}
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
            className="h-9 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            onClick={() => selectedInstance && onRemoveInstance(selectedInstance.instanceId)}
            disabled={!selectedInstance}
          >
            <Minus className="w-3 h-3 mr-2" />
            Delete
          </Button>

          <Button
            size="sm"
            className="h-9 text-[10px] font-bold uppercase tracking-widest bg-foreground text-background hover:bg-foreground/80 rounded"
            onClick={handleApply}
          >
            <Plus className="w-3 h-3 mr-2" />
            {selectedInstance ? "Update" : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}
