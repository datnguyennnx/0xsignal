/**
 * @hyperliquid-api POST /exchange
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing
 */

import { ValidationError } from "./errors";
import { keccak } from "./keccak";
import { encode, map, toObject, type MpMap, type MpValue } from "./msgpack";

export type Digest32 = Uint8Array & { readonly __digest32: unique symbol };

export type Eip712FieldType =
  | "string"
  | "address"
  | "bytes32"
  | "uint64"
  | "uint32"
  | "bytes"
  | "bool";

export type L1Action = { readonly type: string } & Readonly<Record<string, unknown>>;

export const EXCHANGE_DOMAIN = {
  name: "Exchange",
  version: "1",
  chainId: 1337,
  verifyingContract: "0x0000000000000000000000000000000000000000",
} as const;

export const USER_DOMAIN_NAME = "HyperliquidSignTransaction";
export const USER_DOMAIN_VERSION = "1";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export type Domain = {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
};

export type L1TypedData = {
  domain: {
    name: "Exchange";
    version: "1";
    chainId: 1337;
    verifyingContract: string;
  };
  types: {
    Agent: readonly [
      { readonly name: "source"; readonly type: "string" },
      { readonly name: "connectionId"; readonly type: "bytes32" },
    ];
  };
  primaryType: "Agent";
  message: {
    source: "a" | "b";
    connectionId: `0x${string}`;
  };
};

export type L1ActionDigestArgs = {
  action: Uint8Array;
  nonce: bigint;
  vault?: string | null;
  expiresAfter?: bigint | null;
  isTestnet?: boolean;
};

const utf8 = new TextEncoder();

const bytesFromHex = (hex: string): Uint8Array => {
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(body.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  }
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

const padded = (b: Uint8Array): Uint8Array => {
  const out = new Uint8Array(32);
  out.set(b.subarray(0, 32));
  return out;
};

const addressBytes = (value: string): Uint8Array => {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new ValidationError("address", "0x-prefixed 20-byte hex");
  }
  return bytesFromHex(value);
};

const u64 = (v: bigint): Uint8Array => {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt.asUintN(64, v));
  return out;
};

const uint256 = (v: bigint): Uint8Array => {
  const out = new Uint8Array(32);
  new DataView(out.buffer).setBigUint64(24, BigInt.asUintN(64, v));
  return out;
};

export function typeHash(encodeType: string): Uint8Array {
  return keccak(utf8.encode(encodeType));
}

export function encodeTypeValue(type: Eip712FieldType, value: string | boolean): Uint8Array {
  switch (type) {
    case "string":
      return keccak(utf8.encode(String(value)));
    case "address": {
      const out = new Uint8Array(32);
      out.set(addressBytes(String(value)), 12);
      return out;
    }
    case "bytes": {
      const raw = String(value);
      const body = raw.startsWith("0x") ? raw.slice(2) : raw;
      if (!/^([0-9a-fA-F]{2})*$/.test(body)) {
        throw new ValidationError("eip712.bytes", "0x-prefixed hex");
      }
      return keccak(bytesFromHex(raw));
    }
    case "bytes32":
      return padded(bytesFromHex(String(value)));
    case "uint32": {
      const v = BigInt(String(value));
      if (v < 0n || v > 0xffffffffn) {
        throw new ValidationError("eip712.uint32", "0..4294967295");
      }
      const out = new Uint8Array(32);
      out.set(u64(v), 24);
      return out;
    }
    case "uint64": {
      const out = new Uint8Array(32);
      out.set(u64(BigInt(String(value))), 24);
      return out;
    }
    case "bool": {
      const out = new Uint8Array(32);
      out[31] = value === true ? 1 : 0;
      return out;
    }
  }
  throw new ValidationError("eip712.type", `unsupported field type ${String(type)}`);
}

export function hashStruct(types: string, values: Uint8Array[]): Uint8Array {
  return keccak(concat([typeHash(types), ...values]));
}

export function domainSeparator(d: Domain): Uint8Array {
  return hashStruct(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
    [
      encodeTypeValue("string", d.name),
      encodeTypeValue("string", d.version),
      uint256(BigInt(d.chainId)),
      encodeTypeValue("address", d.verifyingContract),
    ],
  );
}

const EXCHANGE_SEPARATOR = domainSeparator(EXCHANGE_DOMAIN);

const userSeparators = new Map<number, Uint8Array>();

const userSeparator = (chainId: number): Uint8Array => {
  const cached = userSeparators.get(chainId);
  if (cached !== undefined) return cached;
  const separator = domainSeparator({
    name: USER_DOMAIN_NAME,
    version: USER_DOMAIN_VERSION,
    chainId,
    verifyingContract: ZERO_ADDRESS,
  });
  userSeparators.set(chainId, separator);
  return separator;
};

const digestWithSeparator = (
  separator: Uint8Array,
  types: string,
  values: Uint8Array[],
): Uint8Array => keccak(concat([Uint8Array.of(0x19, 0x01), separator, hashStruct(types, values)]));

export function digest(domain: Domain, types: string, values: Uint8Array[]): Digest32 {
  return digest32(digestWithSeparator(domainSeparator(domain), types, values));
}

const isDigest32 = (b: Uint8Array): b is Digest32 => b.length === 32;

const digest32 = (b: Uint8Array): Digest32 => {
  if (!isDigest32(b)) throw new ValidationError("digest", "32 bytes");
  return b;
};

const isRecord = (u: unknown): u is Record<string, unknown> =>
  typeof u === "object" && u !== null && !Array.isArray(u) && !(u instanceof Uint8Array);

const wireValue = (value: unknown, path: string): MpValue => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) {
    return value.map((item, index) => wireValue(item, `${path}[${index}]`));
  }
  if (isRecord(value)) {
    return map(
      Object.keys(value).map((key): readonly [string, MpValue] => [
        key,
        wireValue(value[key], `${path}.${key}`),
      ]),
    );
  }
  throw new ValidationError(path, "msgpack-compatible value");
};

export function encodeL1Action(action: L1Action): Uint8Array {
  return encode(wireValue(action, "action"));
}

export function asL1Action(m: MpMap): L1Action {
  const first = m[0];
  if (first === undefined || first[0] !== "type" || typeof first[1] !== "string") {
    throw new ValidationError("action", "type as the first field");
  }
  return { ...toObject(m), type: first[1] };
}

const hexOf = (b: Uint8Array): `0x${string}` =>
  `0x${Array.from(b, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;

export const connectionIdOf = ({
  action,
  nonce,
  vault,
  expiresAfter,
}: L1ActionDigestArgs): Uint8Array => {
  const parts: Uint8Array[] = [action, u64(nonce)];
  if (vault !== undefined && vault !== null) {
    parts.push(Uint8Array.of(0x01), addressBytes(vault));
  } else {
    parts.push(Uint8Array.of(0x00));
  }
  if (expiresAfter !== undefined && expiresAfter !== null) {
    parts.push(Uint8Array.of(0x00), u64(expiresAfter));
  }
  return keccak(concat(parts));
};

export function l1ActionDigest(args: L1ActionDigestArgs): Digest32 {
  return digest32(
    digestWithSeparator(EXCHANGE_SEPARATOR, "Agent(string source,bytes32 connectionId)", [
      encodeTypeValue("string", args.isTestnet === true ? "b" : "a"),
      connectionIdOf(args),
    ]),
  );
}

export function l1ActionTypedData(args: L1ActionDigestArgs): L1TypedData {
  return {
    domain: {
      name: "Exchange",
      version: "1",
      chainId: 1337,
      verifyingContract: EXCHANGE_DOMAIN.verifyingContract,
    },
    types: {
      Agent: [
        { name: "source", type: "string" },
        { name: "connectionId", type: "bytes32" },
      ],
    },
    primaryType: "Agent",
    message: {
      source: args.isTestnet === true ? "b" : "a",
      connectionId: hexOf(connectionIdOf(args)),
    },
  };
}

export function l1ActionHashHex(args: L1ActionDigestArgs): `0x${string}` {
  return hexOf(connectionIdOf(args));
}

export function l1ActionDigestHex(args: L1ActionDigestArgs): `0x${string}` {
  return hexOf(l1ActionDigest(args));
}

export function userSignedDigest(
  typeName: string,
  fieldTypes: readonly string[],
  values: readonly Uint8Array[],
  signatureChainId: number,
): Digest32 {
  const types = `HyperliquidTransaction:${typeName}(${fieldTypes.join(",")})`;
  return digest32(digestWithSeparator(userSeparator(signatureChainId), types, [...values]));
}
