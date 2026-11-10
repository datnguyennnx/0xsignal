/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import type { UserFill } from "@0xsignal/shared";

import { formatCompactUsd } from "../../../core/utils/formatters";
import { prepareFillRows } from "../lib/order-history-rows";

const fill = (overrides: Partial<UserFill> = {}): UserFill => ({
  coin: "BTC",
  side: "B",
  dir: "Open Long",
  sz: "2",
  px: "100",
  fee: "0.5",
  hash: "0xabc",
  oid: 1,
  tid: 1,
  time: 1_700_000_000_000,
  ...overrides,
});

describe("prepareFillRows", () => {
  test("an absent or empty page has no rows", () => {
    expect(prepareFillRows(undefined)).toEqual([]);
    expect(prepareFillRows([])).toEqual([]);
  });

  test("formats each fill once and keeps the page order", () => {
    const rows = prepareFillRows([fill(), fill({ coin: "ETH", hash: "0xdef" })]);

    expect(rows.map((row) => row.coin)).toEqual(["BTC", "ETH"]);
    expect(rows[0]?.value).toBe(formatCompactUsd(200));
    expect(rows[0]?.fee).toBe(formatCompactUsd(0.5));
    expect(rows[0]?.price).toBe("$100.00");
  });

  test("a blank closed PnL stays absent", () => {
    const [row] = prepareFillRows([fill({ closedPnl: "" })]);

    expect(row?.pnl).toBeNull();
    expect(row?.pnlText).toBe("—");
  });

  test("a real closed PnL is formatted and keeps its sign", () => {
    const [row] = prepareFillRows([fill({ closedPnl: "-12.5" })]);

    expect(row?.pnl).toBe(-12.5);
    expect(row?.pnlText).toBe(formatCompactUsd(-12.5));
  });

  test("a repeated hash and time still gets a unique row key", () => {
    const rows = prepareFillRows([fill(), fill()]);

    expect(rows[0]?.key).toBe("0xabc-1700000000000#1");
    expect(rows[1]?.key).toBe("0xabc-1700000000000#2");
  });
});
