/**
 * @hyperliquid-api POST /exchange (signing)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing.md
 */

import { ValidationError } from "../core/errors";
import { asHex, type Hex } from "../core/brands";
import { cast } from "../core/parse";
import {
  USER_DOMAIN_NAME,
  USER_DOMAIN_VERSION,
  ZERO_ADDRESS,
  asL1Action,
  encodeTypeValue,
  encodeL1Action,
  l1ActionDigest,
  l1ActionHashHex,
  l1ActionTypedData,
  userSignedDigest,
  type Digest32,
  type Eip712FieldType,
  type L1Action,
  type L1TypedData,
} from "../core/eip712";
import type { MpMap } from "../core/msgpack";
import { addressOf, sign, type EcdsaSignature } from "../core/secp";
import {
  USER_SIGNED,
  userSignedEncode,
  type UserSignedActionType,
  type UserSignedRegistry,
} from "../exchange/actions/index";

export { userSignedDigest };
export {
  connectionIdOf,
  l1ActionDigestHex,
  l1ActionHashHex,
  l1ActionTypedData,
  EXCHANGE_DOMAIN,
  ZERO_ADDRESS,
} from "../core/eip712";
export type { L1ActionDigestArgs } from "../core/eip712";
export type { Hex };
export type { L1TypedData };
export type { UserSignedActionType };

export type TypedDataSignature = {
  readonly r: `0x${string}`;
  readonly s: `0x${string}`;
  readonly v: 27 | 28;
};

export type TypedDataField = { readonly name: string; readonly type: string };

export type WalletTypedData = {
  domain: {
    readonly name: string;
    readonly version: string;
    readonly chainId: number;
    readonly verifyingContract: string;
  };
  types: Readonly<Record<string, readonly TypedDataField[]>>;
  primaryType: string;
  message: Readonly<Record<string, unknown>>;
};

export type UserSignedTypedData = {
  domain: {
    readonly name: typeof USER_DOMAIN_NAME;
    readonly version: typeof USER_DOMAIN_VERSION;
    readonly chainId: number;
    readonly verifyingContract: `0x${string}`;
  };
  types: Readonly<Record<string, readonly TypedDataField[]>>;
  primaryType: string;
  message: Readonly<Record<string, string | boolean | number>>;
};

export type L1DigestBundle = {
  readonly nonce: number;
  readonly digest: Digest32;
  readonly connectionId: Hex;
  readonly typedData: L1TypedData;
};

export type UserSignedPrepared = {
  readonly digest: Digest32;
  readonly connectionId: Hex;
  readonly typedData: UserSignedTypedData;
};

export interface TypedDataSigner {
  readonly address: string;
  signTypedData(data: L1TypedData | WalletTypedData): Promise<TypedDataSignature>;
}

export type L1SignOptions = {
  vault?: string | null;
  expiresAfter?: bigint | null;
  isTestnet?: boolean;
};

export type SignerConfig = {
  privateKey: Uint8Array;
  isTestnet?: boolean;
  verifySignatures?: boolean;
};

type UserSignedField = { readonly name: string; readonly type: Eip712FieldType };

const structFields = (
  type: UserSignedActionType,
  spec: UserSignedRegistry[UserSignedActionType],
  action: unknown,
): UserSignedField[] => {
  const wireNames = userSignedEncode(type, action)
    .map(([key]) => key)
    .filter((key) => key !== "type" && key !== "signatureChainId");
  const names = wireNames.includes("hyperliquidChain")
    ? wireNames
    : ["hyperliquidChain", ...wireNames];
  if (names.length !== spec.fieldTypes.length) {
    throw new ValidationError("action", "user-signed field count");
  }
  return spec.fieldTypes.map((fieldType, index): UserSignedField => {
    const name = names[index];
    if (name === undefined) {
      throw new ValidationError("action", "user-signed field name");
    }
    return { name, type: fieldType };
  });
};

export type BuilderPolicy = ReadonlyMap<string, number>;

const policyView = (entries: Iterable<readonly [string, number]>): BuilderPolicy => {
  const store = new Map<string, number>(entries);
  const view: BuilderPolicy = {
    get size(): number {
      return store.size;
    },
    get(key: string): number | undefined {
      return store.get(key);
    },
    has(key: string): boolean {
      return store.has(key);
    },
    forEach(
      callback: (value: number, key: string, map: ReadonlyMap<string, number>) => void,
      thisArg?: unknown,
    ): void {
      store.forEach((value, key) => {
        callback.call(thisArg, value, key, view);
      });
    },
    entries() {
      return store.entries();
    },
    keys() {
      return store.keys();
    },
    values() {
      return store.values();
    },
    [Symbol.iterator]() {
      return store.entries();
    },
  };
  return Object.freeze(view);
};

export const PINNED_BUILDERS: BuilderPolicy = policyView([]);

export function assertBuilderAllowed(
  builder: { b: string; f: number },
  policy: BuilderPolicy = PINNED_BUILDERS,
): void {
  const allowed = policy.get(builder.b.toLowerCase());
  if (allowed === undefined) {
    throw new ValidationError("builder.b", "allowlisted builder address");
  }
  if (!Number.isFinite(builder.f) || builder.f < 0) {
    throw new ValidationError("builder.f", "non-negative fee");
  }
  if (builder.f > allowed) {
    throw new ValidationError("builder.f", `<= ${allowed}`);
  }
}

const recordOf = (u: unknown, path: string): Record<string, unknown> => {
  if (typeof u !== "object" || u === null || Array.isArray(u)) {
    throw new ValidationError(path, "object");
  }
  return cast<Record<string, unknown>>(u, path);
};

const encodeField = (record: Record<string, unknown>, field: UserSignedField): Uint8Array => {
  const value = record[field.name];
  if (field.type === "bool") {
    if (typeof value !== "boolean") {
      throw new ValidationError(`action.${field.name}`, "boolean");
    }
    return encodeTypeValue("bool", value);
  }
  if (field.type === "uint32") {
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > 0xffffffff
    ) {
      throw new ValidationError(`action.${field.name}`, "uint32");
    }
    return encodeTypeValue("uint32", String(value));
  }
  if (field.type === "uint64") {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      throw new ValidationError(`action.${field.name}`, "non-negative safe integer");
    }
    return encodeTypeValue("uint64", String(value));
  }
  if (typeof value !== "string") {
    throw new ValidationError(`action.${field.name}`, "string");
  }
  return encodeTypeValue(field.type, value);
};

const safeNumber = (value: bigint, path: string): number => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new ValidationError(path, "non-negative safe integer");
  }
  return n;
};

const hexOfBytes = (b: Uint8Array): Hex =>
  asHex(`0x${Array.from(b, (byte) => byte.toString(16).padStart(2, "0")).join("")}`);

export function encodeUserSigned(
  type: UserSignedActionType,
  action: unknown,
  signatureChainId: number,
): Digest32 {
  const spec = USER_SIGNED[type];
  const record = recordOf(action, "action");
  const fields = structFields(type, spec, action);
  const values = fields.map((field) => encodeField(record, field));
  const types = fields.map((field) => `${field.type} ${field.name}`);
  return userSignedDigest(spec.typeName, types, values, signatureChainId);
}

const normaliseV = (v: number): 27 | 28 => {
  if (v === 27 || v === 28) return v;
  if (v === 0) return 27;
  if (v === 1) return 28;
  throw new ValidationError("signature.v", "27 | 28");
};

const userSignedTypedData = (
  type: UserSignedActionType,
  action: unknown,
  signatureChainId: number,
): UserSignedTypedData => {
  const spec = USER_SIGNED[type];
  const record = recordOf(action, "action");
  const fields = structFields(type, spec, action);
  const message: Record<string, string | boolean | number> = {};
  for (const field of fields) {
    const value = record[field.name];
    if (field.type === "bool") {
      if (typeof value !== "boolean") {
        throw new ValidationError(`action.${field.name}`, "boolean");
      }
      message[field.name] = value;
      continue;
    }
    if (field.type === "uint32" || field.type === "uint64") {
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        throw new ValidationError(`action.${field.name}`, "non-negative safe integer");
      }
      message[field.name] = value;
      continue;
    }
    if (typeof value !== "string") {
      throw new ValidationError(`action.${field.name}`, "string");
    }
    message[field.name] = value;
  }
  const primaryType = `HyperliquidTransaction:${spec.typeName}`;
  return {
    domain: {
      name: USER_DOMAIN_NAME,
      version: USER_DOMAIN_VERSION,
      chainId: signatureChainId,
      verifyingContract: ZERO_ADDRESS,
    },
    types: {
      [primaryType]: fields.map((field) => ({ name: field.name, type: field.type })),
    },
    primaryType,
    message,
  };
};

const walletSignature = (sig: TypedDataSignature): EcdsaSignature => ({
  r: asHex(sig.r),
  s: asHex(sig.s),
  v: normaliseV(sig.v),
});

export function prepareL1(
  action: L1Action | MpMap,
  nonce: bigint,
  opts: L1SignOptions = {},
): L1DigestBundle {
  const wire: L1Action = "type" in action ? action : asL1Action(action);
  const args = {
    action: encodeL1Action(wire),
    nonce,
    vault: opts.vault ?? null,
    expiresAfter: opts.expiresAfter ?? null,
    isTestnet: opts.isTestnet ?? false,
  };
  return {
    nonce: safeNumber(nonce, "nonce"),
    digest: l1ActionDigest(args),
    connectionId: asHex(l1ActionHashHex(args)),
    typedData: l1ActionTypedData(args),
  };
}

export function prepareUserSigned(
  type: UserSignedActionType,
  action: unknown,
  signatureChainId: number,
): UserSignedPrepared {
  const digest = encodeUserSigned(type, action, signatureChainId);
  return {
    digest,
    connectionId: hexOfBytes(digest),
    typedData: userSignedTypedData(type, action, signatureChainId),
  };
}

export async function signL1With(
  signer: TypedDataSigner,
  action: L1Action,
  nonce: bigint,
  opts: L1SignOptions = {},
): Promise<{
  nonce: number;
  signature: EcdsaSignature;
  digest: Digest32;
  typedData: L1TypedData;
}> {
  const prepared = prepareL1(action, nonce, opts);
  const signature = await signer.signTypedData(prepared.typedData);
  return {
    nonce: prepared.nonce,
    signature: walletSignature(signature),
    digest: prepared.digest,
    typedData: prepared.typedData,
  };
}

export async function signUserSignedWith(
  wallet: TypedDataSigner,
  type: UserSignedActionType,
  action: unknown,
  signatureChainId: number,
): Promise<UserSignature> {
  const prepared = prepareUserSigned(type, action, signatureChainId);
  const signature = await wallet.signTypedData(prepared.typedData);
  return { signature: walletSignature(signature), digest: prepared.digest };
}

export type L1Signature = {
  nonce: number;
  signature: EcdsaSignature;
  vaultAddress?: string;
  expiresAfter?: number;
};

export type SignedL1Action = L1Signature & { digest: Digest32 };

export type UserSignature = {
  signature: EcdsaSignature;
  digest: Digest32;
};

export class Signer {
  readonly #privateKey: Uint8Array;
  readonly #address: string;
  readonly #isTestnet: boolean;
  readonly #verifySignatures: boolean;

  constructor(cfg: SignerConfig) {
    if (cfg.privateKey.length !== 32) {
      throw new ValidationError("privateKey", "32 bytes");
    }
    this.#privateKey = cfg.privateKey.slice();
    this.#address = addressOf(this.#privateKey);
    this.#isTestnet = cfg.isTestnet ?? false;
    this.#verifySignatures = cfg.verifySignatures ?? false;
  }

  get address(): string {
    return this.#address;
  }

  get network(): "mainnet" | "testnet" {
    return this.#isTestnet ? "testnet" : "mainnet";
  }

  signL1(
    action: L1Action | MpMap,
    nonce: bigint,
    vault?: string | null,
    expiresAfter?: bigint | null,
    isTestnet?: boolean,
  ): SignedL1Action {
    if (isTestnet !== undefined && isTestnet !== this.#isTestnet) {
      throw new ValidationError("testnet", `signer network ${this.network}`);
    }
    const prepared = prepareL1(action, nonce, {
      vault: vault ?? null,
      expiresAfter: expiresAfter ?? null,
      isTestnet: this.#isTestnet,
    });
    const signature = sign(prepared.digest, this.#privateKey, this.#verifySignatures);
    const signed: SignedL1Action = {
      nonce: prepared.nonce,
      signature,
      digest: prepared.digest,
    };
    if (vault !== undefined && vault !== null) signed.vaultAddress = vault;
    if (expiresAfter !== undefined && expiresAfter !== null) {
      signed.expiresAfter = safeNumber(expiresAfter, "expiresAfter");
    }
    return signed;
  }

  signUserSigned(
    type: UserSignedActionType,
    action: unknown,
    signatureChainId: number,
  ): UserSignature {
    const prepared = prepareUserSigned(type, action, signatureChainId);
    return {
      signature: sign(prepared.digest, this.#privateKey, this.#verifySignatures),
      digest: prepared.digest,
    };
  }
}
