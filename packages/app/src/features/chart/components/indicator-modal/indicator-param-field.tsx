/**
 * @overview Indicator Parameter Input Field
 *
 * Renders a specialized numeric input with increment/decrement buttons for indicator parameters.
 * Supports integer and float constraints defined in the indicator's metadata.
 */
import { useCallback } from "react";
import type { IndicatorParamDefinition } from "@0xsignal/shared";
import { Plus, Minus } from "lucide-react";
import { parseParamInput } from "./utils";

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
    <div className="group/param flex flex-col gap-1.5 transition-all">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex flex-col gap-0.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 group-hover/param:text-foreground transition-colors leading-none">
            {definition.label}
          </label>
          <p className="text-[10px] text-muted-foreground font-mono leading-none opacity-30">
            {definition.min} {"->"} {definition.max}
          </p>
        </div>

        <div className="flex items-center ring-1 ring-border/30 rounded-xl overflow-hidden bg-muted/5 group-hover/param:ring-muted-foreground/30 transition-all">
          <button
            type="button"
            onClick={() => adjust(-1)}
            className="w-7 h-7 flex items-center justify-center hover:bg-muted active:bg-muted-foreground/10 transition-colors border-r"
          >
            <Minus className="w-3 h-3 opacity-30" />
          </button>

          <input
            type="number"
            inputMode="decimal"
            min={definition.min}
            max={definition.max}
            step={definition.step}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className="w-12 h-7 px-1 text-center text-xs font-bold bg-transparent focus:outline-none tabular-nums select-none"
          />

          <button
            type="button"
            onClick={() => adjust(1)}
            className="w-7 h-7 flex items-center justify-center hover:bg-muted active:bg-muted-foreground/10 transition-colors border-l"
          >
            <Plus className="w-3 h-3 opacity-40" />
          </button>
        </div>
      </div>

      {definition.description && (
        <p className="text-[10px] text-muted-foreground leading-tight max-w-[90%] opacity-50 group-hover/param:opacity-100 transition-opacity">
          {definition.description}
        </p>
      )}
    </div>
  );
}
