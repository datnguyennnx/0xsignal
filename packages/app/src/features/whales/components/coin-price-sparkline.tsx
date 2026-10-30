import type { ChartDataPoint } from "@0xsignal/shared";

const TONE_LOSS = "var(--loss)";
const TONE_GAIN = "var(--gain)";
const FLAT_CENTER_Y = 50;

interface CoinPriceSparklineProps {
  candles: ChartDataPoint[];
}

type Point = readonly [x: number, y: number];

const FLAT_POINTS: Point[] = [
  [0, FLAT_CENTER_Y],
  [100, FLAT_CENTER_Y],
];

function toPoints(candles: ChartDataPoint[]): Point[] {
  const closes = candles.map((candle) => candle.close);
  if (closes.length < 2) return FLAT_POINTS;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  if (max === min) return FLAT_POINTS;
  return closes.map((close, index) => [
    (index / (closes.length - 1)) * 100,
    100 - ((close - min) / (max - min)) * 100,
  ]);
}

function toPath(points: Point[]): string {
  return `M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")}`;
}

export default function CoinPriceSparkline({ candles }: CoinPriceSparklineProps) {
  const first = candles.at(0);
  const last = candles.at(-1);
  const isDown = first !== undefined && last !== undefined && last.close < first.close;
  const tone = isDown ? TONE_LOSS : TONE_GAIN;
  const linePath = toPath(toPoints(candles));

  return (
    <svg
      className="h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={`${linePath} L 100 100 L 0 100 Z`} fill={tone} fillOpacity={0.16} />
      <path
        d={linePath}
        fill="none"
        stroke={tone}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
