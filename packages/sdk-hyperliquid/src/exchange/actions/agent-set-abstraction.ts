/**
 * @hyperliquid-api POST /exchange action "agentSetAbstraction"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";

export type AgentSetAbstractionAction = {
  readonly type: "agentSetAbstraction";
  readonly abstraction: "u" | "p" | "i";
};

export function encodeAgentSetAbstraction(action: AgentSetAbstractionAction): MpMap {
  return map([
    ["type", action.type],
    ["abstraction", action.abstraction],
  ]);
}
