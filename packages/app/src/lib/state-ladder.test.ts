/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { SELECTED_CARD_CLASS, SELECTED_ITEM_CLASS } from "./state-classes";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const pagination = source("../components/ui/pagination.tsx");
const toggle = source("../components/ui/toggle.tsx");
const marginMode = source("../features/trade/components/margin-mode-options.tsx");
const orderbook = source("../features/trade/components/orderbook-depth.tsx");
const dropdownMenu = source("../components/ui/dropdown-menu.tsx");
const table = source("../components/ui/table.tsx");

const highlightedFills = (text: string) => text.match(/data-\[highlighted\]:bg-/g) ?? [];

describe("selected state classes", () => {
  test("the selected item is a fill, not the accent surface", () => {
    expect(SELECTED_ITEM_CLASS).toContain("bg-(--control-active-bg)");
    expect(SELECTED_ITEM_CLASS).not.toContain("bg-accent");
    expect(SELECTED_ITEM_CLASS).toContain("shadow-[inset_0_0_0_1px_var(--border)]");
  });

  test("the selected card is a fill with a neutral rim, never the loud accent border", () => {
    expect(SELECTED_CARD_CLASS).not.toContain("option-card-active-border");
    expect(SELECTED_CARD_CLASS).toContain("bg-(--option-card-active-bg)");
    expect(SELECTED_CARD_CLASS).toContain("shadow-[inset_0_0_0_1px_var(--border)]");
  });
});

describe("pagination", () => {
  test("selected and hover are distinct ladder steps", () => {
    expect(pagination).toContain("hover:bg-(--control-hover-bg)");
    expect(pagination).not.toContain("hover:bg-accent");
    expect(pagination).toContain("SELECTED_ITEM_CLASS");
  });

  test("the selected page keeps its accent fill on hover", () => {
    expect(pagination).toContain("hover:bg-(--control-active-bg)");
    expect(pagination).toMatch(
      /currentPage === value\s*\?\s*cn\(SELECTED_ITEM_CLASS,\s*"hover:bg-\(--control-active-bg\)/,
    );
  });
});

describe("toggle", () => {
  test("pressed gains a fill stronger than hover", () => {
    expect(toggle).toContain("aria-pressed:bg-(--control-active-bg)");
    expect(toggle).toContain("aria-pressed:text-foreground");
    expect(toggle).toContain("hover:bg-(--control-hover-bg)");
  });
});

describe("margin mode cards", () => {
  test("hover is a plain control fill with no accent border", () => {
    expect(marginMode).not.toContain("hover:border-(--option-card-active-border)");
    expect(marginMode).not.toContain("hover:border-");
    expect(marginMode).toContain("hover:bg-(--control-hover-bg)");
  });
});

describe("orderbook rows", () => {
  test("row fills stay on the alpha ladder instead of the raw muted surface", () => {
    expect(orderbook).not.toContain("bg-muted/");
    expect(orderbook).toContain("hover:bg-(--control-hover-bg)");
    expect(orderbook).toContain("color-mix(in_oklch,var(--control-hover-bg)");
  });
});

describe("dropdown menu", () => {
  test("highlight is the single state declaration", () => {
    expect(dropdownMenu).not.toContain("hover:bg-(--control-hover-bg)");
    expect(dropdownMenu).not.toContain("focus:bg-(--control-hover-bg)");
    expect(highlightedFills(dropdownMenu).length).toBeGreaterThanOrEqual(2);
  });
});

describe("table rows", () => {
  test("the row owns the only hover fill", () => {
    expect(table).toContain("hover:bg-(--control-hover-bg)");
  });
});
