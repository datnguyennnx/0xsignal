import { Layer } from "effect";
import type { ConfigError } from "effect/Config";
import type { RequestEnvironment } from "./contracts";
import { CoreLayer } from "./core";
import { InfrastructureLayer } from "./infrastructure";
import { AppServicesLayer } from "./services";

export const AppLayer: Layer.Layer<RequestEnvironment, ConfigError> = AppServicesLayer.pipe(
  Layer.provideMerge(InfrastructureLayer),
  Layer.provideMerge(CoreLayer),
);
