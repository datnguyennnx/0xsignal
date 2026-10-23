import { type IndicatorConfig } from "@0xsignal/shared";
import { cn } from "cn";
import { IndicatorFormula } from "./formula";

interface IndicatorInsightsPanelProps {
  indicator: IndicatorConfig;
  className?: string;
}

const hasText = (value: string | null | undefined): value is string =>
  value !== null && value !== undefined && value !== "";

export function IndicatorInsightsPanel({ indicator, className }: IndicatorInsightsPanelProps) {
  const { usage } = indicator;
  const tips = usage.tips ?? [];
  const pitfalls = usage.pitfalls ?? [];

  return (
    <div className={cn("flex flex-col h-full overflow-hidden material-base", className)}>
      <div className="p-6 flex flex-col gap-[clamp(0.75rem,1vw,1.5rem)]">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {indicator.name}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{indicator.description}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-[clamp(1rem,2vw,1.5rem)] space-y-[clamp(1.5rem,3vw,2.5rem)] overscroll-none">
        <div className="space-y-[clamp(1rem,1.5vw,1.5rem)]">
          <div className="grid gap-[clamp(0.75rem,1.5vw,1.5rem)]">
            {hasText(usage.formula) ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Mathematical Engine</p>
                <IndicatorFormula value={usage.formula} />
              </div>
            ) : null}

            {hasText(usage.mathematicalWeaknesses) ? (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Structural Weaknesses</p>
                <p className="text-sm leading-relaxed">{usage.mathematicalWeaknesses}</p>
              </div>
            ) : null}

            {hasText(usage.regimePerformance) ? (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Regime Robustness</p>
                <p className="text-sm leading-relaxed">{usage.regimePerformance}</p>
              </div>
            ) : null}

            {tips.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Pro Tips</p>
                <ul className="space-y-1.5">
                  {tips.map((tip) => (
                    <li
                      key={tip}
                      className="text-sm leading-relaxed text-muted-foreground flex gap-[clamp(0.25rem,0.5vw,0.5rem)]"
                    >
                      <span className="text-foreground/30">•</span> {tip}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {pitfalls.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Execution Pitfalls</p>
                <ul className="space-y-1.5">
                  {pitfalls.map((pitfall) => (
                    <li
                      key={pitfall}
                      className="text-sm leading-relaxed text-muted-foreground flex gap-[clamp(0.25rem,0.5vw,0.5rem)]"
                    >
                      <span className="text-foreground/30">•</span> {pitfall}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {hasText(usage.comparisons) || hasText(usage.upgrades) ? (
              <div className="space-y-5">
                {hasText(usage.comparisons) ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Institutional Comparison
                    </p>
                    <p className="text-sm text-muted-foreground italic leading-relaxed">
                      {usage.comparisons}
                    </p>
                  </div>
                ) : null}
                {hasText(usage.upgrades) ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Architectural Upgrades
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {usage.upgrades}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {hasText(indicator.implementationNotesForDev) ? (
              <div className="p-[clamp(1rem,1.5vw,1.5rem)] rounded-xl material-raised">
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  Implementation Spec
                </p>
                <p className="text-xs text-muted-foreground leading-tight">
                  {indicator.implementationNotesForDev}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
