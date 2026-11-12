import { useContext, useMemo } from "react";
import type { ComponentPropsWithoutRef, ElementType, JSX } from "react";
import { cn } from "cn";
import { SurfaceContext } from "./surface-context";
import {
  assertSurfacePlacement,
  surfaceAttrs,
  VARIANT_CLASS,
  type SurfaceAttrsInput,
  type SurfaceFrame,
  type SurfacePlacement,
  type Variant,
} from "./tiers";

type SurfaceRadius = "panel" | "overlay" | "control" | "chip";

// Vite folds this to `false` in production, so no label or token work ships.
const DEV = import.meta.env.DEV;

const RADIUS_CLASS: Record<SurfaceRadius, string> = {
  panel: "rounded-panel",
  overlay: "rounded-overlay",
  control: "rounded-control",
  chip: "rounded-chip",
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
  const frames = new Error().stack?.split("\n") ?? [];
  for (const frame of frames) {
    if (frame.includes("surface.tsx") || frame.includes("react-dom")) continue;
    const match = frame.match(/[/\\]([^/\\?]+\.(?:tsx?|jsx?))(?:\?[^:]*)?:(\d+)/);
    if (match !== null) return `${match[1]}:${match[2]}`;
  }
  return "";
}

/**
 * One stack capture per element type, not per mounted surface: every `Surface` with the
 * same `as` inherits from the same call site, so the label only has to be found once.
 */
const ownerByType = new WeakMap<object, string>();

/** Intrinsic tags are primitives, so each one gets a stable stand-in key. */
const tagKey = new Map<string, object>();

function tagKeyFor(tag: string): object {
  const existing = tagKey.get(tag);
  if (existing !== undefined) return existing;

  const key = {};
  tagKey.set(tag, key);
  return key;
}

function callerLabelFor(type: ElementType): string {
  const key = typeof type === "string" ? tagKeyFor(type) : type;

  const cached = ownerByType.get(key);
  if (cached !== undefined) return cached;

  const label = callerLabel();
  ownerByType.set(key, label);
  return label;
}

/** Distributes `Omit` over the per-tier union so each member keeps its own material/thickness. */
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type SurfaceProps = ComponentPropsWithoutRef<"div"> &
  DistOmit<SurfaceAttrsInput, "depth"> & {
    radius?: SurfaceRadius;
    /** Render as another element (`aside`, `header`, …) so no wrapper shifts layout. */
    as?: ElementType;
    variant?: Variant;
    interactive?: boolean;
    overMedia?: boolean;
    dim?: boolean;
  };

function assertLayoutOnlyClass(className: string | undefined, owner: string): void {
  if (className === undefined) return;

  const token = findPaintToken(className);
  if (token === undefined) return;

  const where = owner === "" ? "" : ` at ${owner}`;
  throw new Error(
    `Surface className is layout-only; found "${token}" in "${className}"${where}. Use tier or variant for paint.`,
  );
}

/** Tier owns paint; `className` is layout-only and the tier is exposed as `data-tier`. */
export function Surface({
  tier,
  radius,
  as,
  variant = "regular",
  interactive = false,
  overMedia = false,
  dim = false,
  material,
  thickness,
  className,
  style,
  children,
  ...rest
}: SurfaceProps): JSX.Element {
  const ancestors = useContext(SurfaceContext);
  const Component: ElementType = as ?? "div";
  const owner = DEV ? callerLabelFor(Component) : "";

  if (DEV) assertLayoutOnlyClass(className, owner);
  const placement: SurfacePlacement = { tier, variant, overMedia, dim, owner };
  assertSurfacePlacement(placement, ancestors);

  const stack = useMemo<readonly SurfaceFrame[]>(() => {
    const frame: SurfaceFrame = { tier, owner };
    return [...ancestors, frame];
  }, [ancestors, tier, owner]);

  const depth = stack.length - 1;
  const attrs = useMemo(
    () => surfaceAttrs({ tier, material, thickness, depth }),
    [tier, material, thickness, depth],
  );
  const variantClass = VARIANT_CLASS[variant] || undefined;
  // Identity emits no tier class, so no tier paint can leak.
  const identity = variant === "identity";

  return (
    <SurfaceContext.Provider value={stack}>
      <Component
        {...rest}
        {...attrs}
        data-radius={radius}
        className={cn(
          !identity && attrs.className,
          variantClass,
          !identity && interactive && "tier-interactive",
          RADIUS_CLASS[radius ?? "panel"],
          className,
        )}
        style={style}
      >
        {children}
      </Component>
    </SurfaceContext.Provider>
  );
}
