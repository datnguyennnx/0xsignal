import { type IndicatorConfig } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { IndicatorFormula } from "./formula";

interface IndicatorInsightsPanelProps {
  indicator: IndicatorConfig;
  className?: string;
}

export function IndicatorInsightsPanel({ indicator, className }: IndicatorInsightsPanelProps) {
  return (
    <div className={cn("flex flex-col h-full overflow-hidden bg-background", className)}>
      <div className="p-6 flex flex-col gap-[clamp(0.75rem,1vw,1.5rem)]">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {indicator.name}
          </h3>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            {indicator.description}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-[clamp(1rem,2vw,1.5rem)] space-y-[clamp(1.5rem,3vw,2.5rem)] overscroll-none">
        <div className="space-y-[clamp(1rem,1.5vw,1.5rem)]">
          <div className="grid gap-[clamp(0.75rem,1.5vw,1.5rem)]">
            {indicator.usage.formula ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground/70">
                  Mathematical Engine
                </p>
                <IndicatorFormula value={indicator.usage.formula} />
              </div>
            ) : null}

            {indicator.usage.mathematicalWeaknesses ? (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground/70">
                  Structural Weaknesses
                </p>
                <p className="text-sm leading-relaxed">{indicator.usage.mathematicalWeaknesses}</p>
              </div>
            ) : null}

            {indicator.usage.regimePerformance ? (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground/70">Regime Robustness</p>
                <p className="text-sm leading-relaxed">{indicator.usage.regimePerformance}</p>
              </div>
            ) : null}

            {indicator.usage.tips?.length ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground/70">Pro Tips</p>
                <ul className="space-y-1.5">
                  {indicator.usage.tips.map((tip, idx) => (
                    <li
                      key={idx}
                      className="text-sm leading-relaxed text-muted-foreground flex gap-[clamp(0.25rem,0.5vw,0.5rem)]"
                    >
                      <span className="text-foreground/30">•</span> {tip}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {indicator.usage.pitfalls?.length ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground/70">Execution Pitfalls</p>
                <ul className="space-y-1.5">
                  {indicator.usage.pitfalls.map((pitfall, idx) => (
                    <li
                      key={idx}
                      className="text-sm leading-relaxed text-muted-foreground flex gap-[clamp(0.25rem,0.5vw,0.5rem)]"
                    >
                      <span className="text-foreground/30">•</span> {pitfall}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {indicator.usage.comparisons || indicator.usage.upgrades ? (
              <div className="space-y-5">
                {indicator.usage.comparisons && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground/70">
                      Institutional Comparison
                    </p>
                    <p className="text-sm text-muted-foreground italic leading-relaxed">
                      {indicator.usage.comparisons}
                    </p>
                  </div>
                )}
                {indicator.usage.upgrades && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground/70">
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
              <div className="p-[clamp(1rem,1.5vw,1.5rem)] rounded-xl bg-card/50">
                <p className="text-xs font-semibold text-muted-foreground/70 mb-1">
                  Implementation Spec
                </p>
                <p className="text-xs text-muted-foreground/60 leading-tight">
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
