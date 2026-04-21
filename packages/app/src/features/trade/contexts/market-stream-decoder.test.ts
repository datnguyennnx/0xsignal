import { describe, expect, it } from "vitest";
import { decodeMarketWsMessage } from "./market-stream-decoder";

describe("decodeMarketWsMessage", () => {
  it("unwraps backend market envelope with nested Hyperliquid candle event", () => {
    const message = {
      type: "market",
      channel: "candle",
      data: {
        channel: "candle",
        data: {
          t: 1716000000000,
          o: "100",
          h: "102",
          l: "99",
          c: "101",
          v: "25",
        },
      },
    };

    expect(decodeMarketWsMessage(message, "candle")).toEqual({
      kind: "market",
      channel: "candle",
      payload: {
        t: 1716000000000,
        o: "100",
        h: "102",
        l: "99",
        c: "101",
        v: "25",
      },
      meta: undefined,
    });
  });

  it("extracts candle interval metadata from backend envelope", () => {
    const message = {
      type: "market",
      channel: "candle",
      interval: "1h",
      data: {
        t: 1716000000000,
        o: "100",
        h: "102",
        l: "99",
        c: "101",
        v: "25",
      },
    };

    expect(decodeMarketWsMessage(message, "candle")).toEqual({
      kind: "market",
      channel: "candle",
      payload: {
        t: 1716000000000,
        o: "100",
        h: "102",
        l: "99",
        c: "101",
        v: "25",
      },
      meta: {
        interval: "1h",
      },
    });
  });

  it("extracts orderbook levels from nested payload wrappers", () => {
    const levels = [[{ px: "100", sz: "2", n: 1 }], [{ px: "101", sz: "3", n: 1 }]];

    const message = {
      type: "market",
      channel: "l2Book",
      data: {
        channel: "l2Book",
        data: {
          orderbook: {
            levels,
          },
        },
      },
    };

    expect(decodeMarketWsMessage(message, "l2Book")).toEqual({
      kind: "market",
      channel: "l2Book",
      payload: { levels },
      meta: undefined,
    });
  });

  it("passes through l2Book precision metadata", () => {
    const levels = [[{ px: "100", sz: "2", n: 1 }], [{ px: "101", sz: "3", n: 1 }]];

    const message = {
      type: "market",
      channel: "l2Book",
      nSigFigs: 3,
      data: {
        orderbook: {
          levels,
        },
      },
    };

    expect(decodeMarketWsMessage(message, "l2Book")).toEqual({
      kind: "market",
      channel: "l2Book",
      payload: { levels },
      meta: {
        nSigFigs: 3,
      },
    });
  });

  it("parses string payload and returns control messages", () => {
    expect(decodeMarketWsMessage('{"type":"ready"}', "candle")).toEqual({
      kind: "control",
      type: "ready",
      message: undefined,
    });

    expect(decodeMarketWsMessage('{"type":"error","message":"upstream failed"}', "l2Book")).toEqual(
      {
        kind: "control",
        type: "error",
        message: "upstream failed",
      }
    );
  });

  it("ignores mismatched channel envelopes", () => {
    const message = {
      type: "market",
      channel: "l2Book",
      data: {
        levels: [[], []],
      },
    };

    expect(decodeMarketWsMessage(message, "candle")).toEqual({ kind: "ignore" });
  });
});
