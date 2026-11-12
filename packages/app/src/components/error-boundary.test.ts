/// <reference types="bun-types" />
import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createElement, type ReactNode } from "react";

import { cleanup, fireEvent, hasDom, renderDom } from "../../test/render";
import { ErrorBoundary } from "./error-boundary";

const realError = console.error;
console.error = () => {};
afterAll(() => {
  console.error = realError;
  cleanup();
});
afterEach(cleanup);

let shouldThrow = true;
function Boom(): ReactNode {
  if (shouldThrow) throw new Error("boom");
  return createElement("p", null, "recovered child");
}

beforeEach(() => {
  shouldThrow = true;
});

describe.skipIf(!hasDom)("ErrorBoundary", () => {
  test("retry mounts the children again", () => {
    const view = renderDom(createElement(ErrorBoundary, null, createElement(Boom)));
    shouldThrow = false;

    fireEvent.click(view.getByRole("button", { name: /try again/i }));

    expect(view.getByText("recovered child")).toBeDefined();
    expect(view.queryByText("Something went wrong")).toBeNull();
  });

  test("a caller fallback replaces the default one", () => {
    const view = renderDom(
      createElement(ErrorBoundary, {
        fallback: createElement("p", null, "custom fallback"),
        children: createElement(Boom),
      }),
    );

    expect(view.getByText("custom fallback")).toBeDefined();
    expect(view.queryByText("Something went wrong")).toBeNull();
  });
});
