/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import {
  computeOverlayPosition,
  PANEL_CHROME_REM,
  PANEL_CONTENT_HEIGHT_REM,
  PANEL_LIST_ROW_COUNT,
  PANEL_ROW_HEIGHT_REM,
  panelHeightBudget,
} from "./overlay-position";

const ROOT_FONT_SIZE = 16;
const VIEWPORT_EDGE = 1.25 * ROOT_FONT_SIZE;

describe("panel height budget", () => {
  test("a tall viewport spends the whole chrome-plus-list budget", () => {
    expect(panelHeightBudget(1200, ROOT_FONT_SIZE)).toBe(PANEL_CONTENT_HEIGHT_REM * ROOT_FONT_SIZE);
  });

  test("a short viewport clips it to the root's 100dvh-2rem cap", () => {
    expect(panelHeightBudget(300, ROOT_FONT_SIZE)).toBe(300 - 2 * ROOT_FONT_SIZE);
  });

  test("the budget tracks the panel's chrome plus ten measured rows", () => {
    const composition =
      PANEL_CHROME_REM * ROOT_FONT_SIZE +
      PANEL_LIST_ROW_COUNT * PANEL_ROW_HEIGHT_REM * ROOT_FONT_SIZE;
    expect(Math.abs(panelHeightBudget(1200, ROOT_FONT_SIZE) - composition)).toBeLessThanOrEqual(24);
  });
});

describe("overlay position", () => {
  test("a panel that fits below the trigger stays below it", () => {
    const viewport = { width: 1200, height: 1400 };
    const { top } = computeOverlayPosition(
      { top: 100, bottom: 140, left: 200 },
      viewport,
      ROOT_FONT_SIZE,
    );

    expect(top).toBe(140 + 0.5 * ROOT_FONT_SIZE);
  });

  test("a viewport that fits the real panel below the trigger never flips", () => {
    const viewport = { width: 1200, height: 700 };
    const { top } = computeOverlayPosition(
      { top: 100, bottom: 140, left: 200 },
      viewport,
      ROOT_FONT_SIZE,
    );

    expect(top).toBe(140 + 0.5 * ROOT_FONT_SIZE);
  });

  test("a short viewport flips the panel above the trigger and clamps it", () => {
    const viewport = { width: 1200, height: 400 };
    const trigger = { top: 300, bottom: 340, left: 200 };
    const { top } = computeOverlayPosition(trigger, viewport, ROOT_FONT_SIZE);

    expect(top).toBe(VIEWPORT_EDGE);
    expect(top).toBeLessThan(trigger.top);
    expect(top + panelHeightBudget(viewport.height, ROOT_FONT_SIZE)).toBeLessThanOrEqual(
      viewport.height,
    );
  });

  test("a flipped panel still ends inside the viewport", () => {
    const viewport = { width: 1200, height: 800 };
    const { top } = computeOverlayPosition(
      { top: 700, bottom: 740, left: 200 },
      viewport,
      ROOT_FONT_SIZE,
    );

    expect(top + panelHeightBudget(viewport.height, ROOT_FONT_SIZE)).toBeLessThanOrEqual(
      viewport.height - VIEWPORT_EDGE,
    );
  });

  test("the left edge is clamped on a narrow viewport", () => {
    const { left } = computeOverlayPosition(
      { top: 100, bottom: 140, left: 200 },
      { width: 500, height: 900 },
      ROOT_FONT_SIZE,
    );

    expect(left).toBe(0.5 * ROOT_FONT_SIZE);
  });
});
