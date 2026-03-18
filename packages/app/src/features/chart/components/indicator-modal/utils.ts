import {
  normalizeIndicatorParams,
  type ActiveIndicator,
  type IndicatorConfig,
} from "@0xsignal/shared";

export const formatParamValue = (value: number): string => {
  if (Number.isInteger(value)) {
    return `${value}`;
  }
  return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
};

export const parseParamInput = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const toFormValues = (
  indicator: IndicatorConfig,
  source?: Record<string, number>
): Record<string, string> => {
  const params = normalizeIndicatorParams(indicator, source);
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, `${value}`]));
};

export const parseFormValues = (
  indicator: IndicatorConfig,
  formValues: Record<string, string>
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

export const getInstanceLabel = (activeIndicator: ActiveIndicator): string => {
  const keys = activeIndicator.config.params.map((param) => param.key);
  if (keys.length === 0) {
    return "Default setup";
  }

  return keys
    .map((key) => `${key}: ${formatParamValue(activeIndicator.params[key] ?? 0)}`)
    .join(" • ");
};
