import {
  normalizeIndicatorParams,
  type ActiveIndicator,
  type IndicatorConfig,
} from "@0xsignal/shared";

export const parseParamInput = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const toFormValues = (
  indicator: IndicatorConfig,
  source?: Record<string, number>,
): Record<string, string> => {
  const params = normalizeIndicatorParams(indicator, source);
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, `${value}`]));
};

export const parseFormValues = (
  indicator: IndicatorConfig,
  formValues: Record<string, string>,
): Record<string, number> => {
  const params: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(formValues)) {
    const parsed = parseParamInput(rawValue);
    if (parsed !== null) {
      params[key] = parsed;
    }
  }
  return normalizeIndicatorParams(indicator, params);
};

export const toChipLabel = (indicator: ActiveIndicator): string => {
  const summary = indicator.config.params
    .map((param) => {
      const value = indicator.params[param.key];
      if (value === undefined) return null;
      return `${param.key}:${value}`;
    })
    .filter(Boolean)
    .join(" ");

  return summary ? `${indicator.config.name} ${summary}` : indicator.config.name;
};
