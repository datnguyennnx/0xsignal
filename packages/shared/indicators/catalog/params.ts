import type { IndicatorParamDefinition } from "../types";

export type { IndicatorParamDefinition } from "../types";

export const intParam = (
  key: string,
  label: string,
  min: number,
  max: number,
  step: number,
  description?: string,
): IndicatorParamDefinition => ({
  key,
  label,
  min,
  max,
  step,
  description,
  control: "int",
});

export const floatParam = (
  key: string,
  label: string,
  min: number,
  max: number,
  step: number,
  description?: string,
): IndicatorParamDefinition => ({
  key,
  label,
  min,
  max,
  step,
  description,
  control: "float",
});
