import { matchPath } from "react-router";
import { AssetDetailSkeleton } from "@/components/asset-detail-skeleton";
import { ROUTES } from "@/lib/routes";

/**
 * A chunk that resolves inside this window swaps in with no skeleton at all:
 * the top progress bar carries the signal, the eye never sees a flash.
 */
export const ROUTE_FALLBACK_DELAY_MS = 280;

export type RouteFallbackKind = "asset-detail" | "page";

/** The two trade route shapes declare `AssetDetailSkeleton` in `lib/routes`. */
const ASSET_DETAIL_PATHS = ROUTES.filter((route) => route.fallback === AssetDetailSkeleton).map(
  (route) => route.path,
);

export function pickRouteFallback(pathname: string): RouteFallbackKind {
  for (const path of ASSET_DETAIL_PATHS) {
    if (matchPath({ path, end: true }, pathname) !== null) return "asset-detail";
  }
  return "page";
}

/**
 * Arms the reveal timer and returns its cancel function. Kept separate from the
 * hook so the delay contract is testable without a DOM.
 */
export function startRouteFallbackDelay(
  reveal: () => void,
  delayMs: number = ROUTE_FALLBACK_DELAY_MS,
): () => void {
  // render-path-allow: one-shot bounded reveal of the skeleton, cleared on unmount
  const timer = setTimeout(reveal, delayMs);
  return () => {
    clearTimeout(timer);
  };
}
