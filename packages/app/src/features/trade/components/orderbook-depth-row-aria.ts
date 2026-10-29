interface FormattedRowValues {
  formattedPrice: string;
  formattedSize: string;
  formattedTotal: string;
}

export function buildRowAriaLabel(
  price: number,
  side: "bid" | "ask",
  formatted: FormattedRowValues,
): string | undefined {
  if (price <= 0) return undefined;
  return `${side} level, price ${formatted.formattedPrice}, size ${formatted.formattedSize}, total ${formatted.formattedTotal}`;
}
