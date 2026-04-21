import { describe, expect, it } from "vitest";
import { DomainError, validationError } from "../../errors";
import { mapMarketInfraError } from "../error-mapping";

describe("mapMarketInfraError", () => {
  it("passes through DomainError unchanged", () => {
    const original = validationError("already domain");
    expect(mapMarketInfraError("fallback")(original)).toBe(original);
  });

  it("maps provider-shaped error objects (kind + message) to domain errors", () => {
    const map = mapMarketInfraError("fallback");
    expect(map({ message: "bad", kind: "BAD_REQUEST" })).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "bad",
    });
    expect(map({ message: "missing", kind: "NOT_FOUND" })).toMatchObject({
      code: "NOT_FOUND",
      message: "missing",
    });
    expect(map({ message: "upstream", kind: "UPSTREAM" })).toMatchObject({
      code: "INTERNAL_ERROR",
      message: "upstream",
    });
  });

  it("uses message string from arbitrary object shapes when present", () => {
    const map = mapMarketInfraError("fallback");
    expect(map({ message: "custom" })).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "custom",
    });
  });

  it("falls back to fallbackMessage for primitives", () => {
    const map = mapMarketInfraError("fallback");
    expect(map("oops")).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "fallback",
    });
  });

  it("treats DomainError instance check before object branch", () => {
    const de = new DomainError("NOT_FOUND", "nope");
    expect(mapMarketInfraError("x")(de)).toBe(de);
  });
});
