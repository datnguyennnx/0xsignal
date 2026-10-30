import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "cn";

const inputVariants = cva("", {
  variants: {
    size: {
      default: "",
      field: "h-[var(--field-h)] px-[var(--space-2)] text-base sm:text-sm",
      "field-num":
        "h-[var(--field-h)] w-20 px-[var(--space-2)] text-base sm:text-sm text-center tabular-nums",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

function Input({
  className,
  type,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & {
  size?: "default" | "field" | "field-num";
}) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-[var(--control-h-lg)] w-full min-w-0 rounded-[var(--control-radius-md)] border border-input bg-transparent px-[var(--control-px-md)] py-1 text-[length:var(--control-text-md)] transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/40",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/25 dark:aria-invalid:ring-destructive/40",
        inputVariants({ size }),
        className,
      )}
      {...props}
    />
  );
}

export { Input };
