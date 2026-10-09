import { Config, Context, Layer } from "effect";
import type { CalendarSource } from "@0xsignal/shared";

export interface CalendarConfigService {
  readonly refreshMinutes: Readonly<Record<CalendarSource, number>>;
}

export class CalendarConfig extends Context.Service<CalendarConfig, CalendarConfigService>()(
  "CalendarConfig",
) {}

const DEFAULT_REFRESH_MINUTES = 1440;

const refreshMinutesConfig = (envSuffix: string): Config.Config<number> =>
  Config.int(`CALENDAR_REFRESH_MINUTES_${envSuffix}`).pipe(
    Config.withDefault(DEFAULT_REFRESH_MINUTES),
  );

export const calendarConfig: Config.Config<CalendarConfigService> = Config.all({
  bls: refreshMinutesConfig("BLS"),
  bea: refreshMinutesConfig("BEA"),
  federalReserve: refreshMinutesConfig("FEDERAL_RESERVE"),
  forexfactory: refreshMinutesConfig("FOREXFACTORY"),
  secEdgar: refreshMinutesConfig("SEC_EDGAR"),
}).pipe(
  Config.map((resolved) => ({
    refreshMinutes: {
      bls: resolved.bls,
      bea: resolved.bea,
      "federal-reserve": resolved.federalReserve,
      forexfactory: resolved.forexfactory,
      "sec-edgar": resolved.secEdgar,
    },
  })),
);

export const CalendarConfigLayer: Layer.Layer<CalendarConfig, Config.ConfigError> = Layer.effect(
  CalendarConfig,
  calendarConfig,
);
