import type {
  L1TypedData,
  TypedDataSignature,
  TypedDataSigner,
  WalletTypedData,
} from "@0xsignal/sdk-hyperliquid/signing";
import { parseSignature } from "viem";

/**
 * Hyperliquid L1 (phantom-agent) EIP-712 payload. The wallet UI renders only
 * "Exchange" plus an opaque bytes32, so the user cannot verify the action.
 * Every field below is therefore part of the app's last line of defence.
 */
export const EXCHANGE_DOMAIN_NAME = "Exchange";
export const EXCHANGE_DOMAIN_VERSION = "1";
export const EXCHANGE_DOMAIN_CHAIN_ID = 1337;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const ARBITRUM_CHAIN_ID = 42161;

const USER_SIGNED_DOMAIN_NAME = "HyperliquidSignTransaction";
const USER_SIGNED_DOMAIN_VERSION = "1";
const USER_SIGNED_PRIMARY_TYPE_PREFIX = "HyperliquidTransaction:";

const AGENT_TYPE = [
  { name: "source", type: "string" },
  { name: "connectionId", type: "bytes32" },
] as const;

const EIP712_DOMAIN_TYPE = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
] as const;

interface TypedDataField {
  readonly name: string;
  readonly type: string;
}

export type ExchangeTypedData = L1TypedData | WalletTypedData;

export class UntrustedSignatureError extends Error {
  constructor(reason: string) {
    super(`Refusing to sign wallet payload: ${reason}`);
    this.name = "UntrustedSignatureError";
  }
}

export class WrongChainError extends Error {
  constructor(actual: number) {
    super(`Switch your wallet to Arbitrum One (${ARBITRUM_CHAIN_ID}); it is on chain ${actual}.`);
    this.name = "WrongChainError";
  }
}

export const BLOCKED_SIGNATURE_MESSAGE =
  "Signature blocked: this request was not a trading action (order, cancel, or leverage), so nothing was signed or sent.";

export function findBlockedSignatureError(error: unknown): UntrustedSignatureError | null {
  return error instanceof UntrustedSignatureError ? error : null;
}

/** User-facing text for a signing failure, without ever echoing the payload. */
export function describeSigningError(error: unknown): string {
  if (findBlockedSignatureError(error) !== null) return BLOCKED_SIGNATURE_MESSAGE;
  return error instanceof Error ? error.message : "Signing failed";
}

const fieldsMatch = (
  actual: readonly TypedDataField[] | undefined,
  expected: readonly TypedDataField[],
): boolean =>
  actual !== undefined &&
  actual.length === expected.length &&
  expected.every((field, index) => {
    const item = actual[index];
    return item !== undefined && item.name === field.name && item.type === field.type;
  });

function rejectUserSignedPayload(payload: WalletTypedData, signatureChainId: number): never {
  const { domain, primaryType } = payload;
  if (domain.name !== USER_SIGNED_DOMAIN_NAME) {
    throw new UntrustedSignatureError(`domain.name is "${domain.name}"`);
  }
  if (domain.version !== USER_SIGNED_DOMAIN_VERSION) {
    throw new UntrustedSignatureError(`domain.version is "${domain.version}"`);
  }
  if (domain.chainId !== signatureChainId) {
    throw new UntrustedSignatureError(`domain.chainId is ${domain.chainId}`);
  }
  if (domain.verifyingContract.toLowerCase() !== ZERO_ADDRESS) {
    throw new UntrustedSignatureError(`domain.verifyingContract is "${domain.verifyingContract}"`);
  }
  if (!primaryType.startsWith(USER_SIGNED_PRIMARY_TYPE_PREFIX)) {
    throw new UntrustedSignatureError(`primaryType is "${primaryType}"`);
  }
  const types: Readonly<Record<string, readonly TypedDataField[]>> = payload.types;
  const fields = types[primaryType];
  if (fields === undefined) {
    throw new UntrustedSignatureError(`missing EIP-712 type "${primaryType}"`);
  }
  const names = fields.map((field) => field.name);
  const messageKeys = Object.keys(payload.message);
  if (messageKeys.length !== names.length || names.some((name) => !(name in payload.message))) {
    throw new UntrustedSignatureError(`message fields do not match ${primaryType}`);
  }
  throw new UntrustedSignatureError(`user-signed action "${primaryType}" is not allowed`);
}

/**
 * Rejects every payload except the Agent/connectionId signature used by L1
 * actions. This is the guard that stops withdraw, approveAgent and
 * convertToMultiSigUser from ever reaching the wallet.
 */
export function assertAgentExchangePayload(
  params: ExchangeTypedData,
  signatureChainId: number = ARBITRUM_CHAIN_ID,
): void {
  if (params.primaryType !== "Agent") {
    rejectUserSignedPayload(params, signatureChainId);
  }
  const { domain } = params;
  const types: Readonly<Record<string, readonly TypedDataField[]>> = params.types;
  const message: Readonly<Record<string, unknown>> = params.message;

  if (domain.name !== EXCHANGE_DOMAIN_NAME) {
    throw new UntrustedSignatureError(`domain.name is "${domain.name}"`);
  }
  if (domain.version !== EXCHANGE_DOMAIN_VERSION) {
    throw new UntrustedSignatureError(`domain.version is "${domain.version}"`);
  }
  if (domain.chainId !== EXCHANGE_DOMAIN_CHAIN_ID) {
    throw new UntrustedSignatureError(`domain.chainId is ${domain.chainId}`);
  }
  if (domain.verifyingContract.toLowerCase() !== ZERO_ADDRESS) {
    throw new UntrustedSignatureError(`domain.verifyingContract is "${domain.verifyingContract}"`);
  }
  if (!fieldsMatch(types["Agent"], AGENT_TYPE)) {
    throw new UntrustedSignatureError("Agent type fields do not match source/connectionId");
  }

  // viem and the SDK add the canonical EIP712Domain entry before signing.
  // Any other type key means a user-signed action (withdraw, approveAgent...).
  for (const key of Object.keys(types)) {
    if (key === "Agent") continue;
    if (key === "EIP712Domain" && fieldsMatch(types[key], EIP712_DOMAIN_TYPE)) continue;
    throw new UntrustedSignatureError(`unexpected EIP-712 type "${key}"`);
  }

  const messageKeys = Object.keys(message);
  if (messageKeys.length !== 2 || !("source" in message) || !("connectionId" in message)) {
    throw new UntrustedSignatureError("message carries fields beyond source/connectionId");
  }
  if (message.source !== "a" && message.source !== "b") {
    throw new UntrustedSignatureError(`message.source is "${String(message.source)}"`);
  }
  if (typeof message.connectionId !== "string" || !/^0x[0-9a-f]{64}$/.test(message.connectionId)) {
    throw new UntrustedSignatureError("message.connectionId is not a lowercase bytes32");
  }
}

const toTypedDataSignature = (hex: `0x${string}`): TypedDataSignature => {
  const { r, s, v, yParity } = parseSignature(hex);
  const raw = v ?? BigInt(27 + (yParity ?? 0));
  const normalised = raw === 0n ? 27 : raw === 1n ? 28 : Number(raw);
  if (normalised !== 27 && normalised !== 28) {
    throw new UntrustedSignatureError("wallet returned an unrecoverable signature");
  }
  return { r, s, v: normalised === 27 ? 27 : 28 };
};

export interface GuardedWalletDeps {
  readonly address: string;
  readonly signTypedData: (params: ExchangeTypedData) => Promise<`0x${string}`>;
  readonly getChainId: () => Promise<number>;
}

/**
 * Wallet adapter handed to the Hyperliquid SDK. It refuses to forward anything
 * that is not the Agent payload, and refuses to sign while off Arbitrum.
 */
export function createGuardedWallet(
  deps: GuardedWalletDeps,
  signatureChainId: number = ARBITRUM_CHAIN_ID,
): TypedDataSigner {
  return {
    address: deps.address,
    async signTypedData(data): Promise<TypedDataSignature> {
      const chainId = await deps.getChainId();
      if (chainId !== ARBITRUM_CHAIN_ID) throw new WrongChainError(chainId);
      assertAgentExchangePayload(data, signatureChainId);
      return toTypedDataSignature(await deps.signTypedData(data));
    },
  };
}
