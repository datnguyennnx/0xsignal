import { cn } from "@/lib/utils";

interface IndicatorGridProps {
  indicators: {
    rsi: number;
    percentB: number;
    bollingerWidth: number;
    distanceFromMA: number;
    volumeROC: number;
    volumeToMarketCapRatio: number;
    dailyRange: number;
    athDistance: number;
  };
}

export function IndicatorGrid({ indicators }: IndicatorGridProps) {
  const getIndicatorColor = (
    value: number,
    type: "rsi" | "percentB" | "distance" | "volume" | "volatility"
  ) => {
    switch (type) {
      case "rsi":
        if (value > 70) return "text-red-600 dark:text-red-400";
        if (value < 30) return "text-green-600 dark:text-green-400";
        return "text-foreground";
      case "percentB":
        if (value > 0.8) return "text-red-600 dark:text-red-400";
        if (value < 0.2) return "text-green-600 dark:text-green-400";
        return "text-foreground";
      case "distance":
        if (Math.abs(value) > 5) return "text-orange-600 dark:text-orange-400";
        return "text-foreground";
      case "volume":
        if (Math.abs(value) > 50) return "text-purple-600 dark:text-purple-400";
        return "text-foreground";
      case "volatility":
        if (value > 10) return "text-red-600 dark:text-red-400";
        return "text-foreground";
    }
  };

  const getIndicatorInsight = (value: number, type: string) => {
    switch (type) {
      case "rsi":
        if (value > 70) return "Overbought - potential sell";
        if (value < 30) return "Oversold - potential buy";
        return "Neutral zone";
      case "percentB":
        if (value > 0.8) return "Near upper band - overbought";
        if (value < 0.2) return "Near lower band - oversold";
        return "Within normal range";
      case "distanceFromMA":
        if (value > 5) return "Extended above average";
        if (value < -5) return "Extended below average";
        return "Near moving average";
      case "volumeROC":
        if (Math.abs(value) > 50) return "Unusual volume activity";
        return "Normal volume";
      case "dailyRange":
        if (value > 10) return "High volatility";
        if (value < 2) return "Low volatility";
        return "Normal volatility";
      case "athDistance":
        if (value < 10) return "Near all-time high";
        if (value > 80) return "Deep correction";
        return "Mid-range";
      default:
        return "";
    }
  };

  const indicatorList = [
    {
      label: "RSI",
      value: indicators.rsi.toFixed(1),
      type: "rsi" as const,
      insight: getIndicatorInsight(indicators.rsi, "rsi"),
    },
    {
      label: "Percent B",
      value: (indicators.percentB * 100).toFixed(0) + "%",
      type: "percentB" as const,
      insight: getIndicatorInsight(indicators.percentB, "percentB"),
    },
    {
      label: "BB Width",
      value: indicators.bollingerWidth.toFixed(2) + "%",
      type: "volatility" as const,
      insight: "Band width measure",
    },
    {
      label: "Distance from MA",
      value: indicators.distanceFromMA.toFixed(1) + "%",
      type: "distance" as const,
      insight: getIndicatorInsight(indicators.distanceFromMA, "distanceFromMA"),
    },
    {
      label: "Volume ROC",
      value: indicators.volumeROC.toFixed(1) + "%",
      type: "volume" as const,
      insight: getIndicatorInsight(indicators.volumeROC, "volumeROC"),
    },
    {
      label: "Liquidity",
      value: (indicators.volumeToMarketCapRatio * 100).toFixed(2) + "%",
      type: "volume" as const,
      insight: "Volume/Market Cap ratio",
    },
    {
      label: "Daily Range",
      value: indicators.dailyRange.toFixed(2) + "%",
      type: "volatility" as const,
      insight: getIndicatorInsight(indicators.dailyRange, "dailyRange"),
    },
    {
      label: "ATH Distance",
      value: indicators.athDistance.toFixed(1) + "%",
      type: "volatility" as const,
      insight: getIndicatorInsight(indicators.athDistance, "athDistance"),
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {indicatorList.map((indicator) => (
        <div key={indicator.label} className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground mb-1">{indicator.label}</div>
          <div
            className={cn(
              "text-lg font-bold tabular-nums",
              getIndicatorColor(parseFloat(indicator.value), indicator.type)
            )}
          >
            {indicator.value}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{indicator.insight}</div>
        </div>
      ))}
    </div>
  );
}
