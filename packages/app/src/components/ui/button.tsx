import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

import { surfaceAttrs } from "@/components/surface/tiers";

const buttonVariants = cva(
  "group/button motion-control inline-flex shrink-0 items-center justify-center rounded-control border border-transparent bg-clip-padding type-control font-medium whitespace-nowrap select-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-invalid:border-destructive invalid-ring [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-icon",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        cta: "bg-primary text-primary-foreground hover:bg-primary/80",
        accent: "bg-info text-primary-foreground hover:bg-info/80",
        // Opaque control plate; its rest/hover/active/disabled paint lives in `tier-control`.
        outline: "text-foreground hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-(--control-active-bg) aria-expanded:text-foreground aria-expanded:shadow-[inset_0_0_0_1px_var(--border)]",
        // Icon-only dismiss (dialog/side-panel/indicator close): flat at rest, tinted on
        // hover; legal only where an opaque panel already owns the background, never over media.
        dismiss:
          "border-0 bg-transparent text-muted-foreground shadow-none hover:bg-(--control-hover-bg) hover:text-foreground active:bg-(--control-active-bg)",
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
  // Only the plate variant takes a tier surface; `dismiss` paints none by construction.
  const surface =
    variant === "outline" ? surfaceAttrs({ tier: "control", material: "plate" }) : undefined;
  const resolvedSize = size ?? (variant === "cta" ? "cta" : variant === "dismiss" ? "icon" : "md");
  const classes = cn(
    surface?.className,
    buttonVariants({ variant, size: resolvedSize }),
    !isStatic && "press focus-ring",
    className,
  );

  if (isStatic) {
    return (
      <ButtonPrimitive
        data-slot="button"
        data-static=""
        {...surface}
        className={classes}
        nativeButton={false}
        render={<span role="presentation" />}
        // Presentational chrome must not join the tab order.
        tabIndex={-1}
        {...props}
      />
    );
  }

  return <ButtonPrimitive data-slot="button" {...surface} className={classes} {...props} />;
}

export { Button };
