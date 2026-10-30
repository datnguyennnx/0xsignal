import { useState, useMemo } from "react";
import { Surface } from "@/components/surface/surface";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  useClearinghouseState,
  useSpotClearinghouseState,
} from "@/features/trade/hooks/use-user-data";

import {
  usePortfolio,
  useUserVaultEquities,
  useWhalePortfolio,
  useWhaleVaultEquities,
} from "../hooks/use-portfolio-data";
import {
  PERIOD_LABELS,
  PERIOD_KEYS,
  TF_INDEX,
  isPortfolioPeriod,
  type PortfolioPeriod,
} from "../utils/constants";
import { computeMaxDrawdown } from "../utils/financial";
import { SURFACE } from "./portfolio-summary.constants";
import { SELECT_COMPACT_CLASS } from "@/lib/state-classes";
import {
  PortfolioSummaryError,
  PortfolioSummarySections,
  PortfolioSummarySkeleton,
} from "./portfolio-summary-sections";

export function PortfolioSummaryCard({
  readOnlyAddress,
}: {
  readOnlyAddress?: string | undefined;
}) {
  const [tf, setTf] = useState<PortfolioPeriod>("month");
  const isOwn = readOnlyAddress === undefined;

  const ownPortfolio = usePortfolio(isOwn);
  const whalePortfolio = useWhalePortfolio(readOnlyAddress);
  const {
    data: portfolio,
    isLoading: pfLoading,
    isError: pfError,
  } = isOwn ? ownPortfolio : whalePortfolio;

  const { data: chData, isLoading: chLoading } = useClearinghouseState(isOwn);
  const { data: spotData, isLoading: spotLoading } = useSpotClearinghouseState(isOwn);

  const ownVaults = useUserVaultEquities(isOwn);
  const whaleVaults = useWhaleVaultEquities(readOnlyAddress);
  const { data: vaultData, isLoading: vaultLoading } = isOwn ? ownVaults : whaleVaults;

  const isLoading = pfLoading || chLoading || spotLoading || vaultLoading;

  const period = useMemo(() => {
    if (!portfolio) return null;
    return portfolio[TF_INDEX[tf]]?.[1] ?? null;
  }, [portfolio, tf]);

  const perps = useMemo(() => {
    const lastAccountValue = period?.accountValueHistory?.at(-1);
    const portfolioAccountValue = lastAccountValue === undefined ? 0 : Number(lastAccountValue[1]);
    const marginSummary = chData?.marginSummary;
    const accountValue = marginSummary ? Number(marginSummary.accountValue) : portfolioAccountValue;
    const marginUsed = Number(marginSummary?.totalMarginUsed ?? 0);
    const ntlPos = Number(marginSummary?.totalNtlPos ?? 0);
    const unrealizedPnl = (chData?.assetPositions ?? []).reduce(
      (s, p) => s + Number(p.position.unrealizedPnl),
      0,
    );
    const marginRatio = accountValue > 0 ? (marginUsed / accountValue) * 100 : 0;
    const leverage = accountValue > 0 ? ntlPos / accountValue : 0;
    const lastPnl = period?.pnlHistory?.at(-1);
    const pnl = lastPnl === undefined ? 0 : Number(lastPnl[1]);
    const volume = Number(period?.vlm) || 0;
    const maxDd = period ? computeMaxDrawdown(period.accountValueHistory) : null;
    return { accountValue, unrealizedPnl, marginRatio, leverage, pnl, volume, maxDd };
  }, [chData, period]);

  const spot = useMemo(() => {
    if (!spotData?.balances) return null;
    const totalUsdc = spotData.balances.reduce(
      (s, b) => s + (b.coin === "USDC" ? Number(b.total) : 0),
      0,
    );
    const nonZero = spotData.balances.filter((b) => Number(b.total) > 0);
    return { totalUsdc, tokenCount: nonZero.length, top: nonZero.slice(0, 3) };
  }, [spotData]);

  const vaults = useMemo(() => {
    if (!vaultData) return null;
    return {
      totalEquity: vaultData.reduce((s, v) => s + Number(v.equity), 0),
      count: vaultData.length,
    };
  }, [vaultData]);

  if (isLoading) {
    return <PortfolioSummarySkeleton />;
  }

  if (pfError) {
    return <PortfolioSummaryError />;
  }

  return (
    <Surface tier="content" className={SURFACE}>
      <div className="flex items-center justify-between">
        <span className="text-[length:var(--text-compact)] font-medium tracking-wider text-muted-foreground">
          Perps + Spot + Vaults
        </span>
        <NativeSelect
          size="sm"
          aria-label="Timeframe"
          value={tf}
          onChange={(e) => {
            const val = e.target.value;
            setTf(isPortfolioPeriod(val) ? val : "month");
          }}
          className={SELECT_COMPACT_CLASS}
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
