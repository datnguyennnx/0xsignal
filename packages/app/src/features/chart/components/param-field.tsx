import { useCallback, useId } from "react";
import type { IndicatorParamDefinition } from "@0xsignal/shared";
import { Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseParamInput } from "../utils/indicator-param-utils";

interface IndicatorParamFieldProps {
  definition: IndicatorParamDefinition;
  value: string;
  onValueChange: (next: string) => void;
}

const formatValue = (value: number, step: number): string => {
  if (Number.isInteger(step)) {
    return `${Math.round(value)}`;
  }
  const decimals = step.toString().includes(".") ? step.toString().split(".")[1].length : 2;
  return value.toFixed(Math.min(decimals, 4)).replace(/0+$/, "").replace(/\.$/, "");
};

export function IndicatorParamField({
  definition,
  value,
  onValueChange,
}: IndicatorParamFieldProps) {
  const numeric = parseParamInput(value);
  const inputId = useId();

  const adjust = useCallback(
    (direction: -1 | 1) => {
      const base = numeric ?? (direction > 0 ? definition.min : definition.max);
      const next = base + definition.step * direction;
      const clamped = Math.min(definition.max, Math.max(definition.min, next));
      const output = definition.control === "int" ? Math.round(clamped) : clamped;
      onValueChange(formatValue(output, definition.step));
    },
    [definition, numeric, onValueChange],
  );

  return (
    <div className="group/param flex flex-col gap-field">
      <div className="flex items-baseline justify-between gap-field">
        <label htmlFor={inputId} className="type-control font-medium text-foreground leading-none">
          {definition.label}
        </label>
        <span className="type-data text-muted-foreground leading-none tabular-nums shrink-0">
          {definition.min} – {definition.max}
        </span>
      </div>

      <div className="flex items-center bg-muted/40 rounded-control overflow-hidden focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring w-full">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            adjust(-1);
          }}
          disabled={numeric !== null && numeric <= definition.min}
          aria-label={`Decrease ${definition.label}`}
          className="min-h-[40px] min-w-[40px] after:hidden shrink-0 rounded-l rounded-r-none hover:bg-(--control-hover-bg) transition-[background-color,transform] duration-(--dur-fast) active:scale-[0.97]"
        >
          <Minus className="size-icon-sm opacity-50" aria-hidden="true" />
        </Button>

        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          min={definition.min}
          max={definition.max}
          step={definition.step}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
          }}
          className="flex-1 h-[clamp(1.75rem,3vh,2.25rem)] rounded-none border-0 px-1 py-0 text-center type-body font-semibold text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-transparent"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            adjust(1);
          }}
          disabled={numeric !== null && numeric >= definition.max}
          aria-label={`Increase ${definition.label}`}
          className="min-h-[40px] min-w-[40px] after:hidden shrink-0 rounded-l-none rounded-r hover:bg-(--control-hover-bg) transition-[background-color,transform] duration-(--dur-fast) active:scale-[0.97]"
        >
          <Plus className="size-icon-sm opacity-50" aria-hidden="true" />
        </Button>
      </div>

      {definition.description !== undefined && definition.description !== "" && (
        <p className="type-data text-muted-foreground leading-tight">{definition.description}</p>
      )}
    </div>
  );
}
