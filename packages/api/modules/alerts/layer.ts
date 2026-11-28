import { Duration, Effect, Layer, Schedule } from "effect";
import type { PostgresConnectionPool } from "@0xsignal/auth";
import { HyperliquidProvider } from "../../integrations/hyperliquid/data-sources/types";
import { ALERTS_WORKER_LOCK_KEY, guardWithLeaderLock } from "../../platform/db/leader-lock";
import { AlertsConfig, AlertsConfigLayer } from "./config";
import { errorMessage } from "./errors";
import { AlertsNotifier, AlertsNotifierLayer } from "./notifier";
import { AlertsRepositoryLayer } from "./repository";
import { AlertsService, AlertsServiceLayer } from "./service";
import { alertsWorkerTick, ChannelFanoutWithInfra, makeAlertsWorkerState } from "./worker";

export const AlertsServiceWithInfra: Layer.Layer<AlertsService, never, PostgresConnectionPool> =
  AlertsServiceLayer.pipe(
    Layer.provide(AlertsRepositoryLayer),
    Layer.provide(AlertsConfigLayer.pipe(Layer.orDie)),
  );

export const AlertsWorkerLayer: Layer.Layer<
  AlertsNotifier,
  never,
  PostgresConnectionPool | HyperliquidProvider
> = Layer.effectDiscard(
  Effect.gen(function* () {
    const config = yield* AlertsConfig;
    const state = makeAlertsWorkerState();

    yield* Effect.forkScoped(
      guardWithLeaderLock(ALERTS_WORKER_LOCK_KEY, alertsWorkerTick(state)).pipe(
        Effect.catch((error) =>
          Effect.logWarning(`[alerts] worker tick skipped or failed: ${errorMessage(error)}`),
        ),
        Effect.repeat(Schedule.spaced(Duration.millis(config.pollIntervalMs))),
        Effect.provide(ChannelFanoutWithInfra),
      ),
    );
  }),
).pipe(
  Layer.provideMerge(AlertsNotifierLayer),
  Layer.provide(AlertsRepositoryLayer),
  Layer.provide(AlertsConfigLayer.pipe(Layer.orDie)),
);
