/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderMarkup } from "../../test/render";

import { ErrorState } from "./error-state";
import { StateArt } from "./state-art";

function hasChildren(props: unknown): props is { children?: ReactNode } {
  return typeof props === "object" && props !== null;
}

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement) => boolean,
): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of Children.toArray(node)) {
      const found = findElement(child, predicate);
      if (found !== null) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (predicate(node)) return node;
  return hasChildren(node.props) ? findElement(node.props.children, predicate) : null;
}

function sizeOf(element: ReactElement | null): unknown {
  if (element === null) return undefined;
  const props: unknown = element.props;
  return typeof props === "object" && props !== null && "size" in props ? props.size : undefined;
}

type ErrorStateInnerProps = {
  title?: string;
  description?: string;
  retryAction?: (() => void) | undefined;
  retryLabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function isInnerComponent(
  value: unknown,
): value is { type: (props: ErrorStateInnerProps) => ReactElement } {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
  return typeof Reflect.get(value, "type") === "function";
}

function renderInner(props: ErrorStateInnerProps): ReactElement {
  if (!isInnerComponent(ErrorState)) throw new Error("ErrorState inner component is unavailable");
  return ErrorState.type(props);
}

describe("ErrorState", () => {
  test("renders the brand art at md by default", () => {
    const tree = renderInner({});

    const art = findElement(tree, (element) => element.type === StateArt);
    expect(art).not.toBeNull();
    expect(sizeOf(art)).toBe("md");
  });

  test("accepts a smaller table size", () => {
    const tree = renderInner({ size: "sm" });

    const art = findElement(tree, (element) => element.type === StateArt);
    expect(sizeOf(art)).toBe("sm");
  });

  test("keeps the default copy and retry affordance", () => {
    const html = renderMarkup(<ErrorState retryAction={() => {}} />);

    expect(html).toContain("Unable to load data");
    expect(html).toContain("An unexpected error occurred. Please try again.");
    expect(html).toContain("Retry");
    expect(html).toMatch(/<img src="[^"]*state\.webp"/);
  });

  test("honours caller overrides for title and description", () => {
    const html = renderMarkup(<ErrorState title="Custom title" description="Custom description" />);

    expect(html).toContain("Custom title");
    expect(html).toContain("Custom description");
  });

  test("defaults the retry label to Retry and honours an override", () => {
    expect(renderMarkup(<ErrorState retryAction={() => {}} />)).toContain("Retry");

    const html = renderMarkup(<ErrorState retryAction={() => {}} retryLabel="Try again" />);
    expect(html).toContain("Try again");
  });
});
