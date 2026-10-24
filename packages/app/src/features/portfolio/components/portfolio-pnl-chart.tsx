import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  XAxis,
  Tooltip,
} from "recharts";

import { cn } from "cn";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EmptyState } from "@/components/empty-state";

import { usePortfolio } from "../hooks/use-portfolio-data";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PERIOD_LABELS,
  PERIOD_KEYS,
  isPortfolioPeriod,
  type PortfolioPeriod,
} from "../utils/constants";
import { formatAxis, formatSignedUsd } from "@/core/utils/formatters";
import { remToPx, subscribeRootFontSize } from "@/core/utils/rem";

type ChartView = "account-value" | "pnl" | "perps-pnl";

const VIEW_KEYS: ChartView[] = ["account-value", "pnl", "perps-pnl"];
const VIEW_LABELS: Record<ChartView, string> = {
  "account-value": "Account Value",
  pnl: "PnL",
  "perps-pnl": "Perps PnL",
};

function formatXAxisTick(ts: number): string {
  const date = new Date(ts > 1e12 ? ts : ts * 1000);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload?: { time?: number } }>;
}) {
  if (active !== true || payload === undefined || payload.length === 0) return null;
  const val = payload[0].value;
  const rawTs = payload[0].payload?.time;

  let dateStr = "";
  if (rawTs !== undefined && rawTs !== 0) {
    const ts = rawTs > 1e12 ? rawTs : rawTs * 1000;
    dateStr = new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="pointer-events-none rounded border border-[color:var(--tooltip-border)] bg-[color:var(--tooltip-bg)] px-2.5 py-1.5">
      {dateStr && (
        <span className="block text-[length:var(--text-data)] leading-normal text-[color:var(--chart-text)]">
          {dateStr}
        </span>
      )}
      <span
        className={cn(
          "block text-[length:var(--text-data)] font-semibold leading-normal tabular-nums",
          val >= 0 ? "text-gain" : "text-loss",
        )}
      >
        {formatSignedUsd(val)}
      </span>
    </div>
  );
}

const SURFACE =
  "h-full flex flex-col rounded-[var(--radius-panel)] p-4 tier-content animate-in fade-in duration-200 ease-premium gap-[clamp(0.5rem,1vw,1rem)]";

/** Both branches size the plot area from this one token so they cannot drift. */
const CHART_MIN_HEIGHT = "min-h-[clamp(120px,12vw,180px)]";

export function PortfolioPnLChart() {
  const { data: portfolio, isLoading, isError } = usePortfolio();

  const [chartView, setChartView] = useState<ChartView>("account-value");
  const [timePeriod, setTimePeriod] = useState<PortfolioPeriod>("month");

  const values = useMemo<[number, number][] | null>(() => {
    if (!portfolio) return null;
    const periodIndex =
      chartView === "perps-pnl"
        ? PERIOD_KEYS.indexOf(timePeriod) + 4
        : PERIOD_KEYS.indexOf(timePeriod);
    const entry = portfolio[periodIndex];
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

  const chartData = values ? values.map(([time, value]) => ({ time, value })) : null;

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

  const [, bumpRootFontEpoch] = useState(0);
  useEffect(
    () =>
      subscribeRootFontSize(() => {
        bumpRootFontEpoch((n) => n + 1);
      }),
    [],
  );

  const chartMarginPx = remToPx(1);
  const axisFontSizePx = remToPx(0.6875);
  const yAxisWidthPx = Math.round(remToPx(3.5));
  const tickGapPx = remToPx(2.5);

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
      <div className={SURFACE}>
        <div className="flex h-7 items-center justify-between">
          <div className="flex gap-[clamp(0.4rem,0.7vw,0.75rem)]">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <Skeleton className="h-3.5 w-14" />
        </div>
        <div className={cn("flex flex-1 items-center justify-center", CHART_MIN_HEIGHT)}>
          <Skeleton className={cn("w-full", CHART_MIN_HEIGHT)} />
        </div>
      </div>
    );
  }

  if (isError || !portfolio) {
    return (
      <div className={SURFACE}>
        <EmptyState
          variant="chart"
          title="No data"
          description="Connect your wallet to see your PnL history."
        />
      </div>
    );
  }

  return (
    <div className={SURFACE}>
      <div className="flex items-end justify-between">
        <div className="flex items-end">
          {VIEW_KEYS.map((key) => {
            const active = chartView === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setChartView(key);
                }}
                className={cn(
                  "text-[length:var(--text-compact)] font-medium px-2.5 pb-2 cursor-pointer transition-colors -mb-px",
                  active
                    ? "text-foreground border-b-2 border-foreground"
                    : "text-muted-foreground border-transparent hover:text-foreground",
                )}
              >
                {VIEW_LABELS[key]}
              </button>
            );
          })}
        </div>

        <NativeSelect
          size="sm"
          aria-label="Timeframe"
          value={timePeriod}
          onChange={(e) => {
            const val = e.target.value;
            setTimePeriod(isPortfolioPeriod(val) ? val : "month");
          }}
          className="h-7 min-w-[4.5rem] text-xs tabular-nums border-border/40 bg-background/70 hover:bg-muted/40 focus-visible:ring-ring/40"
        >
          {PERIOD_KEYS.map((p) => (
            <NativeSelectOption key={p} value={p}>
              {PERIOD_LABELS[p]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className={cn("flex flex-1 items-center justify-center", CHART_MIN_HEIGHT)}>
        {chartData ? (
          <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: chartMarginPx, right: chartMarginPx, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke="var(--chart-grid)" strokeOpacity={0.5} vertical={false} />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  scale="time"
                  axisLine={{ stroke: "var(--chart-border)", strokeWidth: 1 }}
                  tickLine={false}
                  tick={{ fontSize: axisFontSizePx, fill: "var(--chart-text)" }}
                  tickFormatter={formatXAxisTick}
                  {...(xAxisTicks !== null && { ticks: xAxisTicks })}
                  minTickGap={tickGapPx}
                />
                <YAxis
                  orientation="left"
                  axisLine={{ stroke: "var(--chart-border)", strokeWidth: 1 }}
                  tickLine={false}
                  width={yAxisWidthPx}
                  tick={{
                    fontSize: axisFontSizePx,
                    fill: "var(--chart-text)",
                    style: { fontVariantNumeric: "tabular-nums" },
                  }}
                  tickFormatter={formatAxis}
                  domain={[dataMin, dataMax]}
                  tickCount={4}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{
                    stroke: "var(--chart-crosshair)",
                    strokeWidth: 1,
                    strokeDasharray: "3 3",
                  }}
                  isAnimationActive={false}
                />
                <Line
                  type="stepAfter"
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
    </div>
  );
}
