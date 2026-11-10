/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./trade-dropdown-panel.tsx", import.meta.url), "utf8");

describe("trade dropdown panel virtualization", () => {
  test("the panel computes its window with the pure helper", () => {
    expect(source).toContain("computeWindow");
  });

  test("it renders a slice, never the full list map", () => {
    expect(source).toContain("rows.slice(");
    expect(source).not.toContain("formattedTrades");
    expect(source).not.toMatch(/[^A-Za-z]rows\.map\(/);
  });

  test("the scroll listener is passive and rAF-coalesced", () => {
    expect(source).toContain("{ passive: true }");
    expect(source).toContain("requestAnimationFrame");
  });
});

describe("trade dropdown panel surface", () => {
  test("the root clips its children to the overlay radius", () => {
    expect(source).toContain("overflow-hidden");
    expect(source).toContain("max-h-[calc(100dvh-2rem)]");
    expect(source).toContain("flex-col");
  });

  test("the list is bounded by a 10-row height, never by the viewport", () => {
    const listStart = source.indexOf("ref={scrollRef}");
    const listTag = source.slice(listStart, source.indexOf(">", listStart));
    expect(listTag).not.toContain("dvh");
    expect(listTag).toContain("min-h-0 flex-auto");
    expect(listTag).toContain("style={{ maxHeight: PANEL_LIST_ROW_COUNT * rowHeight }}");
    expect(source).toContain("defaultRowHeightPx, PANEL_LIST_ROW_COUNT");
    expect(source).toContain("const ROW_HEIGHT = defaultRowHeightPx();");
    expect(source).toContain("useState(ROW_HEIGHT)");
    expect(listTag).toContain("overscroll-none");
    expect(source).not.toContain("max-h-[clamp(22rem,60dvh,34rem)]");
  });

  test("every chrome child of the column refuses to shrink", () => {
    expect(source).toContain('className="p-3 shrink-0"');
    expect(source).toContain(
      "flex shrink-0 items-center gap-1 rounded-control px-(--seg-inset) py-[calc(var(--seg-inset)_+_0.175rem)] -my-0.5 overflow-x-auto",
    );
    expect(source).toMatch(/<div className="shrink-0">\s*<MarketHeader/);
  });

  test("the scroll container's measured height feeds computeWindow", () => {
    expect(source).toContain("setViewportHeight(element.clientHeight)");
    expect(source).toContain("observer.observe(element)");
    expect(source).toContain("viewportHeight,");
  });

  test("the selected row's fill outranks hover and focus", () => {
    expect(source).toContain('data-active={isActive ? "true" : "false"}');
    expect(source).toContain("data-[active=false]:hover:bg-(--control-hover-bg)");
    expect(source).toContain("data-[active=false]:focus-visible:bg-(--control-hover-bg)");
    expect(source).not.toContain("hover:bg-(--control-hover-bg) focus-visible");
  });

  test("the search input is not focused on open", () => {
    expect(source).not.toContain("autoFocus");
    expect(source).toContain("tabIndex={-1}");
  });
});

describe("trade dropdown market tabs", () => {
  test("the strip inherits the control radius and seg inset plus focus slack", () => {
    expect(source).toContain('role="tablist"');
    expect(source).toContain("rounded-control px-(--seg-inset)");
    expect(source).toContain("py-[calc(var(--seg-inset)_+_0.175rem)] -my-0.5");
  });

  test("the trigger is concentric with the strip", () => {
    expect(source).toContain("rounded-[calc(var(--radius-control)-var(--seg-inset))]");
    expect(source).not.toContain("border-b-2");
    expect(source).not.toContain("-mb-px");
  });

  test("the active tab is a shape, not a color", () => {
    expect(source).toContain('data-active={isActive ? "" : undefined}');
    expect(source).toContain("aria-selected={isActive}");
    expect(source).toContain("bg-(--control-active-bg)");
    expect(source).toContain("shadow-[inset_0_0_0_1px_var(--border)]");
  });
});
