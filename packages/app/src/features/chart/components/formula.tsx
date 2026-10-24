import { BlockMath } from "react-katex";
import { tokenize } from "../utils/formula-utils";

interface IndicatorFormulaProps {
  value: string;
}

export function IndicatorFormula({ value }: IndicatorFormulaProps) {
  const isDirectLatex =
    value.includes("\\") || value.includes("{") || value.includes("_") || value.includes("^");

  if (!isDirectLatex) {
    return <p className="text-sm text-muted-foreground select-none">{value}</p>;
  }

  const equations = tokenize(value);
  const seen = new Map<string, number>();

  return (
    <div className="rounded-xl bg-transparent p-[clamp(0.75rem,1vw,1rem)] overflow-x-auto overscroll-none space-y-2">
      {equations.map((eq) => {
        const occurrence = (seen.get(eq) ?? 0) + 1;
        seen.set(eq, occurrence);
        return (
          <div
            key={`${eq}#${occurrence}`}
            className="min-h-[1.5rem] flex items-center justify-center"
          >
            <BlockMath math={eq} />
          </div>
        );
      })}
    </div>
  );
}
