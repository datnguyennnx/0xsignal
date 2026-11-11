import {
  ExchangeClient,
  NonceSource,
  Transport,
  asL1Action,
  encodeL1Action,
  l1ActionDigestHex,
  l1ActionHashHex,
  l1ActionTypedData,
  type Digest32,
  type L1TypedData,
  type MpMap,
} from "@0xsignal/sdk-hyperliquid";
import {
  encodeCancel,
  encodeOrder,
  encodeUpdateLeverage,
  type CancelAction,
  type DigestEnvelope,
  type OrderAction,
  type UpdateLeverageAction,
} from "@0xsignal/sdk-hyperliquid/exchange";
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

export function buildOrderAction(params: OrderAction): OrderAction {
  return params;
}

export function buildCancelAction(params: CancelAction): CancelAction {
  return params;
}

export function buildLeverageAction(params: UpdateLeverageAction): UpdateLeverageAction {
  return params;
}

export type PreviewableAction =
  | (OrderAction & { readonly type: "order" })
  | (CancelAction & { readonly type: "cancel" })
  | (UpdateLeverageAction & { readonly type: "updateLeverage" });

export type PreviewEnvelope = {
  readonly connectionId: `0x${string}`;
  readonly typedData: L1TypedData;
  readonly digest: `0x${string}`;
  readonly action: PreviewableAction;
  readonly nonce: number;
  readonly source: "a" | "b";
  readonly isTestnet: boolean;
};

function encodePreviewable(action: PreviewableAction): MpMap {
  if (action.type === "order") return encodeOrder(action);
  if (action.type === "cancel") return encodeCancel(action);
  return encodeUpdateLeverage(action);
}

export function preview(
  action: PreviewableAction,
  options: { readonly nonce: number; readonly isTestnet?: boolean },
): { readonly envelope: PreviewEnvelope } {
  const isTestnet = options.isTestnet ?? false;
  const digestArgs = {
    action: encodeL1Action(asL1Action(encodePreviewable(action))),
    nonce: BigInt(options.nonce),
    isTestnet,
  };
  return {
    envelope: {
      connectionId: l1ActionHashHex(digestArgs),
      typedData: l1ActionTypedData(digestArgs),
      digest: l1ActionDigestHex(digestArgs),
      action,
      nonce: options.nonce,
      source: isTestnet ? "b" : "a",
      isTestnet,
    },
  };
}

export type DigestObserver = (digest: Digest32, envelope: DigestEnvelope) => void;

class PinnedNonceSource extends NonceSource {
  readonly #value: bigint;

  constructor(value: number) {
    super();
    this.#value = BigInt(value);
  }

  override reserve(): bigint {
    return this.#value;
  }
}

export type GuardedClientOptions = {
  readonly deps: GuardedWalletDeps;
  readonly nonce: number;
  readonly transport?: Transport;
  readonly onDigest?: DigestObserver;
};

/**
 * The SDK signs only through the guard adapter, and the fixed nonce is the
 * one issued earlier so the confirmation screen can show the connectionId.
 */
export function createGuardedExchangeClient({
  deps,
  nonce,
  transport = new Transport(),
  onDigest,
}: GuardedClientOptions): ExchangeClient {
  return new ExchangeClient({
    transport,
    wallet: createGuardedWallet(deps),
    signatureChainId: ARBITRUM_CHAIN_ID,
    nonce: new PinnedNonceSource(nonce),
    ...(onDigest === undefined ? {} : { onDigest }),
  });
}

export function assertArbitrum(chainId: number | undefined): asserts chainId is number {
  if (chainId !== ARBITRUM_CHAIN_ID) throw new WrongChainError(chainId ?? 0);
}
