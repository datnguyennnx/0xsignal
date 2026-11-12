"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

import { surfaceAttrs } from "@/components/surface/tiers";

const toggleVariants = cva(
  "motion-control group/toggle inline-flex h-control min-w-(--control-h) cursor-pointer items-center justify-center gap-(--control-gap) rounded-control px-(--control-px) type-control font-medium whitespace-nowrap focus-ring hover:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-pressed:text-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/25 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--icon)",
  {
    variants: {
      variant: {
        default: "",
        outline: "border border-input",
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
  material = "plate",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants> & { material?: "plate" | "none" }) {
  const surface = surfaceAttrs({ tier: "control", material });

  return (
    <TogglePrimitive
      data-slot="toggle"
      {...surface}
      className={cn(surface.className, toggleVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Toggle };
