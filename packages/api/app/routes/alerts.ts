import { Effect, Option } from "effect";
import { buildChannelsRoutes } from "../../modules/alerts/channels/http";
import { ChannelsService } from "../../modules/alerts/channels/service";
import { AlertsConfig } from "../../modules/alerts/config";
import { buildAlertsRoutes } from "../../modules/alerts/http";
import { AlertsService } from "../../modules/alerts/service";
import { AlertsIdentity } from "../../modules/alerts/subject";
import { json } from "../../platform/http/error-response";
import { withDefectGuard } from "../defect-guard";

const ruleRoutes = buildAlertsRoutes({
  json,
}).map((route) => ({
  method: route.method,
  path: route.path,
  handler: (request: Request, url: URL) =>
    withDefectGuard(
      Effect.gen(function* () {
        const alerts = Option.getOrUndefined(yield* Effect.serviceOption(AlertsService));
        const identity = Option.getOrUndefined(yield* Effect.serviceOption(AlertsIdentity));
        if (alerts === undefined || identity === undefined) {
          return json({ error: "Alerts service unavailable" }, 503);
        }
        return yield* route.handler(request, url, alerts, identity);
      }),
    ),
}));

const channelRoutes = buildChannelsRoutes({
  json,
}).map((route) => ({
  method: route.method,
  path: route.path,
  handler: (request: Request, url: URL) =>
    withDefectGuard(
      Effect.gen(function* () {
        const channels = Option.getOrUndefined(yield* Effect.serviceOption(ChannelsService));
        if (channels === undefined) {
          return yield* Effect.die(new Error("ChannelsService is required but not wired"));
        }
        const config = Option.getOrUndefined(yield* Effect.serviceOption(AlertsConfig));
        const identity = Option.getOrUndefined(yield* Effect.serviceOption(AlertsIdentity));
        return yield* route.handler(request, url, { channels, config, identity });
      }),
    ),
}));

export const alertsRoutes = [...ruleRoutes, ...channelRoutes];
