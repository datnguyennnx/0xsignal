import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "cn";

function NativeSelect({
  className,
  wrapperClassName,
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & {
  wrapperClassName?: string;
}) {
  return (
    <div
      className={cn(
        "group/native-select relative inline-flex w-auto min-w-fit max-w-(--select-max-w) has-[select:disabled]:opacity-50",
        wrapperClassName,
      )}
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        className={cn(
          "motion-control h-control w-full min-w-0 appearance-none rounded-control border border-control-border bg-input px-(--control-px) pe-[calc(var(--control-px)*2+var(--icon))] shadow-(--control-shadow) type-control leading-none num tracking-[0.01em] text-foreground selection:bg-(--control-active-bg) selection:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:border-ring focus-ring",
          "aria-invalid:border-destructive aria-invalid:outline-2 aria-invalid:outline-offset-2 aria-invalid:outline-destructive",
          className,
        )}
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-(--control-px) size-icon -translate-y-1/2 text-muted-foreground select-none"
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

export { NativeSelect, NativeSelectOption };
