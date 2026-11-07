export type Tier = "solid" | "content" | "control" | "floating" | "scrim";

export const TIER_CLASS: Record<Tier, string> = {
  solid: "tier-solid",
  content: "tier-content",
  control: "tier-control",
  floating: "tier-floating",
  scrim: "tier-scrim",
};

export type Variant = "regular" | "clear" | "identity";

export const VARIANT_CLASS: Record<Variant, string> = {
  regular: "",
  clear: "variant-clear",
  identity: "tier-identity",
};

/** One rendered surface in the ancestor stack, outermost first. */
export interface SurfaceFrame {
  tier: Tier;
  /** Dev caller label, e.g. `coin-price-dialog.tsx:171`; empty in production. */
  owner: string;
}

export type Material = "glass" | "plate" | "none";

export type Thickness = "thin" | "regular" | "thick";

/** Tier defaults, so a caller can paint glass without restating the material. */
export const DEFAULT_MATERIAL: Record<Tier, { material: Material; thickness?: Thickness }> = {
  solid: { material: "glass", thickness: "thick" },
  content: { material: "glass", thickness: "regular" },
  control: { material: "glass", thickness: "thin" },
  floating: { material: "glass", thickness: "regular" },
  scrim: { material: "none" },
};

function isTier(value: string): value is Tier {
  return Object.hasOwn(DEFAULT_MATERIAL, value);
}

const GLASS_TIERS: ReadonlySet<Tier> = new Set(
  Object.keys(DEFAULT_MATERIAL).filter(
    (tier): tier is Tier => isTier(tier) && DEFAULT_MATERIAL[tier].material === "glass",
  ),
);

export interface SurfacePlacement {
  tier: Tier;
  variant: Variant;
  overMedia: boolean;
  dim: boolean;
  /** Caller label, so the failure names the file/component that wrote the surface. */
  owner?: string;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Legibility hints: dev throws so the call site gets fixed, prod warns instead of blanking the app. */
function fail(message: string): void {
  if (IS_PRODUCTION) {
    console.warn(`[surface] ${message}`);
    return;
  }
  throw new Error(message);
}

const at = (owner: string | undefined): string =>
  owner === undefined || owner === "" ? "" : ` at ${owner}`;

/**
 * Pure, so it is safe to call during render.
 * A glass tier nested in a glass ancestor is legal: only the outermost frame renders the
 * material, and every frame below it paints a translucent fill.
 */
export function assertSurfacePlacement(
  input: SurfacePlacement,
  ancestors: readonly SurfaceFrame[],
): void {
  const { tier, variant, overMedia, dim, owner } = input;

  // Identity paints nothing, so no placement rule can apply.
  if (variant === "identity") return;

  if (tier === "scrim" && ancestors.some((ancestor) => ancestor.tier === "scrim")) {
    fail(`tier "scrim"${at(owner)} is nested inside another "scrim": one scrim per stack.`);
  }

  if (variant === "clear") {
    if (!overMedia) {
      fail(
        `variant "clear"${at(owner)} requires overMedia: it is only legible over media-rich backdrops.`,
      );
    }
    if (GLASS_TIERS.has(tier) && !dim) {
      fail(
        `variant "clear" on tier "${tier}"${at(owner)} requires dim: Apple prescribes a 35% dimming layer.`,
      );
    }
  }
}
