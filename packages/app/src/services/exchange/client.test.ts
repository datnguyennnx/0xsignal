/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { asDecimal, toWirePrice, toWireSize, type Transport } from "@0xsignal/sdk-hyperliquid";
import { mnemonicToAccount } from "viem/accounts";
import {
  UntrustedEnvelopeError,
  assertArbitrum,
  buildOrderAction,
  createGuardedExchangeClient,
  signGuardedAction,
} from "./client";
import { WrongChainError, type GuardedWalletDeps } from "./typed-data-guard";

const account = mnemonicToAccount("test test test test test test test test test test test junk");

const deps: GuardedWalletDeps = {
  address: account.address,
  signTypedData: (params) =>
    account.signTypedData(params as unknown as Parameters<typeof account.signTypedData>[0]),
  getChainId: () => Promise.resolve(42161),
};

const orderAction = buildOrderAction({
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
});

const EXCHANGE_OK = {
  status: "ok",
  response: { type: "order", data: { statuses: [{ resting: { oid: 1 } }] } },
};

const captureTransport = (): { bodies: Record<string, unknown>[]; transport: Transport } => {
  const bodies: Record<string, unknown>[] = [];
  const transport = {
    postExchange: (body: Record<string, unknown>) => {
      bodies.push(body);
      return Promise.resolve(EXCHANGE_OK);
    },
  } as unknown as Transport;
  return { bodies, transport };
};

const chainError = (chainId: number): Error | null => {
  try {
    assertArbitrum(chainId);
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error("non-error rejection");
  }
};

describe("createGuardedExchangeClient envelope", () => {
  test("posts only action, nonce and signature, with no vaultAddress or expiresAfter", async () => {
    const { bodies, transport } = captureTransport();
    const nonce = Date.now();
    const client = createGuardedExchangeClient({ deps, nonce, transport });

    await client.order(orderAction);

    expect(bodies).toHaveLength(1);
    const body = bodies[0] ?? {};
    expect(Object.keys(body).sort()).toEqual(["action", "nonce", "signature"]);
    expect(body["nonce"]).toBe(nonce);
    expect(body["action"]).toMatchObject({ type: "order", grouping: "na" });
    expect("vaultAddress" in body).toBe(false);
    expect("expiresAfter" in body).toBe(false);
  });

  test("the posted signature is a real 27/28 recovery signature", async () => {
    const { bodies, transport } = captureTransport();
    const client = createGuardedExchangeClient({ deps, nonce: Date.now(), transport });

    await client.order(orderAction);

    const signature = bodies[0]?.["signature"] as {
      r: `0x${string}`;
      s: `0x${string}`;
      v: number;
    };
    expect(signature.r).toMatch(/^0x[0-9a-f]{64}$/);
    expect(signature.s).toMatch(/^0x[0-9a-f]{64}$/);
    expect([27, 28]).toContain(signature.v);
  });

  test("posts the issued nonce verbatim instead of reading the clock again", async () => {
    const { bodies, transport } = captureTransport();
    const nonce = Date.now() - 60_000;
    const client = createGuardedExchangeClient({ deps, nonce, transport });

    await client.order(orderAction);

    expect(bodies[0]?.["nonce"]).toBe(nonce);
  });
});

describe("signGuardedAction", () => {
  test("allows order, cancel and updateLeverage through to the signer", async () => {
    for (const type of ["order", "cancel", "updateLeverage"]) {
      let signerCalls = 0;
      const value = await signGuardedAction({ type }, () => {
        signerCalls += 1;
        return Promise.resolve(type);
      });
      expect(value).toBe(type);
      expect(signerCalls).toBe(1);
    }
  });

  test("rejects a non-allowlisted action candidate before the signer is invoked", () => {
    for (const action of [
      { type: "withdraw3", amount: "1" },
      { type: "usdClassTransfer", amount: "1" },
      { type: "approveAgent" },
    ]) {
      let signerCalls = 0;
      const rejection = (): void => {
        signGuardedAction(action, () => {
          signerCalls += 1;
          return Promise.resolve("0x");
        });
      };
      expect(rejection).toThrow(UntrustedEnvelopeError);
      expect(rejection).toThrow(/not allowed/);
      expect(signerCalls).toBe(0);
    }
  });

  test("rejects a non-object action", () => {
    expect(() =>
      signGuardedAction(null as unknown as Record<string, unknown>, () => Promise.resolve("0x")),
    ).toThrow(/action is not an object/);
  });
});

describe("assertArbitrum", () => {
  test("accepts 42161 and rejects every other chain", () => {
    expect(chainError(42161)).toBeNull();
    expect(chainError(1)).toBeInstanceOf(WrongChainError);
  });
});
