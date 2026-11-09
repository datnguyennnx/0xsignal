/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SURFACE } from "./portfolio-summary.constants";
import { PortfolioSummaryHeader } from "./portfolio-summary-header";
import { PortfolioSummaryError, PortfolioSummarySkeleton } from "./portfolio-summary-sections";
import {
  PortfolioSummaryConnectWalletState,
  PortfolioSummaryGate,
} from "./portfolio-summary-states";

describe("PortfolioSummaryGate", () => {
  test("connect-wallet renders the panel empty state inside the summary surface", () => {
    const html = renderToStaticMarkup(<PortfolioSummaryGate state="connect-wallet" />);

    expect(html).toContain("Connect your wallet");
    expect(html).toContain("Connect your wallet to see your portfolio.");
    expect(html).toContain(SURFACE);
    expect(html).toBe(renderToStaticMarkup(<PortfolioSummaryConnectWalletState />));
  });

  test("loading and empty both render the same skeleton as the loaded-card placeholder", () => {
    const skeleton = renderToStaticMarkup(<PortfolioSummarySkeleton />);

    expect(renderToStaticMarkup(<PortfolioSummaryGate state="loading" />)).toBe(skeleton);
    expect(renderToStaticMarkup(<PortfolioSummaryGate state="empty" />)).toBe(skeleton);
  });

  test("error renders the retryable portfolio error", () => {
    const retry = () => {
      /* noop */
    };

    expect(renderToStaticMarkup(<PortfolioSummaryGate state="error" />)).toBe(
      renderToStaticMarkup(<PortfolioSummaryError />),
    );
    expect(renderToStaticMarkup(<PortfolioSummaryGate state="error" onRetry={retry} />)).toBe(
      renderToStaticMarkup(<PortfolioSummaryError onRetry={retry} />),
    );
    expect(renderToStaticMarkup(<PortfolioSummaryGate state="error" />)).toContain(
      "Unable to load portfolio",
    );
  });
});

describe("PortfolioSummaryHeader", () => {
  test("keeps the timeframe control and all period options", () => {
    const html = renderToStaticMarkup(
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
