"use client";

import * as React from "react";
import { cn } from "cn";

type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
};

type SegmentedProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  "aria-label": string;
  /** `intrinsic` tracks content width; `fill` shares equal columns. */
  sizing?: "intrinsic" | "fill";
  /** `dense` tightens padding and type for four-cell groups. */
  dense?: boolean;
  disabled?: boolean;
  className?: string;
};

function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  "aria-label": ariaLabel,
  sizing = "intrinsic",
  dense = false,
  disabled = false,
  className,
}: SegmentedProps<T>) {
  const name = React.useId();
  const isFill = sizing === "fill";

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      data-slot="segmented"
      data-sizing={sizing}
      className={cn(
        "tier-well inline-flex h-control min-w-0 max-w-full items-center gap-(--seg-inset) rounded-control border border-(--well-border) p-[3px] type-control text-muted-foreground",
        isFill ? "w-full" : "w-fit",
        className,
      )}
    >
      {options.map((option) => {
        const isDisabled = disabled || option.disabled === true;
        const isSelected = value === option.value;

        return (
          <label
            key={option.value}
            className={cn(
              "motion-control relative inline-flex h-full cursor-pointer min-w-0 items-center justify-center gap-(--control-gap) rounded-[calc(var(--radius-control)-3px)] font-medium select-none",
              dense ? "px-1" : "px-(--control-px)",
              isFill ? "flex-1" : "flex-none",
              isSelected ? "bg-(--surface-overlay) font-semibold shadow-(--shadow-e1)" : undefined,
              "hover:text-foreground focus-ring-has",
              isDisabled ? "pointer-events-none opacity-50" : undefined,
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option.value}
              checked={isSelected}
              disabled={isDisabled}
              onChange={() => {
                onValueChange(option.value);
              }}
            />
            <span className="min-w-0 truncate">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export { Segmented, type SegmentedOption };
