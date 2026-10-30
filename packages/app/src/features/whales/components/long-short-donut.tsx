import { useState, type JSX } from "react";
// react-doctor-disable-next-line react-doctor/prefer-dynamic-import -- this module is only reached through the panel's lazy()
import { Pie, PieChart } from "recharts";

import { formatCompactUsd } from "@/core/utils/formatters";

import { sharePercent, sharePercentLabel } from "../hooks/use-coin-market";

const DONUT_SIZE_PX = 108;
const DONUT_INNER_RADIUS = "76%";
const DONUT_OUTER_RADIUS = "100%";
// The chart pair, with the older gain/loss pair as the fallback for themes without it.
const TONE_LONG = "var(--data-up, var(--gain))";
const TONE_SHORT = "var(--data-down, var(--loss))";
// A full-circle base, so a thin ring reads as a dial with a scale rather than a floating arc.
const TRACK_TONE = "color-mix(in oklab, var(--muted-foreground) 12%, transparent)";
const TRACK_DATA = [{ label: "track", value: 1 }];

type Side = "long" | "short";

interface DonutSlice {
  side: Side;
  notional: number;
  fill: string;
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number;
  style: { transition: string };
}

interface SplitSide {
  notional: number;
  count: number;
}

interface LongShortDonutProps {
  long: SplitSide;
  short: SplitSide;
}

function sideTone(side: Side): string {
  return side === "long" ? TONE_LONG : TONE_SHORT;
}

/** Slices sit a step under the raw token: at this size full intensity reads as an alarm light. */
function sliceTone(side: Side): string {
  return `color-mix(in oklab, ${sideTone(side)} 88%, transparent)`;
}

function countLabel(count: number): string {
  return count === 1 ? "1 position" : `${count} positions`;
}

/** A zero side prints `0%`, which the shared label would floor to `<1%`. */
function centrePercent(notional: number, percent: number | null): string {
  return notional === 0 ? "0%" : sharePercentLabel(percent);
}

/** Recharts 3 spreads the datum into its sector, so the slice owns the Cell styling itself. */
function toSlice(side: Side, notional: number, hovered: Side | null): DonutSlice {
  const active = hovered === side;
  return {
    side,
    notional,
    fill: sliceTone(side),
    stroke: active ? "var(--foreground)" : "none",
    strokeOpacity: active ? 0.25 : 0,
    strokeWidth: 1,
    style: { transition: "stroke 120ms" },
  };
}

export function LongShortDonut({ long, short }: LongShortDonutProps): JSX.Element {
  const [hovered, setHovered] = useState<Side | null>(null);
  const total = long.notional + short.notional;

  if (!(total > 0)) {
    return <p className="text-xs text-muted-foreground">No tracked long or short notional.</p>;
  }

  const longPercent = sharePercent(long.notional, total);
  const shortPercent = sharePercent(short.notional, total);
  const dominant: Side = long.notional >= short.notional ? "long" : "short";
  const shown: Side = hovered ?? dominant;
  const shownSplit = shown === "long" ? long : short;
  const shownPercent = shown === "long" ? longPercent : shortPercent;
  const dominantPercent = dominant === "long" ? longPercent : shortPercent;
  const detailLabel =
    hovered === null
      ? `${sharePercentLabel(dominantPercent)} ${dominant}`
      : `${formatCompactUsd(shownSplit.notional)} · ${countLabel(shownSplit.count)}`;
  const slices: DonutSlice[] = [
    toSlice("long", long.notional, hovered),
    toSlice("short", short.notional, hovered),
  ];
  const ariaLabel = `Long short split: long ${sharePercentLabel(longPercent)}, ${formatCompactUsd(long.notional)}, ${countLabel(long.count)}; short ${sharePercentLabel(shortPercent)}, ${formatCompactUsd(short.notional)}, ${countLabel(short.count)}.`;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        role="img"
        aria-label={ariaLabel}
        className="relative"
        style={{ width: DONUT_SIZE_PX, height: DONUT_SIZE_PX }}
      >
        <PieChart
          width={DONUT_SIZE_PX}
          height={DONUT_SIZE_PX}
          accessibilityLayer={false}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <Pie
            data={TRACK_DATA}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            innerRadius={DONUT_INNER_RADIUS}
            outerRadius={DONUT_OUTER_RADIUS}
            fill={TRACK_TONE}
            stroke="none"
            isAnimationActive={false}
          />
          <Pie
            data={slices}
            dataKey="notional"
            nameKey="side"
            startAngle={90}
            endAngle={-270}
            innerRadius={DONUT_INNER_RADIUS}
            outerRadius={DONUT_OUTER_RADIUS}
            stroke="none"
            isAnimationActive={false}
            onMouseEnter={(_entry, index) => {
              setHovered(slices[index]?.side ?? null);
            }}
            onMouseLeave={() => {
              setHovered(null);
            }}
          />
        </PieChart>
        {/* Digits carry no descender, so the pair needs a single pixel of drop to look centred. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex w-[68%] translate-y-px flex-col items-center gap-0.5 text-center">
            <span
              className="max-w-full truncate text-lg leading-none font-semibold tabular-nums"
              style={{ color: sideTone(shown) }}
            >
              {centrePercent(shownSplit.notional, shownPercent)}
            </span>
            <span className="max-w-full truncate text-[0.6875rem] leading-none tracking-wide text-muted-foreground uppercase">
              {shown}
            </span>
          </div>
        </div>
      </div>
      <p className="h-4 text-center text-xs leading-4 tabular-nums text-muted-foreground">
        {detailLabel}
      </p>
    </div>
  );
}
