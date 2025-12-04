import { memo, useMemo } from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/core/utils/cn";
import type { ICTAnalysisResult } from "@/core/workers/ict-worker";
import type { ICTVisibility } from "../types";

interface ICTLegendProps {
  analysis: ICTAnalysisResult | null;
  visibility: ICTVisibility;
  className?: string;
}

interface LegendItem {
  label: string;
  shortLabel: string;
  count: number;
  color: string;
  tooltip: string;
}

const getTrendColor = (trend: string) =>
  trend === "bullish" ? "text-gain" : trend === "bearish" ? "text-loss" : "text-muted-foreground";
const getTrendArrow = (trend: string) =>
  trend === "bullish" ? "↑" : trend === "bearish" ? "↓" : "—";

export const ICTLegend = memo(function ICTLegend({
  analysis,
  visibility,
  className,
}: ICTLegendProps) {
  const items = useMemo((): LegendItem[] => {
    if (!analysis) return [];
    const result: LegendItem[] = [];

    if (visibility.marketStructure && analysis.marketStructure.events.length > 0) {
      const bosCount = analysis.marketStructure.events.filter((e) => e.type === "BOS").length;
      const chochCount = analysis.marketStructure.events.filter((e) => e.type === "ChoCH").length;
      const trend = analysis.marketStructure.currentTrend;
      result.push({
        label: "Market Structure",
        shortLabel: `MS ${getTrendArrow(trend)}`,
        count: analysis.marketStructure.swings.length,
        color: getTrendColor(trend),
        tooltip: `${analysis.marketStructure.swings.length} swings, ${bosCount} BOS, ${chochCount} ChoCH | Trend: ${trend}`,
      });
    }

    if (visibility.fvg && analysis.fvgs.length > 0) {
      const unfilled = analysis.fvgs.filter((f) => !f.filled);
      const bullish = unfilled.filter((f) => f.type === "bullish").length;
      const bearish = unfilled.filter((f) => f.type === "bearish").length;
      result.push({
        label: "Fair Value Gaps",
        shortLabel: `FVG ${unfilled.length}`,
        count: unfilled.length,
        color: bullish > bearish ? "text-gain" : bearish > bullish ? "text-loss" : "text-warn",
        tooltip: `${unfilled.length} unfilled FVGs (${bullish} bullish, ${bearish} bearish)`,
      });
    }

    if (visibility.orderBlocks && analysis.orderBlocks.length > 0) {
      const active = analysis.orderBlocks.filter((ob) => !ob.mitigated);
      const bullish = active.filter((ob) => ob.type === "bullish").length;
      const bearish = active.filter((ob) => ob.type === "bearish").length;
      result.push({
        label: "Order Blocks",
        shortLabel: `OB ${active.length}`,
        count: active.length,
        color:
          bullish > bearish
            ? "text-gain"
            : bearish > bullish
              ? "text-loss"
              : "text-muted-foreground",
        tooltip: `${active.length} active OBs (${bullish} demand, ${bearish} supply)`,
      });
    }

    if (visibility.liquidity && analysis.liquidityZones.length > 0) {
      const unswept = analysis.liquidityZones.filter((z) => !z.swept);
      const bsl = unswept.filter((z) => z.type === "BSL").length;
      const ssl = unswept.filter((z) => z.type === "SSL").length;
      result.push({
        label: "Liquidity",
        shortLabel: `LIQ ${unswept.length}`,
        count: unswept.length,
        color: "text-muted-foreground",
        tooltip: `${unswept.length} unswept zones (${bsl} BSL, ${ssl} SSL)`,
      });
    }

    if (visibility.ote && analysis.oteZones.length > 0) {
      const latest = analysis.oteZones[analysis.oteZones.length - 1];
      result.push({
        label: "OTE Zone",
        shortLabel: `OTE ${latest.direction === "bullish" ? "↑" : "↓"}`,
        count: analysis.oteZones.length,
        color: "text-warn",
        tooltip: `Golden Pocket: ${latest.goldenPocketHigh.toFixed(2)} - ${latest.goldenPocketLow.toFixed(2)}`,
      });
    }

    return result;
  }, [analysis, visibility]);

  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((item) => (
        <Tooltip key={item.label}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium bg-background/80 backdrop-blur-sm border border-border/50 cursor-default",
                item.color
              )}
            >
              {item.shortLabel}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[200px]">
            <p className="font-medium">{item.label}</p>
            <p className="text-muted-foreground">{item.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
});
