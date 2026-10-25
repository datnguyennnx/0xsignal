import { describe, expect, it } from "vitest";
import { Predicate } from "effect";
import { HyperliquidError } from "../errors";
import { toWhaleSourceError } from "../whale-source";

describe("whale source error mapping", () => {
  it("maps two distinct causes with the same wording to two distinct tags", () => {
    const rateLimited = toWhaleSourceError("position-poller")(
      new HyperliquidError({ message: "throttled", kind: "RATE_LIMITED" }),
    );
    const upstream = toWhaleSourceError("position-poller")(
      new HyperliquidError({ message: "throttled", kind: "UPSTREAM" }),
    );

    expect(Predicate.isTagged(rateLimited, "WhaleSourceRateLimitedError")).toBe(true);
    expect(Predicate.isTagged(upstream, "WhaleSourceUnavailableError")).toBe(true);
    expect(rateLimited.message).toBe(upstream.message);
  });
});
