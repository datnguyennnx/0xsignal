import type { IndicatorParamDefinition } from "../types";

export type { IndicatorParamDefinition } from "../types";

export const intParam = (
  key: string,
  label: string,
  min: number,
  max: number,
  step: number,
  description?: string
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
  description?: string
): IndicatorParamDefinition => ({
  key,
  label,
  min,
  max,
  step,
  description,
  control: "float",
});

export const staticIndicator = (
  config: Omit<
    import("../types").IndicatorConfig,
    "defaultParams" | "params" | "allowMultiple" | "output" | "overlayOnPrice"
  > & {
    defaultParams?: Record<string, number>;
    params?: readonly IndicatorParamDefinition[];
    allowMultiple?: boolean;
    output?: import("../types").IndicatorOutputType;
    overlayOnPrice: boolean;
  }
): import("../types").IndicatorConfig => ({
  ...config,
  defaultParams: config.defaultParams ?? {},
  params: config.params ?? [],
  allowMultiple: config.allowMultiple ?? false,
  output: config.output ?? "line",
});
