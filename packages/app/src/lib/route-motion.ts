import type { RouteRecord } from "@/lib/routes";

/**
 * Identity of the screen a route renders, used as the enter-animation key.
 *
 * This is the route *pattern* (`record.path`), never `location.pathname`.
 * `/trade/BTC` → `/trade/ETH` both match `/trade/:symbol`, so the key is stable
 * and the chart is not unmounted/recreated on a symbol switch; only a real
 * screen change (e.g. `/portfolio` → `/whales`) changes the key and replays the
 * enter animation.
 */
export function routeMotionKey(record: Pick<RouteRecord, "path">): string {
  return record.path;
}
