/**
 * @overview Indicator Insights Panel
 *
 * Renders detailed documentation and mathematical intuition for a specific technical indicator.
 * Displays formulas (via KaTeX), pro-tips, pitfalls, and regime performance notes.
 */
import { type IndicatorConfig } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { IndicatorFormula } from "./indicator-formula";

interface IndicatorInsightsPanelProps {
  indicator: IndicatorConfig;
  className?: string;
}

export function IndicatorInsightsPanel({ indicator, className }: IndicatorInsightsPanelProps) {
  return (
    <div className={cn("flex flex-col h-full overflow-hidden bg-background", className)}>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-1.5 py-0.5 rounded-xl bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
            Overlay
          </span>
          {indicator.overlayOnPrice && (
            <span className="px-1.5 py-0.5 rounded-xl bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
              Overlay
            </span>
          )}
        </div>
        <h3 className="text-xl font-bold">{indicator.name}</h3>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          {indicator.description}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 overscroll-none">
        <div className="space-y-6">
          <div className="grid gap-6">
            {indicator.usage.formula ? (
              <div className="space-y-3">
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">
                  Mathematical Engine
                </p>
                <IndicatorFormula value={indicator.usage.formula} />
              </div>
            ) : null}

            {indicator.usage.mathematicalWeaknesses ? (
              <div className="space-y-1.5 pt-2 border-t border-muted/20">
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">
                  Structural Weaknesses
                </p>
                <p className="text-sm leading-relaxed">{indicator.usage.mathematicalWeaknesses}</p>
              </div>
            ) : null}

            {indicator.usage.regimePerformance ? (
              <div className="space-y-1.5 pt-2 border-t border-muted/20">
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">
                  Regime Robustness
                </p>
                <p className="text-sm leading-relaxed">{indicator.usage.regimePerformance}</p>
              </div>
            ) : null}

            {indicator.usage.tips?.length ? (
              <div className="space-y-3 pt-2 border-t border-muted/20">
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">
                  Pro Tips
                </p>
                <ul className="space-y-1.5">
                  {indicator.usage.tips.map((tip, idx) => (
                    <li
                      key={idx}
                      className="text-[13px] leading-relaxed text-muted-foreground flex gap-2"
                    >
                      <span className="text-foreground/30">•</span> {tip}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {indicator.usage.pitfalls?.length ? (
              <div className="space-y-3 pt-2 border-t border-muted/20">
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">
                  Execution Pitfalls
                </p>
                <ul className="space-y-1.5">
                  {indicator.usage.pitfalls.map((pitfall, idx) => (
                    <li
                      key={idx}
                      className="text-[13px] leading-relaxed text-muted-foreground flex gap-2"
                    >
                      <span className="text-foreground/30">•</span> {pitfall}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {indicator.usage.comparisons || indicator.usage.upgrades ? (
              <div className="pt-6 space-y-5">
                {indicator.usage.comparisons && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">
                      Institutional Comparison
                    </p>
                    <p className="text-sm text-muted-foreground italic leading-relaxed">
                      {indicator.usage.comparisons}
                    </p>
                  </div>
                )}
                {indicator.usage.upgrades && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">
                      Architectural Upgrades
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {indicator.usage.upgrades}
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {indicator.implementationNotesForDev && (
              <div className="mt-4 p-3 rounded-xl bg-muted/10 border border-border/30">
                <p className="text-[9px] uppercase font-mono font-bold text-muted-foreground/40 mb-1">
                  Implementation Spec
                </p>
                <p className="text-[11px] font-mono text-muted-foreground/60 leading-tight">
                  {indicator.implementationNotesForDev}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
