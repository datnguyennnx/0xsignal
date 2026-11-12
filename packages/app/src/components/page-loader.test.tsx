/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { renderMarkup } from "../../test/render";

import { PageLoader } from "./page-loader";

describe("PageLoader", () => {
  test("shows a visible loading label for reduced-motion users", () => {
    const html = renderMarkup(<PageLoader />);

    expect(html).toContain("Loading…");
    expect(html).toContain("<output");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading"');
  });

  test("keeps the fullscreen variant for the auth shell", () => {
    const html = renderMarkup(<PageLoader variant="fullscreen" />);

    expect(html).toContain("min-h-dvh");
    expect(html).toContain("Loading…");
  });
});
