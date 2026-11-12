import { describe, expect, test } from "bun:test";
import { cast } from "@0xsignal/sdk-hyperliquid";
import type { PredictedFundingsInfoResponse } from "@0xsignal/sdk-hyperliquid/info";
import { toCountdown } from "../utils/format";
import { nextUtcHourMs, selectNextFundingTime } from "./use-funding-countdown";

const data = cast<PredictedFundingsInfoResponse>(
  [
    ["BTC", [["HlPerp", { fundingRate: "0.0000125", nextFundingTime: 1_700_000_000_000 }]]],
    [
      "xyz:TSLA",
      [
        ["HlPerp", null],
        ["BinPerp", { fundingRate: "0.0001", nextFundingTime: 1_700_000_360_000 }],
      ],
    ],
  ],
  "predictedFundings",
);

describe("formatCountdown", () => {
  test("clamps a target in the past to zero", () => {
    expect(toCountdown(-5_000)).toBe("00:00:00");
  });

  test("renders minutes and seconds", () => {
    expect(toCountdown(90_000)).toBe("00:01:30");
  });

  test("renders hours past the hour", () => {
    expect(toCountdown(3_661_000)).toBe("01:01:01");
  });
});

describe("nextUtcHourMs", () => {
  test("rounds a mid-hour instant up to the UTC boundary", () => {
    const now = Date.UTC(2026, 0, 1, 10, 30, 0);
    expect(nextUtcHourMs(now)).toBe(Date.UTC(2026, 0, 1, 11, 0, 0));
  });

  test("an exact boundary moves to the next hour", () => {
    const now = Date.UTC(2026, 0, 1, 11, 0, 0);
    expect(nextUtcHourMs(now)).toBe(Date.UTC(2026, 0, 1, 12, 0, 0));
  });
});

describe("selectNextFundingTime", () => {
  test("returns the coin's real funding epoch", () => {
    expect(selectNextFundingTime(data, "BTC")).toBe(1_700_000_000_000);
  });

  test("is case-insensitive and keeps the dex prefix", () => {
    expect(selectNextFundingTime(data, "XYZ:TSLA")).toBe(1_700_000_360_000);
  });

  test("returns null when the coin is absent", () => {
    expect(selectNextFundingTime(data, "ETH")).toBeNull();
  });
});
