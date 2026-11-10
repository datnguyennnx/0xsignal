import * as React from "react";
import { cn } from "cn";

function Input({ className, type, ...props }: Omit<React.ComponentProps<"input">, "size">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "motion-control h-control w-full min-w-0 rounded-control border border-control-border bg-input px-(--control-px) shadow-(--shadow-e1) type-control selection:bg-(--control-active-bg) selection:text-foreground file:inline-flex file:h-full file:border-0 file:bg-transparent file:type-control file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-ring",
        "aria-invalid:border-destructive invalid-ring",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
