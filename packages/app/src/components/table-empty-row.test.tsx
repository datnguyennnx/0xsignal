/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { cleanup, renderDom, renderMarkup } from "../../test/render";

import { ErrorState } from "./error-state";
import { TableEmptyRow } from "./table-empty-row";

type TableEmptyRowInnerProps = {
  colSpan: number;
  status?: "loading" | "ready" | "empty" | "error";
  onRetry?: (() => void) | undefined;
  emptyTitle?: string;
  rows?: number;
};

type TableEmptyRowMountProps = {
  colSpan: number;
  status: "loading" | "ready" | "empty" | "error";
  onRetry?: (() => void) | undefined;
  emptyTitle: string;
  rows?: number;
};

function renderInner(props: TableEmptyRowInnerProps): ReactElement {
  const inner = (TableEmptyRow as unknown as { type: (p: TableEmptyRowInnerProps) => ReactElement })
    .type;
  return inner(props);
}

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement) => boolean,
): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate);
      if (found !== null) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (predicate(node)) return node;
  return findElement((node.props as { children?: ReactNode }).children, predicate);
}

const FLOOR_CLASS = "min-h-(--empty-min-h)";

const classTokens = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

const hasFloor = (element: Element): boolean => classTokens(element).includes(FLOOR_CLASS);

function floorCarriers(container: HTMLElement): Element[] {
  return [...container.querySelectorAll("*")].filter(hasFloor);
}

function mountEmptyRow(props: TableEmptyRowMountProps) {
  return renderDom(
    <table>
      <tbody>
        <TableEmptyRow {...props} />
      </tbody>
    </table>,
  );
}

describe("TableEmptyRow states", () => {
  afterEach(() => {
    cleanup();
  });

  test("the error state forwards its retry callback to the shared ErrorState", () => {
    let calls = 0;
    const tree = renderInner({
      colSpan: 3,
      status: "error",
      onRetry: () => {
        calls += 1;
      },
    });

    const errorState = findElement(tree, (element) => element.type === ErrorState);
    expect(errorState).not.toBeNull();
    if (errorState === null) throw new Error("expected the error state to render");

    const retry = (errorState.props as { retryAction?: () => void }).retryAction;
    expect(retry).toBeDefined();
    retry?.();
    expect(calls).toBe(1);
  });

  test("loading renders skeleton rows with a polite live region", () => {
    const html = renderMarkup(
      <TableEmptyRow colSpan={3} status="loading" rows={2} emptyTitle="Orders" />,
    );

    expect(html).toContain("<output");
    expect(html).not.toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-hidden="true"');
  });

  test("error renders the shared alert and retry affordance", () => {
    const html = renderMarkup(
      <TableEmptyRow colSpan={3} status="error" emptyTitle="Orders" onRetry={() => {}} />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Unable to load data");
    expect(html).toContain("Retry");
  });

  test("the empty state names the object instead of falling back to a generic label", () => {
    const html = renderMarkup(
      <TableEmptyRow colSpan={3} status="empty" emptyTitle="No open orders" />,
    );

    expect(html).toContain("No open orders");
    expect(html).not.toContain('role="alert"');
  });

  test("loading puts the shared floor on the single wrapper that holds the skeleton rows", () => {
    const view = mountEmptyRow({
      colSpan: 3,
      status: "loading",
      rows: 2,
      emptyTitle: "Orders",
    });

    const carriers = floorCarriers(view.container);
    expect(carriers.length).toBe(1);
    const wrapper = carriers[0];
    if (wrapper === undefined) throw new Error("expected the loading wrapper to carry the floor");

    expect(wrapper.querySelector('output[aria-live="polite"]')).not.toBeNull();
    expect(wrapper.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  test("empty keeps the shared floor on the state panel", () => {
    const view = mountEmptyRow({
      colSpan: 3,
      status: "empty",
      emptyTitle: "No open orders",
    });

    const carriers = floorCarriers(view.container);
    expect(carriers.length).toBe(1);
    const panel = carriers[0];
    if (panel === undefined) throw new Error("expected the empty state to carry the floor");

    expect(panel.textContent).toContain("No open orders");
    expect(classTokens(panel)).not.toContain("min-h-0");
  });

  test("error keeps the shared floor on the alert panel", () => {
    const view = mountEmptyRow({
      colSpan: 3,
      status: "error",
      emptyTitle: "Orders",
      onRetry: () => {},
    });

    const carriers = floorCarriers(view.container);
    expect(carriers.length).toBe(1);
    const panel = carriers[0];
    if (panel === undefined) throw new Error("expected the error state to carry the floor");

    expect(panel.closest('[role="alert"]')).not.toBeNull();
    expect(panel.textContent).toContain("Retry");
  });
});
