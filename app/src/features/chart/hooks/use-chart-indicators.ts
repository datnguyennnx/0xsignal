import { useState, useEffect, useMemo } from "react";
import { useIndicatorWorker } from "@/core/workers/use-indicator-worker";

interface ChartDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  series: {
    macd: number[];
    signal: number[];
    histogram: number[];
  };
}

interface StochasticResult {
  k: number;
  d: number;
  signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  crossover: "BULLISH" | "BEARISH" | "NONE";
  series: {
    k: number[];
    d: number[];
  };
}

interface BollingerResult {
  upperBand: number;
  middleBand: number;
  lowerBand: number;
  bandwidth: number;
  percentB: number;
  series: {
    upper: number[];
    middle: number[];
    lower: number[];
  };
}

interface RSIResult {
  rsi: number;
  signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  series: number[];
}

interface IndicatorResults {
  macd: MACDResult | null;
  stochastic: StochasticResult | null;
  bollinger: BollingerResult | null;
  rsi: RSIResult | null;
  loading: boolean;
}

export const useChartIndicators = (
  chartData: ChartDataPoint[],
  enabledIndicators: {
    macd?: boolean;
    stochastic?: boolean;
    bollinger?: boolean;
    rsi?: boolean;
  } = {}
): IndicatorResults => {
  const { calculate } = useIndicatorWorker();
  const [results, setResults] = useState<IndicatorResults>({
    macd: null,
    stochastic: null,
    bollinger: null,
    rsi: null,
    loading: true,
  });

  const prices = useMemo(() => chartData.map((d) => d.close), [chartData]);
  const highs = useMemo(() => chartData.map((d) => d.high), [chartData]);
  const lows = useMemo(() => chartData.map((d) => d.low), [chartData]);

  useEffect(() => {
    if (chartData.length === 0) {
      setResults({
        macd: null,
        stochastic: null,
        bollinger: null,
        rsi: null,
        loading: false,
      });
      return;
    }

    const calculateIndicators = async () => {
      setResults((prev) => ({ ...prev, loading: true }));

      const promises: Promise<any>[] = [];

      if (enabledIndicators.macd) {
        promises.push(
          calculate<MACDResult>("MACD", {
            prices,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
          })
        );
      } else {
        promises.push(Promise.resolve(null));
      }

      if (enabledIndicators.stochastic) {
        promises.push(
          calculate<StochasticResult>("STOCHASTIC", {
            closes: prices,
            highs,
            lows,
            kPeriod: 14,
            dPeriod: 3,
          })
        );
      } else {
        promises.push(Promise.resolve(null));
      }

      if (enabledIndicators.bollinger) {
        promises.push(
          calculate<BollingerResult>("BOLLINGER", {
            prices,
            period: 20,
            stdDev: 2,
          })
        );
      } else {
        promises.push(Promise.resolve(null));
      }

      if (enabledIndicators.rsi) {
        promises.push(
          calculate<RSIResult>("RSI", {
            prices,
            period: 14,
          })
        );
      } else {
        promises.push(Promise.resolve(null));
      }

      const [macd, stochastic, bollinger, rsi] = await Promise.all(promises);

      setResults({
        macd,
        stochastic,
        bollinger,
        rsi,
        loading: false,
      });
    };

    calculateIndicators();
  }, [chartData, enabledIndicators, calculate, prices, highs, lows]);

  return results;
};
