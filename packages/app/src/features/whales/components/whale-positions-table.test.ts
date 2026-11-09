/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test";

import { position } from "../../../test/fixtures";
import {
  MAX_WHALE_POSITION_PAGES,
  WHALE_POSITIONS_REFETCH_INTERVAL,
  dedupeWhalePositions,
  whalePositionsQueryOptions,
  whalePositionsRefetchInterval,
} from "../hooks/use-whale-positions";
import { formatCompactUsd, formatPrice } from "../../../core/utils/formatters";
import {
  ENTRY_TIME_FORMATTER,
  areWhaleRowPropsEqual,
  formatEntryTime,
  formatWhalePrice,
} from "./whale-positions-table-format";

const noop = (): void => {};

type RowProps = Parameters<typeof areWhaleRowPropsEqual>[0];

const rowProps = (overrides: Partial<RowProps> = {}): RowProps => ({
  position: position(),
  index: 0,
  onSelectWallet: noop,
  onOpenCoin: noop,
  ...overrides,
});

describe("areWhaleRowPropsEqual", () => {
  test("keeps a row when every printed scalar matches across fresh objects", () => {
    const prev = rowProps();
    const next = rowProps();

    expect(prev.position).not.toBe(next.position);
    expect(areWhaleRowPropsEqual(prev, next)).toBe(true);
  });

  test("re-renders when a printed scalar changes", () => {
    const prev = rowProps();
    const changed = rowProps({
      position: position({ unrealizedPnl: 12.5 }),
    });

    expect(areWhaleRowPropsEqual(prev, changed)).toBe(false);
  });

  test("re-renders when the printed identity fields or rank change", () => {
    const prev = rowProps();

    expect(
      areWhaleRowPropsEqual(prev, rowProps({ position: position({ userAddress: "0xabc" }) })),
    ).toBe(false);
    expect(areWhaleRowPropsEqual(prev, rowProps({ position: position({ coin: "SOL" }) }))).toBe(
      false,
    );
    expect(areWhaleRowPropsEqual(prev, rowProps({ index: 1 }))).toBe(false);
  });

  test("re-renders when a row callback changes identity", () => {
    const prev = rowProps();

    expect(areWhaleRowPropsEqual(prev, rowProps({ onSelectWallet: () => {} }))).toBe(false);
    expect(areWhaleRowPropsEqual(prev, rowProps({ onOpenCoin: () => {} }))).toBe(false);
  });
});

describe("module-level whale formatters", () => {
  const price = (value: number): string =>
    value >= 1000
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value)
      : value >= 1
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          }).format(value)
        : new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 4,
            maximumFractionDigits: 5,
          }).format(value);

  test("price output is byte-identical to the shared formatter", () => {
    for (const value of [0.000123, 0.5, 1, 1.23456, 999.99, 1000, 62000, Number.NaN]) {
      expect(formatWhalePrice(value)).toBe(formatPrice(value));
      expect(formatWhalePrice(value)).toBe(price(value));
    }
  });

  test("entry time reuses the module-level DateTimeFormat", () => {
    const iso = "2024-06-01T12:34:56.000Z";
    const date = new Date(iso);
    const legacy = date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    expect(formatEntryTime(iso)).toBe(legacy);
    expect(formatEntryTime(iso)).toBe(ENTRY_TIME_FORMATTER.format(date));
    expect(formatEntryTime("not-a-date")).toBe("—");
  });

  test("compact USD output is unchanged for representative magnitudes", () => {
    const compact = (value: number): string =>
      Math.abs(value) < 10_000
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(value)
        : new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            notation: "compact",
            maximumFractionDigits: 2,
          }).format(value);

    for (const value of [0, 1_000, 9_999, 10_000, 12_345, 1_500_000, -12_345]) {
      expect(formatCompactUsd(value)).toBe(compact(value));
    }
  });
});

describe("whale positions query options", () => {
  test("caps the retained page count", () => {
    expect(MAX_WHALE_POSITION_PAGES).toBe(10);
    expect(whalePositionsQueryOptions().maxPages).toBe(MAX_WHALE_POSITION_PAGES);
  });
});

describe("whalePositionsRefetchInterval", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "document");
  });

  const setVisibility = (visibilityState: DocumentVisibilityState): void => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { visibilityState },
    });
  };

  test("stops polling while the tab is hidden", () => {
    setVisibility("hidden");

    expect(whalePositionsRefetchInterval()).toBe(false);
  });

  test("keeps the interval while the tab is visible", () => {
    setVisibility("visible");

    expect(whalePositionsRefetchInterval()).toBe(WHALE_POSITIONS_REFETCH_INTERVAL);
  });

  test("polls while only the first page is mounted", () => {
    setVisibility("visible");

    expect(whalePositionsRefetchInterval({ state: { data: { pages: [{}] } } })).toBe(
      WHALE_POSITIONS_REFETCH_INTERVAL,
    );
  });

  test("stops polling once more than one page is mounted", () => {
    setVisibility("visible");

    expect(whalePositionsRefetchInterval({ state: { data: { pages: [{}, {}] } } })).toBe(false);
    expect(whalePositionsRefetchInterval({ state: { data: { pages: [{}, {}, {}] } } })).toBe(false);
  });

  test("treats missing data as the single-page case", () => {
    setVisibility("visible");

    expect(whalePositionsRefetchInterval({ state: {} })).toBe(WHALE_POSITIONS_REFETCH_INTERVAL);
    expect(whalePositionsRefetchInterval({ state: { data: {} } })).toBe(
      WHALE_POSITIONS_REFETCH_INTERVAL,
    );
  });
});

describe("dedupeWhalePositions", () => {
  test("returns an empty list for missing pages", () => {
    expect(dedupeWhalePositions(undefined)).toEqual([]);
  });

  test("flattens pages in order", () => {
    const first = position({ coin: "ETH" });
    const second = position({ coin: "BTC", userAddress: `0x${"b".repeat(40)}` });

    expect(
      dedupeWhalePositions([{ positions: [first] }, { positions: [second] }]).map(
        (row) => row.coin,
      ),
    ).toEqual(["ETH", "BTC"]);
  });

  test("keeps the first row when adjacent pages overlap", () => {
    const original = position({ unrealizedPnl: 1 });
    const duplicate = position({ unrealizedPnl: 99 });

    const rows = dedupeWhalePositions([
      { positions: [original] },
      { positions: [duplicate] },
      { positions: [position({ entryTime: "2026-02-01T00:00:00.000Z" })] },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(original);
    expect(rows[1]?.entryTime).toBe("2026-02-01T00:00:00.000Z");
  });

  test("keeps positions that differ only by a key field", () => {
    const rows = dedupeWhalePositions([
      {
        positions: [
          position(),
          position({ coin: "BTC" }),
          position({ userAddress: `0x${"c".repeat(40)}` }),
          position({ entryTime: "2026-01-02T00:00:00.000Z" }),
        ],
      },
    ]);

    expect(rows).toHaveLength(4);
  });
});
