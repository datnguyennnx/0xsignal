/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test";

import { cleanup, renderDom } from "../../../../test/render";

import { InterfaceSettings } from "./interface-settings";

const ROW_LABELS = [
  "Glass",
  "Ambient glow",
  "Density",
  "Text size",
  "Corners",
  "Market colors",
] as const;

const SHARED_GRID = "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]";
const AUTO_GRID = "md:grid-cols-[minmax(0,1fr)_auto]";

const classTokens = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

const hasToken = (element: Element, token: string): boolean => classTokens(element).includes(token);

function mountInterface() {
  const view = renderDom(<InterfaceSettings />);

  const rowFor = (label: string) => {
    const control = view.getByRole("radiogroup", { name: label });
    const row = control.closest('[class*="md:grid-cols-"]');
    if (row === null) throw new Error(`row for "${label}" has no grid template`);
    if (control.parentElement === null) throw new Error(`control for "${label}" has no cell`);
    return { control, cell: control.parentElement, row };
  };

  return { ...view, rowFor };
}

describe("interface settings rows", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the six interface rows as labelled segmented controls", () => {
    const view = mountInterface();

    expect(view.getAllByRole("radiogroup")).toHaveLength(ROW_LABELS.length);
    for (const label of ROW_LABELS) {
      expect(view.getByRole("radiogroup", { name: label })).toBeDefined();
    }
  });

  test("every row splits label and control with the shared 2fr/3fr grid template", () => {
    const view = mountInterface();

    for (const label of ROW_LABELS) {
      const { row } = view.rowFor(label);
      expect(hasToken(row, SHARED_GRID)).toBe(true);
      expect(hasToken(row, AUTO_GRID)).toBe(false);
    }
  });

  test("every segmented control fills its column instead of tracking content width", () => {
    const view = mountInterface();

    for (const label of ROW_LABELS) {
      const { control, cell } = view.rowFor(label);
      expect(hasToken(control, "w-full")).toBe(true);
      expect(hasToken(control, "w-fit")).toBe(false);
      expect(hasToken(cell, "md:justify-end")).toBe(false);
    }
  });

  test("the control cell keeps its full-width, shrinkable box", () => {
    const view = mountInterface();

    for (const label of ROW_LABELS) {
      const { cell } = view.rowFor(label);
      expect(hasToken(cell, "w-full")).toBe(true);
      expect(hasToken(cell, "min-w-0")).toBe(true);
      expect(hasToken(cell, "md:w-auto")).toBe(false);
    }
  });
});
