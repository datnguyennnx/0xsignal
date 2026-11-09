/// <reference types="bun-types" />
import { afterEach, describe, expect, jest, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  pickRouteFallback,
  ROUTE_FALLBACK_DELAY_MS,
  startRouteFallbackDelay,
} from "./route-fallback-logic";
import { RouteFallback, RouteFallbackSkeleton } from "./route-fallback";

afterEach(() => {
  jest.useRealTimers();
});

describe("pickRouteFallback", () => {
  test("maps both trade shapes to the asset-detail skeleton", () => {
    expect(pickRouteFallback("/trade/BTC")).toBe("asset-detail");
    expect(pickRouteFallback("/trade/PURR/USDC")).toBe("asset-detail");
    expect(pickRouteFallback("/trade/xyz:TSLA")).toBe("asset-detail");
  });

  test("maps every other path to the generic page skeleton", () => {
    expect(pickRouteFallback("/")).toBe("page");
    expect(pickRouteFallback("/trade")).toBe("page");
    expect(pickRouteFallback("/portfolio")).toBe("page");
    expect(pickRouteFallback("/whales/0x0000000000000000000000000000000000000002")).toBe("page");
    expect(pickRouteFallback("/not-a-route")).toBe("page");
  });
});

describe("route fallback delay", () => {
  test(`renders nothing for the first ${String(ROUTE_FALLBACK_DELAY_MS)}ms, then the skeleton`, () => {
    jest.useFakeTimers();
    let revealed = false;
    // The component arms this same scheduler on mount; the static renderer has no
    // effects, so the test drives the scheduler and then renders the revealed tree.
    const cancel = startRouteFallbackDelay(() => {
      revealed = true;
    });

    expect(renderToStaticMarkup(<RouteFallback pathname="/portfolio" />)).toBe("");

    jest.advanceTimersByTime(ROUTE_FALLBACK_DELAY_MS - 1);
    expect(revealed).toBe(false);
    expect(renderToStaticMarkup(<RouteFallback pathname="/portfolio" />)).toBe("");

    jest.advanceTimersByTime(1);
    expect(revealed).toBe(true);

    const html = renderToStaticMarkup(
      <RouteFallbackSkeleton kind={pickRouteFallback("/portfolio")} />,
    );
    // `<output>` carries the implicit `status` role and the explicit accessible name.
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading page"');
    expect(html).toContain('data-slot="skeleton"');
    expect(html).not.toContain("animate-spin");

    cancel();
  });

  test("cancelling clears the pending reveal", () => {
    jest.useFakeTimers();
    let revealed = false;
    const cancel = startRouteFallbackDelay(() => {
      revealed = true;
    });

    cancel();
    jest.advanceTimersByTime(ROUTE_FALLBACK_DELAY_MS * 2);

    expect(revealed).toBe(false);
  });

  test("the asset-detail skeleton keeps the route-shaped panels", () => {
    const html = renderToStaticMarkup(<RouteFallbackSkeleton kind="asset-detail" />);

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading page"');
    expect(html).toContain('data-slot="skeleton"');
  });
});
