/// <reference types="bun-types" />
/**
 * Source-level motion contract.
 *
 * Enter/exit durations live in Tailwind class strings, so there is no DOM
 * behaviour to assert without a browser. These checks pin the perception-driven
 * numbers so a refactor cannot silently fall back to the 100ms default.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const DIALOG_SOURCE = source("./ui/dialog.tsx");
const DROPDOWN_SOURCE = source("./ui/dropdown-menu.tsx");
const TOOLTIP_SOURCE = source("./ui/tooltip.tsx");
const SKELETON_SOURCE = source("./ui/skeleton.tsx");
const SIDE_PANEL_SOURCE = source("./side-panel.tsx");
const UTILITIES_SOURCE = source("../styles/utilities.css");
const TOKENS_SOURCE = source("../styles/tokens.scale.css");
const ROUTE_FALLBACK_SOURCE = source("./route-fallback-logic.ts");

describe("motion durations", () => {
  test("dialog enters in 240ms and exits in 160ms", () => {
    expect(DIALOG_SOURCE).toContain("data-open:duration-[240ms]");
    expect(DIALOG_SOURCE).toContain("data-closed:duration-[160ms]");
  });

  test("dropdown enters in 200ms and exits in 140ms", () => {
    expect(DROPDOWN_SOURCE).toContain("data-open:duration-[200ms]");
    expect(DROPDOWN_SOURCE).toContain("data-closed:duration-[140ms]");
  });

  test("tooltip enters in 150ms and exits in 100ms", () => {
    expect(TOOLTIP_SOURCE).toContain("data-open:duration-[150ms]");
    expect(TOOLTIP_SOURCE).toContain("data-closed:duration-[100ms]");
  });

  test("side panel slides open and closed in 200ms", () => {
    expect(SIDE_PANEL_SOURCE).toContain("duration-[200ms]");
  });
});

describe("loading perception", () => {
  test("the route skeleton waits 280ms before revealing", () => {
    expect(ROUTE_FALLBACK_SOURCE).toContain("ROUTE_FALLBACK_DELAY_MS = 280");
  });

  test("skeleton pulse stops under reduced motion and fades in 200ms", () => {
    expect(SKELETON_SOURCE).toContain("animate-pulse");
    expect(SKELETON_SOURCE).toContain("motion-reduce:animate-none");
    expect(SKELETON_SOURCE).toContain("content-fade");
    expect(TOKENS_SOURCE).toContain("--dur-fade: 200ms");
    expect(UTILITIES_SOURCE).toContain("transition: opacity var(--dur-fade) var(--ease-out)");
  });
});

describe("screen-switch enter beat", () => {
  test("starts at 0.9 opacity and 6px, not a blank frame", () => {
    const keyframes = UTILITIES_SOURCE.slice(UTILITIES_SOURCE.indexOf("@keyframes content-enter"));
    expect(keyframes).toContain("opacity: 0.9;");
    expect(keyframes).toContain("transform: translateY(6px);");
  });

  test("runs in 180ms with the route curve and both fill", () => {
    expect(TOKENS_SOURCE).toContain("--dur-route: 180ms");
    expect(UTILITIES_SOURCE).toContain(
      "animation: content-enter var(--dur-route) cubic-bezier(0.2, 0, 0, 1) both;",
    );
  });

  test("reduced motion disables the animation entirely", () => {
    const reduced = UTILITIES_SOURCE.slice(
      UTILITIES_SOURCE.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reduced).toContain(".content-enter {");
    expect(reduced).toContain("animation: none;");
    expect(UTILITIES_SOURCE).not.toContain("content-enter-fade");
  });
});
