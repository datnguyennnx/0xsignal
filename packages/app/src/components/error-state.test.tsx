/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ErrorState } from "./error-state";
import { StateArt } from "./state-art";

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

type ErrorStateInnerProps = {
  title?: string;
  description?: string;
  retryAction?: (() => void) | undefined;
  retryLabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function renderInner(props: ErrorStateInnerProps): ReactElement {
  const inner = (ErrorState as unknown as { type: (p: ErrorStateInnerProps) => ReactElement }).type;
  return inner(props);
}

describe("ErrorState", () => {
  test("renders the brand art at md by default", () => {
    const tree = renderInner({});

    const art = findElement(tree, (element) => element.type === StateArt);
    expect(art).not.toBeNull();
    expect((art?.props as { size?: string }).size).toBe("md");
  });

  test("accepts a smaller table size", () => {
    const tree = renderInner({ size: "sm" });

    const art = findElement(tree, (element) => element.type === StateArt);
    expect((art?.props as { size?: string }).size).toBe("sm");
  });

  test("keeps the default copy and retry affordance", () => {
    const html = renderToStaticMarkup(<ErrorState retryAction={() => {}} />);

    expect(html).toContain("Unable to load data");
    expect(html).toContain("An unexpected error occurred. Please try again.");
    expect(html).toContain("Retry");
    expect(html).toMatch(/<img src="[^"]*state\.webp"/);
  });

  test("honours caller overrides for title and description", () => {
    const html = renderToStaticMarkup(
      <ErrorState title="Custom title" description="Custom description" />,
    );

    expect(html).toContain("Custom title");
    expect(html).toContain("Custom description");
  });

  test("defaults the retry label to Retry and honours an override", () => {
    expect(renderToStaticMarkup(<ErrorState retryAction={() => {}} />)).toContain("Retry");

    const html = renderToStaticMarkup(<ErrorState retryAction={() => {}} retryLabel="Try again" />);
    expect(html).toContain("Try again");
  });
});
