import { memo, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { Surface } from "@/components/surface/surface";
import { Segmented } from "@/components/ui/segmented";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";

import { usePortfolio, useWhalePortfolio } from "../hooks/use-portfolio-data";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PERIOD_LABELS,
  PERIOD_KEYS,
  periodSlot,
  PERPS_PERIOD,
  isPortfolioPeriod,
  type PortfolioPeriod,
} from "../utils/constants";
import { formatAxis, formatCompactUsd, formatSignedUsd } from "@/core/utils/formatters";
import { getRootFontSizePx, remToPxAt, subscribeRootFontSize } from "@/core/utils/rem";
import { SURFACE } from "./portfolio-summary.constants";

type RechartsModule = typeof import("recharts");

/** Recharts stays in its own chunk so the portfolio route shell ships without it. */
function useRecharts(): RechartsModule | null {
  const [mod, setMod] = useState<RechartsModule | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await import("recharts");
        if (active) setMod(loaded);
      } catch {
        // Leave the skeleton in place; the chunk failed to load.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return mod;
}

type ChartView = "account-value" | "pnl" | "perps-pnl";

const VIEW_KEYS: ChartView[] = ["account-value", "pnl", "perps-pnl"];
const VIEW_LABELS: Record<ChartView, string> = {
  "account-value": "Account Value",
  pnl: "PnL",
  "perps-pnl": "Perps PnL",
};
const VIEW_OPTIONS = VIEW_KEYS.map((key) => ({ value: key, label: VIEW_LABELS[key] }));

function formatXAxisTick(ts: number): string {
  const date = new Date(ts > 1e12 ? ts : ts * 1000);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChartTooltip({
  active,
  payload,
  signed,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload?: { time?: number } }>;
  signed: boolean;
}) {
  if (active !== true || payload === undefined || payload.length === 0) return null;
  const val = payload[0].value;
  const rawTs = payload[0].payload?.time;

  let dateStr = "";
  if (rawTs !== undefined && rawTs !== 0) {
    const ts = rawTs > 1e12 ? rawTs : rawTs * 1000;
    dateStr = new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const valueTone = signed ? (val >= 0 ? "text-gain" : "text-loss") : "text-foreground";

  return (
    <div className="hl-trade-tooltip">
      {dateStr && (
        <span className="block type-data leading-normal text-(--data-axis)">{dateStr}</span>
      )}
      <span className={`block type-data font-semibold leading-normal tabular-nums ${valueTone}`}>
        {signed ? formatSignedUsd(val) : formatCompactUsd(val)}
      </span>
    </div>
  );
}

/** Both branches size the plot area from this one token so they cannot drift. */
const CHART_MIN_HEIGHT = "min-h-(--panel-state-min-h)";

/** Static axis chrome: one object identity so Recharts sees no change between renders. */
const AXIS_LINE = { stroke: "var(--data-grid)", strokeWidth: 1 };
const TOOLTIP_CURSOR = { stroke: "var(--data-crosshair)", strokeWidth: 1, strokeDasharray: "3 3" };

export const PortfolioPnLChart = memo(function PortfolioPnLChart({
  readOnlyAddress,
  period: timePeriod,
  onPeriodChange,
}: {
  readOnlyAddress?: string | undefined;
  period: PortfolioPeriod;
  onPeriodChange: (period: PortfolioPeriod) => void;
}) {
  const isOwn = readOnlyAddress === undefined;
  const ownPortfolio = usePortfolio(isOwn);
  const whalePortfolio = useWhalePortfolio(readOnlyAddress);
  const { data: portfolio, isLoading, isError, refetch } = isOwn ? ownPortfolio : whalePortfolio;

  const [chartView, setChartView] = useState<ChartView>("account-value");
  const recharts = useRecharts();

  const values = useMemo<[number, number][] | null>(() => {
    if (!portfolio) return null;
    const periodKey = chartView === "perps-pnl" ? PERPS_PERIOD[timePeriod] : timePeriod;
    const entry = portfolio[periodSlot(periodKey)];
    if (entry === undefined) return null;
    const period = entry[1];
    const rawData: [number, string][] =
      chartView === "account-value" ? period.accountValueHistory : period.pnlHistory;
    const result: [number, number][] = [];
    for (let i = 0; i < rawData.length; i++) {
      const ts = rawData[i][0];
      const val = Number(rawData[i][1]);
      if (ts > 0 && Number.isFinite(val)) result.push([ts, val]);
    }
    return result.length > 0 ? result : null;
  }, [portfolio, chartView, timePeriod]);

  const chartData = useMemo(
    () => (values === null ? null : values.map(([time, value]) => ({ time, value }))),
    [values],
  );

  const [dataMin, dataMax] = useMemo(() => {
    if (!values) return [0, 0];
    let max = -Infinity;
    let min = Infinity;
    for (const [, v] of values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = max - min;
    if (range === 0) {
      const pad = Math.max(Math.abs(min) * 0.01, 1);
      return [min - pad, max + pad];
    }
    return [min - range * 0.12, max + range * 0.12];
  }, [values]);

  // A resize that leaves the root size unchanged notifies but must not commit;
  // `useSyncExternalStore` compares the snapshot and bails out.
  const rootFontSizePx = useSyncExternalStore(
    subscribeRootFontSize,
    getRootFontSizePx,
    getRootFontSizePx,
  );

  const chartMarginPx = remToPxAt(1, rootFontSizePx);
  const axisFontSizePx = remToPxAt(0.75, rootFontSizePx);
  const yAxisWidthPx = Math.round(remToPxAt(3.5, rootFontSizePx));
  const tickGapPx = remToPxAt(2.5, rootFontSizePx);

  const chartMargin = useMemo(
    () => ({ top: chartMarginPx, right: chartMarginPx, bottom: 0, left: 0 }),
    [chartMarginPx],
  );
  const xAxisTick = useMemo(
    () => ({ fontSize: axisFontSizePx, fill: "var(--data-axis)" }),
    [axisFontSizePx],
  );
  const yAxisTick = useMemo(
    () => ({
      fontSize: axisFontSizePx,
      fill: "var(--data-axis)",
      style: { fontVariantNumeric: "tabular-nums" as const },
    }),
    [axisFontSizePx],
  );
  const yAxisDomain = useMemo<[number, number]>(() => [dataMin, dataMax], [dataMin, dataMax]);

  const xAxisTicks = useMemo(() => {
    if (!values || values.length < 2) return null;
    const first = values.at(0);
    const last = values.at(-1);
    if (first === undefined || last === undefined) return null;
    const min = first[0];
    const max = last[0];
    const count = 4;
    const step = (max - min) / count;
    return Array.from({ length: count + 1 }, (_, i) => +(min + step * i).toFixed(0));
  }, [values]);

  if (isLoading) {
    return (
      <Surface tier="content" className={SURFACE}>
        <div className="flex h-control items-center justify-between">
          <div className="flex gap-inline">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <Skeleton className="h-3.5 w-14" />
        </div>
        <div className={`flex flex-1 items-center justify-center ${CHART_MIN_HEIGHT}`}>
          <Skeleton className={`w-full ${CHART_MIN_HEIGHT}`} />
        </div>
      </Surface>
    );
  }

  if (isError) {
    return (
      <Surface tier="content" className={SURFACE}>
        <ErrorState
          title="Unable to load PnL"
          description={
            isOwn
              ? "Your PnL history could not be loaded. Please try again."
              : "This account's PnL history could not be loaded. Please try again."
          }
          retryAction={() => {
            void refetch();
          }}
        />
      </Surface>
    );
  }

  if (!portfolio) {
    return (
      <Surface tier="content" className={SURFACE}>
        <EmptyState
          variant="chart"
          title="No data"
          description={
            isOwn
              ? "Connect your wallet to see your PnL history."
              : "No PnL history for this account."
          }
        />
      </Surface>
    );
  }

  if (recharts === null) {
    return (
      <Surface tier="content" className={SURFACE}>
        <div className={`flex flex-1 items-center justify-center ${CHART_MIN_HEIGHT}`}>
          <Skeleton className={`w-full ${CHART_MIN_HEIGHT}`} />
        </div>
      </Surface>
    );
  }

  const { CartesianGrid, ResponsiveContainer, LineChart, Line, YAxis, XAxis, Tooltip } = recharts;

  return (
    <Surface tier="content" className={SURFACE}>
      <div data-dense className="flex items-end justify-between">
        <Segmented
          aria-label="Chart view"
          value={chartView}
          options={VIEW_OPTIONS}
          onValueChange={setChartView}
        />

        <NativeSelect
          aria-label="Timeframe"
          value={timePeriod}
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

      <div className={`flex flex-1 items-center justify-center ${CHART_MIN_HEIGHT}`}>
        {chartData ? (
          <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={chartMargin}>
                <CartesianGrid stroke="var(--data-grid)" strokeOpacity={0.5} vertical={false} />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  scale="time"
                  axisLine={AXIS_LINE}
                  tickLine={false}
                  tick={xAxisTick}
                  tickFormatter={formatXAxisTick}
                  {...(xAxisTicks !== null && { ticks: xAxisTicks })}
                  minTickGap={tickGapPx}
                />
                <YAxis
                  orientation="left"
                  axisLine={AXIS_LINE}
                  tickLine={false}
                  width={yAxisWidthPx}
                  tick={yAxisTick}
                  tickFormatter={formatAxis}
                  domain={yAxisDomain}
                  tickCount={4}
                />
                <Tooltip
                  content={<ChartTooltip signed={chartView !== "account-value"} />}
                  cursor={TOOLTIP_CURSOR}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--foreground)"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState variant="chart" />
        )}
      </div>
    </Surface>
  );
});
