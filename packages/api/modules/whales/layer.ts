import { Effect, Layer } from "effect";
import { WhaleService } from "./index";
import { makeWhaleService } from "./service";
import { WhaleConfig, WhaleConfigLayer } from "./config";
import type { WhaleRepo } from "./repo";
import type { WhaleSources } from "./sources";
import { WhaleSourcesLayer } from "../../integrations/hyperliquid/data-sources/whale-source";
import { ensureWhaleSchema } from "./table";
import { WhaleRepoLayer } from "./repo.pg";
import { WhaleDiscoveryLayer } from "./discovery";

export const whaleServiceLayer: Layer.Layer<
  WhaleService,
  never,
  WhaleRepo | WhaleSources | WhaleConfig
> = Layer.effect(WhaleService, makeWhaleService());

const WhaleSchemaLayer = Layer.effectDiscard(
  ensureWhaleSchema.pipe(
    Effect.tapError((error) =>
      Effect.logWarning(`[whale] schema initialization skipped: ${error.message}`),
    ),
    Effect.ignore,
  ),
);

const WhaleServiceWithInfra = whaleServiceLayer.pipe(
  Layer.provide(Layer.mergeAll(WhaleSourcesLayer, WhaleRepoLayer)),
);

const WhaleStartupLayer = Layer.mergeAll(
  WhaleSchemaLayer,
  WhaleDiscoveryLayer.pipe(Layer.provide(WhaleServiceWithInfra)),
);

export const WhaleLayer = Layer.mergeAll(WhaleServiceWithInfra, WhaleStartupLayer).pipe(
  Layer.provideMerge(WhaleConfigLayer.pipe(Layer.orDie)),
);
