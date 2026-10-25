/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import {
  UntrustedEnvelopeError,
  assertArbitrum,
  assertExchangeEnvelope,
  buildOrderAction,
  signGuardedAction,
} from "./client";
import { WrongChainError } from "./typed-data-guard";

const orderAction = buildOrderAction({
  orders: [{ a: 0, b: true, p: "50000", s: "0.01", r: false, t: { limit: { tif: "Gtc" } } }],
  grouping: "na",
});

const envelope = (patch: Record<string, unknown> = {}): Record<string, unknown> => ({
  action: orderAction,
  signature: { r: `0x${"11".repeat(32)}`, s: `0x${"22".repeat(32)}`, v: 27 },
  nonce: 1_700_000_000_000,
  ...patch,
});

const envelopeError = (value: unknown): Error | null => {
  try {
    assertExchangeEnvelope(value);
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error("non-error rejection");
  }
};

const chainError = (chainId: number): Error | null => {
  try {
    assertArbitrum(chainId);
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error("non-error rejection");
  }
};

describe("assertExchangeEnvelope", () => {
  test("accepts an order envelope without a vault address", () => {
    expect(envelopeError(envelope())).toBeNull();
    expect("vaultAddress" in envelope()).toBe(false);
  });

  test("rejects any vaultAddress field", () => {
    const error = envelopeError(
      envelope({ vaultAddress: "0x0000000000000000000000000000000000000001" }),
    );
    expect(error?.message).toMatch(/vaultAddress is forbidden/);
  });

  test("rejects expiresAfter", () => {
    expect(envelopeError(envelope({ expiresAfter: 1 }))).toBeInstanceOf(UntrustedEnvelopeError);
  });

  test("rejects a non-allowlisted action such as withdraw3", () => {
    const error = envelopeError(envelope({ action: { type: "withdraw3", amount: "1" } }));
    expect(error?.message).toMatch(/not allowed/);
  });

  test("rejects a missing or zero nonce", () => {
    expect(envelopeError(envelope({ nonce: 0 }))?.message).toMatch(/nonce/);
    expect(envelopeError(envelope({ nonce: "1" }))?.message).toMatch(/nonce/);
  });

  test("rejects a non-object payload", () => {
    expect(envelopeError(null)).toBeInstanceOf(UntrustedEnvelopeError);
  });
});

describe("signGuardedAction", () => {
  test("rejects a non-allowlisted action before the signer is invoked", () => {
    let signerCalls = 0;
    const sign = (): Promise<`0x${string}`> => {
      signerCalls += 1;
      return Promise.resolve(`0x${"11".repeat(65)}`);
    };

    expect(() => signGuardedAction({ type: "usdClassTransfer", amount: "1" }, sign)).toThrow(
      /not allowed/,
    );
    expect(signerCalls).toBe(0);
  });
});

describe("assertArbitrum", () => {
  test("accepts 42161 and rejects every other chain", () => {
    expect(chainError(42161)).toBeNull();
    expect(chainError(1)).toBeInstanceOf(WrongChainError);
  });
});
