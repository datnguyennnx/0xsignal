/**
 * @hyperliquid-api POST /exchange action "approveAgent" (user-signed EIP-712)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import { ZERO_ADDRESS, type Eip712FieldType } from "../../core/eip712";
import type { Address } from "../../core/brands";
import { ValidationError } from "../../core/errors";

export type ApproveAgentAction = {
  agentAddress: Address;
  agentName: string;
  nonce: number;
  hyperliquidChain: "Mainnet" | "Testnet";
  signatureChainId: string;
};

export const APPROVE_AGENT = {
  type: "approveAgent" as const,
  typeName: "ApproveAgent" as const,
  fieldTypes: [
    "string",
    "address",
    "string",
    "uint64",
  ] as const satisfies readonly Eip712FieldType[],
  encode: encodeApproveAgent,
} as const;

function encodeApproveAgent(action: ApproveAgentAction): MpMap {
  if (action.agentAddress.toLowerCase() === ZERO_ADDRESS) {
    throw new ValidationError("action.agentAddress", "non-zero address");
  }
  return map([
    ["type", APPROVE_AGENT.type],
    ["agentAddress", action.agentAddress],
    ["agentName", action.agentName],
    ["nonce", action.nonce],
  ]);
}
