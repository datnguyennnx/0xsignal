import { memo } from "react";
import { Card } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Skeleton } from "@/ui/skeleton";

interface IndicatorPanelProps {
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
    trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  } | null;
  stochastic?: {
    k: number;
    d: number;
    signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
    crossover: "BULLISH" | "BEARISH" | "NONE";
  } | null;
  bollinger?: {
    upperBand: number;
    middleBand: number;
    lowerBand: number;
    bandwidth: number;
    percentB: number;
  } | null;
  rsi?: {
    rsi: number;
    signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  } | null;
  loading?: boolean;
}

const IndicatorPanelComponent = ({
  macd,
  stochastic,
  bollinger,
  rsi,
  loading,
}: IndicatorPanelProps) => {
  if (loading) {
    return (
      <Card className="p-4 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <h3 className="text-sm font-semibold">Technical Indicators</h3>

      {macd && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">MACD</span>
            <Badge
              variant={
                macd.trend === "BULLISH"
                  ? "default"
                  : macd.trend === "BEARISH"
                    ? "destructive"
                    : "secondary"
              }
            >
              {macd.trend}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">MACD</div>
              <div className="font-medium">{macd.macd.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Signal</div>
              <div className="font-medium">{macd.signal.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Hist</div>
              <div className="font-medium">{macd.histogram.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      {stochastic && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Stochastic</span>
            <Badge
              variant={
                stochastic.signal === "OVERBOUGHT"
                  ? "destructive"
                  : stochastic.signal === "OVERSOLD"
                    ? "default"
                    : "secondary"
              }
            >
              {stochastic.signal}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">%K</div>
              <div className="font-medium">{stochastic.k.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">%D</div>
              <div className="font-medium">{stochastic.d.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Cross</div>
              <div className="font-medium text-xs">{stochastic.crossover}</div>
            </div>
          </div>
        </div>
      )}

      {bollinger && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Bollinger Bands</span>
            <span className="text-xs">{(bollinger.bandwidth * 100).toFixed(1)}% width</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">Upper</div>
              <div className="font-medium">{bollinger.upperBand.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Middle</div>
              <div className="font-medium">{bollinger.middleBand.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Lower</div>
              <div className="font-medium">{bollinger.lowerBand.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      {rsi && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">RSI</span>
            <Badge
              variant={
                rsi.signal === "OVERBOUGHT"
                  ? "destructive"
                  : rsi.signal === "OVERSOLD"
                    ? "default"
                    : "secondary"
              }
            >
              {rsi.signal}
            </Badge>
          </div>
          <div className="text-2xl font-bold">{rsi.rsi.toFixed(2)}</div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${rsi.rsi}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
};

export const IndicatorPanel = memo(IndicatorPanelComponent);
