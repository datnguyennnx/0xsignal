import * as katexStyles from "katex/dist/katex.min.css";
import { BlockMath } from "react-katex";
import { tokenize } from "../utils/formula-utils";

void katexStyles;

interface IndicatorFormulaProps {
  value: string;
}

export function IndicatorFormula({ value }: IndicatorFormulaProps) {
  const isDirectLatex =
    value.includes("\\") || value.includes("{") || value.includes("_") || value.includes("^");

  if (!isDirectLatex) {
    return <p className="type-body text-muted-foreground select-none">{value}</p>;
  }

  const equations = tokenize(value);
  const seen = new Map<string, number>();

  return (
    <div className="rounded-panel bg-transparent p-panel space-y-2 overflow-x-auto overscroll-none">
      {equations.map((eq) => {
        const occurrence = (seen.get(eq) ?? 0) + 1;
        seen.set(eq, occurrence);
        return (
          <div
            key={`${eq}#${occurrence}`}
            className="flex min-h-(--control-h) items-center justify-center"
          >
            <BlockMath math={eq} />
          </div>
        );
      })}
    </div>
  );
}
