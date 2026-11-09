import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import {
  PERIOD_KEYS,
  PERIOD_LABELS,
  isPortfolioPeriod,
  type PortfolioPeriod,
} from "../utils/constants";

/** Period selector row of the portfolio summary card. */
export function PortfolioSummaryHeader({
  selectedPeriod,
  onPeriodChange,
}: {
  selectedPeriod: PortfolioPeriod;
  onPeriodChange: (period: PortfolioPeriod) => void;
}) {
  return (
    <div data-dense className="flex items-center justify-between">
      <span className="type-data font-medium tracking-wider text-muted-foreground">
        Perps + Spot + Vaults
      </span>
      <NativeSelect
        aria-label="Timeframe"
        value={selectedPeriod}
        onChange={(e) => {
          const val = e.target.value;
          onPeriodChange(isPortfolioPeriod(val) ? val : "month");
        }}
      >
        {PERIOD_KEYS.map((p) => (
          <NativeSelectOption key={p} value={p}>
            {PERIOD_LABELS[p]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
