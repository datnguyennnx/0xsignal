/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { hasRenderableBook } from "./orderbook-widget-shared";

describe("hasRenderableBook", () => {
  test("renders nothing before the first frame arrives", () => {
    expect(hasRenderableBook(undefined)).toBe(false);
  });

  test("renders a book with only bid levels", () => {
    expect(hasRenderableBook({ bids: [1], asks: [] })).toBe(true);
  });

  test("renders a book with only ask levels", () => {
    expect(hasRenderableBook({ bids: [], asks: [1] })).toBe(true);
  });

  test("reports an empty book only when both sides are empty", () => {
    expect(hasRenderableBook({ bids: [], asks: [] })).toBe(false);
  });
});
