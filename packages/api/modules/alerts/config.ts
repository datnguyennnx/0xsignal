import { Config, Context, Layer, Option, Redacted } from "effect";

// Out-of-app channels are opt-in: the optional fields stay absent until an
// operator configures them, and a partial service object stays constructible.
export interface AlertsConfigService {
  readonly pollIntervalMs: number;
  readonly maxRulesPerDevice: number;
  readonly dailyCap: number;
  readonly telegramBotToken: Option.Option<Redacted.Redacted>;
  readonly telegramBotUsername?: Option.Option<string>;
  readonly telegramWebhookSecret?: Option.Option<Redacted.Redacted>;
  readonly publicAppUrl?: Option.Option<string>;
}

export class AlertsConfig extends Context.Service<AlertsConfig, AlertsConfigService>()(
  "AlertsConfig",
) {}

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_MAX_RULES_PER_DEVICE = 10;
const DEFAULT_DAILY_CAP = 12;

const publicAppUrlConfig: Config.Config<Option.Option<string>> = Config.all({
  configured: Config.option(Config.String("ALERTS_PUBLIC_APP_URL")),
  frontend: Config.option(Config.String("FRONTEND_URL")),
}).pipe(
  Config.map(({ configured, frontend }) => (Option.isSome(configured) ? configured : frontend)),
);

const alertsConfig: Config.Config<AlertsConfigService> = Config.all({
  pollIntervalMs: Config.Int("ALERTS_POLL_INTERVAL_MS").pipe(
    Config.withDefault(DEFAULT_POLL_INTERVAL_MS),
  ),
  maxRulesPerDevice: Config.Int("ALERTS_MAX_RULES_PER_DEVICE").pipe(
    Config.withDefault(DEFAULT_MAX_RULES_PER_DEVICE),
  ),
  dailyCap: Config.Int("ALERTS_DAILY_CAP").pipe(Config.withDefault(DEFAULT_DAILY_CAP)),
  telegramBotToken: Config.option(Config.Redacted("ALERTS_TELEGRAM_BOT_TOKEN")),
  telegramBotUsername: Config.option(Config.String("ALERTS_TELEGRAM_BOT_USERNAME")),
  telegramWebhookSecret: Config.option(Config.Redacted("ALERTS_TELEGRAM_WEBHOOK_SECRET")),
  publicAppUrl: publicAppUrlConfig,
});

export const AlertsConfigLayer: Layer.Layer<AlertsConfig, Config.ConfigError> = Layer.effect(
  AlertsConfig,
  alertsConfig,
);
