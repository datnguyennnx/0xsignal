/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { RouteErrorFallback } from "./app-router";
import { ERROR_QUIPS } from "@/lib/error-quips";

const SOURCE = readFileSync(new URL("./app-router.tsx", import.meta.url), "utf8");

describe("AppRouter route error fallback", () => {
  test("delegates to the shared ErrorState so there is one error language", () => {
    expect(SOURCE).toContain("<ErrorState");
    expect(SOURCE).toContain('title="Something went wrong"');
  });

  test("picks a pool quip once, in state, instead of per render", () => {
    expect(SOURCE).toContain("const [quip] = useState(() => pickErrorQuip());");
    expect(SOURCE).toContain("description={quip}");
  });

  test("renders a description that comes from the quip pool", () => {
    const html = renderToStaticMarkup(createElement(RouteErrorFallback));

    expect(ERROR_QUIPS.some((quip) => html.includes(quip))).toBe(true);
    expect(html).not.toContain("Even good terminals have bad days.");
  });

  test("passes Try again so the button matches the description", () => {
    expect(SOURCE).toContain('retryLabel="Try again"');
  });

  test("reloads through the shared retry action instead of a one-off button", () => {
    expect(SOURCE).toContain("window.location.reload()");
    expect(SOURCE).not.toContain("<button");
    expect(SOURCE).not.toContain("bg-info");
  });

  test("keeps the full-viewport centering wrapper", () => {
    expect(SOURCE).toContain("min-h-dvh");
  });
});
