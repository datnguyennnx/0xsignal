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
  regular: "variant-regular",
  clear: "variant-clear",
  identity: "tier-identity",
};

interface TierContract {
  layer: "content" | "floating" | "backdrop";
  blur: boolean;
  /** Placement rule in prose; the runtime guards below enforce the hard parts. */
  allowedOn: string;
}

// Record<Tier, …> makes a missing tier a type error.
const TIER_CONTRACT: Record<Tier, TierContract> = {
  solid: {
    layer: "content",
    blur: false,
    allowedOn: "page content that scrolls under other surfaces",
  },
  content: {
    layer: "content",
    blur: false,
    allowedOn: "inside a solid region; never carries its own material",
  },
  control: {
    layer: "content",
    blur: false,
    allowedOn:
      "form controls; carries a resting inset edge so it stays visible on a same-tone parent",
  },
  floating: {
    layer: "floating",
    blur: true,
    allowedOn: "portals and overlays above the page; never inside another blur tier",
  },
  scrim: {
    layer: "backdrop",
    blur: false,
    allowedOn: "behind a modal; never nested in another scrim",
  },
};

const BLUR_TIERS: ReadonlySet<string> = new Set(
  Object.entries(TIER_CONTRACT)
    .filter(([, contract]) => contract.blur)
    .map(([tier]) => tier),
);

export interface SurfacePlacement {
  tier: Tier;
  variant: Variant;
  overMedia: boolean;
  dim: boolean;
}

/** Dev-only placement check; pure, so safe in an effect and unit-testable. */
export function assertSurfacePlacement(input: SurfacePlacement, ancestorTiers: Tier[]): void {
  if (process.env.NODE_ENV === "production") return;

  const { tier, variant, overMedia, dim } = input;

  // Identity paints nothing, so no placement rule can apply.
  if (variant === "identity") return;

  if (BLUR_TIERS.has(tier)) {
    const glassAncestor = ancestorTiers.find((ancestor) => BLUR_TIERS.has(ancestor));
    if (glassAncestor !== undefined) {
      throw new Error(
        `Tier "${tier}" cannot be nested inside "${glassAncestor}": glass on glass destroys legibility.`,
      );
    }
  }

  if (tier === "scrim" && ancestorTiers.includes("scrim")) {
    throw new Error('Tier "scrim" cannot be nested inside another "scrim".');
  }

  if (variant === "clear") {
    if (!overMedia) {
      throw new Error(
        'Variant "clear" requires overMedia: it is only legible over media-rich backdrops.',
      );
    }
    if (BLUR_TIERS.has(tier) && !dim) {
      throw new Error(
        'Variant "clear" on a blur tier requires dim: Apple prescribes a 35% dimming layer.',
      );
    }
  }
}
