import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { BunServices } from "@effect/platform-bun";
import { devLoggerLayer } from "../platform/logging";

export const CoreLayer = Layer.mergeAll(devLoggerLayer, BunServices.layer, FetchHttpClient.layer);
