/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderMarkup } from "../../test/render";

import { ErrorState } from "./error-state";
import { TableEmptyRow } from "./table-empty-row";

type TableEmptyRowInnerProps = {
  colSpan: number;
  status?: "loading" | "ready" | "empty" | "error";
  onRetry?: (() => void) | undefined;
  emptyTitle?: string;
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

describe("TableEmptyRow states", () => {
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
});
