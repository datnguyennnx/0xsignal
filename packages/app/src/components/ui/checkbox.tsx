import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "cn";

function Checkbox({
  checked,
  onCheckedChange,
  className,
  children,
  disabled,
  "aria-invalid": ariaInvalid,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "size" | "checked" | "onChange"> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "group/checkbox relative inline-flex cursor-pointer items-center gap-inline type-control select-none has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
        className,
      )}
    >
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          "motion-control inline-flex size-icon shrink-0 items-center justify-center rounded-chip border",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
          "peer-aria-[invalid=true]:border-destructive",
          checked
            ? "border-info bg-info text-primary-foreground shadow-[inset_0_1px_0_var(--control-active-rim)]"
            : "border-control-border bg-(--control-bg) group-hover/checkbox:border-control-border",
        )}
      >
        {checked && <CheckIcon className="size-icon-sm" />}
      </span>
      {children}
    </label>
  );
}

export { Checkbox };
