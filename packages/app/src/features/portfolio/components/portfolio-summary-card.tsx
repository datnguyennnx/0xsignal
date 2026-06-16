import { useState, useMemo } from "react";
import { cn } from "@/core/utils/cn";
import { usePortfolio, useUserVaultEquities } from "../hooks/use-portfolio-data";
import {
  useClearinghouseState,
  useSpotClearinghouseState,
} from "@/features/trade/hooks/use-user-data";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

/* Types */

type Timeframe = "day" | "week" | "month" | "allTime";

const PERIOD_LABELS: Record<Timeframe, string> = {
  day: "1D",
  week: "7D",
  month: "30D",
  allTime: "All",
};
const PERIOD_KEYS: Timeframe[] = ["day", "week", "month", "allTime"];
const TF_INDEX: Record<Timeframe, number> = { day: 0, week: 1, month: 2, allTime: 3 };

/* Helpers */

function computeMaxDrawdown(history: [number, string][]): number | null {
  if (history.length < 2) return null;
  let peak = -Infinity,
    maxDd = 0;
  for (const [, v] of history) {
    const val = Number(v);
    if (!Number.isFinite(val)) continue;
    if (val > peak) peak = val;
    if (peak > 0) {
      const dd = (val - peak) / peak;
      if (dd < maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

/* Primitives */

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "gain" | "loss" | "warn" | null;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[length:var(--text-data)] font-medium text-muted-foreground tracking-wide">
        {label}
      </span>
      <span
        className={cn(
          "text-[length:var(--text-compact)] tabular-nums font-medium",
          accent === "gain" && "text-gain",
          accent === "loss" && "text-loss",
          accent === "warn" && "text-warn",
          !accent && "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function SkeletonLine({ w = "100%", h = 11 }: { w?: string; h?: number }) {
  return <div className="loading-shimmer rounded-sm" style={{ width: w, height: h }} />;
}

/* Main Component */

const SURFACE =
  "h-full flex flex-col rounded-xl border border-border/20 p-4 bg-card animate-in fade-in duration-200 ease-premium gap-[clamp(0.5rem,1vw,1rem)]";

export function PortfolioSummaryCard() {
  const [tf, setTf] = useState<Timeframe>("month");

  const { data: portfolio, isLoading: pfLoading, isError: pfError } = usePortfolio();
  const { data: chData, isLoading: chLoading } = useClearinghouseState();
  const { data: spotData, isLoading: spotLoading } = useSpotClearinghouseState();
  const { data: vaultData, isLoading: vaultLoading } = useUserVaultEquities();

  const isLoading = pfLoading || chLoading || spotLoading || vaultLoading;

  const period = useMemo(() => {
    if (!portfolio) return null;
    return portfolio[TF_INDEX[tf]]?.[1] ?? null;
  }, [portfolio, tf]);

  const perps = useMemo(() => {
    if (!chData?.marginSummary) return null;
    const ms = chData.marginSummary;
    const accountValue = Number(ms.accountValue);
    const marginUsed = Number(ms.totalMarginUsed);
    const ntlPos = Number(ms.totalNtlPos);
    const unrealizedPnl = (chData.assetPositions ?? []).reduce(
      (s, p) => s + Number(p.position.unrealizedPnl),
      0
    );
    const marginRatio = accountValue > 0 ? (marginUsed / accountValue) * 100 : 0;
    const leverage = accountValue > 0 ? ntlPos / accountValue : 0;
    const pnl = period?.pnlHistory?.length
      ? Number(period.pnlHistory[period.pnlHistory.length - 1][1])
      : 0;
    const volume = Number(period?.vlm) || 0;
    const maxDd = period ? computeMaxDrawdown(period.accountValueHistory) : null;
    return { accountValue, unrealizedPnl, marginRatio, leverage, pnl, volume, maxDd };
  }, [chData, period]);

  const spot = useMemo(() => {
    if (!spotData?.balances) return null;
    const totalUsdc = spotData.balances.reduce(
      (s, b) => s + (b.coin === "USDC" ? Number(b.total) : 0),
      0
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

  /* Loading */
  if (isLoading) {
    return (
      <div className={SURFACE}>
        <div className="p-0 flex justify-between items-center">
          <SkeletonLine w="48px" h={14} />
          <SkeletonLine w="36px" h={20} />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <SkeletonLine w="38%" h={11} />
              <SkeletonLine w="28%" h={11} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* Error */
  if (pfError) {
    return (
      <div className={SURFACE}>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs uppercase tracking-widest text-muted-foreground/30">
            Unable to load
          </span>
        </div>
      </div>
    );
  }

  /* Render */
  return (
    <div className={SURFACE}>
      <div className="flex items-center justify-between">
        <span className="text-[length:var(--text-compact)] font-medium tracking-wider text-muted-foreground">
          Perps + Spot + Vaults
        </span>
        <NativeSelect
          size="sm"
          aria-label="Timeframe"
          value={tf}
          onChange={(e) => setTf(e.target.value as Timeframe)}
          className="h-7 min-w-[4.5rem] text-xs tabular-nums border-border/30 bg-background/70 hover:bg-muted/40 focus-visible:ring-ring/25"
        >
          {PERIOD_KEYS.map((p) => (
            <NativeSelectOption key={p} value={p}>
              {PERIOD_LABELS[p]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="overflow-y-auto flex-1 flex flex-col gap-[clamp(0.5rem,1vw,1rem)]">
        <Row
          label="PNL"
          value={
            perps && perps.pnl !== 0
              ? `${perps.pnl >= 0 ? "+" : ""}$${Math.abs(perps.pnl).toFixed(2)}`
              : "$0.00"
          }
          accent={perps && perps.pnl > 0 ? "gain" : perps && perps.pnl < 0 ? "loss" : null}
        />
        <Row
          label="Volume"
          value={
            perps
              ? `$${Number(perps.volume).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "$0.00"
          }
        />
        <Row
          label="Max Drawdown"
          value={perps && perps.maxDd !== null ? (perps.maxDd * 100).toFixed(2) + "%" : "0.00%"}
          accent={perps && perps.maxDd !== null && perps.maxDd < 0 ? "loss" : null}
        />
        <Row
          label="Total Equity"
          value={`$${((perps?.accountValue ?? 0) + (spot?.totalUsdc ?? 0)).toFixed(2)}`}
        />
        <Row label="Trading Equity" value={`$${(perps?.accountValue ?? 0).toFixed(2)}`} />
        <Row label="Vault Equity" value={`$${(vaults?.totalEquity ?? 0).toFixed(2)}`} />
        <Row label="Earn Balance" value="$0.00" />
        <Row label="Staking Account" value="0 HYPE" />
      </div>
    </div>
  );
}
