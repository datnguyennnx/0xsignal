/**
 * @hyperliquid-api POST /exchange action "agentSendAsset"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import type { Address, DecimalString } from "../../core/brands";
import { map, type MpMap } from "../../core/msgpack";

export type AgentSendAssetAction = {
  readonly type: "agentSendAsset";
  readonly destination: Address;
  readonly sourceDex: string;
  readonly destinationDex: string;
  readonly token: number;
  readonly amount: DecimalString;
  readonly fromSubAccount: boolean;
  readonly nonce: number;
};

export function encodeAgentSendAsset(action: AgentSendAssetAction): MpMap {
  return map([
    ["type", action.type],
    ["destination", action.destination],
    ["sourceDex", action.sourceDex],
    ["destinationDex", action.destinationDex],
    ["token", action.token],
    ["amount", action.amount],
    ["fromSubAccount", action.fromSubAccount],
    ["nonce", action.nonce],
  ]);
}
