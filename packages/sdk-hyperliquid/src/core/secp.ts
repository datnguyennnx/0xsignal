/**
 * @hyperliquid-api POST /exchange
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing
 */

import { secp256k1 } from "@noble/curves/secp256k1.js";

import { asHex, type Hex } from "./brands";
import type { Digest32 } from "./eip712";
import { ValidationError } from "./errors";
import { keccak } from "./keccak";

const hex = (b: Uint8Array): string =>
  Array.from(b, (byte) => byte.toString(16).padStart(2, "0")).join("");

const publicKeys = new WeakMap<Uint8Array, Uint8Array>();

const publicKeyOf = (privateKey: Uint8Array): Uint8Array => {
  const cached = publicKeys.get(privateKey);
  if (cached !== undefined) return cached;
  const key = secp256k1.getPublicKey(privateKey, false);
  publicKeys.set(privateKey, key);
  return key;
};

export type EcdsaSignature = {
  readonly r: Hex;
  readonly s: Hex;
  readonly v: 27 | 28;
};

export function addressOf(privateKey: Uint8Array): string {
  return `0x${hex(keccak(publicKeyOf(privateKey).subarray(1)).subarray(12))}`;
}

export function sign(d: Digest32, privateKey: Uint8Array, verify = false): EcdsaSignature {
  const signature = secp256k1.sign(d, privateKey, {
    prehash: false,
    lowS: true,
    format: "recovered",
  });
  if (
    verify &&
    !secp256k1.verify(signature, d, publicKeyOf(privateKey), {
      prehash: false,
      lowS: true,
      format: "recovered",
    })
  ) {
    throw new ValidationError("signature", "valid ECDSA signature");
  }
  const recid = signature[0] ?? 0;
  return {
    r: asHex(`0x${hex(signature.subarray(1, 33))}`),
    s: asHex(`0x${hex(signature.subarray(33, 65))}`),
    v: (recid & 1) === 1 ? 28 : 27,
  };
}
