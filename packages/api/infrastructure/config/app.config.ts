/** Application Configuration - Type-safe config using Effect Config */

import { Config, Context, Effect, Layer } from "effect";

// Environment config
export const EnvConfig = Config.all({
  port: Config.number("PORT").pipe(Config.withDefault(9006)),
  logLevel: Config.string("LOG_LEVEL").pipe(Config.withDefault("info")),
});

export type EnvConfig = Config.Config.Success<typeof EnvConfig>;

// App config service
export interface AppConfig {
  readonly env: EnvConfig;
}

export class AppConfigTag extends Context.Tag("AppConfig")<AppConfigTag, AppConfig>() {}

export const AppConfigLive = Layer.effect(
  AppConfigTag,
  Effect.gen(function* () {
    const env = yield* EnvConfig;
    return { env };
  })
);
