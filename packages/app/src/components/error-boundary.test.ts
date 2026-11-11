/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ErrorBoundary } from "./error-boundary";
import { ERROR_QUIPS } from "@/lib/error-quips";

const SOURCE = readFileSync(new URL("./error-boundary.tsx", import.meta.url), "utf8");

function renderCaptured(): { instance: ErrorBoundary; html: string } {
  const instance = new ErrorBoundary({ children: null });
  Object.assign(instance.state, { hasError: true });
  const html = renderToStaticMarkup(instance.render() as ReactElement);
  return { instance, html };
}

describe("ErrorBoundary default fallback", () => {
  test("uses the shared brand art instead of an alert icon", () => {
    expect(SOURCE).toContain('<StateArt size="lg" />');
    expect(SOURCE).not.toContain("AlertTriangle");
  });

  test("takes its description from the quip pool", () => {
    const { instance, html } = renderCaptured();

    expect(ERROR_QUIPS).toContain(instance.state.quip);
    expect(html).toContain(instance.state.quip);
    expect(html).not.toContain("Even good terminals have bad days.");
  });

  test("keeps the quip stable across a re-render", () => {
    const instance = new ErrorBoundary({ children: null });
    Object.assign(instance.state, { hasError: true });

    const first = renderToStaticMarkup(instance.render() as ReactElement);
    const second = renderToStaticMarkup(instance.render() as ReactElement);

    expect(first).toBe(second);
    expect(first).toContain(instance.state.quip);
  });

  test("keeps the title and retry wiring", () => {
    expect(SOURCE).toContain("Something went wrong");
    expect(SOURCE).toContain("Try again");
    expect(SOURCE).toContain("onClick={this.handleReset}");
    expect(SOURCE).toContain("flex-1");
    expect(SOURCE).toContain("min-h-full");
    expect(SOURCE).toContain("justify-center");
  });
});
