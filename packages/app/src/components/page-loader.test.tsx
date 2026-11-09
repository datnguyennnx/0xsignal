/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { PageLoader } from "./page-loader";

describe("PageLoader", () => {
  test("shows a visible loading label for reduced-motion users", () => {
    const html = renderToStaticMarkup(<PageLoader />);

    expect(html).toContain("Loading…");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading"');
  });

  test("keeps the fullscreen variant for the auth shell", () => {
    const html = renderToStaticMarkup(<PageLoader variant="fullscreen" />);

    expect(html).toContain("min-h-dvh");
    expect(html).toContain("Loading…");
  });
});
