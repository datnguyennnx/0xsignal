/** Domain Errors Tests - Using @effect/vitest */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import {
  ValidationError,
  InsufficientDataError,
  CalculationError,
  InvalidDataError,
  AnalysisError,
  StrategyError,
  CacheError,
  MarketDataError,
  matchFormulaError,
  matchDomainError,
  toHttpError,
} from "../errors";

describe("Domain Errors", () => {
  describe("Tagged Error Creation", () => {
    it("creates ValidationError with correct tag", () => {
      const error = new ValidationError({
        formula: "RSI",
        errors: ["Invalid period", "Missing data"],
      });

      expect(error._tag).toBe("ValidationError");
      expect(error.formula).toBe("RSI");
      expect(error.errors).toHaveLength(2);
    });

    it("creates InsufficientDataError with correct tag", () => {
      const error = new InsufficientDataError({
        formula: "SMA",
        required: 20,
        actual: 5,
      });

      expect(error._tag).toBe("InsufficientDataError");
      expect(error.required).toBe(20);
      expect(error.actual).toBe(5);
    });

    it("creates CalculationError with correct tag", () => {
      const error = new CalculationError({
        formula: "ATR",
        reason: "Division by zero",
      });

      expect(error._tag).toBe("CalculationError");
      expect(error.reason).toBe("Division by zero");
    });

    it("creates AnalysisError with optional fields", () => {
      const error = new AnalysisError({
        message: "Analysis failed",
        symbol: "BTC",
        cause: new Error("Network error"),
      });

      expect(error._tag).toBe("AnalysisError");
      expect(error.symbol).toBe("BTC");
      expect(error.cause).toBeDefined();
    });

    it("creates MarketDataError with source info", () => {
      const error = new MarketDataError({
        source: "CoinGecko",
        message: "Rate limited",
        symbol: "ETH",
      });

      expect(error._tag).toBe("MarketDataError");
      expect(error.source).toBe("CoinGecko");
    });
  });

  describe("matchFormulaError", () => {
    it("matches ValidationError correctly", () => {
      const error = new ValidationError({
        formula: "RSI",
        errors: ["Invalid period"],
      });

      const result = matchFormulaError(error);

      expect(result.code).toBe("VALIDATION");
      expect(result.message).toContain("Invalid period");
    });

    it("matches InsufficientDataError correctly", () => {
      const error = new InsufficientDataError({
        formula: "SMA",
        required: 20,
        actual: 5,
      });

      const result = matchFormulaError(error);

      expect(result.code).toBe("INSUFFICIENT_DATA");
      expect(result.message).toContain("20");
      expect(result.message).toContain("5");
    });

    it("matches CalculationError correctly", () => {
      const error = new CalculationError({
        formula: "ATR",
        reason: "Division by zero",
      });

      const result = matchFormulaError(error);

      expect(result.code).toBe("CALCULATION");
      expect(result.message).toBe("Division by zero");
    });

    it("matches InvalidDataError correctly", () => {
      const error = new InvalidDataError({
        formula: "MACD",
        issues: ["NaN value", "Negative price"],
      });

      const result = matchFormulaError(error);

      expect(result.code).toBe("INVALID_DATA");
      expect(result.message).toContain("NaN value");
    });
  });

  describe("matchDomainError", () => {
    it("returns 400 status for validation errors", () => {
      const error = new ValidationError({
        formula: "RSI",
        errors: ["Invalid"],
      });

      const result = matchDomainError(error);

      expect(result.status).toBe(400);
    });

    it("returns 500 status for calculation errors", () => {
      const error = new CalculationError({
        formula: "ATR",
        reason: "Internal error",
      });

      const result = matchDomainError(error);

      expect(result.status).toBe(500);
    });

    it("returns 502 status for market data errors", () => {
      const error = new MarketDataError({
        source: "Binance",
        message: "API unavailable",
      });

      const result = matchDomainError(error);

      expect(result.status).toBe(502);
    });
  });

  describe("toHttpError", () => {
    it("converts domain error to HTTP response format", () => {
      const error = new AnalysisError({
        message: "Failed to analyze",
      });

      const result = toHttpError(error);

      expect(result.status).toBe(500);
      expect(result.message).toBe("Failed to analyze");
    });
  });

  describe("Effect integration", () => {
    it.effect("can be used with Effect.fail", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new ValidationError({
            formula: "RSI",
            errors: ["Test error"],
          })
        );

        const result = yield* Effect.exit(program);

        expect(Exit.isFailure(result)).toBe(true);
      })
    );

    it.effect("can be caught and matched", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new InsufficientDataError({
            formula: "SMA",
            required: 20,
            actual: 5,
          })
        ).pipe(
          Effect.catchTag("InsufficientDataError", (e) =>
            Effect.succeed(`Caught: need ${e.required} points`)
          )
        );

        const result = yield* program;

        expect(result).toBe("Caught: need 20 points");
      })
    );
  });
});
