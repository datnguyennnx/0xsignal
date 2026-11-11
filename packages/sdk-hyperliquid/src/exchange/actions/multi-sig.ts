/**
 * @hyperliquid-api POST /exchange action "multiSig"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import type { Address } from "../../core/brands";
import { map, type MpMap } from "../../core/msgpack";
import type { EcdsaSignature } from "../../core/secp";

export type MultiSigSignature = EcdsaSignature;

export type MultiSigPayload = {
  readonly multiSigUser: Address;
  readonly outerSigner: Address;
  readonly action: MpMap;
};

export type MultiSigAction = {
  readonly type: "multiSig";
  readonly signatureChainId: string;
  readonly signatures: readonly MultiSigSignature[];
  readonly payload: MultiSigPayload;
};

export function encodeMultiSig(action: MultiSigAction): MpMap {
  const signatures = action.signatures.map((s) =>
    map([
      ["r", s.r],
      ["s", s.s],
      ["v", s.v],
    ]),
  );
  const payload: MpMap = map([
    ["multiSigUser", action.payload.multiSigUser],
    ["outerSigner", action.payload.outerSigner],
    ["action", action.payload.action],
  ]);
  return map([
    ["type", action.type],
    ["signatureChainId", action.signatureChainId],
    ["signatures", signatures],
    ["payload", payload],
  ]);
}
