/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ErrorState } from "./error-state";
import { TableEmptyRow } from "./table-empty-row";
import { resolveTableState } from "./table-empty-row-logic";

type TableEmptyRowInnerProps = {
  colSpan: number;
  state?: "loading" | "empty" | "error";
  onRetry?: (() => void) | undefined;
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

describe("resolveTableState", () => {
  test("loading wins over an error and an empty result", () => {
    expect(resolveTableState({ isLoading: true, isError: true })).toBe("loading");
  });

  test("an error wins over an empty result", () => {
    expect(resolveTableState({ isLoading: false, isError: true })).toBe("error");
  });

  test("only a settled, successful read is empty", () => {
    expect(resolveTableState({ isLoading: false, isError: false })).toBe("empty");
  });
});

describe("TableEmptyRow states", () => {
  test("the error state forwards its retry callback to the shared ErrorState", () => {
    let calls = 0;
    const tree = renderInner({
      colSpan: 3,
      state: "error",
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
    const html = renderToStaticMarkup(<TableEmptyRow colSpan={3} state="loading" rows={2} />);

    expect(html).toContain("<output");
    expect(html).not.toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-hidden="true"');
  });

  test("error renders the shared alert and retry affordance", () => {
    const html = renderToStaticMarkup(
      <TableEmptyRow colSpan={3} state="error" onRetry={() => {}} />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Unable to load data");
    expect(html).toContain("Retry");
  });

  test("the existing empty contract still works without a state prop", () => {
    const html = renderToStaticMarkup(<TableEmptyRow colSpan={3} />);

    expect(html).toContain("No data available");
    expect(html).not.toContain('role="alert"');
  });
});
