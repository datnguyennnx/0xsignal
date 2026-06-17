import { Effect, Layer, Option } from "effect";
import { AuthService } from "./auth.service";
import type { JwtPayload } from "../domain/session";
import { GoogleProvider } from "../infrastructure/providers/google.provider";
import { GitHubProvider } from "../infrastructure/providers/github.provider";
import { JwtService } from "../infrastructure/jwt.service";
import { OAuthStateStore, AuthCodeStore } from "../infrastructure/state.store";
import { UserRepo } from "../infrastructure/repos/user.repo";
import { OAuthAccountRepo } from "../infrastructure/repos/oauth-account.repo";
import {
  OAuthStateMismatch,
  OAuthCallbackFailed,
  UserSuspended,
  TokenRevoked,
} from "../domain/errors";
import type { OAuthProvider } from "../domain/oauth-account";
import { UserId } from "../domain/user";

export const AuthServiceLayer: Layer.Layer<
  AuthService,
  never,
  | GoogleProvider
  | GitHubProvider
  | JwtService
  | OAuthStateStore
  | AuthCodeStore
  | UserRepo
  | OAuthAccountRepo
> = Layer.effect(
  AuthService,
  Effect.gen(function* () {
    const googleProvider = yield* GoogleProvider;
    const githubProvider = yield* GitHubProvider;
    const jwtService = yield* JwtService;
    const stateStore = yield* OAuthStateStore;
    const authCodeStore = yield* AuthCodeStore;
    const userRepo = yield* UserRepo;
    const oauthAccountRepo = yield* OAuthAccountRepo;

    const getProvider = (provider: OAuthProvider) =>
      provider === "google" ? googleProvider : githubProvider;

    return AuthService.of({
      getAuthorizationUrl: ({
        provider,
        redirectUrl,
      }: {
        provider: OAuthProvider;
        redirectUrl?: string;
      }) =>
        Effect.gen(function* () {
          const p = getProvider(provider);
          const state = yield* p.generateState();
          const { url, codeVerifier } = yield* p.createAuthorizationUrl(state);
          yield* stateStore.save({
            state,
            provider,
            redirectUrl: redirectUrl ?? null,
            codeVerifier,
          });
          return { url: url.toString(), state };
        }),

      handleCallback: ({
        provider,
        code,
        state,
      }: {
        provider: OAuthProvider;
        code: string;
        state: string;
      }) =>
        Effect.gen(function* () {
          const storedState = yield* stateStore.consume(state);
          if (storedState.provider !== provider) {
            yield* Effect.fail(new OAuthStateMismatch());
          }
          const p = getProvider(provider);
          const profile = yield* p
            .fetchProfile(code, storedState.codeVerifier)
            .pipe(Effect.mapError((cause) => new OAuthCallbackFailed({ cause })));
          const linked = yield* oauthAccountRepo.createWithUser(profile);
          const user = yield* userRepo.findById(UserId(linked.userId));
          if (!user || user.status !== "active") {
            yield* Effect.fail(new UserSuspended({ userId: linked.userId }));
          }
          const oneTimeCode = crypto.randomUUID();
          yield* authCodeStore.save({ code: oneTimeCode, userId: linked.userId, provider });
          return { code: oneTimeCode };
        }),

      exchangeCode: (code: string) =>
        Effect.gen(function* () {
          const stored = yield* authCodeStore.consume(code);
          return yield* jwtService.sign({ sub: UserId(stored.userId), provider: stored.provider });
        }),

      verifyToken: (accessToken: string) =>
        Effect.gen(function* () {
          const payload = yield* jwtService.verify(accessToken, "access");
          const user = yield* userRepo.findById(payload.sub);
          if (!user || user.status !== "active") {
            yield* Effect.fail(new UserSuspended({ userId: payload.sub }));
          }
          return {
            userId: payload.sub,
            provider: payload.provider,
            jti: payload.jti,
          };
        }),

      refreshTokens: (refreshToken: string) =>
        Effect.gen(function* () {
          const payload = yield* jwtService.verify(refreshToken, "refresh");
          const revoked = yield* jwtService.isRevoked(payload.jti);
          if (revoked) yield* Effect.fail(new TokenRevoked());
          return yield* jwtService.sign({ sub: payload.sub, provider: payload.provider });
        }),

      logout: (refreshToken: string) =>
        Effect.gen(function* () {
          const maybePayload = yield* jwtService.verify(refreshToken, "refresh").pipe(
            Effect.map((payload): Option.Option<JwtPayload> => Option.some(payload)),
            Effect.catchTags({
              TokenExpired: () => Effect.succeed(Option.none<JwtPayload>()),
              TokenInvalid: () => Effect.succeed(Option.none<JwtPayload>()),
            }),
          );

          if (Option.isSome(maybePayload)) {
            const payload = maybePayload.value;
            const expiresAt = new Date(payload.exp * 1000);
            yield* jwtService.revoke(payload.jti, expiresAt).pipe(Effect.ignore);
          }
        }),

      getProfile: (userId: string) =>
        Effect.gen(function* () {
          const account = yield* oauthAccountRepo.findByUserId(UserId(userId));
          if (!account) return null;
          return {
            userId: account.userId,
            provider: account.provider,
            avatarUrl: account.avatarUrl,
            displayName: account.displayName,
          };
        }),

      updateProfile: (userId, params) =>
        Effect.gen(function* () {
          yield* oauthAccountRepo.updateDisplayName(UserId(userId), params.displayName);
          const account = yield* oauthAccountRepo.findByUserId(UserId(userId));
          if (!account) {
            return {
              userId,
              provider: "google" as const,
              avatarUrl: null,
              displayName: null,
            };
          }
          return {
            userId: account.userId,
            provider: account.provider,
            avatarUrl: account.avatarUrl,
            displayName: account.displayName,
          };
        }),
    });
  }),
);
