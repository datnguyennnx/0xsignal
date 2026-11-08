import { useState, type JSX } from "react";
// react-doctor-disable-next-line react-doctor/prefer-dynamic-import -- this module is only reached through the panel's lazy()
import { Pie, PieChart, ResponsiveContainer } from "recharts";

import { formatCompactUsd } from "@/core/utils/formatters";

import { sharePercent, sharePercentLabel } from "../hooks/use-coin-market";

const DONUT_INNER_RADIUS = "76%";
// Inset from the box edge so the 1px hover stroke is not clipped by the svg viewport.
const DONUT_OUTER_RADIUS = "96%";
const TONE_LONG = "var(--market-up)";
const TONE_SHORT = "var(--market-down)";
// A full-circle base, so a thin ring reads as a dial with a scale rather than a floating arc.
const TRACK_TONE = "var(--muted-foreground)";
const TRACK_OPACITY = 0.12;
const SLICE_OPACITY = 0.88;
const TRACK_DATA = [{ label: "track", value: 1 }];

type Side = "long" | "short";

interface DonutSlice {
  side: Side;
  notional: number;
  fill: string;
  fillOpacity: number;
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

/** Slices sit a step under the raw token: at this size full intensity reads as an alarm light. */
function sliceTone(side: Side): string {
  return side === "long" ? TONE_LONG : TONE_SHORT;
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
    fillOpacity: SLICE_OPACITY,
    stroke: active ? "var(--foreground)" : "none",
    strokeOpacity: active ? 0.25 : 0,
    strokeWidth: 1,
    style: { transition: "stroke 120ms" },
  };
}

export function LongShortDonut({ long, short }: LongShortDonutProps): JSX.Element {
  const [hovered, setHovered] = useState<Side | null>(null);
  const total = long.notional + short.notional;
  const hasData = total > 0;

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
    <div className="flex flex-col items-center gap-inline">
      <div
        role={hasData ? "img" : undefined}
        aria-label={hasData ? ariaLabel : undefined}
        className="relative aspect-square w-(--donut-size) max-w-full"
      >
        {hasData ? (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart
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
                  fillOpacity={TRACK_OPACITY}
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
            </ResponsiveContainer>
            {/* Digits carry no descender, so the pair needs a single pixel of drop to look centred. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex w-2/3 translate-y-px flex-col items-center gap-1 text-center">
                <span
                  className="max-w-full truncate type-title leading-none font-semibold tabular-nums"
                  style={{ color: shown === "long" ? TONE_LONG : TONE_SHORT }}
                >
                  {centrePercent(shownSplit.notional, shownPercent)}
                </span>
                <span className="max-w-full truncate type-label leading-none tracking-wide text-muted-foreground uppercase">
                  {shown}
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="flex h-full items-center justify-center px-2 text-center type-label text-muted-foreground">
            No tracked long or short notional.
          </p>
        )}
      </div>
      {hasData && (
        <p className="min-h-4 text-center type-label tracking-wide tabular-nums text-muted-foreground">
          {detailLabel}
        </p>
      )}
    </div>
  );
}
