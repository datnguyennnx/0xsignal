import type { ReactNode } from "react";
import type { PortfolioResponse } from "@0xsignal/shared";

import { Region } from "@/components/region";
import type { AsyncState } from "@/lib/async-state";

import { PortfolioSummarySkeleton } from "./portfolio-summary-sections";

interface SummaryEmptyCopy {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** The card's one state boundary: Region owns loading, empty, error and ready. */
export function PortfolioSummaryGate({
  state,
  onRetry,
  empty,
  children,
}: {
  state: AsyncState<PortfolioResponse>;
  onRetry?: (() => void) | undefined;
  empty: SummaryEmptyCopy;
  children: (data: PortfolioResponse) => ReactNode;
}) {
  return (
    <Region
      state={state}
      label="Portfolio summary"
      className="flex min-h-0 flex-1 flex-col gap-stack"
      skeleton={<PortfolioSummarySkeleton />}
      empty={empty}
      error={{
        title: "Unable to load portfolio",
        description: "One or more portfolio requests failed. Check your connection and try again.",
        ...(onRetry === undefined ? {} : { retry: onRetry }),
      }}
    >
      {children}
    </Region>
  );
}
