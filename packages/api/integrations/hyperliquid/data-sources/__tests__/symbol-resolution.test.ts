import { describe, expect, it } from "vitest";
import { Option, Result } from "effect";
import { resolveInternalSymbol } from "../ticker-snapshot";
import type { TickerSnapshotError } from "../errors";
import type { TickerSnapshot } from "../types";

const failureOf = (result: Result.Result<string, TickerSnapshotError>): TickerSnapshotError =>
  Option.getOrThrow(
    Result.match(result, {
      onSuccess: () => Option.none<TickerSnapshotError>(),
      onFailure: (error) => Option.some(error),
    }),
  );

const snapshotOf = (
  universe: TickerSnapshot["universe"],
  extra: Pick<TickerSnapshot, "dexNames" | "spotPairs"> = {},
): TickerSnapshot => ({
  universe,
  assetCtxs: [],
  allMids: {},
  ...extra,
});

describe("resolveInternalSymbol across dexes", () => {
  it("keeps a main-dex hit even when a builder dex lists the same coin", () => {
    const snapshot = snapshotOf(
      [
        { name: "DOGE", dexIndex: 0 },
        { name: "xyz:DOGE", dexIndex: 1 },
      ],
      { dexNames: ["", "xyz"] },
    );

    expect(Result.getOrThrow(resolveInternalSymbol(snapshot, "DOGE"))).toBe("DOGE");
  });

  it("qualifies a unique builder-dex hit", () => {
    const snapshot = snapshotOf(
      [
        { name: "BTC", dexIndex: 0 },
        { name: "xyz:ONLY", dexIndex: 1 },
      ],
      { dexNames: ["", "xyz"] },
    );

    expect(Result.getOrThrow(resolveInternalSymbol(snapshot, "ONLY"))).toBe("xyz:ONLY");
  });

  it("qualifies a builder entry that arrives without its prefix", () => {
    const snapshot = snapshotOf(
      [
        { name: "BTC", dexIndex: 0 },
        { name: "ONLY", dexIndex: 1 },
      ],
      { dexNames: ["", "xyz"] },
    );

    expect(Result.getOrThrow(resolveInternalSymbol(snapshot, "ONLY"))).toBe("xyz:ONLY");
  });

  it("reports an ambiguity instead of guessing between builder dexes", () => {
    const snapshot = snapshotOf(
      [
        { name: "BTC", dexIndex: 0 },
        { name: "xyz:DOGE", dexIndex: 1 },
        { name: "abc:DOGE", dexIndex: 2 },
      ],
      { dexNames: ["", "xyz", "abc"] },
    );

    const error = failureOf(resolveInternalSymbol(snapshot, "DOGE"));

    expect(error).toMatchObject({
      _tag: "TickerSnapshotError",
      kind: "BAD_REQUEST",
      reason: "AMBIGUOUS",
    });
    expect(error.candidates).toEqual(["xyz:DOGE", "abc:DOGE"]);
    expect(error.message).toContain("xyz:DOGE");
    expect(error.message).toContain("abc:DOGE");
  });

  it("never reaches a k-prefixed contract from the bare name", () => {
    const snapshot = snapshotOf([{ name: "kDOGE", dexIndex: 0 }], { dexNames: [""] });

    const error = failureOf(resolveInternalSymbol(snapshot, "DOGE"));

    expect(error).toMatchObject({ kind: "NOT_FOUND", reason: "NOT_FOUND" });
    expect(error.message).not.toContain("kDOGE");
  });

  it("resolves a spot token to its owning pair's direct query name", () => {
    const snapshot = snapshotOf([{ name: "BTC", dexIndex: 0 }], {
      dexNames: [""],
      spotPairs: [{ token: "PURR", queryName: "PURR/USDC" }],
    });

    expect(Result.getOrThrow(resolveInternalSymbol(snapshot, "PURR"))).toBe("PURR/USDC");
  });

  it("resolves a non-canonical spot token to its @<index> query name", () => {
    const snapshot = snapshotOf([{ name: "BTC", dexIndex: 0 }], {
      dexNames: [""],
      spotPairs: [{ token: "HFUN", queryName: "@1" }],
    });

    expect(Result.getOrThrow(resolveInternalSymbol(snapshot, "HFUN"))).toBe("@1");
  });

  it("does not let a delisted main-dex entry mask a live builder-dex entry", () => {
    const snapshot = snapshotOf(
      [
        { name: "NEW", dexIndex: 0, isDelisted: true },
        { name: "xyz:NEW", dexIndex: 1 },
      ],
      { dexNames: ["", "xyz"] },
    );

    expect(Result.getOrThrow(resolveInternalSymbol(snapshot, "NEW"))).toBe("xyz:NEW");
  });

  it("names a delisted match as delisted rather than not found", () => {
    const snapshot = snapshotOf([{ name: "OLD", dexIndex: 0, isDelisted: true }], {
      dexNames: [""],
    });

    const error = failureOf(resolveInternalSymbol(snapshot, "OLD"));

    expect(error).toMatchObject({ kind: "NOT_FOUND", reason: "DELISTED", resolved: "OLD" });
    expect(error.message).toContain("delisted");
  });

  it("reports the forms tried and the dexes searched when nothing matches", () => {
    const snapshot = snapshotOf([{ name: "BTC", dexIndex: 0 }], {
      dexNames: ["", "xyz"],
    });

    const error = failureOf(resolveInternalSymbol(snapshot, "NOPE"));

    expect(error).toMatchObject({ kind: "NOT_FOUND", symbol: "NOPE" });
    expect(error.tried).toEqual(["NOPE", "NOPE/USDC", "xyz:NOPE"]);
    expect(error.dexes).toEqual(["main", "xyz"]);
    expect(error.message).toContain("Symbol not found: NOPE");
  });
});
