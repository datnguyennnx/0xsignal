"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const toggleVariants = cva(
  "tier-control group/toggle inline-flex items-center justify-center gap-1 rounded-[var(--control-radius-md)] font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-[120ms] outline-none hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/25 aria-pressed:bg-accent aria-pressed:text-accent-foreground dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-accent",
      },
      size: {
        default:
          "h-[var(--control-h-md)] min-w-[var(--control-h-md)] px-[var(--control-px-md)] text-[length:var(--control-text-md)] has-data-[icon=inline-end]:pr-[var(--control-px-sm)] has-data-[icon=inline-start]:pl-[var(--control-px-sm)]",
        sm: "h-[var(--control-h-sm)] min-w-[var(--control-h-sm)] rounded-[var(--control-radius-sm)] px-[var(--control-px-md)] text-[length:var(--control-text-sm)] has-data-[icon=inline-end]:pr-[var(--control-px-xs)] has-data-[icon=inline-start]:pl-[var(--control-px-xs)] [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant = "default",
  size = "default",
  material = "glass",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants> & { material?: "glass" | "none" }) {
  const isGlass = material === "glass";

  return (
    <TogglePrimitive
      data-slot="toggle"
      data-material={isGlass ? "glass" : undefined}
      data-thickness={isGlass ? "thin" : undefined}
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle };
