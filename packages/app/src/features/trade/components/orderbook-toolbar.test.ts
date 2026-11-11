/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { TickSizeOption } from "../hooks/use-hyperliquid-orderbook";
import { areOrderbookToolbarPropsEqual } from "./orderbook-toolbar-logic";

const noop = (): void => {};

const scalingOptions: TickSizeOption[] = [
  { value: 5, label: "0.001", nSigFigs: 5, mantissa: null },
  { value: 0, label: "Raw", nSigFigs: null, mantissa: null },
];

type ToolbarProps = Parameters<typeof areOrderbookToolbarPropsEqual>[0];

const props = (overrides: Partial<ToolbarProps> = {}): ToolbarProps => ({
  symbol: "BTC",
  pairFocus: "base",
  onPairFocusChange: noop,
  currentNSigFigs: 5,
  onNSigFigsChange: noop,
  scalingOptions,
  ...overrides,
});

describe("areOrderbookToolbarPropsEqual", () => {
  test("keeps the toolbar when every rendered prop is unchanged", () => {
    expect(areOrderbookToolbarPropsEqual(props(), props())).toBe(true);
  });

  test("re-renders when the symbol changes", () => {
    expect(areOrderbookToolbarPropsEqual(props(), props({ symbol: "ETH" }))).toBe(false);
  });

  test("re-renders when the scaling options change", () => {
    expect(
      areOrderbookToolbarPropsEqual(
        props(),
        props({ scalingOptions: [{ value: 0, label: "Raw", nSigFigs: null, mantissa: null }] }),
      ),
    ).toBe(false);
  });

  test("re-renders when the sig-figs handler changes", () => {
    expect(areOrderbookToolbarPropsEqual(props(), props({ onNSigFigsChange: () => {} }))).toBe(
      false,
    );
  });

  test("re-renders when the focus state or its handler changes", () => {
    expect(areOrderbookToolbarPropsEqual(props(), props({ pairFocus: "quote" }))).toBe(false);
    expect(areOrderbookToolbarPropsEqual(props(), props({ onPairFocusChange: () => {} }))).toBe(
      false,
    );
  });

  test("re-renders when the selected precision changes", () => {
    expect(areOrderbookToolbarPropsEqual(props(), props({ currentNSigFigs: 3 }))).toBe(false);
  });

  test("re-renders when the precision select visibility changes", () => {
    expect(
      areOrderbookToolbarPropsEqual(
        props({ showPrecision: true }),
        props({ showPrecision: false }),
      ),
    ).toBe(false);
  });
});
