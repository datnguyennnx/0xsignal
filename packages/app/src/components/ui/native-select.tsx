import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/core/utils/cn";

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
        wrapperClassName
      )}
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        data-size={size}
        className={cn(
          "h-8 w-full min-w-0 appearance-none rounded-md border border-border/60 bg-background/80 px-2.5 pr-8 text-[12px] leading-none tabular-nums tracking-[0.01em] text-foreground shadow-none transition-[background-color,border-color,color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground/80 hover:bg-muted/35 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 data-[size=sm]:h-7 data-[size=sm]:px-2 data-[size=sm]:pr-7 dark:bg-input/20 dark:hover:bg-input/40 dark:[color-scheme:dark]",
          "focus-visible:border-ring/70 focus-visible:ring-[2px] focus-visible:ring-ring/25",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/25",
          className
        )}
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground/80 select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

function NativeSelectOption({ ...props }: React.ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />;
}

function NativeSelectOptGroup({ className, ...props }: React.ComponentProps<"optgroup">) {
  return <optgroup data-slot="native-select-optgroup" className={cn(className)} {...props} />;
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
