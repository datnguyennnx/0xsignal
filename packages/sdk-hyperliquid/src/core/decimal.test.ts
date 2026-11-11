import { describe, expect, test } from "bun:test";
import { asDecimal } from "./brands";
import {
  addDecimal,
  compareDecimal,
  isTickAligned,
  mulDecimal,
  normalize,
  toWire,
} from "./decimal";

const d = asDecimal;

describe("decimal normalize", () => {
  test("trims trailing fractional zeros", () => {
    expect(normalize("1.50")).toBe("1.5");
  });

  test("drops a zero fractional part", () => {
    expect(normalize("1.0")).toBe("1");
  });

  test("normalizes negative zero to zero", () => {
    expect(normalize("-0")).toBe("0");
  });

  test("normalizes negative zero with a fractional part to zero", () => {
    expect(normalize("-0.0")).toBe("0");
  });

  test("strips leading integer zeros", () => {
    expect(normalize("0001.50")).toBe("1.5");
  });

  test("keeps a negative magnitude", () => {
    expect(normalize("-1.20")).toBe("-1.2");
  });
});

describe("decimal toWire", () => {
  test("keeps a value already within eight decimal places", () => {
    expect(toWire(d("1.5"))).toBe("1.5");
  });

  test("keeps the smallest eight-decimal tick", () => {
    expect(toWire(d("0.00000001"))).toBe("0.00000001");
  });

  test("accepts a ninth decimal zero by dropping it", () => {
    expect(toWire(d("1.234567890"))).toBe("1.23456789");
  });

  test("throws for a ninth nonzero decimal that would be lost", () => {
    expect(() => toWire(d("1.234567891"))).toThrow();
  });
});

describe("decimal compareDecimal", () => {
  test("treats differently padded equal values as equal", () => {
    expect(compareDecimal(d("1.5"), d("1.50"))).toBe(0);
  });

  test("orders a negative below a positive", () => {
    expect(compareDecimal(d("-1"), d("1"))).toBe(-1);
  });

  test("orders a larger integer above a smaller fractional one", () => {
    expect(compareDecimal(d("2"), d("1.9"))).toBe(1);
  });
});

describe("decimal addDecimal", () => {
  test("adds exact decimal strings", () => {
    expect(addDecimal(d("1.5"), d("2.25"))).toBe("3.75");
  });

  test("avoids binary floating point drift", () => {
    expect(addDecimal(d("0.1"), d("0.2"))).toBe("0.3");
  });

  test("cancels to zero", () => {
    expect(addDecimal(d("-1"), d("1"))).toBe("0");
  });
});

describe("decimal mulDecimal", () => {
  test("multiplies by an integer", () => {
    expect(mulDecimal(d("1.5"), d("2"))).toBe("3");
  });

  test("multiplies two fractional values exactly", () => {
    expect(mulDecimal(d("0.1"), d("0.2"))).toBe("0.02");
  });

  test("keeps the sign of a negative product", () => {
    expect(mulDecimal(d("-2.5"), d("4"))).toBe("-10");
  });
});

describe("decimal isTickAligned", () => {
  test("accepts an exact tick multiple", () => {
    expect(isTickAligned(d("100"), d("0.5"))).toBe(true);
  });

  test("rejects an off-tick price", () => {
    expect(isTickAligned(d("100.1"), d("0.5"))).toBe(false);
  });

  test("rejects a zero tick size", () => {
    expect(isTickAligned(d("100"), d("0"))).toBe(false);
  });

  test("accepts a quarter tick", () => {
    expect(isTickAligned(d("100.25"), d("0.25"))).toBe(true);
  });

  test("accepts a five-cent tick", () => {
    expect(isTickAligned(d("100.10"), d("0.05"))).toBe(true);
  });

  test("rejects a negative offset", () => {
    expect(isTickAligned(d("-100.1"), d("0.5"))).toBe(false);
  });
});
