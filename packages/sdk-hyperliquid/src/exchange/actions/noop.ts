/**
 * @hyperliquid-api POST /exchange action "noop"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";

export type NoopAction = Record<string, never>;

export const NOOP_TYPE = "noop" as const;

export function encodeNoop(_action: NoopAction): MpMap {
  return map([["type", NOOP_TYPE]]);
}
