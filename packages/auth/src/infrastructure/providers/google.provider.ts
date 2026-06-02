import { Config, Context, Effect, Layer, Option } from "effect";
import * as arctic from "arctic";
import type { OAuthProfile } from "../../domain/oauth-account";
import { OAuthCallbackFailed } from "../../domain/errors";

export interface GoogleProviderPort {
  readonly generateState: () => Effect.Effect<string>;
  readonly createAuthorizationUrl: (
    state: string
  ) => Effect.Effect<{ url: URL; codeVerifier: string }>;
  readonly fetchProfile: (
    code: string,
    codeVerifier: string | null
  ) => Effect.Effect<OAuthProfile, OAuthCallbackFailed>;
}

export class GoogleProvider extends Context.Service<GoogleProvider, GoogleProviderPort>()(
  "GoogleProvider"
) {}

const disabledGoogleProvider = GoogleProvider.of({
  generateState: () => Effect.die(new Error("Google OAuth is not configured")),
  createAuthorizationUrl: () => Effect.die(new Error("Google OAuth is not configured")),
  fetchProfile: () => Effect.die(new Error("Google OAuth is not configured")),
});

export const GoogleProviderLayer: Layer.Layer<GoogleProvider, never, never> = Layer.effect(
  GoogleProvider,
  Effect.gen(function* () {
    const maybeClientId = yield* Config.option(Config.string("GOOGLE_CLIENT_ID")).pipe(
      Effect.orDie
    );
    const maybeClientSecret = yield* Config.option(Config.string("GOOGLE_CLIENT_SECRET")).pipe(
      Effect.orDie
    );
    const maybeRedirectUri = yield* Config.option(Config.string("GOOGLE_REDIRECT_URI")).pipe(
      Effect.orDie
    );

    if (
      Option.isNone(maybeClientId) ||
      Option.isNone(maybeClientSecret) ||
      Option.isNone(maybeRedirectUri)
    ) {
      yield* Effect.logWarning("Google OAuth not configured — provider disabled");
      return disabledGoogleProvider;
    }

    const clientId = maybeClientId.value;
    const clientSecret = maybeClientSecret.value;
    const redirectUri = maybeRedirectUri.value;
    const client = new arctic.Google(clientId, clientSecret, redirectUri);

    return GoogleProvider.of({
      generateState: () => Effect.sync(() => arctic.generateState()),
      createAuthorizationUrl: (state) =>
        Effect.sync(() => {
          const codeVerifier = arctic.generateCodeVerifier();
          const url = client.createAuthorizationURL(state, codeVerifier, [
            "openid",
            "profile",
            "email",
          ]);
          return { url, codeVerifier };
        }),
      fetchProfile: (code, codeVerifier) =>
        Effect.tryPromise({
          try: async () => {
            if (!codeVerifier) {
              throw new Error("Google OAuth requires a code verifier (PKCE)");
            }
            const tokens = await client.validateAuthorizationCode(code, codeVerifier);
            const accessToken = tokens.accessToken();
            const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const info = (await res.json()) as {
              sub: string;
              email?: string;
              name?: string;
              picture?: string;
            };
            return {
              provider: "google" as const,
              providerUserId: info.sub,
              email: info.email ?? null,
              displayName: info.name ?? null,
              avatarUrl: info.picture ?? null,
            };
          },
          catch: (cause) => new OAuthCallbackFailed({ cause }),
        }),
    });
  })
);
