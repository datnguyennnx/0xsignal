import { describe, expect, it } from "vitest";
import { Effect, Layer, Schema } from "effect";
import { privateKeyToAccount } from "viem/accounts";
import {
  AgentRegistrationRepo,
  AuthService,
  ExchangeAccountRepo,
  WalletAddressClaimed,
  WalletChallengeAddressMismatch,
  WalletChallengeExpired,
  WalletChallengeNotFound,
  WalletChallengeRepo,
  WalletChallengeUsed,
  makeUserId,
  type ExchangeAccount,
  type Session,
  type WalletChallenge,
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

const isHex = (value: string): value is `0x${string}` => /^0x[a-fA-F0-9]+$/.test(value);

const hex = (value: string): `0x${string}` => {
  if (!isHex(value)) throw new Error(`not hex: ${value}`);
  return value;
};

const WALLET_A = privateKeyToAccount(
  hex("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"),
);
const WALLET_B = privateKeyToAccount(
  hex("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"),
);

type StoredChallenge = {
  id: string;
  userId: string;
  walletAddress: string;
  nonce: string;
  message: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

const toChallenge = (row: StoredChallenge): WalletChallenge => ({
  id: row.id,
  userId: row.userId,
  walletAddress: row.walletAddress,
  nonce: row.nonce,
  message: row.message,
  expiresAt: row.expiresAt.toISOString(),
  ...(row.consumedAt !== null && { consumedAt: row.consumedAt.toISOString() }),
});

const classify = (
  row: StoredChallenge | undefined,
  params: { readonly userId: string; readonly walletAddress: string; readonly nonce: string },
): Effect.Effect<
  WalletChallenge,
  | WalletChallengeNotFound
  | WalletChallengeExpired
  | WalletChallengeUsed
  | WalletChallengeAddressMismatch
> => {
  if (row === undefined || row.userId !== params.userId) {
    return Effect.fail(new WalletChallengeNotFound({ nonce: params.nonce }));
  }
  if (row.walletAddress.toLowerCase() !== params.walletAddress.toLowerCase()) {
    return Effect.fail(new WalletChallengeAddressMismatch({ nonce: params.nonce }));
  }
  if (row.consumedAt !== null) {
    return Effect.fail(new WalletChallengeUsed({ nonce: params.nonce }));
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    return Effect.fail(new WalletChallengeExpired({ nonce: params.nonce }));
  }
  return Effect.succeed(toChallenge(row));
};

const makeChallengeLayer = () => {
  const store = new Map<string, StoredChallenge>();

  const layer = Layer.mock(WalletChallengeRepo, {
    issue: (params) =>
      Effect.sync(() => {
        for (const [nonce, row] of store) {
          if (
            row.userId === params.userId &&
            row.walletAddress.toLowerCase() === params.walletAddress.toLowerCase()
          ) {
            store.delete(nonce);
          }
        }
        const row: StoredChallenge = {
          id: `challenge-${params.nonce}`,
          userId: params.userId,
          walletAddress: params.walletAddress,
          nonce: params.nonce,
          message: params.message,
          expiresAt: params.expiresAt,
          consumedAt: null,
        };
        store.set(row.nonce, row);
        return toChallenge(row);
      }),
    findActive: (params) => Effect.suspend(() => classify(store.get(params.nonce), params)),
    consume: (params) =>
      Effect.suspend(() => {
        const row = store.get(params.nonce);
        return Effect.flatMap(classify(row, params), () =>
          Effect.sync(() => {
            if (row !== undefined) row.consumedAt = new Date();
          }),
        );
      }),
  });

  return { store, layer };
};

const accountFor = (walletAddress: string, userId: string, verified = true): ExchangeAccount => ({
  id: `account-${walletAddress}`,
  userId,
  exchangeId: "exchange-1",
  nodeType: "wallet",
  walletAddress,
  label: "",
  sortOrder: 0,
  isActive: true,
  isPrimary: true,
  ...(verified && { verifiedAt: "2026-01-01T00:00:00.000Z" }),
  metadata: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

type WalletRow = {
  id: string;
  userId: string;
  walletAddress: string;
  verifiedAt?: string;
};

type EnvOptions = {
  readonly initialRows?: ReadonlyArray<WalletRow>;
};

const makeEnv = (options?: EnvOptions) => {
  const challenge = makeChallengeLayer();
  const walletRows: WalletRow[] = [...(options?.initialRows ?? [])];

  const layer = Layer.mergeAll(
    Layer.mock(MarketDataService, {}),
    Layer.mock(HealthService, {}),
    Layer.mock(UserDataService, {}),
    Layer.mock(OrderIntentService, {}),
    Layer.mock(AuthService, {
      verifyToken: (token) => Effect.succeed(token === "token-b" ? SESSION_B : SESSION_A),
    }),
    Layer.mock(AgentRegistrationRepo, {}),
    Layer.mock(ExchangeAccountRepo, {
      verifyWallet: (params) =>
        Effect.suspend(() => {
          const address = params.walletAddress.toLowerCase();
          const rows = walletRows.filter((row) => row.walletAddress.toLowerCase() === address);
          const provenByOther = rows.some(
            (row) => row.userId !== params.userId && row.verifiedAt !== undefined,
          );
          if (provenByOther) {
            return Effect.fail(new WalletAddressClaimed({ walletAddress: params.walletAddress }));
          }
          for (const row of rows) {
            if (row.userId !== params.userId) delete row.verifiedAt;
          }
          const own = rows.find((row) => row.userId === params.userId);
          if (own === undefined) {
            walletRows.push({
              id: `account-${params.walletAddress}`,
              userId: params.userId,
              walletAddress: params.walletAddress,
              verifiedAt: "2026-01-02T00:00:00.000Z",
            });
          } else {
            own.verifiedAt = "2026-01-02T00:00:00.000Z";
          }
          return Effect.succeed(accountFor(params.walletAddress, params.userId));
        }),
      findByUserId: (userId) =>
        Effect.succeed(
          walletRows
            .filter((row) => row.userId === userId)
            .map((row) => accountFor(row.walletAddress, row.userId, row.verifiedAt !== undefined)),
        ),
    }),
    challenge.layer,
  );

  return { store: challenge.store, walletRows, layer };
};

const request = (path: string, init?: RequestInit): Request =>
  new Request(`http://localhost${path}`, init);

const run = (env: ReturnType<typeof makeEnv>, path: string, init?: RequestInit) =>
  Effect.runPromise(handleRequest(request(path, init)).pipe(Effect.provide(env.layer)));

const postJson = (token: string, body: unknown): RequestInit => ({
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const ChallengeResponseSchema = Schema.Struct({
  data: Schema.Struct({
    nonce: Schema.String,
    message: Schema.String,
    expiresAt: Schema.String,
  }),
});

const WalletListSchema = Schema.Struct({
  data: Schema.Array(
    Schema.Struct({
      verified: Schema.Boolean,
    }),
  ),
});

const readChallenge = async (
  response: Response,
): Promise<Schema.Schema.Type<typeof ChallengeResponseSchema>["data"]> => {
  const raw: unknown = await response.json();
  return Schema.decodeUnknownSync(ChallengeResponseSchema)(raw).data;
};

const linkBody = (params: {
  readonly address: string;
  readonly nonce: string;
  readonly signature: string;
}) => ({
  exchangeSlug: "hyperliquid",
  walletAddress: params.address,
  nonce: params.nonce,
  signature: params.signature,
});

const errorText = async (response: Response): Promise<string> =>
  JSON.stringify(await response.json());

const expireChallenge = (env: ReturnType<typeof makeEnv>, nonce: string): void => {
  const stored = env.store.get(nonce);
  if (stored === undefined) throw new Error(`missing challenge ${nonce}`);
  stored.expiresAt = new Date(Date.now() - 1000);
};

describe("HTTP Wallet Ownership Router", () => {
  it("requires auth for the challenge endpoint", async () => {
    const env = makeEnv();
    const response = await run(env, "/api/wallets/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: WALLET_A.address }),
    });

    expect(response.status).toBe(401);
  });

  it("issues a challenge that names the address, nonce, domain and expiry", async () => {
    const env = makeEnv();
    const response = await run(
      env,
      "/api/wallets/challenge",
      postJson("token-a", { address: WALLET_A.address }),
    );

    expect(response.status).toBe(200);
    const challenge = await readChallenge(response);
    expect(challenge.message).toContain(WALLET_A.address);
    expect(challenge.message).toContain(challenge.nonce);
    expect(challenge.message).toContain("Domain: localhost");
    expect(challenge.message).toContain(`Expiration Time: ${challenge.expiresAt}`);
    expect(env.store.size).toBe(1);
  });

  it("rejects linking without a nonce or signature", async () => {
    const env = makeEnv();
    const response = await run(
      env,
      "/api/wallets",
      postJson("token-a", { exchangeSlug: "hyperliquid", walletAddress: WALLET_A.address }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a challenge that does not exist for this user", async () => {
    const env = makeEnv();
    const response = await run(
      env,
      "/api/wallets",
      postJson(
        "token-a",
        linkBody({
          address: WALLET_A.address,
          nonce: "never-issued",
          signature: await WALLET_A.signMessage({ message: "anything" }),
        }),
      ),
    );

    expect(response.status).toBe(400);
    expect(await errorText(response)).toContain("No valid wallet challenge");
  });

  it("rejects an expired challenge", async () => {
    const env = makeEnv();
    const challengeResponse = await run(
      env,
      "/api/wallets/challenge",
      postJson("token-a", { address: WALLET_A.address }),
    );
    const challenge = await readChallenge(challengeResponse);

    expireChallenge(env, challenge.nonce);

    const signature = await WALLET_A.signMessage({ message: challenge.message });
    const response = await run(
      env,
      "/api/wallets",
      postJson(
        "token-a",
        linkBody({ address: WALLET_A.address, nonce: challenge.nonce, signature }),
      ),
    );

    expect(response.status).toBe(400);
    expect(await errorText(response)).toContain("expired");
  });

  it("rejects a signature produced by a different key", async () => {
    const env = makeEnv();
    const challengeResponse = await run(
      env,
      "/api/wallets/challenge",
      postJson("token-a", { address: WALLET_A.address }),
    );
    const challenge = await readChallenge(challengeResponse);
    const signature = await WALLET_B.signMessage({ message: challenge.message });

    const response = await run(
      env,
      "/api/wallets",
      postJson(
        "token-a",
        linkBody({ address: WALLET_A.address, nonce: challenge.nonce, signature }),
      ),
    );

    expect(response.status).toBe(400);
    expect(await errorText(response)).toContain("Signature does not match");
  });

  it("links with a valid signature and rejects a replay of the same nonce", async () => {
    const env = makeEnv();
    const challengeResponse = await run(
      env,
      "/api/wallets/challenge",
      postJson("token-a", { address: WALLET_A.address }),
    );
    const challenge = await readChallenge(challengeResponse);
    const signature = await WALLET_A.signMessage({ message: challenge.message });
    const body = linkBody({ address: WALLET_A.address, nonce: challenge.nonce, signature });

    const linked = await run(env, "/api/wallets", postJson("token-a", body));
    expect(linked.status).toBe(200);
    expect(env.store.get(challenge.nonce)?.consumedAt).not.toBeNull();

    const replay = await run(env, "/api/wallets", postJson("token-a", body));
    expect(replay.status).toBe(400);
    expect(await errorText(replay)).toContain("already used");
  });

  it("returns 409 when another user has already proven the address", async () => {
    const env = makeEnv({
      initialRows: [
        {
          id: "account-a",
          userId: USER_A,
          walletAddress: WALLET_A.address,
          verifiedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const challengeResponse = await run(
      env,
      "/api/wallets/challenge",
      postJson("token-b", { address: WALLET_A.address }),
    );
    const challenge = await readChallenge(challengeResponse);
    const signature = await WALLET_A.signMessage({ message: challenge.message });

    const response = await run(
      env,
      "/api/wallets",
      postJson(
        "token-b",
        linkBody({ address: WALLET_A.address, nonce: challenge.nonce, signature }),
      ),
    );

    expect(response.status).toBe(409);
    expect(await errorText(response)).toContain("already linked");
    expect(env.walletRows.filter((row) => row.verifiedAt !== undefined)).toHaveLength(1);
  });

  it("transfers proof from unverified rows without deleting them", async () => {
    const env = makeEnv({
      initialRows: [
        {
          id: "account-a",
          userId: USER_A,
          walletAddress: WALLET_A.address,
        },
      ],
    });

    const challengeResponse = await run(
      env,
      "/api/wallets/challenge",
      postJson("token-b", { address: WALLET_A.address }),
    );
    const challenge = await readChallenge(challengeResponse);
    const signature = await WALLET_A.signMessage({ message: challenge.message });

    const response = await run(
      env,
      "/api/wallets",
      postJson(
        "token-b",
        linkBody({ address: WALLET_A.address, nonce: challenge.nonce, signature }),
      ),
    );

    expect(response.status).toBe(200);
    expect(env.walletRows).toHaveLength(2);

    const [previous, current] = env.walletRows;
    expect(previous.userId).toBe(USER_A);
    expect(previous.verifiedAt).toBeUndefined();
    expect(current.userId).toBe(USER_B);
    expect(current.verifiedAt).toBeDefined();

    const listResponse = await run(env, "/api/wallets", {
      headers: { Authorization: "Bearer token-a" },
    });
    const listBody: unknown = await listResponse.json();
    const decoded = Schema.decodeUnknownSync(WalletListSchema)(listBody);
    expect(decoded.data).toEqual([{ verified: false }]);
  });
});
