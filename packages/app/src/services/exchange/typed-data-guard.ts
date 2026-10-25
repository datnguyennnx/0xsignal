import type { AbstractViemJsonRpcAccount } from "@nktkas/hyperliquid/signing";

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

export interface ExchangeTypedData {
  readonly domain: {
    readonly name: string;
    readonly version: string;
    readonly chainId: number;
    readonly verifyingContract: `0x${string}`;
  };
  readonly types: Readonly<Record<string, readonly TypedDataField[]>>;
  readonly primaryType: string;
  readonly message: Readonly<Record<string, unknown>>;
}

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

const MAX_CAUSE_DEPTH = 8;

/** The SDK wraps guard errors in AbstractWalletError, so inspect the whole cause chain. */
export function findBlockedSignatureError(error: unknown): UntrustedSignatureError | null {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (current instanceof UntrustedSignatureError) return current;
    if (typeof current !== "object" || current === null) return null;
    current = Reflect.get(current, "cause");
  }
  return null;
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

/**
 * Rejects every payload except the Agent/connectionId signature used by L1
 * actions. This is the guard that stops withdraw, approveAgent and
 * convertToMultiSigUser from ever reaching the wallet.
 */
export function assertAgentExchangePayload(params: ExchangeTypedData): void {
  const { domain, types, primaryType, message } = params;

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
  if (primaryType !== "Agent") {
    throw new UntrustedSignatureError(`primaryType is "${primaryType}"`);
  }
  if (!fieldsMatch(types[primaryType], AGENT_TYPE)) {
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

export interface GuardedWalletDeps {
  readonly signTypedData: (
    params: ExchangeTypedData & { readonly types: Record<string, readonly TypedDataField[]> },
  ) => Promise<`0x${string}`>;
  readonly getAddresses: () => Promise<`0x${string}`[]>;
  readonly getChainId: () => Promise<number>;
}

/**
 * Wallet adapter handed to the Hyperliquid SDK. It refuses to forward anything
 * that is not the Agent payload, and refuses to sign while off Arbitrum.
 */
export function createGuardedWallet(deps: GuardedWalletDeps): AbstractViemJsonRpcAccount {
  return {
    async signTypedData(params): Promise<`0x${string}`> {
      const chainId = await deps.getChainId();
      if (chainId !== ARBITRUM_CHAIN_ID) throw new WrongChainError(chainId);
      assertAgentExchangePayload(params);
      return deps.signTypedData(params);
    },
    getAddresses: () => deps.getAddresses(),
    getChainId: () => deps.getChainId(),
  };
}
