/// <reference types="bun-types" />
/**
 * Source-level handoff contract.
 *
 * The loading → content swap is owned by CSS (`.content-enter` / `.content-fade`),
 * so there is no DOM behaviour to assert without a browser. These checks pin the
 * two regressions that made the swap replay: card shells carrying the page entry
 * animation, and skeleton blocks leaking into the accessibility tree.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { SURFACE } from "@/features/portfolio/components/portfolio-summary.constants";

const SKELETON_SOURCE = readFileSync(new URL("./ui/skeleton.tsx", import.meta.url), "utf8");

describe("loading → content handoff", () => {
  test("card and section shells carry no entry animation of their own", () => {
    expect(SURFACE).not.toContain("page-enter");
    expect(SURFACE).not.toContain("content-enter");
  });

  test("skeleton blocks are decorative", () => {
    expect(SKELETON_SOURCE).toContain('aria-hidden="true"');
    expect(SKELETON_SOURCE).toContain("motion-reduce:animate-none");
  });
});
