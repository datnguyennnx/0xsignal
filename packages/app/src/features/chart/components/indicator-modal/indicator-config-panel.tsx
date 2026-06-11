/**
 * @overview Indicator Configuration Panel
 *
 * It manages the form state for updating or adding specific indicator instances.
 * It handles the reconciliation between form inputs and existing active indicators (to detect "Update" vs "Add" actions).
 */
import { useMemo, useState, useCallback, useEffect } from "react";
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
  // Track selected instance - null means "new/default"
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(() => {
    if (activeIndicators.length > 0) {
      return activeIndicators[0].instanceId;
    }
    return null;
  });

  // Track local edits when user manually changes form fields
  const [localEdits, setLocalEdits] = useState<Record<string, string> | null>(null);

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

  // Merge local edits (if any) on top of memoized formValues so keystrokes are reflected
  const effectiveValues = useMemo(() => {
    if (!localEdits) return formValues;
    return { ...formValues, ...localEdits };
  }, [formValues, localEdits]);

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
    const parsed = parseFormValues(indicator, effectiveValues);
    onApply(normalizeIndicatorParams(indicator, parsed));
  }, [indicator, effectiveValues, onApply]);

  // Reset local edits only when indicator changes (not on selectedInstanceId change,
  // because onValueChange also calls setSelectedInstanceId(null) and the effect
  // would silently discard the user's first keystroke)
  useEffect(() => {
    setLocalEdits(null);
  }, [indicator.id]);

  const activeCount = activeIndicators.length;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background">
      <div className="p-[clamp(1rem,2vw,1.5rem)]">
        <div className="flex items-start justify-between gap-[clamp(0.5rem,1vw,1rem)]">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              Indicator Settings
            </h3>
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              Configure parameters for this technical indicator.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-muted-foreground/70 font-medium">
              {activeCount} active
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-[clamp(1rem,2vw,1.5rem)] py-[clamp(0.75rem,1vw,1rem)] scrollbar-none overscroll-none">
        <div className="space-y-6">
          {indicator.params.length > 0 ? (
            <div className="flex flex-col gap-4">
              {indicator.params.map((paramDef) => (
                <IndicatorParamField
                  key={paramDef.key}
                  definition={paramDef}
                  value={effectiveValues[paramDef.key] ?? ""}
                  onValueChange={(next) => {
                    // Capture user edits into local state so form reflects keystrokes
                    setLocalEdits((prev) => {
                      const merged = { ...(prev ?? formValues), [paramDef.key]: next };
                      return merged;
                    });
                    // When user edits a field, switch to "new" mode since params no longer match any instance
                    if (selectedInstanceId) setSelectedInstanceId(null);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[clamp(10rem,30dvh,14rem)]">
              <ContentUnavailable
                variant="empty"
                title="Fixed Model"
                description="This strategy utilizes fixed institutional logic and does not require manual parameter adjustment."
              />
            </div>
          )}
        </div>
      </div>

      <div className="p-[clamp(1rem,2vw,1.5rem)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[clamp(2.5rem,5vh,3rem)] text-xs font-semibold rounded-lg active:scale-[0.97]"
            onClick={() =>
              matchingActiveInstance && onRemoveInstance(matchingActiveInstance.instanceId)
            }
            disabled={!matchingActiveInstance}
          >
            <Minus className="size-3.5" />
            Delete
          </Button>

          <Button
            size="sm"
            className="min-h-[clamp(2.5rem,5vh,3rem)] text-xs font-semibold rounded-lg active:scale-[0.97] bg-foreground text-background hover:bg-foreground/85"
            onClick={handleApply}
          >
            <Plus className="size-3.5" />
            {matchingActiveInstance ? "Update" : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}
