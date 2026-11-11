import { describe, expect, test } from "bun:test";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import {
  EXCHANGE_DOMAIN,
  asL1Action,
  digest,
  encodeTypeValue,
  l1ActionDigest,
  l1ActionDigestHex,
  l1ActionHashHex,
  l1ActionTypedData,
  type L1TypedData,
} from "../core/eip712";
import { encode, map } from "../core/msgpack";
import { sign, type EcdsaSignature } from "../core/secp";
import { Signer, signL1With, type TypedDataSignature, type TypedDataSigner } from "./index";

const PRIVATE_KEY_HEX = "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
const VAULT = "0x1111111111111111111111111111111111111111";
const NOOP_MAP = map([["type", "noop"]]);
const NOOP = asL1Action(NOOP_MAP);
const NOOP_BYTES = encode(NOOP_MAP);
const NONCE = 1_700_000_000_000n;
const EXPIRES_AFTER = 1_700_000_300_000n;
const ZERO = "0x0000000000000000000000000000000000000000";

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

const PRIVATE_KEY = bytesFromHex(PRIVATE_KEY_HEX);
const PUBLIC_KEY = secp256k1.getPublicKey(PRIVATE_KEY, false);

const recoveredBytes = (sig: EcdsaSignature): Uint8Array => {
  const out = new Uint8Array(65);
  out[0] = sig.v - 27;
  out.set(bytesFromHex(sig.r), 1);
  out.set(bytesFromHex(sig.s), 33);
  return out;
};

const verify = (sig: EcdsaSignature, digestBytes: Uint8Array): boolean =>
  secp256k1.verify(recoveredBytes(sig), digestBytes, PUBLIC_KEY, {
    prehash: false,
    lowS: true,
    format: "recovered",
  });

const HASH32 = /^0x[0-9a-f]{64}$/;

describe("l1 action hash and signature digest", () => {
  const args = {
    action: NOOP_BYTES,
    nonce: NONCE,
    vault: VAULT,
    expiresAfter: EXPIRES_AFTER,
  };

  test("the action hash is the connectionId, not the signature digest", () => {
    const hash = l1ActionHashHex(args);
    const digestHex = l1ActionDigestHex(args);
    expect(hash).toMatch(HASH32);
    expect(digestHex).toMatch(HASH32);
    expect(hash).not.toBe(digestHex);
  });

  test("typed data is the mainnet Agent struct over the connectionId", () => {
    const typedData = l1ActionTypedData(args);
    expect(typedData.domain).toEqual({
      name: "Exchange",
      version: "1",
      chainId: 1337,
      verifyingContract: ZERO,
    });
    expect(typedData.primaryType).toBe("Agent");
    expect(typedData.types.Agent).toEqual([
      { name: "source", type: "string" },
      { name: "connectionId", type: "bytes32" },
    ]);
    expect(typedData.message.source).toBe("a");
    expect(typedData.message.connectionId).toBe(l1ActionHashHex(args));
  });

  test("testnet uses source b over the same connectionId", () => {
    const typedData = l1ActionTypedData({ ...args, isTestnet: true });
    expect(typedData.message.source).toBe("b");
    expect(typedData.message.connectionId).toBe(l1ActionHashHex(args));
  });

  test("the typed data connectionId rebuilds the signature digest", () => {
    const typedData = l1ActionTypedData(args);
    const rebuilt = digest(EXCHANGE_DOMAIN, "Agent(string source,bytes32 connectionId)", [
      encodeTypeValue("string", typedData.message.source),
      encodeTypeValue("bytes32", typedData.message.connectionId),
    ]);
    expect(bytesEqual(rebuilt, l1ActionDigest(args))).toBe(true);
  });
});

describe("signL1With", () => {
  const expectedDigest = l1ActionDigest({ action: NOOP_BYTES, nonce: NONCE });
  const knownSignature: EcdsaSignature = sign(expectedDigest, PRIVATE_KEY);
  const typedSignature: TypedDataSignature = {
    r: `0x${knownSignature.r.slice(2)}`,
    s: `0x${knownSignature.s.slice(2)}`,
    v: knownSignature.v,
  };
  const privateSigner = new Signer({ privateKey: PRIVATE_KEY });

  const wallet = (seen: L1TypedData[]): TypedDataSigner => ({
    address: privateSigner.address,
    signTypedData(data: L1TypedData): Promise<TypedDataSignature> {
      seen.push(data);
      return Promise.resolve(typedSignature);
    },
  });

  test("stub signature round-trips and verifies against the digest", async () => {
    const seen: L1TypedData[] = [];
    const result = await signL1With(wallet(seen), NOOP, NONCE);

    expect(bytesEqual(result.digest, expectedDigest)).toBe(true);
    expect(result.nonce).toBe(Number(NONCE));
    expect(result.signature.r).toBe(knownSignature.r);
    expect(result.signature.s).toBe(knownSignature.s);
    expect(result.signature.v).toBe(knownSignature.v);
    expect(verify(result.signature, result.digest)).toBe(true);
    expect(seen[0]?.message.connectionId).toBe(
      l1ActionHashHex({ action: NOOP_BYTES, nonce: NONCE }),
    );
  });

  test("agrees with the private-key signer on the digest", async () => {
    const seen: L1TypedData[] = [];
    const result = await signL1With(wallet(seen), NOOP, NONCE);
    const privateSigned = privateSigner.signL1(NOOP, NONCE);
    expect(bytesEqual(result.digest, privateSigned.digest)).toBe(true);
  });
});
