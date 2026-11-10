"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

import { surfaceAttrs } from "@/components/surface/tiers";

const toggleVariants = cva(
  "tier-control motion-control group/toggle inline-flex h-control min-w-(--control-h) items-center justify-center gap-(--control-gap) rounded-control px-(--control-px) type-control font-medium whitespace-nowrap focus-ring hover:bg-(--control-hover-bg) hover:text-foreground disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/25 aria-pressed:bg-(--control-active-bg) aria-pressed:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--icon)",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-(--control-hover-bg)",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Toggle({
  className,
  variant = "default",
  material = "glass",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants> & { material?: "glass" | "none" }) {
  const surface = surfaceAttrs({
    tier: "control",
    material: material === "glass" ? "glass" : "none",
  });

  return (
    <TogglePrimitive
      data-slot="toggle"
      {...surface}
      className={cn(toggleVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Toggle };
