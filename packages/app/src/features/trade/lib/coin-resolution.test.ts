/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveCoinWithoutIndex } from "./coin-resolution";

describe("resolveCoinWithoutIndex", () => {
  test("main perp resolves without the index", () => {
    expect(resolveCoinWithoutIndex("BTC")).toEqual({ kind: "perp", coin: "BTC" });
  });

  test("builder perp keeps the dex-prefixed coin", () => {
    expect(resolveCoinWithoutIndex("xyz:TSLA")).toEqual({ kind: "perp", coin: "xyz:TSLA" });
  });

  test("spot needs the index to translate to the @N universe name", () => {
    expect(resolveCoinWithoutIndex("PURR/USDC")).toEqual({ kind: "needs-index" });
  });

  test("empty and whitespace need the index", () => {
    expect(resolveCoinWithoutIndex("")).toEqual({ kind: "needs-index" });
    expect(resolveCoinWithoutIndex("   ")).toEqual({ kind: "needs-index" });
  });
});

describe("resolveHlCoin perp fast path", () => {
  const source = readFileSync(join(import.meta.dir, "hl-market-stream.ts"), "utf8");
  const body = source.slice(source.indexOf("export async function resolveHlCoin"));

  test("consults the cached index before the loader", () => {
    expect(body).toContain("peekCoinIndex()");
  });

  test("the perp branch returns the normalized coin before awaiting the index", () => {
    const perpBranch = body.slice(
      body.indexOf('resolveCoinWithoutIndex(symbol).kind === "perp"'),
      body.indexOf("const resolved = await loadCoinIndex()"),
    );
    expect(perpBranch).toContain("return normalized;");
    expect(perpBranch).not.toContain("await loadCoinIndex()");
  });
});
