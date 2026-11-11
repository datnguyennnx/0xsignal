/**
 * @hyperliquid-api POST /exchange action "agentEnableDexAbstraction"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";

export type AgentEnableDexAbstractionAction = {
  readonly type: "agentEnableDexAbstraction";
};

export function encodeAgentEnableDexAbstraction(action: AgentEnableDexAbstractionAction): MpMap {
  return map([["type", action.type]]);
}
