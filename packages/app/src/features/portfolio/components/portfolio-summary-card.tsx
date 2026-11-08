import { useMemo } from "react";
import { Surface } from "@/components/surface/surface";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  useClearinghouseState,
  useSpotClearinghouseState,
} from "@/features/trade/hooks/use-user-data";
import { useOwnAddress } from "@/hooks/use-effective-address";

import {
  usePortfolio,
  useUserVaultEquities,
  useWhaleClearinghouseState,
  useWhalePortfolio,
  useWhaleSpotClearinghouseState,
  useWhaleVaultEquities,
} from "../hooks/use-portfolio-data";
import {
  PERIOD_LABELS,
  PERIOD_KEYS,
  findPeriodEntry,
  isPortfolioPeriod,
  type PortfolioPeriod,
} from "../utils/constants";
import { QUOTE_ASSET } from "@/core/utils/hyperliquid";
import { computeMaxDrawdown } from "../utils/financial";
import { SURFACE } from "./portfolio-summary.constants";
import {
  PortfolioSummaryError,
  PortfolioSummarySections,
  PortfolioSummarySkeleton,
} from "./portfolio-summary-sections";

export function PortfolioSummaryCard({
  readOnlyAddress,
  period: selectedPeriod,
  onPeriodChange,
}: {
  readOnlyAddress?: string | undefined;
  period: PortfolioPeriod;
  onPeriodChange: (period: PortfolioPeriod) => void;
}) {
  const isOwn = readOnlyAddress === undefined;
  const ownAddress = useOwnAddress();

  const ownPortfolio = usePortfolio(isOwn);
  const whalePortfolio = useWhalePortfolio(readOnlyAddress);
  const {
    data: portfolio,
    isLoading: pfLoading,
    isError: pfError,
  } = isOwn ? ownPortfolio : whalePortfolio;

  const ownClearinghouse = useClearinghouseState(isOwn);
  const whaleClearinghouse = useWhaleClearinghouseState(readOnlyAddress);
  const { data: chData, isLoading: chLoading } = isOwn ? ownClearinghouse : whaleClearinghouse;

  const ownSpot = useSpotClearinghouseState(isOwn);
  const whaleSpot = useWhaleSpotClearinghouseState(readOnlyAddress);
  const { data: spotData, isLoading: spotLoading } = isOwn ? ownSpot : whaleSpot;

  const ownVaults = useUserVaultEquities(isOwn);
  const whaleVaults = useWhaleVaultEquities(readOnlyAddress);
  const { data: vaultData, isLoading: vaultLoading } = isOwn ? ownVaults : whaleVaults;

  const isLoading = pfLoading || chLoading || spotLoading || vaultLoading;

  const period = useMemo(() => {
    if (!portfolio) return null;
    return findPeriodEntry(portfolio, selectedPeriod) ?? null;
  }, [portfolio, selectedPeriod]);

  const perps = useMemo(() => {
    const lastAccountValue = period?.accountValueHistory?.at(-1);
    const portfolioAccountValue =
      lastAccountValue === undefined ? null : Number(lastAccountValue[1]);
    const marginSummary = chData?.marginSummary;
    const accountValue = marginSummary ? Number(marginSummary.accountValue) : portfolioAccountValue;
    const lastPnl = period?.pnlHistory?.at(-1);
    const pnl = lastPnl === undefined ? null : Number(lastPnl[1]);
    const volume = period?.vlm === undefined ? null : Number(period.vlm);
    const maxDd = period ? computeMaxDrawdown(period.accountValueHistory) : null;
    return { accountValue, pnl, volume, maxDd };
  }, [chData, period]);

  const spot = useMemo(() => {
    if (!spotData?.balances) return null;
    const totalUsdc = spotData.balances.reduce(
      (s, b) => s + (b.coin === QUOTE_ASSET ? Number(b.total) : 0),
      0,
    );
    return { totalUsdc };
  }, [spotData]);

  const vaults = useMemo(() => {
    if (!vaultData) return null;
    return { totalEquity: vaultData.reduce((s, v) => s + Number(v.equity), 0) };
  }, [vaultData]);

  if (isOwn && ownAddress === undefined) {
    return (
      <Surface tier="content" className={SURFACE}>
        <EmptyState
          variant="panel"
          title="Connect your wallet"
          description="Connect your wallet to see your portfolio."
        />
      </Surface>
    );
  }

  if (isLoading) {
    return <PortfolioSummarySkeleton />;
  }

  if (pfError) {
    return <PortfolioSummaryError />;
  }

  return (
    <Surface tier="content" className={SURFACE}>
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

      <PortfolioSummarySections perps={perps} spot={spot} vaults={vaults} />
    </Surface>
  );
}
