/** Branded Types Tests */

import { expect, describe, it } from "vitest";
import {
  SymbolId,
  Price,
  Percentage,
  Confidence,
  RiskScore,
  RSIValue,
  NormalizedATR,
  MarketCap,
  Volume,
  safeBrand,
} from "../branded";

describe("Branded Types", () => {
  describe("SymbolId", () => {
    it("creates valid symbol id", () => {
      const symbol = SymbolId("btc");
      expect(symbol).toBe("btc");
    });

    it("accepts any string", () => {
      const symbol = SymbolId("ethereum-classic");
      expect(symbol).toBe("ethereum-classic");
    });
  });

  describe("Price", () => {
    it("creates valid price for positive number", () => {
      const price = Price(50000);
      expect(price).toBe(50000);
    });

    it("creates valid price for zero", () => {
      const price = Price(0);
      expect(price).toBe(0);
    });

    it("throws for negative price", () => {
      expect(() => Price(-100)).toThrow();
    });

    it("accepts decimal prices", () => {
      const price = Price(0.00001234);
      expect(price).toBe(0.00001234);
    });
  });

  describe("Percentage", () => {
    it("creates valid percentage", () => {
      const pct = Percentage(50);
      expect(pct).toBe(50);
    });

    it("accepts negative percentages", () => {
      const pct = Percentage(-25);
      expect(pct).toBe(-25);
    });

    it("accepts percentages over 100", () => {
      const pct = Percentage(150);
      expect(pct).toBe(150);
    });
  });

  describe("Confidence", () => {
    it("creates valid confidence for 0", () => {
      const conf = Confidence(0);
      expect(conf).toBe(0);
    });

    it("creates valid confidence for 100", () => {
      const conf = Confidence(100);
      expect(conf).toBe(100);
    });

    it("creates valid confidence for middle value", () => {
      const conf = Confidence(50);
      expect(conf).toBe(50);
    });

    it("throws for confidence below 0", () => {
      expect(() => Confidence(-1)).toThrow();
    });

    it("throws for confidence above 100", () => {
      expect(() => Confidence(101)).toThrow();
    });
  });

  describe("RiskScore", () => {
    it("creates valid risk score for 0", () => {
      const risk = RiskScore(0);
      expect(risk).toBe(0);
    });

    it("creates valid risk score for 100", () => {
      const risk = RiskScore(100);
      expect(risk).toBe(100);
    });

    it("creates valid risk score for middle value", () => {
      const risk = RiskScore(50);
      expect(risk).toBe(50);
    });

    it("throws for risk score below 0", () => {
      expect(() => RiskScore(-1)).toThrow();
    });

    it("throws for risk score above 100", () => {
      expect(() => RiskScore(101)).toThrow();
    });
  });

  describe("RSIValue", () => {
    it("creates valid RSI for 0", () => {
      const rsi = RSIValue(0);
      expect(rsi).toBe(0);
    });

    it("creates valid RSI for 100", () => {
      const rsi = RSIValue(100);
      expect(rsi).toBe(100);
    });

    it("creates valid RSI for typical values", () => {
      expect(RSIValue(30)).toBe(30);
      expect(RSIValue(50)).toBe(50);
      expect(RSIValue(70)).toBe(70);
    });

    it("throws for RSI below 0", () => {
      expect(() => RSIValue(-1)).toThrow();
    });

    it("throws for RSI above 100", () => {
      expect(() => RSIValue(101)).toThrow();
    });
  });

  describe("NormalizedATR", () => {
    it("creates valid normalized ATR for 0", () => {
      const atr = NormalizedATR(0);
      expect(atr).toBe(0);
    });

    it("creates valid normalized ATR for positive values", () => {
      const atr = NormalizedATR(5.5);
      expect(atr).toBe(5.5);
    });

    it("accepts high ATR values", () => {
      const atr = NormalizedATR(15);
      expect(atr).toBe(15);
    });

    it("throws for negative ATR", () => {
      expect(() => NormalizedATR(-1)).toThrow();
    });
  });

  describe("MarketCap", () => {
    it("creates valid market cap for 0", () => {
      const mcap = MarketCap(0);
      expect(mcap).toBe(0);
    });

    it("creates valid market cap for large numbers", () => {
      const mcap = MarketCap(1000000000000);
      expect(mcap).toBe(1000000000000);
    });

    it("throws for negative market cap", () => {
      expect(() => MarketCap(-1)).toThrow();
    });
  });

  describe("Volume", () => {
    it("creates valid volume for 0", () => {
      const vol = Volume(0);
      expect(vol).toBe(0);
    });

    it("creates valid volume for large numbers", () => {
      const vol = Volume(50000000000);
      expect(vol).toBe(50000000000);
    });

    it("throws for negative volume", () => {
      expect(() => Volume(-1)).toThrow();
    });
  });

  describe("safeBrand", () => {
    it("returns branded value for valid input", () => {
      const result = safeBrand(Confidence, 50);
      expect(result).toBe(50);
    });

    it("returns null for invalid input", () => {
      const result = safeBrand(Confidence, 150);
      expect(result).toBeNull();
    });

    it("returns null for negative price", () => {
      const result = safeBrand(Price, -100);
      expect(result).toBeNull();
    });

    it("returns branded value for valid price", () => {
      const result = safeBrand(Price, 50000);
      expect(result).toBe(50000);
    });

    it("returns null for invalid RSI", () => {
      const result = safeBrand(RSIValue, 150);
      expect(result).toBeNull();
    });

    it("returns branded value for valid RSI", () => {
      const result = safeBrand(RSIValue, 50);
      expect(result).toBe(50);
    });

    it("returns null for invalid risk score", () => {
      const result = safeBrand(RiskScore, -10);
      expect(result).toBeNull();
    });

    it("handles edge cases at boundaries", () => {
      expect(safeBrand(Confidence, 0)).toBe(0);
      expect(safeBrand(Confidence, 100)).toBe(100);
      expect(safeBrand(Confidence, -0.001)).toBeNull();
      expect(safeBrand(Confidence, 100.001)).toBeNull();
    });
  });
});
