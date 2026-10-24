import { createContext, useContext, useEffect, useMemo } from "react";
import type { ComponentPropsWithoutRef, CSSProperties, ElementType, JSX } from "react";
import { cn } from "cn";
import {
  assertSurfacePlacement,
  TIER_CLASS,
  VARIANT_CLASS,
  type Tier,
  type Variant,
} from "./tiers";

type SurfaceRadius = "panel" | "overlay" | "control" | "chip";

const RADIUS_CLASS: Record<SurfaceRadius, string> = {
  panel: "rounded-[var(--radius-panel)]",
  overlay: "rounded-[var(--radius-overlay)]",
  control: "rounded-[var(--radius-control)]",
  chip: "rounded-[var(--radius-chip)]",
};

const PAINT_UTILITIES = [
  "bg-",
  "backdrop-",
  "border-",
  "shadow-",
  "opacity-",
  "filter-",
  "saturate-",
  "ring-",
  "fill-",
  "stroke-",
] as const;

/** Ancestor tier stack, nearest last. Read by nested surfaces for placement checks. */
export const SurfaceContext = createContext<readonly Tier[]>([]);

export type SurfaceProps = ComponentPropsWithoutRef<"div"> & {
  tier: Tier;
  radius?: SurfaceRadius;
  as?: ElementType;
  variant?: Variant;
  tint?: string;
  interactive?: boolean;
  overMedia?: boolean;
  dim?: boolean;
};

function assertLayoutOnlyClass(className: string | undefined): void {
  if (process.env.NODE_ENV === "production" || className === undefined) return;

  const paint = PAINT_UTILITIES.find((utility) => className.includes(utility));
  if (paint !== undefined) {
    throw new Error(
      `Surface className is layout-only; found "${paint}" in "${className}". Use tier/variant/tint for paint.`,
    );
  }
}

/** Tier owns paint; `className` is layout-only. */
export function Surface({
  tier,
  radius = "panel",
  as,
  variant = "regular",
  tint,
  interactive = false,
  overMedia = false,
  dim = false,
  className,
  style,
  children,
  ...rest
}: SurfaceProps): JSX.Element {
  const ancestors = useContext(SurfaceContext);
  const Component: ElementType = as ?? "div";

  assertLayoutOnlyClass(className);

  const stack = useMemo<readonly Tier[]>(() => [...ancestors, tier], [ancestors, tier]);

  useEffect(() => {
    assertSurfacePlacement({ tier, variant, overMedia, dim }, [...ancestors]);
  }, [tier, variant, overMedia, dim, ancestors]);

  const variantClass = VARIANT_CLASS[variant] || undefined;
  // Identity emits no tier class, so no tier paint can leak.
  const identity = variant === "identity";
  const mergedStyle =
    tint === undefined ? style : ({ ...style, "--surface-tint": tint } as CSSProperties);

  return (
    <SurfaceContext.Provider value={stack}>
      <Component
        className={cn(
          !identity && TIER_CLASS[tier],
          variantClass,
          !identity && interactive && "tier-interactive",
          RADIUS_CLASS[radius],
          className,
        )}
        style={mergedStyle}
        {...rest}
      >
        {children}
      </Component>
    </SurfaceContext.Provider>
  );
}
