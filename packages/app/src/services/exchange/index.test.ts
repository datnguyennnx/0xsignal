/// <reference types="bun-types" />
import { afterAll, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type {
  OrderIntentRequest,
  OrderIntentResponse,
  OrderIntentResultRequest,
  OrderIntentResultResponse,
  PlaceOrderEntry,
  PlaceOrderRequest,
} from "@0xsignal/shared";
import type { EIP1193Provider } from "viem";
import { asL1Action, cast, encodeL1Action, l1ActionHashHex } from "@0xsignal/sdk-hyperliquid";
import { encodeOrder, type OrderAction } from "@0xsignal/sdk-hyperliquid/exchange";
import * as apiExchangeModule from "@/services/api/exchange";
import * as clientModule from "./client";
import { computeIntentHash } from "./intent";
import * as nonceModule from "./nonce-issuer";

interface ReportedResult {
  readonly intentId: string;
  readonly result: OrderIntentResultRequest;
}

type ExchangeResponse = unknown;

let exchangeResponse: ExchangeResponse;
let signCalls = 0;
let submittedAction: Record<string, unknown> | undefined;
const reports: ReportedResult[] = [];

spyOn(nonceModule, "createBrowserNonceIssuer").mockImplementation(
  () => () => Promise.resolve(Date.now()),
);

spyOn(clientModule, "signGuardedAction").mockImplementation(
  async <T>(action: Record<string, unknown>, _sign: () => Promise<T>): Promise<T> => {
    signCalls += 1;
    submittedAction = action;
    return exchangeResponse as T;
  },
);

spyOn(apiExchangeModule, "requestOrderIntent").mockImplementation(
  async (input: OrderIntentRequest): Promise<OrderIntentResponse> => ({
    intentId: "intent-1",
    intentHash: await computeIntentHash(input),
    validated: {
      assetIndex: 3,
      symbol: "BTC",
      sizeDecimals: 5,
      priceDecimals: 1,
      notionalUsd: 500,
    },
  }),
);

spyOn(apiExchangeModule, "reportOrderIntentResult").mockImplementation(
  (intentId: string, result: OrderIntentResultRequest): Promise<OrderIntentResultResponse> => {
    reports.push({ intentId, result });
    return Promise.resolve({ intentId, status: "submitted", txHash: null, error: null });
  },
);

const { ExchangeRejectionError, submitPlaceOrder, toHlTif } = await import("./index");

const entry: PlaceOrderEntry = {
  symbol: "BTC",
  side: "buy",
  quantity: "0.01",
  price: "50000",
  reduceOnly: false,
  orderType: { kind: "limit", timeInForce: "GTC" },
};

const request: PlaceOrderRequest = { orders: [entry] };

const ctx = {
  address: `0x${"11".repeat(20)}` as `0x${string}`,
  chainId: 42161,
  provider: { request: () => Promise.resolve(null) } as unknown as EIP1193Provider,
  confirm: () => true,
};

const rejectionOf = async (run: () => Promise<unknown>): Promise<Error | null> => {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error("non-error rejection");
  }
};

beforeEach(() => {
  signCalls = 0;
  submittedAction = undefined;
  reports.length = 0;
});

afterAll(() => {
  mock.restore();
});

describe("submitPlaceOrder exchange rejection", () => {
  test("an ok response whose statuses carry an error rejects and sends no txHash", async () => {
    exchangeResponse = {
      status: "ok",
      response: {
        type: "order",
        data: { statuses: [{ error: "Insufficient margin to place order." }] },
      },
    };

    const rejection = await rejectionOf(() => submitPlaceOrder(request, ctx));

    expect(rejection).toBeInstanceOf(ExchangeRejectionError);
    const rejectionError =
      rejection instanceof ExchangeRejectionError ? rejection : new ExchangeRejectionError([]);
    expect(rejectionError.messages).toEqual(["Insufficient margin to place order."]);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.result).toEqual({ error: "Insufficient margin to place order." });
  });

  test("a genuinely accepted order reports the connection id as txHash", async () => {
    exchangeResponse = {
      status: "ok",
      response: { type: "order", data: { statuses: [{ resting: { oid: 1 } }] } },
    };

    expect(await rejectionOf(() => submitPlaceOrder(request, ctx))).toBeNull();
    expect(reports).toHaveLength(1);
    expect(reports[0]?.result).toMatchObject({
      txHash: expect.stringMatching(/^0x[0-9a-f]{64}$/),
    });
  });
});

describe("confirmation binding", () => {
  test("the connection id shown for confirmation equals the submitted action's connection id", async () => {
    const now = 1_700_000_000_000;
    const nowSpy = spyOn(Date, "now").mockReturnValue(now);
    exchangeResponse = {
      status: "ok",
      response: { type: "order", data: { statuses: [{ resting: { oid: 1 } }] } },
    };
    let confirmed: string | undefined;
    const captureCtx = {
      ...ctx,
      confirm: (message: string) => {
        confirmed = /connectionId: (0x[0-9a-f]{64})/.exec(message)?.[1];
        return true;
      },
    };
    try {
      expect(await rejectionOf(() => submitPlaceOrder(request, captureCtx))).toBeNull();
      expect(submittedAction).toBeDefined();
      const action = cast<OrderAction>(submittedAction, "submitted action");
      const expected = l1ActionHashHex({
        action: encodeL1Action(asL1Action(encodeOrder(action))),
        nonce: BigInt(now),
      });
      expect(confirmed).toBe(expected);
    } finally {
      nowSpy.mockRestore();
    }
  });
});

describe("FOK mirrors the API rule", () => {
  test("rejects FOK instead of silently downgrading it", () => {
    expect(() => toHlTif("FOK")).toThrow(/FOK is not supported by Hyperliquid/);
  });

  test("keeps the supported time-in-force mappings", () => {
    expect(toHlTif("GTC")).toBe("Gtc");
    expect(toHlTif("IOC")).toBe("Ioc");
    expect(toHlTif("Alo")).toBe("Alo");
    expect(toHlTif("FrontendMarket")).toBe("Ioc");
  });

  test("a FOK order is refused before anything is signed", async () => {
    const fokRequest: PlaceOrderRequest = {
      orders: [{ ...entry, orderType: { kind: "limit", timeInForce: "FOK" } }],
    };

    const rejection = await rejectionOf(() => submitPlaceOrder(fokRequest, ctx));

    expect(rejection).not.toBeNull();
    expect(signCalls).toBe(0);
  });
});
