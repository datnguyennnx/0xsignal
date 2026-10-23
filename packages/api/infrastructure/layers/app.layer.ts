import { Layer } from "effect";
import type { ConfigError } from "effect/Config";
import type { RequestEnvironment } from "./request-environment";
import { AppServicesLayer } from "./app-services.layer";
import { InfrastructureLayer } from "./app-infrastructure.layer";
import { CoreLayer } from "./core.layer";

export const AppLayer: Layer.Layer<RequestEnvironment, ConfigError> = AppServicesLayer.pipe(
  Layer.provideMerge(InfrastructureLayer),
  Layer.provideMerge(CoreLayer),
);
