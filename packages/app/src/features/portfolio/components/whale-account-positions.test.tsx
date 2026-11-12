/// <reference types="bun-types" />
import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { createElement } from "react";
import { MemoryRouter } from "react-router";

import { cleanup, fireEvent, hasDom, renderDom } from "../../../../test/render";

// Other suites in this Bun process delete the DOM globals without restoring
// them, so reinstall a window when this file runs after one of them.
if (!("document" in globalThis)) {
  const window = new Window({ url: "http://localhost/" });
  for (const [name, value] of [
    ["window", window],
    ["document", window.document],
    ["navigator", window.navigator],
  ] as const) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
}

const POSITION = {
  coin: "xyz:TSLA",
  szi: "10",
  entryPx: "24000",
  positionValue: "25000",
  liquidationPx: null,
  marginUsed: "1000",
  unrealizedPnl: "1000",
  returnOnEquity: "0.1",
  cumFunding: { sinceOpen: "0" },
  leverage: { type: "cross", value: 10 },
};

mock.module("../hooks/use-portfolio-data", () => ({
  useWhaleClearinghouseState: () => ({
    data: { assetPositions: [{ position: POSITION }] },
    isLoading: false,
    isError: false,
    refetch: () => {},
  }),
}));

const openedCoins: string[] = [];
mock.module("@/components/app-side-panel-context", () => ({
  useOpenCoin: () => (coin: string) => {
    openedCoins.push(coin);
  },
}));

const { WhaleAccountPositions } = await import("./whale-account-positions");

function renderPositions() {
  return renderDom(
    createElement(MemoryRouter, null, createElement(WhaleAccountPositions, { address: "0xwhale" })),
  );
}

afterEach(() => {
  openedCoins.length = 0;
  cleanup();
});
afterAll(() => {
  mock.restore();
});

describe.skipIf(!hasDom)("WhaleAccountPositions asset cell", () => {
  test("opens the coin panel with the raw coin when the asset button is clicked", () => {
    const view = renderPositions();

    const button = view.container.querySelector("button");
    expect(button).not.toBeNull();
    fireEvent.click(button as HTMLButtonElement);

    expect(openedCoins).toEqual(["xyz:TSLA"]);
  });
});
