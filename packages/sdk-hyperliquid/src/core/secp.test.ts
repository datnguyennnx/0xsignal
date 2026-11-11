/**
 * @hyperliquid-api POST /exchange (ECDSA)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing
 */

import { describe, expect, test } from "bun:test";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import type { Digest32 } from "./eip712";
import { keccak } from "./keccak";
import { cast } from "./parse";
import { addressOf, sign } from "./secp";

const PRIVATE_KEY_HEX = "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
const DIGEST_HEX = "1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8";

const bytesFromHex = (hex: string): Uint8Array => {
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(body.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const toHex = (b: Uint8Array): string =>
  Array.from(b, (byte) => byte.toString(16).padStart(2, "0")).join("");

const PRIVATE_KEY = bytesFromHex(PRIVATE_KEY_HEX);
const DIGEST = cast<Digest32>(bytesFromHex(DIGEST_HEX), "digest");
const PUBLIC_KEY = secp256k1.getPublicKey(PRIVATE_KEY, false);

type Sig = { r: string; s: string; v: number };

const recoveredBytes = (sig: Sig): Uint8Array => {
  const out = new Uint8Array(65);
  out[0] = sig.v - 27;
  out.set(bytesFromHex(sig.r), 1);
  out.set(bytesFromHex(sig.s), 33);
  return out;
};

describe("secp256k1 sign", () => {
  test("signs the raw digest rather than its hash", () => {
    const sig = sign(DIGEST, PRIVATE_KEY);
    expect([27, 28]).toContain(sig.v);
    expect(sig.r).toMatch(/^0x[0-9a-f]{64}$/);
    expect(sig.s).toMatch(/^0x[0-9a-f]{64}$/);
    const bytes = recoveredBytes(sig);
    expect(
      secp256k1.verify(bytes, DIGEST, PUBLIC_KEY, {
        prehash: false,
        lowS: true,
        format: "recovered",
      }),
    ).toBe(true);
    expect(
      secp256k1.verify(bytes, DIGEST, PUBLIC_KEY, {
        prehash: true,
        lowS: true,
        format: "recovered",
      }),
    ).toBe(false);
  });

  test("recovers the signer address from the r,s,v layout", () => {
    const sig = sign(DIGEST, PRIVATE_KEY);
    const parsed = secp256k1.Signature.fromBytes(recoveredBytes(sig), "recovered");
    const recovered = parsed.recoverPublicKey(DIGEST).toBytes(false);
    expect(Array.from(recovered)).toEqual(Array.from(PUBLIC_KEY));
    const address = `0x${toHex(keccak(recovered.subarray(1)).subarray(12))}`;
    expect(address).toBe(addressOf(PRIVATE_KEY));
  });

  test("produces low-S signatures for distinct digests", () => {
    const halfOrder = secp256k1.Point.CURVE().n / 2n;
    for (let i = 0; i < 20; i += 1) {
      const sig = sign(cast<Digest32>(keccak(Uint8Array.of(i)), "digest"), PRIVATE_KEY);
      const s = BigInt(sig.s);
      expect(s > 0n).toBe(true);
      expect(s <= halfOrder).toBe(true);
    }
  });
});
