import { ExchangeClient, HttpTransport, type IRequestTransport } from "@nktkas/hyperliquid";
import {
  CancelRequest,
  OrderRequest,
  UpdateLeverageRequest as UpdateLeverageRequestSchema,
  type CancelParameters,
  type OrderParameters,
  type UpdateLeverageParameters,
} from "@nktkas/hyperliquid/api/exchange";
import { canonicalize, createL1ActionHash } from "@nktkas/hyperliquid/signing";
import {
  ARBITRUM_CHAIN_ID,
  createGuardedWallet,
  type GuardedWalletDeps,
  WrongChainError,
} from "./typed-data-guard";

/** Only these three actions may leave the browser. Everything else is a bug. */
const ALLOWED_ACTION_TYPES = new Set(["order", "cancel", "updateLeverage"]);

export class UntrustedEnvelopeError extends Error {
  constructor(reason: string) {
    super(`Refusing to submit Hyperliquid request: ${reason}`);
    this.name = "UntrustedEnvelopeError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Only an allowlisted action may be signed at all, so this runs before the wallet. */
function assertActionAllowed(action: unknown): void {
  if (!isRecord(action)) throw new UntrustedEnvelopeError("action is not an object");
  const type = action.type;
  if (typeof type !== "string" || !ALLOWED_ACTION_TYPES.has(type)) {
    throw new UntrustedEnvelopeError(`action type "${String(type)}" is not allowed`);
  }
}

/** Pre-sign gate: the signing callback never runs for a disallowed action. */
export function signGuardedAction<T>(
  action: Record<string, unknown>,
  sign: () => Promise<T>,
): Promise<T> {
  assertActionAllowed(action);
  return sign();
}

/** Asserts the wire envelope: known action, non-zero nonce, and no vaultAddress. */
export function assertExchangeEnvelope(payload: unknown): void {
  if (!isRecord(payload)) throw new UntrustedEnvelopeError("payload is not an object");
  if ("vaultAddress" in payload) throw new UntrustedEnvelopeError("vaultAddress is forbidden");
  if ("expiresAfter" in payload) throw new UntrustedEnvelopeError("expiresAfter is forbidden");

  assertActionAllowed(payload.action);

  const nonce = payload.nonce;
  if (typeof nonce !== "number" || !Number.isSafeInteger(nonce) || nonce <= 0) {
    throw new UntrustedEnvelopeError("nonce is not a positive integer");
  }
}

/** Wraps the SDK transport so no unchecked payload reaches the network. */
function createGuardedTransport(inner: IRequestTransport): IRequestTransport {
  return {
    isTestnet: inner.isTestnet,
    request<T>(endpoint: "info" | "exchange", payload: unknown, signal?: AbortSignal): Promise<T> {
      if (endpoint === "exchange") assertExchangeEnvelope(payload);
      return inner.request<T>(endpoint, payload, signal);
    },
  };
}

export function buildOrderAction(params: OrderParameters): Record<string, unknown> {
  return canonicalize(OrderRequest.entries.action, { type: "order", ...params });
}

export function buildCancelAction(params: CancelParameters): Record<string, unknown> {
  return canonicalize(CancelRequest.entries.action, { type: "cancel", ...params });
}

export function buildLeverageAction(params: UpdateLeverageParameters): Record<string, unknown> {
  return canonicalize(UpdateLeverageRequestSchema.entries.action, {
    type: "updateLeverage",
    ...params,
  });
}

export type GuardedClientOptions = {
  readonly deps: GuardedWalletDeps;
  readonly nonce: number;
  readonly transport?: IRequestTransport;
};

/**
 * The SDK signs only through the guard adapter, and the fixed nonce is the
 * one issued earlier so the confirmation screen can show the connectionId.
 */
export function createGuardedExchangeClient({
  deps,
  nonce,
  transport = new HttpTransport(),
}: GuardedClientOptions): ExchangeClient {
  return new ExchangeClient({
    transport: createGuardedTransport(transport),
    wallet: createGuardedWallet(deps),
    signatureChainId: `0x${ARBITRUM_CHAIN_ID.toString(16)}`,
    nonceManager: () => nonce,
  });
}

export function actionId(action: Record<string, unknown>, nonce: number): `0x${string}` {
  return createL1ActionHash({ action, nonce });
}

export function assertArbitrum(chainId: number | undefined): asserts chainId is number {
  if (chainId !== ARBITRUM_CHAIN_ID) throw new WrongChainError(chainId ?? 0);
}
