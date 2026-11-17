/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test";

import { cleanup, renderDom } from "../../../../test/render";

import { InterfaceSettings } from "./interface-settings";

// The glass control reads "Preset" after the sliders merge (interface-settings.tsx
// SegmentedRow label) — not the SettingGroup title "Glass". Don't relabel it back.
const ROW_LABELS = [
  "Preset",
  "Ambient glow",
  "Density",
  "Text size",
  "Corners",
  "Market colors",
] as const;

const SLIDER_LABELS = [
  "Transparency",
  "Blur",
  "Edge definition",
  "Saturation",
  "Brightness",
  "Ambient intensity",
  "Noise",
] as const;

const SLIDER_NAMES: ReadonlySet<string> = new Set(SLIDER_LABELS);

const SHARED_GRID = "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]";
const AUTO_GRID = "md:grid-cols-[minmax(0,1fr)_auto]";

const classTokens = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

const hasToken = (element: Element, token: string): boolean => classTokens(element).includes(token);

function valueChipIn(cell: Element): Element {
  const chip = Array.from(cell.querySelectorAll("*")).find(
    (element) =>
      hasToken(element, "tabular-nums") &&
      hasToken(element, "rounded-chip") &&
      hasToken(element, "shrink-0"),
  );
  if (chip === undefined) throw new Error("slider cell has no value chip");
  return chip;
}

function labelCellIn(row: Element, controlCell: Element): Element {
  const cell = Array.from(row.children).find(
    (child) =>
      child !== controlCell &&
      hasToken(child, "flex-col") &&
      hasToken(child, "min-w-0") &&
      !hasToken(child, "items-center"),
  );
  if (cell === undefined) throw new Error("slider row has no label cell");
  return cell;
}

function mountInterface() {
  const view = renderDom(<InterfaceSettings />);

  const rowFor = (label: string) => {
    const control = view.getByRole("radiogroup", { name: label });
    const row = control.closest('[class*="md:grid-cols-"]');
    if (row === null) throw new Error(`row for "${label}" has no grid template`);
    if (control.parentElement === null) throw new Error(`control for "${label}" has no cell`);
    return { control, cell: control.parentElement, row };
  };

  // The slider's accessible name lives on the Base UI group; the range input
  // nested in the thumb is visually hidden and exposes no slider role.
  const sliderFor = (label: string) => {
    const control = view.getByRole("group", { name: label });
    const slider = control.querySelector('input[type="range"]');
    if (!(slider instanceof HTMLInputElement)) {
      throw new Error(`slider for "${label}" has no range input`);
    }
    const cell = control.parentElement;
    if (cell === null) throw new Error(`slider for "${label}" has no cell`);
    const row = control.closest('[class*="md:grid-cols-"]');
    if (row === null) throw new Error(`row for "${label}" has no grid template`);
    return { control, slider, cell, row };
  };

  return { ...view, rowFor, sliderFor };
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

describe("interface slider rows", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the seven advanced knobs as labelled sliders", () => {
    const view = mountInterface();

    const groups = view.getAllByRole("group", { name: (name: string) => SLIDER_NAMES.has(name) });
    expect(groups).toHaveLength(SLIDER_LABELS.length);
    for (const label of SLIDER_LABELS) {
      const control = view.getByRole("group", { name: label });
      expect(control.querySelector('input[type="range"]')).not.toBeNull();
    }
  });

  test("every slider row uses the shared 2fr/3fr grid template", () => {
    const view = mountInterface();

    for (const label of SLIDER_LABELS) {
      const { row } = view.sliderFor(label);
      expect(hasToken(row, SHARED_GRID)).toBe(true);
      expect(hasToken(row, AUTO_GRID)).toBe(false);
    }
  });

  test("every slider shrinks beside its chip inside a centred cell", () => {
    const view = mountInterface();

    for (const label of SLIDER_LABELS) {
      const { control, cell } = view.sliderFor(label);
      expect(hasToken(control, "min-w-0")).toBe(true);
      expect(hasToken(control, "flex-1")).toBe(true);
      expect(hasToken(cell, "items-center")).toBe(true);
    }
  });

  test("every slider row keeps its value chip in the control cell, never the label cell", () => {
    const view = mountInterface();

    for (const label of SLIDER_LABELS) {
      const { cell, row, slider } = view.sliderFor(label);
      const chip = valueChipIn(cell);

      expect(cell.contains(slider)).toBe(true);
      expect(cell.contains(chip)).toBe(true);

      const labelCell = labelCellIn(row, cell);
      expect(labelCell.contains(chip)).toBe(false);
      expect(labelCell.querySelectorAll("input").length).toBe(0);
    }
  });
});
