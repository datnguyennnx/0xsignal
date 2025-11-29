/** Streaming Types Tests */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { BinanceConnectionError, StreamingError } from "../types";
import type { BinanceKline, Subscription } from "../types";

describe("Streaming Types", () => {
  describe("BinanceConnectionError", () => {
    it("creates error with correct tag", () => {
      const error = new BinanceConnectionError({
        message: "Connection failed",
      });

      expect(error._tag).toBe("BinanceConnectionError");
      expect(error.message).toBe("Connection failed");
    });

    it("creates error with optional symbol", () => {
      const error = new BinanceConnectionError({
        message: "Subscription failed",
        symbol: "BTCUSDT",
      });

      expect(error.symbol).toBe("BTCUSDT");
    });

    it("creates error without symbol", () => {
      const error = new BinanceConnectionError({
        message: "WebSocket closed",
      });

      expect(error.symbol).toBeUndefined();
    });

    it.effect("can be used with Effect.fail", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new BinanceConnectionError({
            message: "Connection timeout",
          })
        );

        const result = yield* Effect.exit(program);

        expect(Exit.isFailure(result)).toBe(true);
      })
    );

    it.effect("can be caught by tag", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new BinanceConnectionError({
            message: "Stream disconnected",
            symbol: "ETHUSDT",
          })
        ).pipe(
          Effect.catchTag("BinanceConnectionError", (e) =>
            Effect.succeed(`Binance error for ${e.symbol ?? "unknown"}: ${e.message}`)
          )
        );

        const result = yield* program;

        expect(result).toBe("Binance error for ETHUSDT: Stream disconnected");
      })
    );
  });

  describe("StreamingError", () => {
    it("creates error with correct tag", () => {
      const error = new StreamingError({
        message: "Stream processing failed",
      });

      expect(error._tag).toBe("StreamingError");
      expect(error.message).toBe("Stream processing failed");
    });

    it("creates error with optional cause", () => {
      const cause = new Error("Underlying error");
      const error = new StreamingError({
        message: "Processing failed",
        cause,
      });

      expect(error.cause).toBe(cause);
    });

    it("creates error without cause", () => {
      const error = new StreamingError({
        message: "Unknown error",
      });

      expect(error.cause).toBeUndefined();
    });

    it.effect("can be used with Effect.fail", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new StreamingError({
            message: "Buffer overflow",
          })
        );

        const result = yield* Effect.exit(program);

        expect(Exit.isFailure(result)).toBe(true);
      })
    );

    it.effect("can be caught by tag", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new StreamingError({
            message: "Message parsing failed",
            cause: new Error("Invalid JSON"),
          })
        ).pipe(
          Effect.catchTag("StreamingError", (e) => Effect.succeed(`Streaming error: ${e.message}`))
        );

        const result = yield* program;

        expect(result).toBe("Streaming error: Message parsing failed");
      })
    );
  });

  describe("BinanceKline interface", () => {
    it("creates valid kline data", () => {
      const kline: BinanceKline = {
        symbol: "BTCUSDT",
        interval: "1m",
        openTime: 1700000000000,
        closeTime: 1700000060000,
        open: 50000,
        high: 50100,
        low: 49900,
        close: 50050,
        volume: 1000,
        trades: 500,
        isFinal: true,
      };

      expect(kline.symbol).toBe("BTCUSDT");
      expect(kline.interval).toBe("1m");
      expect(kline.open).toBe(50000);
      expect(kline.high).toBe(50100);
      expect(kline.low).toBe(49900);
      expect(kline.close).toBe(50050);
      expect(kline.volume).toBe(1000);
      expect(kline.trades).toBe(500);
      expect(kline.isFinal).toBe(true);
    });

    it("supports different intervals", () => {
      const intervals = ["1m", "5m", "15m", "1h", "4h", "1d"];

      intervals.forEach((interval) => {
        const kline: BinanceKline = {
          symbol: "BTCUSDT",
          interval,
          openTime: 1700000000000,
          closeTime: 1700000060000,
          open: 50000,
          high: 50100,
          low: 49900,
          close: 50050,
          volume: 1000,
          trades: 500,
          isFinal: false,
        };

        expect(kline.interval).toBe(interval);
      });
    });
  });

  describe("Subscription interface", () => {
    it("creates valid subscription data", () => {
      const subscription: Subscription = {
        symbol: "BTCUSDT",
        interval: "1m",
        clientCount: 5,
        lastUpdate: Date.now(),
      };

      expect(subscription.symbol).toBe("BTCUSDT");
      expect(subscription.interval).toBe("1m");
      expect(subscription.clientCount).toBe(5);
      expect(subscription.lastUpdate).toBeGreaterThan(0);
    });

    it("tracks multiple clients", () => {
      const subscription: Subscription = {
        symbol: "ETHUSDT",
        interval: "5m",
        clientCount: 10,
        lastUpdate: Date.now(),
      };

      expect(subscription.clientCount).toBe(10);
    });
  });

  describe("Error discrimination", () => {
    it.effect("can discriminate between error types", () =>
      Effect.gen(function* () {
        const handleError = (error: BinanceConnectionError | StreamingError) => {
          switch (error._tag) {
            case "BinanceConnectionError":
              return `Binance: ${error.message}${error.symbol ? ` (${error.symbol})` : ""}`;
            case "StreamingError":
              return `Stream: ${error.message}`;
          }
        };

        const binanceError = new BinanceConnectionError({
          message: "Connection lost",
          symbol: "BTCUSDT",
        });
        const streamError = new StreamingError({
          message: "Buffer full",
        });

        expect(handleError(binanceError)).toBe("Binance: Connection lost (BTCUSDT)");
        expect(handleError(streamError)).toBe("Stream: Buffer full");
      })
    );
  });
});
