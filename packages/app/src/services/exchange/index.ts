import type { EIP1193Provider } from "viem";
import { createWalletClient, custom } from "viem";
import { arbitrum } from "viem/chains";
import type {
  CancelOrdersRequest,
  OrderIntentRequest,
  PlaceOrderEntry,
  PlaceOrderRequest,
  TimeInForce,
  UpdateLeverageRequest,
} from "@0xsignal/shared";
import type { OrderParameters, UpdateLeverageParameters } from "@nktkas/hyperliquid/api/exchange";
import {
  actionId,
  assertArbitrum,
  buildCancelAction,
  buildLeverageAction,
  buildOrderAction,
  createGuardedExchangeClient,
  signGuardedAction,
} from "./client";
import {
  type IntentSummary,
  assertIntentHash,
  formatConfirmation,
  summarizeIntent,
} from "./intent";
import { reportOrderIntentResult, requestOrderIntent } from "@/services/api/exchange";
import { createBrowserNonceIssuer } from "./nonce-issuer";
import { describeSigningError, type GuardedWalletDeps } from "./typed-data-guard";

const HL_TIF: Record<TimeInForce, "Gtc" | "Ioc" | "Alo" | "FrontendMarket"> = {
  GTC: "Gtc",
  IOC: "Ioc",
  FOK: "Ioc",
  Alo: "Alo",
  FrontendMarket: "FrontendMarket",
};

export interface SigningContext {
  readonly address: `0x${string}`;
  readonly chainId: number | undefined;
  readonly provider: EIP1193Provider | undefined;
  readonly confirm: (message: string) => boolean;
}

const issueNonce = createBrowserNonceIssuer();

function walletDeps(address: `0x${string}`, provider: EIP1193Provider): GuardedWalletDeps {
  const client = createWalletClient({
    account: address,
    chain: arbitrum,
    transport: custom(provider),
  });
  return {
    signTypedData: (params) => client.signTypedData({ account: address, ...params }),
    getAddresses: () => Promise.resolve([address]),
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

function toOrderLeg(entry: PlaceOrderEntry, assetIndex: number): OrderParameters["orders"][number] {
  const orderType = entry.orderType;
  return {
    a: assetIndex,
    b: entry.side === "buy",
    p: entry.price,
    s: entry.quantity,
    r: entry.reduceOnly,
    t:
      orderType.kind === "limit"
        ? { limit: { tif: HL_TIF[orderType.timeInForce] } }
        : {
            trigger: {
              isMarket: orderType.isMarket,
              triggerPx: orderType.triggerPrice,
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

  try {
    const prepared = await Promise.all(
      request.orders.map(async (entry) => {
        const input = toIntent(entry);
        if (input === null) {
          return { summary: triggerSummary(entry), pending: null, assetIndex: null };
        }
        const response = await requestOrderIntent(input);
        await assertIntentHash(input, response);
        return {
          summary: summarizeIntent(input, response.validated),
          pending: { intentId: response.intentId, input },
          assetIndex: response.validated.assetIndex,
        };
      }),
    );

    for (const item of prepared) {
      summaries.push(item.summary);
      if (item.pending !== null) pending.push(item.pending);
      if (item.assetIndex !== null) assetIndex ??= item.assetIndex;
    }

    if (assetIndex === null) {
      throw new Error("A take-profit/stop-loss order needs a primary order to resolve the asset.");
    }
    const resolvedAssetIndex = assetIndex;

    const legs = request.orders.map((entry) => toOrderLeg(entry, resolvedAssetIndex));
    const params: OrderParameters = {
      orders: legs,
      grouping: request.grouping ?? "na",
    };
    const action = buildOrderAction(params);
    const nonce = await issueNonce(ctx.address);
    const id = actionId(action, nonce);

    if (!ctx.confirm(formatConfirmation(summaries, id))) {
      throw new Error("Order cancelled before signing.");
    }

    const client = createGuardedExchangeClient({
      deps: walletDeps(ctx.address, provider),
      nonce,
    });
    await signGuardedAction(action, () => client.order(params));

    await Promise.all(
      pending.map(async ({ intentId }) => {
        await reportOrderIntentResult(intentId, { txHash: id });
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

  const action = buildCancelAction({ cancels });
  const nonce = await issueNonce(ctx.address);
  const id = actionId(action, nonce);
  const client = createGuardedExchangeClient({
    deps: walletDeps(ctx.address, provider),
    nonce,
  });
  await signGuardedAction(action, () => client.cancel({ cancels }));
  return id;
}

export async function submitUpdateLeverage(
  request: UpdateLeverageRequest,
  ctx: SigningContext & { readonly assetIndex: number },
): Promise<`0x${string}`> {
  assertArbitrum(ctx.chainId);
  const provider = requireProvider(ctx);
  const params: UpdateLeverageParameters = {
    asset: ctx.assetIndex,
    isCross: request.isCross,
    leverage: request.leverage,
  };
  const action = buildLeverageAction(params);
  const nonce = await issueNonce(ctx.address);
  const id = actionId(action, nonce);
  const client = createGuardedExchangeClient({
    deps: walletDeps(ctx.address, provider),
    nonce,
  });
  await signGuardedAction(action, () => client.updateLeverage(params));
  return id;
}
