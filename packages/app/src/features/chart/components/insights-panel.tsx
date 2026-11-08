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
    <div className={cn("flex flex-col h-full overflow-hidden bg-transparent", className)}>
      <div className="p-panel flex flex-col gap-field">
        <div className="flex flex-col gap-field">
          <h3 className="flex items-center gap-field type-body font-semibold text-foreground">
            {indicator.name}
          </h3>
          <p className="type-label text-muted-foreground leading-relaxed">
            {indicator.description}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-panel space-y-section overscroll-none">
        <div className="flex flex-col gap-section">
          <div className="grid gap-stack">
            {hasText(usage.formula) ? (
              <div className="flex flex-col gap-field">
                <p className="type-label font-semibold text-muted-foreground">
                  Mathematical Engine
                </p>
                <IndicatorFormula value={usage.formula} />
              </div>
            ) : null}

            {hasText(usage.mathematicalWeaknesses) ? (
              <div className="flex flex-col gap-field">
                <p className="type-label font-semibold text-muted-foreground">
                  Structural Weaknesses
                </p>
                <p className="type-body leading-relaxed">{usage.mathematicalWeaknesses}</p>
              </div>
            ) : null}

            {hasText(usage.regimePerformance) ? (
              <div className="flex flex-col gap-field">
                <p className="type-label font-semibold text-muted-foreground">Regime Robustness</p>
                <p className="type-body leading-relaxed">{usage.regimePerformance}</p>
              </div>
            ) : null}

            {tips.length > 0 ? (
              <div className="flex flex-col gap-field">
                <p className="type-label font-semibold text-muted-foreground">Pro Tips</p>
                <ul className="flex flex-col gap-field">
                  {tips.map((tip) => (
                    <li
                      key={tip}
                      className="type-body leading-relaxed text-muted-foreground flex gap-1"
                    >
                      <span className="text-foreground/40">•</span> {tip}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {pitfalls.length > 0 ? (
              <div className="flex flex-col gap-field">
                <p className="type-label font-semibold text-muted-foreground">Execution Pitfalls</p>
                <ul className="flex flex-col gap-field">
                  {pitfalls.map((pitfall) => (
                    <li
                      key={pitfall}
                      className="type-body leading-relaxed text-muted-foreground flex gap-1"
                    >
                      <span className="text-foreground/40">•</span> {pitfall}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {hasText(usage.comparisons) || hasText(usage.upgrades) ? (
              <div className="space-y-section">
                {hasText(usage.comparisons) ? (
                  <div className="flex flex-col gap-field">
                    <p className="type-label font-semibold text-muted-foreground">
                      Institutional Comparison
                    </p>
                    <p className="type-body text-muted-foreground italic leading-relaxed">
                      {usage.comparisons}
                    </p>
                  </div>
                ) : null}
                {hasText(usage.upgrades) ? (
                  <div className="flex flex-col gap-field">
                    <p className="type-label font-semibold text-muted-foreground">
                      Architectural Upgrades
                    </p>
                    <p className="type-body text-muted-foreground leading-relaxed">
                      {usage.upgrades}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {hasText(indicator.implementationNotesForDev) ? (
              <div className="p-panel rounded-panel bg-secondary">
                <p className="type-label font-semibold text-muted-foreground mb-label">
                  Implementation Spec
                </p>
                <p className="type-label text-muted-foreground leading-tight">
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
