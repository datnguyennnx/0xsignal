/**
 * @hyperliquid-api POST /exchange (price/size rules)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint
 */

import { describe, expect, test } from "bun:test";
import { asDecimal } from "./brands";
import { ValidationError } from "./errors";
import { isValidPrice, isValidSize, toWirePrice, toWireSize } from "./trade-rules";

const wireOutcome = (produce: () => unknown): string => {
  try {
    return String(produce());
  } catch (error) {
    if (error instanceof ValidationError) return "ValidationError";
    throw error;
  }
};

const expectedWire = (item: { readonly valid: boolean; readonly wire: string }): string =>
  item.valid ? item.wire : "ValidationError";

type PriceCase = {
  readonly name: string;
  readonly raw: string;
  readonly szDecimals: number;
  readonly kind: "perp" | "spot";
  readonly valid: boolean;
  readonly wire: string;
};

const PRICE_CASES: readonly PriceCase[] = [
  {
    name: "perp accepts one decimal place at szDecimals 5",
    raw: "1100.5",
    szDecimals: 5,
    kind: "perp",
    valid: true,
    wire: "1100.5",
  },
  {
    name: "perp rejects two decimal places at szDecimals 5",
    raw: "1100.55",
    szDecimals: 5,
    kind: "perp",
    valid: false,
    wire: "",
  },
  {
    name: "spot accepts three decimal places at szDecimals 5",
    raw: "10.555",
    szDecimals: 5,
    kind: "spot",
    valid: true,
    wire: "10.555",
  },
  {
    name: "spot rejects four decimal places at szDecimals 5",
    raw: "10.5555",
    szDecimals: 5,
    kind: "spot",
    valid: false,
    wire: "",
  },
  {
    name: "integer prices ignore the significant-figure cap",
    raw: "123456789",
    szDecimals: 5,
    kind: "perp",
    valid: true,
    wire: "123456789",
  },
  {
    name: "non-integer prices beyond five significant figures are rejected",
    raw: "12345.6",
    szDecimals: 5,
    kind: "perp",
    valid: false,
    wire: "",
  },
  {
    name: "five significant figures within the decimal limit are accepted",
    raw: "1234.5",
    szDecimals: 5,
    kind: "perp",
    valid: true,
    wire: "1234.5",
  },
  {
    name: "six significant figures are rejected on spot",
    raw: "111.555",
    szDecimals: 5,
    kind: "spot",
    valid: false,
    wire: "",
  },
  {
    name: "a trailing fractional zero is normalized away",
    raw: "1100.0",
    szDecimals: 5,
    kind: "perp",
    valid: true,
    wire: "1100",
  },
  {
    name: "negative zero normalizes to zero",
    raw: "-0",
    szDecimals: 5,
    kind: "perp",
    valid: true,
    wire: "0",
  },
  {
    name: "the previously signed two-decimal price now throws",
    raw: "100.55",
    szDecimals: 5,
    kind: "perp",
    valid: false,
    wire: "",
  },
];

describe("toWirePrice at szDecimals 5", () => {
  for (const c of PRICE_CASES) {
    test(c.name, () => {
      expect(isValidPrice(c.raw, c.szDecimals, c.kind)).toBe(c.valid);
      expect(wireOutcome(() => toWirePrice(asDecimal(c.raw), c.szDecimals, c.kind))).toBe(
        expectedWire(c),
      );
    });
  }
});

type SizeCase = {
  readonly name: string;
  readonly raw: string;
  readonly szDecimals: number;
  readonly valid: boolean;
  readonly wire: string;
};

const SIZE_CASES: readonly SizeCase[] = [
  {
    name: "accepts exactly szDecimals decimal places",
    raw: "0.12345",
    szDecimals: 5,
    valid: true,
    wire: "0.12345",
  },
  {
    name: "rejects one more decimal place than szDecimals",
    raw: "0.123456",
    szDecimals: 5,
    valid: false,
    wire: "",
  },
  {
    name: "integer sizes are allowed",
    raw: "42",
    szDecimals: 5,
    valid: true,
    wire: "42",
  },
  {
    name: "trailing zeros in a size are normalized",
    raw: "0.10000",
    szDecimals: 5,
    valid: true,
    wire: "0.1",
  },
  {
    name: "negative zero size normalizes to zero",
    raw: "-0",
    szDecimals: 5,
    valid: true,
    wire: "0",
  },
];

describe("toWireSize at szDecimals 5", () => {
  for (const c of SIZE_CASES) {
    test(c.name, () => {
      expect(isValidSize(c.raw, c.szDecimals)).toBe(c.valid);
      expect(wireOutcome(() => toWireSize(asDecimal(c.raw), c.szDecimals))).toBe(expectedWire(c));
    });
  }
});

describe("wire constructors", () => {
  test("a number that cannot round-trip throws", () => {
    expect(() => toWirePrice(0.1 + 0.2, 5, "perp")).toThrow(ValidationError);
    expect(() => toWireSize(0.1 + 0.2, 5)).toThrow(ValidationError);
  });

  test("toWirePrice and toWireSize normalize before branding", () => {
    expect(String(toWirePrice(asDecimal("0001.5000"), 5, "perp"))).toBe("1.5");
    expect(String(toWireSize(asDecimal("0001.5000"), 5))).toBe("1.5");
  });

  test("isValidPrice does not coerce a number", () => {
    expect(isValidPrice("0.1", 5, "perp")).toBe(true);
    expect(isValidPrice("100.55", 5, "perp")).toBe(false);
  });
});
