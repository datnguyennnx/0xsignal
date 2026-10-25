/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { AbstractWalletError, createL1ActionHash, signL1Action } from "@nktkas/hyperliquid/signing";
import { mnemonicToAccount } from "viem/accounts";
import { concat, recoverTypedDataAddress, toHex } from "viem";
import { buildOrderAction } from "./client";
import {
  ARBITRUM_CHAIN_ID,
  EXCHANGE_DOMAIN_CHAIN_ID,
  EXCHANGE_DOMAIN_NAME,
  EXCHANGE_DOMAIN_VERSION,
  ZERO_ADDRESS,
  createGuardedWallet,
  type GuardedWalletDeps,
} from "./typed-data-guard";

const account = mnemonicToAccount("test test test test test test test test test test test junk");

const deps = (chainId: number): GuardedWalletDeps => ({
  signTypedData: (params) => account.signTypedData(params),
  getAddresses: () => Promise.resolve([account.address]),
  getChainId: () => Promise.resolve(chainId),
});

const signatureToHex = (signature: { r: `0x${string}`; s: `0x${string}`; v: 27 | 28 }) =>
  concat([signature.r, signature.s, toHex(signature.v)]);

const rejectionOf = async (run: () => Promise<unknown>): Promise<Error | null> => {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error("non-error rejection");
  }
};

const action = buildOrderAction({
  orders: [{ a: 0, b: true, p: "50000", s: "0.01", r: false, t: { limit: { tif: "Gtc" } } }],
  grouping: "na",
});

describe("signer recovery round trip", () => {
  test("the recovered signer equals the wallet address", async () => {
    const nonce = 1_700_000_000_000;
    const wallet = createGuardedWallet(deps(ARBITRUM_CHAIN_ID));
    const signature = await signL1Action({ wallet, action, nonce });
    const connectionId = createL1ActionHash({ action, nonce });

    const recovered = await recoverTypedDataAddress({
      domain: {
        name: EXCHANGE_DOMAIN_NAME,
        version: EXCHANGE_DOMAIN_VERSION,
        chainId: EXCHANGE_DOMAIN_CHAIN_ID,
        verifyingContract: ZERO_ADDRESS,
      },
      types: {
        Agent: [
          { name: "source", type: "string" },
          { name: "connectionId", type: "bytes32" },
        ],
      },
      primaryType: "Agent",
      message: { source: "a", connectionId },
      signature: signatureToHex(signature),
    });

    expect(recovered).toBe(account.address);
    expect(connectionId).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("an off-Arbitrum wallet produces no signature", async () => {
    const wallet = createGuardedWallet(deps(1));
    const error = await rejectionOf(() =>
      signL1Action({ wallet, action, nonce: 1_700_000_000_000 }),
    );
    expect(error).toBeInstanceOf(AbstractWalletError);
  });
});
