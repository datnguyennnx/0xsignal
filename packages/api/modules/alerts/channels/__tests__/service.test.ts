import { describe, expect, it } from "vitest";
import { Effect, Layer, Option } from "effect";
import type { Pool } from "pg";
import { PostgresConnectionPool } from "@0xsignal/auth";
import { AlertsConfig } from "../../config";
import type { Subject } from "../../table";
import {
  ChannelsRepository,
  ChannelsRepositoryLayer,
  type ChannelsRepositoryPort,
} from "../repository";
import { ChannelsService, ChannelsServiceLayer, type ChannelRow } from "../service";

const NOW = 1_700_000_000_000;
const SUBJECT: Subject = { type: "device", id: "device-1" };

const config = AlertsConfig.of({
  pollIntervalMs: 2_000,
  maxRulesPerDevice: 10,
  dailyCap: 12,
  telegramBotToken: Option.none(),
  telegramBotUsername: Option.some("signal_bot"),
});

const channelRow = (overrides: Partial<ChannelRow> = {}): ChannelRow => ({
  id: "channel-1",
  channel: "telegram",
  destination: "chat-1",
  label: null,
  verifiedAt: null,
  lastError: null,
  lastSentAt: null,
  ...overrides,
});

const stubRepository = (
  overrides: Partial<ChannelsRepositoryPort> = {},
): ChannelsRepositoryPort => ({
  insertLinkCode: () => Effect.void,
  consumeLinkCode: () => Effect.succeed(null),
  upsertChannel: (input) =>
    Effect.succeed(
      channelRow({
        channel: input.channel,
        destination: input.destination,
        label: input.label,
      }),
    ),
  listBySubject: () => Effect.succeed([]),
  remove: () => Effect.succeed(true),
  countBySubject: () => Effect.succeed(0),
  touchSent: () => Effect.void,
  touchError: () => Effect.void,
  forSubjects: () => Effect.succeed([]),
  ...overrides,
});

const withService = <A, E>(
  repo: ChannelsRepositoryPort,
  body: (service: ChannelsServicePort) => Effect.Effect<A, E>,
): Promise<A> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* ChannelsService;
      return yield* body(service);
    }).pipe(
      Effect.provide(
        ChannelsServiceLayer.pipe(
          Layer.provide(Layer.succeed(ChannelsRepository, repo)),
          Layer.provide(Layer.succeed(AlertsConfig, config)),
        ),
      ),
    ),
  );

type ChannelsServicePort = typeof ChannelsService.Service;

describe("channels service", () => {
  it("consumeLink returns null for an expired code", async () => {
    const seen: number[] = [];
    const repo = stubRepository({
      consumeLinkCode: (_code, now) => {
        seen.push(now);
        return Effect.succeed(null);
      },
    });

    const result = await withService(repo, (service) => service.consumeLink("ABCDEFGH", NOW));

    expect(result).toBeNull();
    expect(seen).toEqual([NOW]);
  });

  it("consumeLink returns null for an already consumed code", async () => {
    const seen: string[] = [];
    const repo = stubRepository({
      consumeLinkCode: (code) => {
        seen.push(code);
        return Effect.succeed(null);
      },
    });

    const result = await withService(repo, (service) => service.consumeLink("23456789", NOW));

    expect(result).toBeNull();
    expect(seen).toEqual(["23456789"]);
  });

  it("createLink refuses the sixth channel with LimitExceeded", async () => {
    let inserted = 0;
    const repo = stubRepository({
      countBySubject: () => Effect.succeed(5),
      insertLinkCode: () => {
        inserted += 1;
        return Effect.void;
      },
    });

    const error = await withService(repo, (service) =>
      service.createLink(SUBJECT, "telegram", NOW).pipe(Effect.flip),
    );

    expect(error._tag).toBe("LimitExceeded");
    expect(inserted).toBe(0);
  });

  it("createLink mints an 8-char base32 code and a telegram deep link", async () => {
    const repo = stubRepository({ countBySubject: () => Effect.succeed(0) });

    const result = await withService(repo, (service) =>
      service.createLink(SUBJECT, "telegram", NOW),
    );

    expect(result.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(result.expiresAt).toBe(new Date(NOW + 10 * 60 * 1000).toISOString());
    expect(result.deepLink).toBe(`https://t.me/signal_bot?start=${result.code}`);
  });

  it("unlink reports NotFound for another subject's channel", async () => {
    const repo = stubRepository({ remove: () => Effect.succeed(false) });

    const error = await withService(repo, (service) =>
      service.unlink(SUBJECT, "channel-1", NOW).pipe(Effect.flip),
    );

    expect(error._tag).toBe("NotFound");
  });

  it("bindChannel falls back to the destination when label is absent", async () => {
    const repo = stubRepository();

    const row = await withService(repo, (service) =>
      service.bindChannel(SUBJECT, "telegram", "chat-1", null, NOW),
    );

    expect(row.label).toBe("chat-1");
  });
});

describe("channels repository layer", () => {
  it("maps a stored channel row through the pool", async () => {
    const pool = {
      query: (sql: string) =>
        Promise.resolve({
          rows: sql.includes("FROM alert_channels")
            ? [
                {
                  id: "channel-1",
                  channel: "telegram",
                  destination: "chat-1",
                  label: "Desk",
                  verified_at: "2026-01-01T00:00:00.000Z",
                  last_error: null,
                  last_sent_at: null,
                },
              ]
            : [],
        }),
    } as unknown as Pool;

    const rows = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ChannelsRepository;
        return yield* repo.listBySubject(SUBJECT);
      }).pipe(
        Effect.provide(ChannelsRepositoryLayer),
        Effect.provide(Layer.succeed(PostgresConnectionPool, pool)),
      ),
    );

    expect(rows).toEqual([
      {
        id: "channel-1",
        channel: "telegram",
        destination: "chat-1",
        label: "Desk",
        verifiedAt: "2026-01-01T00:00:00.000Z",
        lastError: null,
        lastSentAt: null,
      },
    ]);
  });
});
