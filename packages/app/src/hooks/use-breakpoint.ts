/**
 * Breakpoint Detection Hook
 *
 * @uses matchMedia API (efficient, no polling)
 * @breakpoints mobile: <768px, tablet: 768-1023px, desktop: >=1024px
 */

import { useState, useEffect } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

const BREAKPOINTS = { mobile: 0, tablet: 768, desktop: 1024 };

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => {
    if (typeof window === "undefined") return "desktop";
    const w = window.innerWidth;
    if (w < BREAKPOINTS.tablet) return "mobile";
    if (w < BREAKPOINTS.desktop) return "tablet";
    return "desktop";
  });

  useEffect(() => {
    const mq = {
      mobile: window.matchMedia(`(max-width: ${BREAKPOINTS.tablet - 1}px)`),
      tablet: window.matchMedia(
        `(min-width: ${BREAKPOINTS.tablet}px) and (max-width: ${BREAKPOINTS.desktop - 1}px)`
      ),
      desktop: window.matchMedia(`(min-width: ${BREAKPOINTS.desktop}px)`),
    };

    const handler = () => {
      if (mq.mobile.matches) setBp("mobile");
      else if (mq.tablet.matches) setBp("tablet");
      else setBp("desktop");
    };

    mq.mobile.addEventListener("change", handler);
    mq.tablet.addEventListener("change", handler);
    mq.desktop.addEventListener("change", handler);
    handler();

    return () => {
      mq.mobile.removeEventListener("change", handler);
      mq.tablet.removeEventListener("change", handler);
      mq.desktop.removeEventListener("change", handler);
    };
  }, []);

  return bp;
}

export const CHART_CONFIG = {
  mobile: { initialCandles: 100, loadMoreCandles: 100, visibleCandles: 80 },
  tablet: { initialCandles: 200, loadMoreCandles: 200, visibleCandles: 150 },
  desktop: { initialCandles: 350, loadMoreCandles: 300, visibleCandles: 250 },
} as const;

export function useChartConfig() {
  return CHART_CONFIG[useBreakpoint()];
}
