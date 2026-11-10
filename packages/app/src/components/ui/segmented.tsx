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
  disabled?: boolean;
  className?: string;
};

function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  "aria-label": ariaLabel,
  sizing = "intrinsic",
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
        "tier-well inline-flex h-control items-center gap-(--seg-inset) rounded-control p-(--seg-inset) type-control text-muted-foreground",
        isFill ? "w-full" : "w-fit",
        className,
      )}
    >
      {options.map((option) => {
        const isDisabled = disabled || option.disabled === true;

        return (
          <label
            key={option.value}
            className={cn(
              "motion-control relative inline-flex h-full cursor-pointer items-center justify-center gap-(--control-gap) rounded-[calc(var(--radius-control)-var(--seg-inset))] px-(--control-px) font-medium whitespace-nowrap select-none",
              isFill ? "flex-1" : "flex-none",
              "hover:text-foreground focus-ring-has",
              "has-[:checked]:bg-(--control-active-bg) has-[:checked]:text-foreground has-[:checked]:shadow-[inset_0_1px_0_var(--control-active-rim),inset_0_0_0_1px_var(--border)]",
              isDisabled ? "pointer-events-none opacity-50" : undefined,
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={isDisabled}
              onChange={() => {
                onValueChange(option.value);
              }}
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

export { Segmented, type SegmentedOption };
