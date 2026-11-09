import { useMemo, useState, useCallback } from "react";
import {
  createIndicatorInstanceId,
  normalizeIndicatorParams,
  type ActiveIndicator,
  type IndicatorConfig,
} from "@0xsignal/shared";
import { Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { IndicatorParamField } from "./param-field";
import { parseFormValues, toFormValues } from "../utils/indicator-param-utils";

interface IndicatorConfigPanelProps {
  indicator: IndicatorConfig;
  activeIndicators: ActiveIndicator[];
  onApply: (params: Record<string, number>) => void;
  onRemoveInstance: (instanceId: string) => void;
}

function IndicatorConfigPanelInner({
  indicator,
  activeIndicators,
  onApply,
  onRemoveInstance,
}: IndicatorConfigPanelProps) {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(() => {
    if (activeIndicators.length > 0) {
      return activeIndicators[0].instanceId;
    }
    return null;
  });

  const [localEdits, setLocalEdits] = useState<Record<string, string> | null>(null);

  const selectedInstance = useMemo(
    () => activeIndicators.find((i) => i.instanceId === selectedInstanceId) ?? null,
    [activeIndicators, selectedInstanceId],
  );

  const formValues = useMemo(
    () =>
      selectedInstance ? toFormValues(indicator, selectedInstance.params) : toFormValues(indicator),
    [indicator, selectedInstance],
  );

  const effectiveValues = useMemo(() => {
    if (!localEdits) return formValues;
    return { ...formValues, ...localEdits };
  }, [formValues, localEdits]);

  const parsedParamsForCurrentForm = parseFormValues(indicator, formValues);
  const derivedInstanceId = createIndicatorInstanceId(indicator, parsedParamsForCurrentForm);

  const matchingActiveInstance = activeIndicators.find(
    (entry) => entry.instanceId === derivedInstanceId,
  );

  const handleApply = useCallback(() => {
    const parsed = parseFormValues(indicator, effectiveValues);
    onApply(normalizeIndicatorParams(indicator, parsed));
  }, [indicator, effectiveValues, onApply]);

  const activeCount = activeIndicators.length;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-transparent">
      <div className="p-panel">
        <div className="flex items-start justify-between gap-inline">
          <div className="min-w-0 flex flex-col gap-field">
            <h3 className="type-body font-semibold text-foreground">Indicator Settings</h3>
            <p className="type-label text-muted-foreground leading-relaxed">
              Configure parameters for this technical indicator.
            </p>
          </div>
          <span className="shrink-0 whitespace-nowrap type-label font-medium text-muted-foreground tabular-nums">
            {activeCount} active
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-panel py-2 scrollbar-none overscroll-none">
        {indicator.params.length > 0 ? (
          <div className="flex flex-col gap-field">
            {indicator.params.map((paramDef) => (
              <IndicatorParamField
                key={paramDef.key}
                definition={paramDef}
                value={effectiveValues[paramDef.key] ?? ""}
                onValueChange={(next) => {
                  setLocalEdits((prev) => {
                    const merged = { ...(prev ?? formValues), [paramDef.key]: next };
                    return merged;
                  });
                  if (selectedInstanceId !== null) setSelectedInstanceId(null);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[clamp(10rem,30dvh,14rem)]">
            <EmptyState
              variant="panel"
              className="min-w-0 px-4"
              title="Fixed Model"
              description="This strategy utilizes fixed institutional logic and does not require manual parameter adjustment."
            />
          </div>
        )}
      </div>

      <div className="p-panel">
        <div className="grid grid-cols-1 gap-field">
          <Button
            variant="ghost"
            className="font-semibold active:scale-[0.97]"
            onClick={() => {
              if (matchingActiveInstance !== undefined) {
                onRemoveInstance(matchingActiveInstance.instanceId);
              }
            }}
            disabled={matchingActiveInstance === undefined}
          >
            <Minus className="size-icon-sm" />
            Delete
          </Button>

          <Button
            className="font-semibold active:scale-[0.97] bg-info text-primary-foreground hover:bg-info/80"
            onClick={handleApply}
          >
            <Plus className="size-icon-sm" />
            {matchingActiveInstance ? "Update" : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Keys the inner form by `indicator.id` so local state resets when the indicator changes. */
export function IndicatorConfigPanel(props: IndicatorConfigPanelProps) {
  return <IndicatorConfigPanelInner key={props.indicator.id} {...props} />;
}
