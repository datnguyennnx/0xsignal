// Only perp labels carry a "-QUOTE" suffix worth rendering apart. Pair labels
// ("HFUN/USDC") are already readable pairs and must not be split or truncated.
export function splitDisplaySymbol(displaySymbol: string): { base: string; quote: string } {
  if (displaySymbol.includes("/")) return { base: displaySymbol, quote: "" };
  const [base, ...quoteParts] = displaySymbol.split("-");
  return { base, quote: quoteParts.join("-") };
}
