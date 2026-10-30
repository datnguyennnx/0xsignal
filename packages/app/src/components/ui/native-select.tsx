import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "cn";

function NativeSelect({
  className,
  wrapperClassName,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default";
  wrapperClassName?: string;
}) {
  return (
    <div
      className={cn(
        "group/native-select relative inline-flex w-auto min-w-fit max-w-[16rem] has-[select:disabled]:opacity-50",
        wrapperClassName,
      )}
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        data-size={size}
        className={cn(
          "h-[var(--control-h-md)] w-full min-w-0 appearance-none rounded-[var(--control-radius-md)] tier-control px-[var(--control-px-md)] pr-[calc(var(--control-px-lg)+var(--control-px-md)+var(--control-px-xs))] text-[length:var(--control-text-md)] leading-none tabular-nums tracking-[0.01em] text-foreground transition-[background-color,border-color,color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground hover:bg-muted/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 data-[size=sm]:h-[var(--control-h-sm)] data-[size=sm]:px-[var(--control-px-sm)] data-[size=sm]:pr-[calc(var(--control-px-md)+var(--control-px-sm)+var(--control-px-xs))] dark:bg-input/25 dark:hover:bg-input/40 dark:[color-scheme:dark]",
          "focus-visible:border-ring/60 focus-visible:ring-[2px] focus-visible:ring-ring/40",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/25",
          className,
        )}
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

function NativeSelectOption({ className, ...props }: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[color:Canvas] text-[color:CanvasText]", className)}
      {...props}
    />
  );
}

function NativeSelectOptGroup({ className, ...props }: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[color:Canvas] text-[color:CanvasText]", className)}
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
