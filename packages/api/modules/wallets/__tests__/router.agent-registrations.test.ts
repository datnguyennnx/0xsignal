import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect, Layer, Schema } from "effect";
import { TestClock } from "effect/testing";
import {
  AgentRegistrationRepo,
  AuthService,
  ExchangeAccountRepo,
  makeUserId,
  type AgentRegistration,
  type Session,
} from "@0xsignal/auth";
import { UserDataService } from "../../user-data";
import { MarketDataService } from "../../market-data";
import { HealthService } from "../../health";
import { OrderIntentService } from "../../exchange";
import { handleRequest } from "../../../app";

const USER_A = makeUserId("user-a");
const USER_B = makeUserId("user-b");

const SESSION_A: Session = { userId: USER_A, provider: "google", jti: "jti-a" };
const SESSION_B: Session = { userId: USER_B, provider: "google", jti: "jti-b" };

const registration = (params: {
  readonly id: string;
  readonly userId: string;
  readonly agentAddress: string;
  readonly label?: string;
  readonly expiresAt?: string;
}): AgentRegistration => ({
  id: params.id,
  userId: params.userId,
  agentAddress: params.agentAddress,
  ...(params.label !== undefined && { label: params.label }),
  ...(params.expiresAt !== undefined && { expiresAt: params.expiresAt }),
  createdAt: "2026-01-01T00:00:00.000Z",
  isVerified: true,
});

const ROWS_BY_USER: Record<string, readonly AgentRegistration[]> = {
  [USER_A]: [
    registration({
      id: "reg-a",
      userId: USER_A,
      agentAddress: `0x${"a".repeat(40)}`,
      label: "primary-agent",
    }),
  ],
  [USER_B]: [
    registration({
      id: "reg-b",
      userId: USER_B,
      agentAddress: `0x${"b".repeat(40)}`,
      label: "other-user-agent",
    }),
  ],
};

const makeLayer = (rowsByUser: Record<string, readonly AgentRegistration[]>) =>
  Layer.mergeAll(
    Layer.mock(MarketDataService, {}),
    Layer.mock(HealthService, {}),
    Layer.mock(UserDataService, {}),
    Layer.mock(OrderIntentService, {}),
    Layer.mock(AuthService, {
      verifyToken: (token) => Effect.succeed(token === "token-b" ? SESSION_B : SESSION_A),
    }),
    Layer.mock(ExchangeAccountRepo, {}),
    Layer.mock(AgentRegistrationRepo, {
      listByUserId: (userId) => Effect.succeed(rowsByUser[userId] ?? []),
    }),
  );

const request = (path: string, token?: string) =>
  new Request(
    `http://localhost${path}`,
    token === undefined ? {} : { headers: { Authorization: `Bearer ${token}` } },
  );

const runRequest = (
  path: string,
  options?: {
    readonly token?: string;
    readonly nowMillis?: number;
    readonly rows?: typeof ROWS_BY_USER;
  },
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      if (options?.nowMillis !== undefined) {
        yield* TestClock.adjust(`${options.nowMillis} millis`);
      }
      return yield* handleRequest(request(path, options?.token));
    }).pipe(
      Effect.provide(makeLayer(options?.rows ?? ROWS_BY_USER)),
      Effect.provide(TestClock.layer()),
    ),
  );

const ResponseSchema = Schema.Struct({
  data: Schema.Array(
    Schema.Struct({
      agentAddress: Schema.String,
      status: Schema.String,
      expiresAt: Schema.optionalKey(Schema.String),
    }),
  ),
});

type AgentRegistrationBody = Schema.Schema.Type<typeof ResponseSchema>;

const readBody = async (response: Response): Promise<AgentRegistrationBody> => {
  const raw: unknown = await response.json();
  return Schema.decodeUnknownSync(ResponseSchema)(raw);
};

describe("HTTP Agent Registrations Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unauthenticated request with 401", async () => {
    const response = await runRequest("/api/wallets/agent-registrations");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns only the session user's rows and ignores a caller-supplied user id", async () => {
    const response = await runRequest(`/api/wallets/agent-registrations?userId=${USER_B}`, {
      token: "token-a",
    });

    expect(response.status).toBe(200);
    const body = await readBody(response);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].agentAddress).toBe(`0x${"a".repeat(40)}`);
    expect(JSON.stringify(body)).not.toContain("other-user-agent");
  });

  it("never returns key material or ciphertext fields", async () => {
    const response = await runRequest("/api/wallets/agent-registrations", { token: "token-a" });

    const text = JSON.stringify(await readBody(response));
    for (const forbidden of ["privateKey", "apiKey", "secret", "ciphertext", "permissions"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("marks a past expiry expired and a future expiry active using the injected clock", async () => {
    const rows = {
      [USER_A]: [
        registration({
          id: "expired",
          userId: USER_A,
          agentAddress: `0x${"c".repeat(40)}`,
          expiresAt: "1970-01-01T00:00:00.500Z",
        }),
        registration({
          id: "active",
          userId: USER_A,
          agentAddress: `0x${"d".repeat(40)}`,
          expiresAt: "1970-01-01T00:00:02.000Z",
        }),
      ],
    };

    const response = await runRequest("/api/wallets/agent-registrations", {
      token: "token-a",
      nowMillis: 1000,
      rows,
    });

    expect(response.status).toBe(200);
    const body = await readBody(response);
    const statuses = body.data.map((item) => item.status);
    expect(statuses).toEqual(["expired", "active"]);
  });
});
