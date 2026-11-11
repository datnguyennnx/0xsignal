import type { EIP1193Provider } from "viem";
import { createWalletClient, custom, getAddress } from "viem";
import { arbitrum } from "viem/chains";
import type {
  CancelOrdersRequest,
  OrderIntentRequest,
  PlaceOrderEntry,
  PlaceOrderRequest,
  TimeInForce,
  UpdateLeverageRequest,
} from "@0xsignal/shared";
import { asDecimal, toWirePrice, toWireSize, type Digest32 } from "@0xsignal/sdk-hyperliquid";
import {
  errorsOf,
  type CancelAction,
  type DigestEnvelope,
  type ExchangeOk,
  type OrderAction,
  type OrderWire,
  type UpdateLeverageAction,
} from "@0xsignal/sdk-hyperliquid/exchange";
import {
  assertArbitrum,
  buildCancelAction,
  buildLeverageAction,
  buildOrderAction,
  createGuardedExchangeClient,
  preview,
  signGuardedAction,
  type PreviewEnvelope,
} from "./client";
import { formatOrderSize } from "@/features/trade/utils/trade-math";
import {
  type IntentSummary,
  assertIntentHash,
  formatConfirmation,
  summarizeIntent,
} from "./intent";
import { reportOrderIntentResult, requestOrderIntent } from "@/services/api/exchange";
import { createBrowserNonceIssuer } from "./nonce-issuer";
import { describeSigningError, type GuardedWalletDeps } from "./typed-data-guard";

const HL_TIF: Record<Exclude<TimeInForce, "FOK">, "Gtc" | "Ioc" | "Alo"> = {
  GTC: "Gtc",
  IOC: "Ioc",
  Alo: "Alo",
  FrontendMarket: "Ioc",
};

const FOK_REJECTION =
  "FOK is not supported by Hyperliquid: there is no fill-or-kill time-in-force, so reject instead of downgrading to a resting Gtc order";

export function toHlTif(timeInForce: TimeInForce): "Gtc" | "Ioc" | "Alo" {
  if (timeInForce === "FOK") throw new Error(FOK_REJECTION);
  return HL_TIF[timeInForce];
}

export class ExchangeRejectionError extends Error {
  readonly messages: readonly string[];

  constructor(messages: readonly string[]) {
    super(messages.join("; "));
    this.name = "ExchangeRejectionError";
    this.messages = messages;
  }
}

function assertAccepted(response: ExchangeOk): void {
  const messages = errorsOf(response);
  if (messages.length > 0) throw new ExchangeRejectionError(messages);
}

class SizeDecimalsMismatchError extends Error {
  constructor(ui: number, backend: number) {
    super(
      `Refusing to submit: the form uses ${ui} size decimals but the market requires ${backend}. Reload the market precision and try again.`,
    );
    this.name = "SizeDecimalsMismatchError";
  }
}

function digestHex(digest: Digest32): `0x${string}` {
  return `0x${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function assertSignedEnvelope(
  previewed: PreviewEnvelope,
  digest: Digest32,
  envelope: DigestEnvelope,
): void {
  if (envelope.nonce !== previewed.nonce || digestHex(digest) !== previewed.digest) {
    throw new Error(
      "Refusing to submit: the wallet returned a different envelope than the one shown for confirmation.",
    );
  }
}

function canonicalSize(summary: IntentSummary, szDecimals: number): IntentSummary {
  const size = formatOrderSize(summary.size, szDecimals);
  if (Number(size) !== Number(summary.size)) {
    throw new Error(
      `Refusing to submit: ${summary.symbol} size ${summary.size} does not fit ${szDecimals} size decimals.`,
    );
  }
  return { ...summary, size };
}

export interface SigningContext {
  readonly address: `0x${string}`;
  readonly chainId: number | undefined;
  readonly provider: EIP1193Provider | undefined;
  readonly confirm: (message: string) => boolean;
  readonly szDecimals?: number;
}

const issueNonce = createBrowserNonceIssuer();

function walletDeps(address: `0x${string}`, provider: EIP1193Provider): GuardedWalletDeps {
  const client = createWalletClient({
    account: address,
    chain: arbitrum,
    transport: custom(provider),
  });
  return {
    address,
    signTypedData: (params) =>
      client.signTypedData({
        account: address,
        domain: {
          name: params.domain.name,
          version: params.domain.version,
          chainId: params.domain.chainId,
          verifyingContract: getAddress(params.domain.verifyingContract),
        },
        types: params.types,
        primaryType: params.primaryType,
        message: params.message,
      }),
    getChainId: () => client.getChainId(),
  };
}

function requireProvider(ctx: SigningContext): EIP1193Provider {
  if (ctx.provider === undefined) {
    throw new Error("Connect a browser wallet to sign Hyperliquid actions.");
  }
  return ctx.provider;
}

function toIntent(entry: PlaceOrderEntry): OrderIntentRequest | null {
  if (entry.orderType.kind === "trigger") return null;
  const timeInForce = entry.orderType.timeInForce;
  return {
    symbol: entry.symbol,
    side: entry.side,
    size: entry.quantity,
    price: entry.price,
    orderType: timeInForce === "FrontendMarket" ? "market" : "limit",
    timeInForce,
    reduceOnly: entry.reduceOnly,
  };
}

function toOrderLeg(entry: PlaceOrderEntry, assetIndex: number, szDecimals: number): OrderWire {
  const orderType = entry.orderType;
  return {
    a: assetIndex,
    b: entry.side === "buy",
    p: toWirePrice(asDecimal(entry.price), szDecimals, "perp"),
    s: toWireSize(asDecimal(entry.quantity), szDecimals),
    r: entry.reduceOnly,
    t:
      orderType.kind === "limit"
        ? { limit: { tif: toHlTif(orderType.timeInForce) } }
        : {
            trigger: {
              isMarket: orderType.isMarket,
              triggerPx: toWirePrice(asDecimal(orderType.triggerPrice), szDecimals, "perp"),
              tpsl: orderType.tpsl,
            },
          },
  };
}

function triggerSummary(entry: PlaceOrderEntry): IntentSummary {
  const orderType = entry.orderType;
  return {
    symbol: entry.symbol,
    side: entry.side,
    size: entry.quantity,
    price: orderType.kind === "trigger" ? orderType.triggerPrice : entry.price,
    orderType: "trigger",
    timeInForce: orderType.kind === "trigger" && orderType.isMarket ? "market" : "limit",
    reduceOnly: entry.reduceOnly,
    notionalUsd: Number(entry.quantity) * Number(entry.price),
  };
}

interface PendingIntent {
  readonly intentId: string;
  readonly input: OrderIntentRequest;
}

function assertLegsMatchIntent(
  legs: readonly OrderWire[],
  summaries: readonly IntentSummary[],
  assetIndex: number,
  szDecimals: number,
): void {
  if (legs.length !== summaries.length) {
    throw new Error(
      "Refusing to sign: the encoded order count does not match the confirmed orders.",
    );
  }
  legs.forEach((leg, index) => {
    const summary = summaries[index];
    if (summary === undefined) {
      throw new Error("Refusing to sign: the confirmed order is missing.");
    }
    const size = toWireSize(asDecimal(summary.size), szDecimals);
    const price = toWirePrice(asDecimal(summary.price), szDecimals, "perp");
    const sideMatches = leg.b === (summary.side === "buy");
    const priceMatches = "trigger" in leg.t ? leg.t.trigger.triggerPx === price : leg.p === price;
    if (leg.a !== assetIndex || !sideMatches || leg.s !== size || !priceMatches) {
      throw new Error("Refusing to sign: the encoded order does not match the confirmed order.");
    }
  });
}

async function rejectIntents(pending: readonly PendingIntent[], error: unknown): Promise<void> {
  const message = describeSigningError(error);
  await Promise.all(
    pending.map(async ({ intentId }) => {
      try {
        await reportOrderIntentResult(intentId, { error: message });
      } catch {
        // The order already failed; the audit write is best-effort.
      }
    }),
  );
}

/**
 * Intent -> hash check -> confirmation -> signature -> direct submit -> result.
 * The backend validates the order, the browser never holds a key, and the
 * guard adapter refuses anything but the Agent payload.
 */
export async function submitPlaceOrder(
  request: PlaceOrderRequest,
  ctx: SigningContext,
): Promise<void> {
  assertArbitrum(ctx.chainId);
  const provider = requireProvider(ctx);

  const pending: PendingIntent[] = [];
  const summaries: IntentSummary[] = [];
  let assetIndex: number | null = null;
  let szDecimals: number | null = null;

  try {
    const prepared = await Promise.all(
      request.orders.map(async (entry) => {
        const input = toIntent(entry);
        if (input === null) {
          return {
            summary: triggerSummary(entry),
            pending: null,
            assetIndex: null,
            szDecimals: null,
          };
        }
        const response = await requestOrderIntent(input);
        await assertIntentHash(input, response);
        return {
          summary: summarizeIntent(input, response.validated),
          pending: { intentId: response.intentId, input },
          assetIndex: response.validated.assetIndex,
          szDecimals: response.validated.sizeDecimals,
        };
      }),
    );

    for (const item of prepared) {
      summaries.push(item.summary);
      if (item.pending !== null) pending.push(item.pending);
      if (item.assetIndex !== null) assetIndex ??= item.assetIndex;
      if (item.szDecimals !== null) szDecimals ??= item.szDecimals;
    }

    if (assetIndex === null || szDecimals === null) {
      throw new Error("A take-profit/stop-loss order needs a primary order to resolve the asset.");
    }
    const resolvedAssetIndex = assetIndex;
    const resolvedSzDecimals = szDecimals;
    if (ctx.szDecimals !== undefined && ctx.szDecimals !== resolvedSzDecimals) {
      throw new SizeDecimalsMismatchError(ctx.szDecimals, resolvedSzDecimals);
    }

    const canonicalSummaries = summaries.map((summary) =>
      canonicalSize(summary, resolvedSzDecimals),
    );
    const legs = request.orders.map((entry) =>
      toOrderLeg(entry, resolvedAssetIndex, resolvedSzDecimals),
    );
    const params: OrderAction = {
      orders: legs,
      grouping: request.grouping ?? "na",
    };
    const action = buildOrderAction(params);
    assertLegsMatchIntent(
      action.orders,
      canonicalSummaries,
      resolvedAssetIndex,
      resolvedSzDecimals,
    );
    const nonce = await issueNonce(ctx.address);
    const previewAction = { type: "order", ...action } as const;
    const { envelope } = preview(previewAction, { nonce });

    if (!ctx.confirm(formatConfirmation(canonicalSummaries, envelope.connectionId))) {
      throw new Error("Order cancelled before signing.");
    }

    const client = createGuardedExchangeClient({
      deps: walletDeps(ctx.address, provider),
      nonce,
      onDigest: (digest, signed) => {
        assertSignedEnvelope(envelope, digest, signed);
      },
    });
    const response = await signGuardedAction({ type: "order", ...action }, () =>
      client.order(action),
    );
    assertAccepted(response);

    await Promise.all(
      pending.map(async ({ intentId }) => {
        await reportOrderIntentResult(intentId, { txHash: envelope.connectionId });
      }),
    );
  } catch (error) {
    await rejectIntents(pending, error);
    throw error;
  }
}

export async function submitCancelOrders(
  request: CancelOrdersRequest,
  ctx: SigningContext & { readonly assetIndex: (symbol: string) => number | null },
): Promise<`0x${string}`> {
  assertArbitrum(ctx.chainId);
  const provider = requireProvider(ctx);
  const cancels = request.cancels.map((cancel) => {
    const index = ctx.assetIndex(cancel.symbol);
    if (index === null) throw new Error(`Unknown Hyperliquid asset: ${cancel.symbol}`);
    return { a: index, o: cancel.orderId };
  });

  const action: CancelAction = buildCancelAction({ cancels });
  const nonce = await issueNonce(ctx.address);
  const previewAction = { type: "cancel", ...action } as const;
  const { envelope } = preview(previewAction, { nonce });
  const client = createGuardedExchangeClient({
    deps: walletDeps(ctx.address, provider),
    nonce,
    onDigest: (digest, signed) => {
      assertSignedEnvelope(envelope, digest, signed);
    },
  });
  const response = await signGuardedAction({ type: "cancel", ...action }, () =>
    client.cancel(action),
  );
  assertAccepted(response);
  return envelope.connectionId;
}

export async function submitUpdateLeverage(
  request: UpdateLeverageRequest,
  ctx: SigningContext & { readonly assetIndex: number },
): Promise<`0x${string}`> {
  assertArbitrum(ctx.chainId);
  const provider = requireProvider(ctx);
  const params: UpdateLeverageAction = {
    asset: ctx.assetIndex,
    isCross: request.isCross,
    leverage: request.leverage,
  };
  const action = buildLeverageAction(params);
  const nonce = await issueNonce(ctx.address);
  const previewAction = { type: "updateLeverage", ...action } as const;
  const { envelope } = preview(previewAction, { nonce });
  const client = createGuardedExchangeClient({
    deps: walletDeps(ctx.address, provider),
    nonce,
    onDigest: (digest, signed) => {
      assertSignedEnvelope(envelope, digest, signed);
    },
  });
  const response = await signGuardedAction({ type: "updateLeverage", ...action }, () =>
    client.updateLeverage(action),
  );
  assertAccepted(response);
  return envelope.connectionId;
}
