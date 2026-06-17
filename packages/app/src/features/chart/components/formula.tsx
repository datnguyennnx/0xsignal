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

  return (
    <div className="rounded-xl bg-background p-[clamp(0.75rem,1vw,1rem)] overflow-x-auto overscroll-none space-y-2">
      {equations.map((eq, i) => (
        <div key={i} className="min-h-[1.5rem] flex items-center justify-center">
          <BlockMath math={eq} />
        </div>
      ))}
    </div>
  );
}
