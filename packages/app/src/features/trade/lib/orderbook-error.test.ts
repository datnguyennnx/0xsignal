/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { selectOrderbookError } from "./orderbook-error";

describe("selectOrderbookError", () => {
  test("surfaces the message while the socket is disconnected", () => {
    expect(selectOrderbookError("stream failed", false)).toBe("stream failed");
  });

  test("clears the message in the same render that the socket reconnects", () => {
    expect(selectOrderbookError("stream failed", true)).toBeNull();
  });

  test("stays empty when there is no error and the socket is down", () => {
    expect(selectOrderbookError(null, false)).toBeNull();
  });

  test("stays empty when there is no error and the socket is up", () => {
    expect(selectOrderbookError(null, true)).toBeNull();
  });
});
