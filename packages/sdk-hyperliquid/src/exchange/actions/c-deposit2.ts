/**
 * @hyperliquid-api POST /exchange action "cDeposit2" (agent-signable)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";

export type CDeposit2Action = {
  readonly wei: number;
};

export const C_DEPOSIT2_TYPE = "cDeposit2" as const;

export function encodeCDeposit2(action: CDeposit2Action): MpMap {
  return map([
    ["type", C_DEPOSIT2_TYPE],
    ["wei", action.wei],
  ]);
}
