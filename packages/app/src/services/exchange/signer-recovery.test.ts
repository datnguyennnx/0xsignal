/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { asDecimal, encodeL1Action, toWirePrice, toWireSize } from "@0xsignal/sdk-hyperliquid";
import { l1ActionHashHex, signL1With, type L1TypedData } from "@0xsignal/sdk-hyperliquid/signing";
import { concat, recoverTypedDataAddress, toHex } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { buildOrderAction } from "./client";
import {
  ARBITRUM_CHAIN_ID,
  WrongChainError,
  createGuardedWallet,
  type GuardedWalletDeps,
} from "./typed-data-guard";

const EXCHANGE_DOMAIN_NAME = "Exchange";
const EXCHANGE_DOMAIN_VERSION = "1";
const EXCHANGE_DOMAIN_CHAIN_ID = 1337;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const account = mnemonicToAccount("test test test test test test test test test test test junk");

const deps = (chainId: number): GuardedWalletDeps => ({
  address: account.address,
  signTypedData: (params) =>
    account.signTypedData(params as unknown as Parameters<typeof account.signTypedData>[0]),
  getChainId: () => Promise.resolve(chainId),
});

const signatureToHex = (signature: {
  readonly r: string;
  readonly s: string;
  readonly v: 27 | 28;
}): `0x${string}` =>
  concat([signature.r as `0x${string}`, signature.s as `0x${string}`, toHex(signature.v)]);

const rejectionOf = async (run: () => Promise<unknown>): Promise<Error | null> => {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error("non-error rejection");
  }
};

type RecoveryParams = Parameters<typeof recoverTypedDataAddress>[0];

type RecoveryDomain = {
  readonly name: string;
  readonly version: string;
  readonly chainId: number;
  readonly verifyingContract: string;
};

const recover = (params: {
  domain: RecoveryDomain;
  types: L1TypedData["types"];
  message: L1TypedData["message"];
  signature: `0x${string}`;
}): Promise<string> =>
  recoverTypedDataAddress({
    domain: {
      ...params.domain,
      verifyingContract: params.domain.verifyingContract as `0x${string}`,
    },
    types: params.types,
    primaryType: "Agent",
    message: params.message,
    signature: params.signature,
  } as RecoveryParams);

const action = {
  type: "order",
  ...buildOrderAction({
    orders: [
      {
        a: 0,
        b: true,
        p: toWirePrice(asDecimal("50000"), 5, "perp"),
        s: toWireSize(asDecimal("0.01"), 5),
        r: false,
        t: { limit: { tif: "Gtc" } },
      },
    ],
    grouping: "na",
  }),
};

const nonce = 1_700_000_000_000n;
const connectionId = l1ActionHashHex({ action: encodeL1Action(action), nonce });

describe("signer recovery round trip", () => {
  test("the recovered signer equals the wallet address", async () => {
    const wallet = createGuardedWallet(deps(ARBITRUM_CHAIN_ID));
    const signed = await signL1With(wallet, action, nonce);

    expect(signed.typedData.domain).toEqual({
      name: EXCHANGE_DOMAIN_NAME,
      version: EXCHANGE_DOMAIN_VERSION,
      chainId: EXCHANGE_DOMAIN_CHAIN_ID,
      verifyingContract: ZERO_ADDRESS,
    });
    expect(signed.typedData.primaryType).toBe("Agent");
    expect(signed.typedData.message).toEqual({ source: "a", connectionId });
    expect(connectionId).toMatch(/^0x[0-9a-f]{64}$/);

    const recovered = await recover({
      domain: signed.typedData.domain,
      types: signed.typedData.types,
      message: signed.typedData.message,
      signature: signatureToHex(signed.signature),
    });

    expect(recovered).toBe(account.address);
  });

  test("a signature for one chain cannot be replayed on another chain", async () => {
    const wallet = createGuardedWallet(deps(ARBITRUM_CHAIN_ID));
    const signed = await signL1With(wallet, action, nonce);

    const replayed = await recover({
      domain: { ...signed.typedData.domain, chainId: EXCHANGE_DOMAIN_CHAIN_ID + 1 },
      types: signed.typedData.types,
      message: signed.typedData.message,
      signature: signatureToHex(signed.signature),
    });

    expect(replayed).not.toBe(account.address);
  });

  test("a signature for one action cannot be replayed for another", async () => {
    const wallet = createGuardedWallet(deps(ARBITRUM_CHAIN_ID));
    const signed = await signL1With(wallet, action, nonce);

    const replayed = await recover({
      domain: signed.typedData.domain,
      types: signed.typedData.types,
      message: { source: "a", connectionId: `0x${"22".repeat(32)}` },
      signature: signatureToHex(signed.signature),
    });

    expect(replayed).not.toBe(account.address);
  });

  test("an off-Arbitrum wallet produces no signature", async () => {
    const wallet = createGuardedWallet(deps(1));
    const error = await rejectionOf(() => signL1With(wallet, action, nonce));
    expect(error).toBeInstanceOf(WrongChainError);
    expect(error?.message).toContain(String(ARBITRUM_CHAIN_ID));
  });
});
