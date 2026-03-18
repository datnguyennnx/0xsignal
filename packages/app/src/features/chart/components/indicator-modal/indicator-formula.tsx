import { BlockMath } from "react-katex";

interface IndicatorFormulaProps {
  value: string;
}

export function IndicatorFormula({ value }: IndicatorFormulaProps) {
  // If the value contains LaTeX markers (like backslashes or curlies or subscripts),
  // assume it's direct LaTeX. Otherwise render as plain text.
  const isDirectLatex =
    value.includes("\\") || value.includes("{") || value.includes("_") || value.includes("^");

  if (!isDirectLatex) {
    return <p className="text-sm text-muted-foreground">{value}</p>;
  }

  return (
    <div className="rounded-xl border bg-background px-3 py-2 overflow-x-auto">
      <BlockMath math={value} />
    </div>
  );
}
