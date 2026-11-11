import { describe, expect, test } from "bun:test";
import * as e from "./eip712";
import { keccak } from "./keccak";
import { encode, map } from "./msgpack";

const noopAction = encode(map([["type", "noop"]]));

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const toHex = (b: Uint8Array): string =>
  Array.from(b, (byte) => byte.toString(16).padStart(2, "0")).join("");

const u64 = (v: bigint): Uint8Array => {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, v);
  return out;
};

const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

describe("eip712 exchange domain", () => {
  test("has the documented Exchange domain constants", () => {
    expect(e.EXCHANGE_DOMAIN).toEqual({
      name: "Exchange",
      version: "1",
      chainId: 1337,
      verifyingContract: "0x0000000000000000000000000000000000000000",
    });
  });

  test("hashes the Agent type to 32 bytes", () => {
    expect(e.typeHash("Agent(string source,bytes32 connectionId)").length).toBe(32);
  });

  test("hashes the Agent type deterministically", () => {
    const first = e.typeHash("Agent(string source,bytes32 connectionId)");
    const second = e.typeHash("Agent(string source,bytes32 connectionId)");
    expect(bytesEqual(first, second)).toBe(true);
  });

  test("produces a 32-byte domain separator", () => {
    expect(e.domainSeparator(e.EXCHANGE_DOMAIN).length).toBe(32);
  });

  test("changes the domain separator when the chain id changes", () => {
    const mainnet = e.domainSeparator(e.EXCHANGE_DOMAIN);
    const other = e.domainSeparator({ ...e.EXCHANGE_DOMAIN, chainId: 1338 });
    expect(bytesEqual(mainnet, other)).toBe(false);
  });
});

describe("eip712 l1 action digest", () => {
  test("is deterministic for identical input", () => {
    const first = e.l1ActionDigest({ action: noopAction, nonce: 1_700_000_000_000n });
    const second = e.l1ActionDigest({ action: noopAction, nonce: 1_700_000_000_000n });
    expect(bytesEqual(first, second)).toBe(true);
  });

  test("changes when the vault is set", () => {
    const base = e.l1ActionDigest({ action: noopAction, nonce: 1_700_000_000_000n });
    const vaulted = e.l1ActionDigest({
      action: noopAction,
      nonce: 1_700_000_000_000n,
      vault: "0x1111111111111111111111111111111111111111",
    });
    expect(bytesEqual(base, vaulted)).toBe(false);
  });

  test("changes when expiresAfter is appended", () => {
    const base = e.l1ActionDigest({ action: noopAction, nonce: 1_700_000_000_000n });
    const expiring = e.l1ActionDigest({
      action: noopAction,
      nonce: 1_700_000_000_000n,
      expiresAfter: 1_700_000_300_000n,
    });
    expect(bytesEqual(base, expiring)).toBe(false);
  });

  test("returns 32 bytes and is sensitive to the nonce", () => {
    const digest = e.l1ActionDigest({ action: noopAction, nonce: 1n });
    expect(digest.length).toBe(32);
    const repeat = e.l1ActionDigest({ action: noopAction, nonce: 1n });
    expect(bytesEqual(digest, repeat)).toBe(true);
    const shifted = e.l1ActionDigest({ action: noopAction, nonce: 2n });
    expect(bytesEqual(digest, shifted)).toBe(false);
  });

  test("treats expiresAfter of zero as a present marker", () => {
    const absent = e.l1ActionDigest({ action: noopAction, nonce: 5n });
    const zero = e.l1ActionDigest({ action: noopAction, nonce: 5n, expiresAfter: 0n });
    expect(bytesEqual(absent, zero)).toBe(false);
  });

  test("writes a single 0x00 marker when the vault is absent", () => {
    const digest = e.l1ActionDigest({ action: noopAction, nonce: 1n });
    const connectionId = keccak(concat([noopAction, u64(1n), Uint8Array.of(0x00)]));
    const expected = e.digest(e.EXCHANGE_DOMAIN, "Agent(string source,bytes32 connectionId)", [
      e.encodeTypeValue("string", "a"),
      connectionId,
    ]);
    expect(bytesEqual(digest, expected)).toBe(true);
  });
});

describe("eip712 address encoding", () => {
  test("left-pads an address into bytes 12..32", () => {
    const address = "0x0000000000000000000000000000000000000001";
    const bytes = e.encodeTypeValue("address", address);
    expect(bytes.length).toBe(32);
    for (let i = 0; i < 12; i += 1) {
      expect(bytes[i]).toBe(0);
    }
    expect(bytes[12]).toBe(0x00);
    expect(bytes[31]).toBe(0x01);
    expect(toHex(bytes.subarray(12))).toBe(address.slice(2));
  });
});
