import { Effect, Option } from "effect";
import { AlertsNotifier } from "../modules/alerts/notifier";
import { AlertsIdentity } from "../modules/alerts/subject";
import { subjectKey } from "../modules/alerts/table";
import { createAlertsWsHandlers } from "../modules/alerts/ws";
import type { MarketStreamHubPort, MarketWsConnectionData } from "../modules/market-data";
import {
  createWsEventHandlers,
  MARKET_WS_PATH,
  upgradeMarketWs,
  WS_IDLE_TIMEOUT_SECONDS,
} from "../modules/market-data/ws";
import { asHttpError, type HttpError } from "../platform/http/error-response";
import type { AlertsWsMount, RunAppEffect, WsSetupBundle } from "../platform/http/server";
import { ALERTS_WS_PATH, upgradeAlertsWs } from "../platform/http/ws/upgrade";
import type { RunSocketWork, SocketConnection } from "../platform/http/ws";

const toWsHttpError = (error: { readonly message: string }): HttpError =>
  asHttpError(500, error.message);

const socketConnection = (hub: MarketStreamHubPort): SocketConnection<MarketWsConnectionData> => ({
  handleOpen: (ws) => hub.handleOpen(ws).pipe(Effect.mapError(toWsHttpError)),
  handleClose: (ws) => hub.handleClose(ws).pipe(Effect.mapError(toWsHttpError)),
  handleMessage: (ws, raw) => hub.handleMessage(ws, raw).pipe(Effect.mapError(toWsHttpError)),
});

const requireService = <A>(service: Option.Option<A>, name: string): A => {
  if (Option.isNone(service)) throw new Error(`${name} must be provided by the app runtime`);
  return service.value;
};

/**
 * The notifier must be the instance the alerts worker publishes to, so both
 * services come from the live runtime. AppLayer's public type names only
 * RequestEnvironment, which hides AlertsNotifier; this composition boundary is
 * where that knowledge lives.
 */
const prepareAlertsWs = (run: RunAppEffect): Promise<AlertsWsMount> => {
  const effect: Effect.Effect<AlertsWsMount> = Effect.gen(function* () {
    const notifier = requireService(yield* Effect.serviceOption(AlertsNotifier), "AlertsNotifier");
    const identity = requireService(yield* Effect.serviceOption(AlertsIdentity), "AlertsIdentity");

    const resolveSubjectKey = (request: Request): Promise<string | null> =>
      run(
        identity.resolve(request, { mintDevice: false }).pipe(
          Effect.map(({ subject }) => (subject === null ? null : subjectKey(subject))),
          Effect.catch(() => Effect.succeed(null)),
        ),
      );

    const mount: AlertsWsMount = {
      path: ALERTS_WS_PATH,
      handlers: createAlertsWsHandlers(notifier),
      upgrade: (url, req, server) => upgradeAlertsWs(url, req, server, resolveSubjectKey),
    };
    return mount;
  });

  return run(effect);
};

// The transport sees only this opaque setup; the concrete market-data hub is
// adapted here, at the composition root.
export const createWsSetup = (
  hub: MarketStreamHubPort,
  run: RunSocketWork,
): WsSetupBundle<MarketWsConnectionData> => ({
  path: MARKET_WS_PATH,
  idleTimeoutSeconds: WS_IDLE_TIMEOUT_SECONDS,
  upgrade: (url, req, server) => upgradeMarketWs(url, req, server, hub),
  handlers: createWsEventHandlers(socketConnection(hub), run),
  alerts: {
    path: ALERTS_WS_PATH,
    prepare: prepareAlertsWs,
  },
});
