import { useState, useMemo } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  XAxis,
  Tooltip,
} from "recharts";

import { cn } from "@/core/utils/cn";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { usePortfolio } from "../hooks/use-portfolio-data";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PERIOD_LABELS,
  PERIOD_KEYS,
  isPortfolioPeriod,
  type PortfolioPeriod,
} from "../utils/constants";

type ChartView = "account-value" | "pnl" | "perps-pnl";

const VIEW_KEYS: ChartView[] = ["account-value", "pnl", "perps-pnl"];
const VIEW_LABELS: Record<ChartView, string> = {
  "account-value": "Account Value",
  pnl: "PnL",
  "perps-pnl": "Perps PnL",
};

function formatCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (abs >= 1_000) return (v / 1_000).toFixed(2) + "K";
  return v.toFixed(2);
}

function formatAxisTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toFixed(0);
}

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
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const rawTs = payload[0]?.payload?.time as number | undefined;

  let dateStr = "";
  if (rawTs) {
    const ts = rawTs > 1e12 ? rawTs : rawTs * 1000;
    dateStr = new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div
      style={{
        background: "var(--tooltip-bg)",
        border: "1px solid var(--tooltip-border)",
        borderRadius: 4,
        padding: "6px 10px",
        pointerEvents: "none",
      }}
    >
      {dateStr && (
        <span
          style={{
            display: "block",
            fontSize: 12,
            color: "var(--chart-text)",
            lineHeight: 1.5,
          }}
        >
          {dateStr}
        </span>
      )}
      <span
        style={{
          display: "block",
          fontSize: 14,
          fontWeight: 600,
          color: val >= 0 ? "var(--gain)" : "var(--loss)",
          lineHeight: 1.5,
        }}
      >
        {val >= 0 ? "+" : ""}
        {formatCompact(val)}
      </span>
    </div>
  );
}

const SURFACE =
  "h-full flex flex-col rounded-xl border border-border/20 p-4 bg-card animate-in fade-in duration-200 ease-premium gap-[clamp(0.5rem,1vw,1rem)]";

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
    if (!entry) return null;
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
    let min = Infinity,
      max = -Infinity;
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

  const xAxisTicks = useMemo(() => {
    if (!values || values.length < 2) return undefined;
    const min = values[0][0];
    const max = values[values.length - 1][0];
    const count = 4;
    const step = (max - min) / count;
    return Array.from({ length: count + 1 }, (_, i) => +(min + step * i).toFixed(0));
  }, [values]);

  if (isLoading) {
    return (
      <div className={SURFACE}>
        <div className="flex justify-between">
          <div className="flex gap-[clamp(0.4rem,0.7vw,0.75rem)]">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <Skeleton className="w-14" style={{ height: 18 }} />
        </div>
        <div className="flex-1 flex items-center justify-center p-1.5 min-h-[clamp(80px,10vw,120px)]">
          <Skeleton className="w-full h-[120px]" />
        </div>
      </div>
    );
  }

  if (isError || !portfolio) {
    return (
      <div className={SURFACE}>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/30">
            Chart unavailable
          </span>
        </div>
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
                onClick={() => setChartView(key)}
                className={cn(
                  "text-[length:var(--text-compact)] font-medium px-2.5 pb-2 cursor-pointer transition-colors -mb-px",
                  active
                    ? "text-foreground border-b-2 border-foreground"
                    : "text-muted-foreground/50 border-transparent hover:text-muted-foreground",
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
          className="h-7 min-w-[4.5rem] text-xs tabular-nums border-border/30 bg-background/70 hover:bg-muted/40 focus-visible:ring-ring/25"
        >
          {PERIOD_KEYS.map((p) => (
            <NativeSelectOption key={p} value={p}>
              {PERIOD_LABELS[p]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="flex-1 min-h-[clamp(120px,12vw,180px)]">
        {chartData ? (
          <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeOpacity={0.5} vertical={false} />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  scale="time"
                  axisLine={{ stroke: "var(--chart-border)", strokeWidth: 1 }}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--chart-text)" }}
                  tickFormatter={formatXAxisTick}
                  ticks={xAxisTicks}
                  minTickGap={40}
                />
                <YAxis
                  orientation="left"
                  axisLine={{ stroke: "var(--chart-border)", strokeWidth: 1 }}
                  tickLine={false}
                  width={56}
                  tick={{ fontSize: 11, fill: "var(--chart-text)" }}
                  tickFormatter={formatAxisTick}
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
          <div className="flex items-center justify-center h-full">
            <span className="text-xs text-muted-foreground/30 uppercase tracking-widest">
              No data
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
