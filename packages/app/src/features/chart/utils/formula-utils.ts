/**
 * Tokenize a LaTeX formula string by splitting on double-backslash line breaks,
 * preserving any \begin{...}...\end{...} blocks as single tokens.
 */
export const tokenize = (value: string): string[] => {
  const blocks: string[] = [];
  const placeholders: string[] = [];

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
