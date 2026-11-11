/**
 * @hyperliquid-api POST /exchange (signing)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing.md
 */

import { describe, expect, test } from "bun:test";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { ValidationError } from "../core/errors";
import { asL1Action, l1ActionDigest } from "../core/eip712";
import { encode, map } from "../core/msgpack";
import { Signer } from "./index";

const PRIVATE_KEY_HEX = "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
const VAULT = "0x1111111111111111111111111111111111111111";

const bytesFromHex = (hex: string): Uint8Array => {
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(body.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

type Sig = { r: string; s: string; v: number };

const recoveredBytes = (sig: Sig): Uint8Array => {
  const out = new Uint8Array(65);
  out[0] = sig.v - 27;
  out.set(bytesFromHex(sig.r), 1);
  out.set(bytesFromHex(sig.s), 33);
  return out;
};

const PRIVATE_KEY = bytesFromHex(PRIVATE_KEY_HEX);
const PUBLIC_KEY = secp256k1.getPublicKey(PRIVATE_KEY, false);
const NOOP_MAP = map([["type", "noop"]]);
const NOOP = asL1Action(NOOP_MAP);

const verify = (sig: Sig, digest: Uint8Array): boolean =>
  secp256k1.verify(recoveredBytes(sig), digest, PUBLIC_KEY, {
    prehash: false,
    lowS: true,
    format: "recovered",
  });

describe("Signer L1", () => {
  test("signs a noop action end-to-end against a fresh digest", () => {
    const signer = new Signer({ privateKey: PRIVATE_KEY });
    const signed = signer.signL1(NOOP, 1n);
    expect(signed.digest.length).toBe(32);
    expect(signed.nonce).toBe(1);
    expect([27, 28]).toContain(signed.signature.v);
    const fresh = l1ActionDigest({ action: encode(NOOP_MAP), nonce: 1n });
    expect(bytesEqual(signed.digest, fresh)).toBe(true);
    expect(verify(signed.signature, fresh)).toBe(true);
  });

  test("signs an approveAgent user-signed action end-to-end", () => {
    const signer = new Signer({ privateKey: PRIVATE_KEY });
    const action = {
      hyperliquidChain: "Mainnet",
      agentAddress: "0x0000000000000000000000000000000000000002",
      agentName: "",
      nonce: 1,
    };
    const signed = signer.signUserSigned("approveAgent", action, 1337);
    expect(signed.digest.length).toBe(32);
    expect(signed.signature.r).toMatch(/^0x[0-9a-f]{64}$/);
    expect(verify(signed.signature, signed.digest)).toBe(true);
  });
});

describe("asL1Action", () => {
  test("builds a wire action when type is the first pair", () => {
    expect(asL1Action(map([["type", "noop"]]))).toEqual({ type: "noop" });
  });

  test("throws when the first pair is not type", () => {
    expect(() => asL1Action(map([["orders", []]]))).toThrow(ValidationError);
  });
});

describe("Signer digest mutation sensitivity", () => {
  const signer = new Signer({ privateKey: PRIVATE_KEY });
  const base = signer.signL1(NOOP, 100n);

  test("changing the nonce changes the digest", () => {
    expect(bytesEqual(base.digest, signer.signL1(NOOP, 101n).digest)).toBe(false);
  });

  test("changing the vault changes the digest", () => {
    expect(bytesEqual(base.digest, signer.signL1(NOOP, 100n, VAULT).digest)).toBe(false);
  });

  test("changing expiresAfter changes the digest", () => {
    expect(bytesEqual(base.digest, signer.signL1(NOOP, 100n, null, 200n).digest)).toBe(false);
  });
});
