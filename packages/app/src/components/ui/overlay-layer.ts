/** A portalled overlay is not nested in the page's surfaces, whatever triggered it. */
export const PORTAL_ANCESTORS = [] as const;

/** The stacking origin a portalled popup starts from. */
const OVERLAY_BASE = "var(--z-overlay)";

/** Stack order for a popup layer, relative to the overlay origin. */
export const overlayZ = (step: number): string => `calc(${OVERLAY_BASE} + ${step})`;
