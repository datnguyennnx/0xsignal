/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { renderMarkup } from "../../../../test/render";

import { PortfolioSummaryHeader } from "./portfolio-summary-header";
import { PortfolioSummarySkeleton } from "./portfolio-summary-sections";
import { PortfolioSummaryGate } from "./portfolio-summary-states";

const EMPTY_COPY = {
  title: "Connect your wallet",
  description: "Connect your wallet to see your portfolio.",
};

const gate = (state: Parameters<typeof PortfolioSummaryGate>[0]["state"]): string =>
  renderMarkup(
    <PortfolioSummaryGate state={state} empty={EMPTY_COPY}>
      {() => null}
    </PortfolioSummaryGate>,
  );

describe("PortfolioSummaryGate", () => {
  test("empty renders the caller's copy inside the summary surface", () => {
    const html = gate({ status: "empty", reason: "first-use" });

    expect(html).toContain("Connect your wallet");
    expect(html).toContain("Connect your wallet to see your portfolio.");
  });

  test("idle and loading both render the same skeleton as the loaded-card placeholder", () => {
    const skeleton = renderMarkup(<PortfolioSummarySkeleton />);

    expect(gate({ status: "idle" })).toContain(skeleton);
    expect(gate({ status: "loading" })).toContain(skeleton);
  });

  test("error renders the retryable portfolio error", () => {
    const failed = { status: "error", error: new Error("portfolio failed") } as const;

    expect(gate(failed)).toContain("Unable to load portfolio");
    expect(gate(failed)).toContain("One or more portfolio requests failed");
  });
});

describe("PortfolioSummaryHeader", () => {
  test("keeps the timeframe control and all period options", () => {
    const html = renderMarkup(
      <PortfolioSummaryHeader
        selectedPeriod="month"
        onPeriodChange={() => {
          /* noop */
        }}
      />,
    );

    expect(html).toContain("Perps + Spot + Vaults");
    expect(html).toContain('aria-label="Timeframe"');
    expect(html.match(/<option/g)).toHaveLength(4);
    for (const label of ["1D", "7D", "30D", "All"]) {
      expect(html).toContain(label);
    }
  });
});
