import { describe, expect, test } from "bun:test";
import { asDecimal } from "@0xsignal/sdk-hyperliquid/core";
import type { WsActiveAssetCtx } from "@0xsignal/sdk-hyperliquid/subscription";
import { createAssetCtxStream, type AssetCtxStream } from "./asset-ctx-stream";
import { subscribeAssetCtx } from "./hyperliquid-sink";

type Ctx = WsActiveAssetCtx["ctx"];

const ctxOf = (markPx: string): Ctx => ({
  dayNtlVlm: asDecimal("0"),
  prevDayPx: asDecimal(markPx),
  markPx: asDecimal(markPx),
  funding: asDecimal("0"),
  openInterest: asDecimal("0"),
  oraclePx: asDecimal(markPx),
});

type RecordedSubscription = {
  readonly coin: string;
  readonly listener: (ctx: Ctx) => void;
  readonly onError: ((error: unknown) => void) | undefined;
  unsubscribes: number;
};

const createRecorder = () => {
  const subscriptions: RecordedSubscription[] = [];
  const subscribe = (
    coin: string,
    listener: (ctx: Ctx) => void,
    onError?: (error: unknown) => void,
  ): (() => void) => {
    const record: RecordedSubscription = { coin, listener, onError, unsubscribes: 0 };
    subscriptions.push(record);
    return () => {
      record.unsubscribes += 1;
    };
  };
  return { subscriptions, subscribe };
};

type Recorder = ReturnType<typeof createRecorder>;

const forCoin = (recorder: Recorder, coin: string): RecordedSubscription[] =>
  recorder.subscriptions.filter((subscription) => subscription.coin === coin);

const firstForCoin = (recorder: Recorder, coin: string): RecordedSubscription => {
  const record = forCoin(recorder, coin)[0];
  if (record === undefined) throw new Error(`no subscription for ${coin}`);
  return record;
};

const coinsOf = (recorder: Recorder): string[] =>
  recorder.subscriptions.map((subscription) => subscription.coin);

const inert = (): void => {};

describe("asset ctx stream", () => {
  test("the sink exports the shared-client subscribe seam", () => {
    expect(typeof subscribeAssetCtx).toBe("function");
  });

  test("subscribes every coin in the initial visible set", () => {
    const recorder = createRecorder();
    const stream: AssetCtxStream = createAssetCtxStream({
      subscribe: recorder.subscribe,
      onCtx: inert,
    });

    stream.setVisible(["A", "B"]);

    expect(coinsOf(recorder)).toEqual(["A", "B"]);
  });

  test("setVisible subscribes only additions and releases only removals", () => {
    const recorder = createRecorder();
    const stream = createAssetCtxStream({ subscribe: recorder.subscribe, onCtx: inert });

    stream.setVisible(["A", "B"]);
    stream.setVisible(["B", "C"]);

    expect(forCoin(recorder, "A")).toHaveLength(1);
    expect(firstForCoin(recorder, "A").unsubscribes).toBe(1);
    expect(forCoin(recorder, "B")).toHaveLength(1);
    expect(firstForCoin(recorder, "B").unsubscribes).toBe(0);
    expect(forCoin(recorder, "C")).toHaveLength(1);
    expect(firstForCoin(recorder, "C").unsubscribes).toBe(0);
  });

  test("a repeated visible set is a no-op", () => {
    const recorder = createRecorder();
    const stream = createAssetCtxStream({ subscribe: recorder.subscribe, onCtx: inert });

    stream.setVisible(["A", "B"]);
    stream.setVisible(["A", "B"]);

    expect(coinsOf(recorder)).toEqual(["A", "B"]);
    expect(firstForCoin(recorder, "A").unsubscribes).toBe(0);
    expect(firstForCoin(recorder, "B").unsubscribes).toBe(0);
  });

  test("duplicate coins are subscribed once", () => {
    const recorder = createRecorder();
    const stream = createAssetCtxStream({ subscribe: recorder.subscribe, onCtx: inert });

    stream.setVisible(["A", "A", "B"]);

    expect(coinsOf(recorder)).toEqual(["A", "B"]);
  });

  test("frames reach onCtx with the coin that opened the subscription", () => {
    const recorder = createRecorder();
    const received: { coin: string; ctx: Ctx }[] = [];
    const stream = createAssetCtxStream({
      subscribe: recorder.subscribe,
      onCtx: (coin, ctx) => received.push({ coin, ctx }),
    });

    stream.setVisible(["A"]);
    firstForCoin(recorder, "A").listener(ctxOf("42"));

    expect(received).toEqual([{ coin: "A", ctx: ctxOf("42") }]);
  });

  test("dispose releases every coin and ignores later calls", () => {
    const recorder = createRecorder();
    const stream = createAssetCtxStream({ subscribe: recorder.subscribe, onCtx: inert });

    stream.setVisible(["A", "B"]);
    stream.dispose();

    expect(firstForCoin(recorder, "A").unsubscribes).toBe(1);
    expect(firstForCoin(recorder, "B").unsubscribes).toBe(1);

    stream.setVisible(["A", "C"]);
    stream.dispose();

    expect(coinsOf(recorder)).toEqual(["A", "B"]);
    expect(firstForCoin(recorder, "A").unsubscribes).toBe(1);
    expect(firstForCoin(recorder, "B").unsubscribes).toBe(1);
  });

  test("a failing subscribe is reported and does not break the stream", () => {
    const errors: unknown[] = [];
    const stream = createAssetCtxStream({
      subscribe: (coin) => {
        if (coin === "BAD") throw new Error("boom");
        return inert;
      },
      onCtx: inert,
      onError: (error) => errors.push(error),
    });

    expect(() => stream.setVisible(["BAD", "GOOD"])).not.toThrow();

    expect(errors).toHaveLength(1);
  });

  test("a throwing listener is reported and does not break the stream", () => {
    const recorder = createRecorder();
    const errors: unknown[] = [];
    const stream = createAssetCtxStream({
      subscribe: recorder.subscribe,
      onCtx: () => {
        throw new Error("listener");
      },
      onError: (error) => errors.push(error),
    });

    stream.setVisible(["A"]);

    expect(() => firstForCoin(recorder, "A").listener(ctxOf("1"))).not.toThrow();
    expect(errors).toHaveLength(1);
  });
});
