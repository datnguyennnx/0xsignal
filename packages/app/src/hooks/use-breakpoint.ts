/**
 * @overview Breakpoint Detection Hook
 *
 * Provides real-time detection of viewport size for responsive layout adjustments.
 * Includes device-specific chart configurations (initial candles, etc.).
 *
 * @mechanism
 * - Uses native matchMedia API for high-performance event-driven updates (no polling)
 * - Returns semantic breakpoint labels (mobile, tablet, desktop, wide)
 *
 * @breakpoints mobile: <640px, tablet: 640-1023px, desktop: 1024-1535px, wide: >=1536px
 */

import { useState, useEffect } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop" | "wide";

export const BREAKPOINTS = {
  mobile: 0,
  tablet: 640,
  desktop: 1024,
  wide: 1536,
} as const;

function getBreakpoint(width: number): Breakpoint {
  if (width < BREAKPOINTS.tablet) return "mobile";
  if (width < BREAKPOINTS.desktop) return "tablet";
  if (width < BREAKPOINTS.wide) return "desktop";
  return "wide";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => {
    if (typeof window === "undefined") return "desktop";
    return getBreakpoint(window.innerWidth);
  });

  useEffect(() => {
    const mq = {
      mobile: window.matchMedia(`(max-width: ${BREAKPOINTS.tablet - 1}px)`),
      tablet: window.matchMedia(
        `(min-width: ${BREAKPOINTS.tablet}px) and (max-width: ${BREAKPOINTS.desktop - 1}px)`
      ),
      desktop: window.matchMedia(
        `(min-width: ${BREAKPOINTS.desktop}px) and (max-width: ${BREAKPOINTS.wide - 1}px)`
      ),
      wide: window.matchMedia(`(min-width: ${BREAKPOINTS.wide}px)`),
    };

    const handler = () => {
      if (mq.mobile.matches) setBp("mobile");
      else if (mq.tablet.matches) setBp("tablet");
      else if (mq.desktop.matches) setBp("desktop");
      else setBp("wide");
    };

    mq.mobile.addEventListener("change", handler);
    mq.tablet.addEventListener("change", handler);
    mq.desktop.addEventListener("change", handler);
    mq.wide.addEventListener("change", handler);
    handler();

    return () => {
      mq.mobile.removeEventListener("change", handler);
      mq.tablet.removeEventListener("change", handler);
      mq.desktop.removeEventListener("change", handler);
      mq.wide.removeEventListener("change", handler);
    };
  }, []);

  return bp;
}

export const CHART_CONFIG = {
  mobile: { initialCandles: 100, loadMoreCandles: 100, visibleCandles: 80 },
  tablet: { initialCandles: 200, loadMoreCandles: 200, visibleCandles: 150 },
  desktop: { initialCandles: 350, loadMoreCandles: 300, visibleCandles: 250 },
  wide: { initialCandles: 500, loadMoreCandles: 350, visibleCandles: 320 },
} as const;

export function useChartConfig() {
  return CHART_CONFIG[useBreakpoint()];
}
