/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { StateArt } from "./state-art";

const SOURCE = readFileSync(new URL("./state-art.tsx", import.meta.url), "utf8");

describe("StateArt", () => {
  test("imports the asset through the shared module instead of the public dir", () => {
    expect(SOURCE).toContain('from "@/lib/state-art-url"');
    expect(SOURCE).not.toContain('src="/state.webp"');

    const html = renderToStaticMarkup(<StateArt />);
    expect(html).toMatch(/<img[^>]+src="[^"]*state[^"]*\.webp"/);
  });

  test("hides itself from assistive tech and defers the decode", () => {
    const html = renderToStaticMarkup(<StateArt />);

    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('decoding="async"');
  });

  test("reserves the 500×500 intrinsic box with numeric width/height and an aspect ratio", () => {
    const html = renderToStaticMarkup(<StateArt />);

    expect(html).toContain('width="500"');
    expect(html).toContain('height="500"');
    expect(html).toContain("aspect-ratio:500 / 500");
  });

  test("defaults to the md size", () => {
    const html = renderToStaticMarkup(<StateArt />);

    expect(html).toContain("w-[clamp(7rem,18vmin,13rem)]");
  });

  test("renders each requested size", () => {
    expect(renderToStaticMarkup(<StateArt size="sm" />)).toContain("w-[clamp(3rem,6vmin,4.5rem)]");
    expect(renderToStaticMarkup(<StateArt size="md" />)).toContain("w-[clamp(7rem,18vmin,13rem)]");
    expect(renderToStaticMarkup(<StateArt size="lg" />)).toContain("w-[clamp(10rem,26vmin,19rem)]");
  });

  test("merges a caller class onto the image", () => {
    const html = renderToStaticMarkup(<StateArt className="mb-4" />);

    expect(html).toContain("mb-4");
  });

  test("carries no fallback: no monogram, no error branch, no state", () => {
    expect(SOURCE).not.toContain("0x");
    expect(SOURCE).not.toContain("onError");
    expect(SOURCE).not.toContain("useState");
    expect(SOURCE).not.toContain("console.error");
  });
});
