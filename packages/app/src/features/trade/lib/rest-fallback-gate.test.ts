/// <reference types="bun-types" />
import { afterEach, describe, expect, jest, test } from "bun:test";

import { createRestFallbackGate, USER_STREAM_REST_GRACE_MS } from "./rest-fallback-gate";

afterEach(() => {
  jest.useRealTimers();
});

describe("user stream REST grace period", () => {
  test("a stream confirmed before the window issues zero REST reads", () => {
    jest.useFakeTimers();
    let restReads = 0;
    const gate = createRestFallbackGate(() => {
      restReads += 1;
    });

    gate.setLive(false);
    jest.advanceTimersByTime(100);
    gate.setLive(true);
    jest.advanceTimersByTime(2000);

    expect(restReads).toBe(0);
    expect(gate.isRestEnabled()).toBe(false);
    gate.dispose();
  });

  test("an unconfirmed stream opens the REST fallback after the window", () => {
    jest.useFakeTimers();
    let restReads = 0;
    const gate = createRestFallbackGate(() => {
      restReads += 1;
    });

    gate.setLive(false);
    jest.advanceTimersByTime(USER_STREAM_REST_GRACE_MS - 1);
    expect(restReads).toBe(0);

    jest.advanceTimersByTime(1);
    expect(restReads).toBe(1);
    expect(gate.isRestEnabled()).toBe(true);
    gate.dispose();
  });
});
