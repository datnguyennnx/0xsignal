import { useContext, useMemo } from "react";
import type { ComponentPropsWithoutRef, CSSProperties, ElementType, JSX } from "react";
import { cn } from "cn";
import { SurfaceContext } from "./surface-context";
import {
  assertSurfacePlacement,
  TIER_CLASS,
  VARIANT_CLASS,
  type SurfaceFrame,
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

/** Alpha modifiers and literal colour functions re-declare material the tier already owns. */
const RAW_ALPHA =
  /(?:^|:)(?:bg|border|text|fill|stroke|ring|shadow|divide|outline|from|via|to)-[^/\s:]+[/]\d+/;
const RAW_COLOR = /oklch\(|rgb\(|hsl\(|#/;

/** The first offending class token, named in full so the fix is obvious. */
function findPaintToken(className: string): string | undefined {
  for (const token of className.split(/\s+/)) {
    if (token === "") continue;
    if (PAINT_UTILITIES.some((utility) => token.includes(utility))) return token;
    if (RAW_ALPHA.test(token) || RAW_COLOR.test(token)) return token;
  }
  return undefined;
}

/** Caller label, e.g. `coin-price-dialog.tsx:171`, so every failure names its author. */
function callerLabel(): string {
  // Stack capture is the hot cost, so production folds this branch away entirely.
  if (process.env.NODE_ENV === "production") return "";

  const frames = new Error().stack?.split("\n") ?? [];
  for (const frame of frames) {
    if (frame.includes("surface.tsx") || frame.includes("react-dom")) continue;
    const match = frame.match(/[/\\]([^/\\?]+\.(?:tsx?|jsx?))(?:\?[^:]*)?:(\d+)/);
    if (match !== null) return `${match[1]}:${match[2]}`;
  }
  return "";
}

export type SurfaceProps = ComponentPropsWithoutRef<"div"> & {
  tier: Tier;
  radius?: SurfaceRadius;
  /** Render as another element (`aside`, `header`, …) so no wrapper shifts layout. */
  as?: ElementType;
  variant?: Variant;
  tint?: string;
  interactive?: boolean;
  overMedia?: boolean;
  dim?: boolean;
  /** Opt out over dense content (candles, orderbook rows), where a second blur hurts legibility. */
  blur?: boolean;
};

function assertLayoutOnlyClass(className: string | undefined, owner: string): void {
  if (process.env.NODE_ENV === "production" || className === undefined) return;

  const token = findPaintToken(className);
  if (token === undefined) return;

  const where = owner === "" ? "" : ` at ${owner}`;
  throw new Error(
    `Surface className is layout-only; found "${token}" in "${className}"${where}. Use tier/variant/tint (or --surface-tint) for paint.`,
  );
}

/** Tier owns paint; `className` is layout-only and the tier is exposed as `data-tier`. */
export function Surface({
  tier,
  radius = "panel",
  as,
  variant = "regular",
  tint,
  interactive = false,
  overMedia = false,
  dim = false,
  blur = true,
  className,
  style,
  children,
  ...rest
}: SurfaceProps): JSX.Element {
  const ancestors = useContext(SurfaceContext);
  const Component: ElementType = as ?? "div";
  const owner = callerLabel();

  assertLayoutOnlyClass(className, owner);
  assertSurfacePlacement({ tier, variant, overMedia, dim, owner }, ancestors);

  const stack = useMemo<readonly SurfaceFrame[]>(
    () => [...ancestors, { tier, owner }],
    [ancestors, tier, owner],
  );

  const variantClass = VARIANT_CLASS[variant] || undefined;
  // Identity emits no tier class, so no tier paint can leak.
  const identity = variant === "identity";
  const mergedStyle =
    tint === undefined ? style : ({ ...style, "--surface-tint": tint } as CSSProperties);

  return (
    <SurfaceContext.Provider value={stack}>
      <Component
        {...rest}
        data-tier={tier}
        data-glass-depth={ancestors.length}
        data-glass-blur={blur ? undefined : "off"}
        className={cn(
          !identity && TIER_CLASS[tier],
          variantClass,
          !identity && interactive && "tier-interactive",
          RADIUS_CLASS[radius],
          className,
        )}
        style={mergedStyle}
      >
        {children}
      </Component>
    </SurfaceContext.Provider>
  );
}
