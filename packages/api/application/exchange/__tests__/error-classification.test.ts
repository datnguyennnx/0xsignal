import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { toHlTif } from "../error-classification";
import { HyperliquidValidationError } from "../../../domain/errors";

describe("toHlTif", () => {
  it.each([
    ["GTC", "Gtc"],
    ["IOC", "Ioc"],
    ["ALO", "Alo"],
    ["Alo", "Alo"],
    ["PostOnly", "Alo"],
    ["FrontendMarket", "FrontendMarket"],
    ["Market", "FrontendMarket"],
  ])("maps %s to %s", async (input, expected) => {
    const mapped = await Effect.runPromise(toHlTif(input));
    expect(mapped).toBe(expected);
  });

  it("rejects FOK instead of downgrading it to a resting Gtc order", async () => {
    const result = await Effect.runPromise(toHlTif("FOK").pipe(Effect.flip));

    expect(result).toBeInstanceOf(HyperliquidValidationError);
    expect(result).toHaveProperty("_tag", "HyperliquidValidationError");
    expect(result).toHaveProperty("input", "FOK");
  });

  it("rejects unknown time-in-force values", async () => {
    const result = await Effect.runPromise(toHlTif("gtc").pipe(Effect.flip));

    expect(result).toBeInstanceOf(HyperliquidValidationError);
    expect(result).toHaveProperty("input", "gtc");
  });
});
