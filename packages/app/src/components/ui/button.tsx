import type * as React from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

import { surfaceAttrs } from "@/components/surface/tiers";

const buttonVariants = cva(
  "group/button motion-control inline-flex shrink-0 items-center justify-center rounded-control border border-transparent bg-clip-padding type-control font-medium whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive invalid-ring [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-icon",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        cta: "bg-primary text-primary-foreground hover:bg-primary/80",
        accent: "bg-info text-primary-foreground hover:bg-info/80",
        outline:
          "tier-control hover:bg-(--control-hover-bg) hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-(--control-active-bg) aria-expanded:text-foreground aria-expanded:shadow-[inset_0_0_0_1px_var(--border)]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        md: "h-(--action-h) gap-(--control-gap) px-(--control-px)",
        cta: "h-(--control-h-cta) gap-(--control-gap) px-(--control-px)",
        icon: "size-(--icon-btn) p-0 shrink-0 justify-center hit-area [--hit-min:var(--icon-btn)]",
        auto: "h-auto rounded-none border-0 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Badge/link chrome: paints like a button but has no press, focus or disabled semantics. */
    static?: boolean;
  };

function Button({
  className,
  variant = "default",
  size,
  static: isStatic = false,
  ...props
}: ButtonProps) {
  const surface =
    variant === "outline"
      ? surfaceAttrs({ tier: "control", material: "glass", thickness: "thin" })
      : undefined;
  const resolvedSize = size ?? (variant === "cta" ? "cta" : "md");
  const classes = cn(
    buttonVariants({ variant, size: resolvedSize }),
    !isStatic && "press focus-ring",
    className,
  );

  if (isStatic) {
    // eslint-disable-next-line typescript/no-unsafe-type-assertion
    const staticProps = props as React.ComponentProps<"span">;
    return (
      <span
        role="presentation"
        data-slot="button"
        data-static=""
        {...surface}
        className={classes}
        {...staticProps}
      />
    );
  }

  return <ButtonPrimitive data-slot="button" {...surface} className={classes} {...props} />;
}

export { Button };
