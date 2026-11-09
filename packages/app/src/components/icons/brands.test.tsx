/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import type { ComponentType, SVGProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Coinbase, Github, Google, Metamask } from "./brands";

interface BrandCase {
  name: "Google" | "Github" | "Metamask" | "Coinbase";
  viewBox: string;
  minPaths: number;
}

const BRAND_COMPONENTS: Record<BrandCase["name"], ComponentType<SVGProps<SVGSVGElement>>> = {
  Google,
  Github,
  Metamask,
  Coinbase,
};

const CASES: readonly BrandCase[] = [
  { name: "Google", viewBox: "0 0 268.152 273.883", minPaths: 2 },
  { name: "Github", viewBox: "0 0 1024 1024", minPaths: 1 },
  { name: "Metamask", viewBox: "0 0 318.6 318.6", minPaths: 2 },
  { name: "Coinbase", viewBox: "0 0 48 48", minPaths: 1 },
];

describe("brand icons", () => {
  test("exports the four brand components", () => {
    for (const { name } of CASES) {
      expect(typeof BRAND_COMPONENTS[name]).toBe("function");
    }
  });

  for (const { name, viewBox, minPaths } of CASES) {
    test(`${name} renders a decorative, self-contained svg`, () => {
      const Icon = BRAND_COMPONENTS[name];
      const html = renderToStaticMarkup(<Icon />);

      expect(html.startsWith("<svg")).toBe(true);
      expect(html).toContain(`viewBox="${viewBox}"`);
      expect(html).toContain('aria-hidden="true"');
      expect(html.match(/<path/g)?.length ?? 0).toBeGreaterThanOrEqual(minPaths);
    });
  }

  test("passes caller props through to the root svg", () => {
    const html = renderToStaticMarkup(<Google className="size-icon" />);

    expect(html).toContain('class="size-icon"');
  });
});
