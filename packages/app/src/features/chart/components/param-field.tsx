import { useCallback } from "react";
import type { IndicatorParamDefinition } from "@0xsignal/shared";
import { Plus, Minus } from "lucide-react";
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

  const adjust = useCallback(
    (direction: -1 | 1) => {
      const base = numeric ?? (direction > 0 ? definition.min : definition.max);
      const next = base + definition.step * direction;
      const clamped = Math.min(definition.max, Math.max(definition.min, next));
      const output = definition.control === "int" ? Math.round(clamped) : clamped;
      onValueChange(formatValue(output, definition.step));
    },
    [definition, numeric, onValueChange]
  );

  return (
    <div className="group/param flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-foreground leading-none">
          {definition.label}
        </label>
        <span className="text-[10px] text-muted-foreground leading-none tabular-nums shrink-0">
          {definition.min} – {definition.max}
        </span>
      </div>

      <div className="flex items-center bg-muted/40 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-ring/25 w-full">
        {/* Decrement */}
        <button
          type="button"
          onClick={() => adjust(-1)}
          disabled={numeric !== null && numeric <= definition.min}
          className="h-[clamp(1.75rem,3vh,2.25rem)] w-[clamp(1.75rem,2.5vw,2rem)] flex items-center justify-center hover:bg-accent/30 rounded-l transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none shrink-0"
        >
          <Minus className="size-3.5 opacity-50" />
        </button>

        {/* Value — centered, fills remaining space */}
        <input
          type="number"
          inputMode="decimal"
          min={definition.min}
          max={definition.max}
          step={definition.step}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="flex-1 h-[clamp(1.75rem,3vh,2.25rem)] px-1 text-center text-xs font-semibold bg-transparent text-foreground focus:outline-none tabular-nums select-none min-w-0"
        />

        {/* Increment */}
        <button
          type="button"
          onClick={() => adjust(1)}
          disabled={numeric !== null && numeric >= definition.max}
          className="h-[clamp(1.75rem,3vh,2.25rem)] w-[clamp(1.75rem,2.5vw,2rem)] flex items-center justify-center hover:bg-accent/30 rounded-r transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none shrink-0"
        >
          <Plus className="size-3.5 opacity-50" />
        </button>
      </div>

      {definition.description && (
        <p className="text-[11px] text-muted-foreground leading-tight">{definition.description}</p>
      )}
    </div>
  );
}
