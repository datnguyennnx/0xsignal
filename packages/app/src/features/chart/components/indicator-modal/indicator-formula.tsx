import { BlockMath } from "react-katex";

interface IndicatorFormulaProps {
  value: string;
}

const tokenize = (value: string): string[] => {
  // Store blocks and their unique placeholders
  const blocks: string[] = [];
  const placeholders: string[] = [];

  // Replace each \begin{...\} ... \end{...} with a unique placeholder
  // Using non-greedy match for content between begin and end
  const replaced = value.replace(/\\begin\{[^}]*}[\s\S]*?\\end\{[^}]*}/g, (match) => {
    const placeholder = `__BLOCK_${blocks.length}_${Math.random().toString(36).substring(2)}__`;
    blocks.push(match);
    placeholders.push(placeholder);
    return placeholder;
  });

  // Split on "\\" or "\\ " (two backslashes followed by optional space) outside of blocks
  const parts = replaced.split(/\\\\ ?/);

  // For each part, replace all placeholders with their corresponding blocks
  const result: string[] = [];
  for (const part of parts) {
    let filled = part;
    for (let i = 0; i < placeholders.length; i++) {
      filled = filled.replace(placeholders[i], blocks[i]);
    }
    if (filled.trim()) {
      result.push(filled.trim());
    }
  }

  return result;
};

export function IndicatorFormula({ value }: IndicatorFormulaProps) {
  const isDirectLatex =
    value.includes("\\") || value.includes("{") || value.includes("_") || value.includes("^");

  if (!isDirectLatex) {
    return <p className="text-sm text-muted-foreground select-none">{value}</p>;
  }

  const equations = tokenize(value);

  return (
    <div className="rounded-xl bg-background px-3 py-3 overflow-x-auto overscroll-none space-y-2">
      {equations.map((eq, i) => (
        <div key={i} className="min-h-[1.5rem] flex items-center justify-center">
          <BlockMath math={eq} />
        </div>
      ))}
    </div>
  );
}
