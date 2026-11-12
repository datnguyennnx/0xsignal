export type Tier = "solid" | "content" | "control" | "floating" | "scrim";

const TIER_CLASS: Record<Tier, string> = {
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

export type Material = "frost" | "solid" | "glass" | "plate" | "none";

type Thickness = "thin" | "regular" | "thick";

/**
 * Per-tier material contract: solid/content are frost or opaque paint, floating blurs,
 * control is always an opaque plate (glass is a container material, never a control's),
 * scrim paints nothing.
 */
export type TierMaterialDefault = {
  solid: { material: "frost" | "solid" | "plate"; thickness?: never };
  content: { material: "frost" | "solid" | "plate"; thickness?: never };
  control: { material: "plate"; thickness?: never };
  floating: { material: "glass" | "plate"; thickness?: Thickness };
  scrim: { material: "none"; thickness?: never };
};

/** Tier defaults, so a caller can paint a layer without restating its material. */
const DEFAULT_MATERIAL: TierMaterialDefault = {
  solid: { material: "frost" },
  content: { material: "plate" },
  control: { material: "plate" },
  floating: { material: "glass", thickness: "regular" },
  scrim: { material: "none" },
};

/** Legal material set per tier; content/solid never render glass, control never does either. */
const TIER_MATERIALS: Record<Tier, readonly Material[]> = {
  solid: ["frost", "solid", "plate"],
  content: ["frost", "solid", "plate"],
  control: ["plate", "none"],
  floating: ["glass", "plate", "none"],
  scrim: ["none"],
};

function isTier(value: string): value is Tier {
  return Object.hasOwn(DEFAULT_MATERIAL, value);
}

const GLASS_TIERS: ReadonlySet<Tier> = new Set(
  Object.keys(DEFAULT_MATERIAL).filter(
    (tier): tier is Tier => isTier(tier) && DEFAULT_MATERIAL[tier].material === "glass",
  ),
);

export interface SurfaceAttrs {
  "data-tier": Tier;
  "data-material": Material;
  "data-glass-depth"?: number;
  "data-thickness"?: Thickness;
  className: string;
}

type DepthArg = { depth?: number | undefined };

/**
 * Per-tier discriminated input, so `{ tier: "content", material: "glass" }` cannot type-check.
 * The broad member keeps non-literal `tier` call sites compiling. The combined solid/content member
 * covers a tier expression that resolves to either frost-default tier, and the control member accepts
 * only an opaque plate or `none` so a control can never resolve to a glass surface. The
 * control/floating split keeps a `"glass" | "none"` variable assignable without allowing
 * thickness on a non-glass literal, which the glass members alone cover.
 */
export type SurfaceAttrsInput =
  | (DepthArg & { tier: Tier; material?: never; thickness?: never })
  | (DepthArg & { tier: "solid"; material?: "frost" | "solid" | "plate"; thickness?: never })
  | (DepthArg & { tier: "content"; material?: "frost" | "solid" | "plate"; thickness?: never })
  | (DepthArg & {
      tier: "solid" | "content";
      material?: "frost" | "solid" | "plate";
      thickness?: never;
    })
  | (DepthArg & { tier: "control"; material?: "plate" | "none"; thickness?: never })
  | (DepthArg & { tier: "floating"; material?: "glass"; thickness?: Thickness })
  | (DepthArg & { tier: "floating"; material?: "glass" | "plate" | "none"; thickness?: never })
  | (DepthArg & { tier: "scrim"; material?: "none"; thickness?: never });

/** Whether `material` is legal for `tier`; content and solid must never render glass. */
export function isMaterialFor(tier: Tier, material: Material): boolean {
  return TIER_MATERIALS[tier].includes(material);
}

/** Resolves tier defaults into the exact `data-*` paint contract for a rendered surface. */
export function surfaceAttrs(input: SurfaceAttrsInput): SurfaceAttrs;
export function surfaceAttrs(input: {
  tier: Tier;
  material?: Material | undefined;
  thickness?: Thickness | undefined;
  depth?: number | undefined;
}): SurfaceAttrs;
export function surfaceAttrs({
  tier,
  material,
  thickness,
  depth,
}: {
  tier: Tier;
  material?: Material | undefined;
  thickness?: Thickness | undefined;
  depth?: number | undefined;
}): SurfaceAttrs {
  const fallback = DEFAULT_MATERIAL[tier];
  let resolvedMaterial: Material = fallback.material;
  if (material !== undefined) {
    if (isMaterialFor(tier, material)) {
      resolvedMaterial = material;
    } else {
      fail(`material "${material}" is not allowed on tier "${tier}".`);
      resolvedMaterial = fallback.material;
    }
  }
  const resolvedThickness =
    resolvedMaterial === "glass" ? (thickness ?? fallback.thickness ?? "regular") : undefined;

  return {
    "data-tier": tier,
    "data-material": resolvedMaterial,
    ...(depth === undefined ? {} : { "data-glass-depth": depth }),
    ...(resolvedThickness === undefined ? {} : { "data-thickness": resolvedThickness }),
    className: TIER_CLASS[tier],
  };
}

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
