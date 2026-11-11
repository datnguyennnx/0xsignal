/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./asset-content.tsx", import.meta.url), "utf8");
const headerSource = readFileSync(new URL("./market-terminal-header.tsx", import.meta.url), "utf8");
const countdownHookSource = readFileSync(
  new URL("../hooks/use-funding-countdown.ts", import.meta.url),
  "utf8",
);

describe("trading header offset publishing", () => {
  test("writes --trading-header-offset only when the value actually changed", () => {
    const guard = source.indexOf('region.style.getPropertyValue("--trading-header-offset")');
    const write = source.indexOf('region.style.setProperty("--trading-header-offset"');

    expect(guard).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(guard);
    expect(source).toContain("=== next) return;");
  });

  test("the resize observer is still disconnected on unmount", () => {
    expect(source).toContain("observer.disconnect()");
  });
});

describe("funding countdown isolation", () => {
  test("the tick lives in the countdown hook, not the header", () => {
    expect(countdownHookSource).toContain("setInterval");
    expect(countdownHookSource).toContain("clearInterval");

    const headerBody = source.slice(
      source.indexOf("const LiveMarketHeader = memo("),
      source.indexOf("const TradingGrid = memo("),
    );

    expect(headerBody).not.toContain("setInterval");
    expect(headerBody).not.toContain("setCountdown");
  });

  test("the leaf renders the hook value and is declared before the header", () => {
    const leaf = source.indexOf("const FundingCountdown = memo(");
    const header = source.indexOf("const LiveMarketHeader = memo(");

    expect(leaf).toBeGreaterThan(-1);
    expect(header).toBeGreaterThan(leaf);
    expect(source.slice(leaf, header)).toContain("useFundingCountdown(");
  });

  test("the perp header receives the countdown element, never a plain string", () => {
    expect(source).toContain("<FundingCountdown nextFundingMs={nextFundingMs} />");
    expect(source).not.toContain("fundingCountdown={fundingCountdown}");
  });

  test("the header prop accepts a node so a string still passes through inline", () => {
    expect(headerSource).toContain("fundingCountdown: ReactNode;");
    expect(headerSource).not.toContain("fundingCountdown: string;");
    expect(headerSource).toContain("{fundingCountdown}");
  });
});
