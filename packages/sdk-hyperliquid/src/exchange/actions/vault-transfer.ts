/**
 * @hyperliquid-api POST /exchange action "vaultTransfer"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import type { Address } from "../../core/brands";
import { map, type MpMap } from "../../core/msgpack";

export type VaultTransferAction = {
  readonly type: "vaultTransfer";
  readonly vaultAddress: Address;
  readonly isDeposit: boolean;
  readonly usd: number;
};

export function encodeVaultTransfer(action: VaultTransferAction): MpMap {
  return map([
    ["type", action.type],
    ["vaultAddress", action.vaultAddress],
    ["isDeposit", action.isDeposit],
    ["usd", action.usd],
  ]);
}
