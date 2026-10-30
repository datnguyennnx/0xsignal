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

interface TierContract {
  layer: "content" | "floating" | "backdrop";
  /** Nesting guard only: solid, content and control drop their depth-0 blur when nested. */
  blur: boolean;
  /** Placement rule in prose; the runtime guards below enforce the hard parts. */
  allowedOn: string;
}

// Only data-glass-depth="0" blurs; nested tiers paint a translucent fill instead.
const TIER_CONTRACT: Record<Tier, TierContract> = {
  solid: {
    layer: "content",
    blur: false,
    allowedOn: "page content that scrolls under other surfaces",
  },
  content: {
    layer: "content",
    blur: false,
    allowedOn:
      "page content tiles; paints --glass-fill with the hairline edge and shared lift exactly as solid does, so the two differ only in semantic intent",
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

/** Correctness violations throw in every build, so none can ship silently. */
function violation(message: string): never {
  throw new Error(message);
}

const at = (owner: string | undefined): string =>
  owner === undefined || owner === "" ? "" : ` at ${owner}`;

/** Pure, so it is safe to call during render; a glass-on-glass stack throws in production too. */
export function assertSurfacePlacement(
  input: SurfacePlacement,
  ancestors: readonly SurfaceFrame[],
): void {
  const { tier, variant, overMedia, dim, owner } = input;

  // Identity paints nothing, so no placement rule can apply.
  if (variant === "identity") return;

  if (BLUR_TIERS.has(tier)) {
    const glassAncestor = ancestors.find((ancestor) => BLUR_TIERS.has(ancestor.tier));
    if (glassAncestor !== undefined) {
      // A nested backdrop-filter costs 2^(N-1) paint passes, so it fails the render, not warns.
      violation(
        `tier "${tier}"${at(owner)} sits ${ancestors.length} deep inside tier "${glassAncestor.tier}"${at(glassAncestor.owner)}: glass on glass destroys legibility. Use tier="content" for the inner layer.`,
      );
    }
  }

  if (tier === "scrim" && ancestors.some((ancestor) => ancestor.tier === "scrim")) {
    fail(`tier "scrim"${at(owner)} is nested inside another "scrim": one scrim per stack.`);
  }

  if (variant === "clear") {
    if (!overMedia) {
      fail(
        `variant "clear"${at(owner)} requires overMedia: it is only legible over media-rich backdrops.`,
      );
    }
    if (BLUR_TIERS.has(tier) && !dim) {
      fail(
        `variant "clear" on tier "${tier}"${at(owner)} requires dim: Apple prescribes a 35% dimming layer.`,
      );
    }
  }
}
