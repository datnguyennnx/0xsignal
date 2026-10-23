import { Config, Context, Effect, Layer, Option, Predicate } from "effect";
import * as arctic from "arctic";
import type { OAuthProfile } from "../../domain/oauth-account";
import { OAuthCallbackFailed } from "../../domain/errors";

interface GitHubUser {
  readonly id: number;
  readonly login: string;
  readonly name: string | null;
  readonly email: string | null;
  readonly avatar_url: string | null;
}

interface GitHubEmail {
  readonly email: string;
  readonly primary: boolean;
  readonly verified: boolean;
}

const isArray = (value: unknown): value is readonly unknown[] => Array.isArray(value);

const optionalString = (value: unknown): string | null =>
  Predicate.isString(value) ? value : null;

const toGitHubUser = (value: unknown): GitHubUser => {
  if (
    !Predicate.isObject(value) ||
    typeof value.id !== "number" ||
    typeof value.login !== "string"
  ) {
    throw new TypeError("Malformed GitHub /user response");
  }
  return {
    id: value.id,
    login: value.login,
    name: optionalString(value.name),
    email: optionalString(value.email),
    avatar_url: optionalString(value.avatar_url),
  };
};

const isGitHubEmail = (value: unknown): value is GitHubEmail =>
  Predicate.isObject(value) &&
  typeof value.email === "string" &&
  typeof value.primary === "boolean" &&
  typeof value.verified === "boolean";

const toGitHubEmails = (value: unknown): readonly GitHubEmail[] =>
  isArray(value) ? value.filter((entry) => isGitHubEmail(entry)) : [];

export interface GitHubProviderPort {
  readonly generateState: () => Effect.Effect<string>;
  readonly createAuthorizationUrl: (
    state: string,
  ) => Effect.Effect<{ url: URL; codeVerifier: null }>;
  readonly fetchProfile: (
    code: string,
    codeVerifier: string | null,
  ) => Effect.Effect<OAuthProfile, OAuthCallbackFailed>;
}

export class GitHubProvider extends Context.Service<GitHubProvider, GitHubProviderPort>()(
  "GitHubProvider",
) {}

const disabledGitHubProvider = GitHubProvider.of({
  generateState: () => Effect.die(new Error("GitHub OAuth is not configured")),
  createAuthorizationUrl: () => Effect.die(new Error("GitHub OAuth is not configured")),
  fetchProfile: () => Effect.die(new Error("GitHub OAuth is not configured")),
});

export const GitHubProviderLayer: Layer.Layer<GitHubProvider> = Layer.effect(
  GitHubProvider,
  Effect.gen(function* () {
    const maybeClientId = yield* Config.option(Config.string("GITHUB_CLIENT_ID")).pipe(
      Effect.orDie,
    );
    const maybeClientSecret = yield* Config.option(Config.string("GITHUB_CLIENT_SECRET")).pipe(
      Effect.orDie,
    );
    const maybeRedirectUri = yield* Config.option(Config.string("GITHUB_REDIRECT_URI")).pipe(
      Effect.orDie,
    );

    if (
      Option.isNone(maybeClientId) ||
      Option.isNone(maybeClientSecret) ||
      Option.isNone(maybeRedirectUri)
    ) {
      yield* Effect.logWarning("GitHub OAuth not configured — provider disabled");
      return disabledGitHubProvider;
    }

    const clientId = maybeClientId.value;
    const clientSecret = maybeClientSecret.value;
    const redirectUri = maybeRedirectUri.value;
    const client = new arctic.GitHub(clientId, clientSecret, redirectUri);

    return GitHubProvider.of({
      generateState: () => Effect.sync(() => arctic.generateState()),
      createAuthorizationUrl: (state) =>
        Effect.sync(() => ({
          url: client.createAuthorizationURL(state, ["user:email", "read:user"]),
          codeVerifier: null,
        })),
      fetchProfile: (code, _codeVerifier) =>
        Effect.tryPromise({
          try: async () => {
            const tokens = await client.validateAuthorizationCode(code);
            const accessToken = tokens.accessToken();

            const headers = {
              Authorization: `Bearer ${accessToken}`,
              "User-Agent": "0xsignal-auth",
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            };

            const [userRes, emailsRes] = await Promise.all([
              fetch("https://api.github.com/user", { headers }),
              fetch("https://api.github.com/user/emails", { headers }),
            ]);

            if (!userRes.ok) {
              throw new Error(`GitHub /user returned ${userRes.status}`);
            }

            const rawUser: unknown = await userRes.json();
            const user = toGitHubUser(rawUser);
            let primaryEmail: string | null = null;

            if (emailsRes.ok) {
              try {
                const rawEmails: unknown = await emailsRes.json();
                const emails = toGitHubEmails(rawEmails);
                primaryEmail = emails.find((e) => e.primary && e.verified)?.email ?? null;
              } catch {
                // Ignore email parsing failures
              }
            }

            if (primaryEmail === null && user.email !== null) {
              primaryEmail = user.email;
            }

            return {
              provider: "github" as const,
              providerUserId: user.id.toString(),
              email: primaryEmail,
              displayName: user.name ?? user.login,
              avatarUrl: user.avatar_url ?? null,
            };
          },
          catch: (cause) => new OAuthCallbackFailed({ cause }),
        }).pipe(
          Effect.tapError((err) => Effect.logError("GitHub OAuth error", { cause: err.cause })),
        ),
    });
  }),
);
