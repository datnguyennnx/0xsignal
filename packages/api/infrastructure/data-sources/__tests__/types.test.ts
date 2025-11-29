/** Infrastructure Data Source Types Tests */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { DataSourceError, RateLimitError, DataNotAvailableError } from "../types";

describe("Data Source Types", () => {
  describe("DataSourceError", () => {
    it("creates error with correct tag", () => {
      const error = new DataSourceError({
        source: "CoinGecko",
        message: "API request failed",
      });

      expect(error._tag).toBe("DataSourceError");
      expect(error.source).toBe("CoinGecko");
      expect(error.message).toBe("API request failed");
    });

    it("creates error with optional symbol", () => {
      const error = new DataSourceError({
        source: "Binance",
        message: "Symbol not found",
        symbol: "UNKNOWN",
      });

      expect(error.symbol).toBe("UNKNOWN");
    });

    it("creates error with optional cause", () => {
      const cause = new Error("Network error");
      const error = new DataSourceError({
        source: "DefiLlama",
        message: "Request failed",
        cause,
      });

      expect(error.cause).toBe(cause);
    });

    it.effect("can be used with Effect.fail", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new DataSourceError({
            source: "Test",
            message: "Test error",
          })
        );

        const result = yield* Effect.exit(program);

        expect(Exit.isFailure(result)).toBe(true);
      })
    );

    it.effect("can be caught by tag", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new DataSourceError({
            source: "CoinGecko",
            message: "Rate limited",
          })
        ).pipe(
          Effect.catchTag("DataSourceError", (e) =>
            Effect.succeed(`Caught: ${e.source} - ${e.message}`)
          )
        );

        const result = yield* program;

        expect(result).toBe("Caught: CoinGecko - Rate limited");
      })
    );
  });

  describe("RateLimitError", () => {
    it("creates error with correct tag", () => {
      const error = new RateLimitError({
        source: "Binance",
      });

      expect(error._tag).toBe("RateLimitError");
      expect(error.source).toBe("Binance");
    });

    it("creates error with optional retryAfter", () => {
      const error = new RateLimitError({
        source: "CoinGecko",
        retryAfter: 60,
      });

      expect(error.retryAfter).toBe(60);
    });

    it("creates error without retryAfter", () => {
      const error = new RateLimitError({
        source: "DefiLlama",
      });

      expect(error.retryAfter).toBeUndefined();
    });

    it.effect("can be used with Effect.fail", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new RateLimitError({
            source: "Test",
            retryAfter: 30,
          })
        );

        const result = yield* Effect.exit(program);

        expect(Exit.isFailure(result)).toBe(true);
      })
    );

    it.effect("can be caught by tag", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new RateLimitError({
            source: "Binance",
            retryAfter: 120,
          })
        ).pipe(
          Effect.catchTag("RateLimitError", (e) =>
            Effect.succeed(`Rate limited by ${e.source}, retry in ${e.retryAfter}s`)
          )
        );

        const result = yield* program;

        expect(result).toBe("Rate limited by Binance, retry in 120s");
      })
    );
  });

  describe("DataNotAvailableError", () => {
    it("creates error with correct tag", () => {
      const error = new DataNotAvailableError({
        source: "Binance",
        dataType: "liquidations",
      });

      expect(error._tag).toBe("DataNotAvailableError");
      expect(error.source).toBe("Binance");
      expect(error.dataType).toBe("liquidations");
    });

    it("creates error with optional symbol", () => {
      const error = new DataNotAvailableError({
        source: "CoinGecko",
        dataType: "price",
        symbol: "UNKNOWN",
      });

      expect(error.symbol).toBe("UNKNOWN");
    });

    it("creates error without symbol", () => {
      const error = new DataNotAvailableError({
        source: "DefiLlama",
        dataType: "fees",
      });

      expect(error.symbol).toBeUndefined();
    });

    it.effect("can be used with Effect.fail", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new DataNotAvailableError({
            source: "Test",
            dataType: "test",
          })
        );

        const result = yield* Effect.exit(program);

        expect(Exit.isFailure(result)).toBe(true);
      })
    );

    it.effect("can be caught by tag", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new DataNotAvailableError({
            source: "Binance",
            dataType: "openInterest",
            symbol: "BTC",
          })
        ).pipe(
          Effect.catchTag("DataNotAvailableError", (e) =>
            Effect.succeed(`${e.dataType} not available for ${e.symbol} from ${e.source}`)
          )
        );

        const result = yield* program;

        expect(result).toBe("openInterest not available for BTC from Binance");
      })
    );
  });

  describe("Error discrimination", () => {
    it.effect("can discriminate between error types", () =>
      Effect.gen(function* () {
        const handleError = (error: DataSourceError | RateLimitError | DataNotAvailableError) => {
          switch (error._tag) {
            case "DataSourceError":
              return `Data source error: ${error.message}`;
            case "RateLimitError":
              return `Rate limited: retry in ${error.retryAfter ?? "unknown"}s`;
            case "DataNotAvailableError":
              return `Data not available: ${error.dataType}`;
          }
        };

        const dataSourceError = new DataSourceError({
          source: "Test",
          message: "Connection failed",
        });
        const rateLimitError = new RateLimitError({
          source: "Test",
          retryAfter: 60,
        });
        const notAvailableError = new DataNotAvailableError({
          source: "Test",
          dataType: "historical",
        });

        expect(handleError(dataSourceError)).toBe("Data source error: Connection failed");
        expect(handleError(rateLimitError)).toBe("Rate limited: retry in 60s");
        expect(handleError(notAvailableError)).toBe("Data not available: historical");
      })
    );
  });
});
