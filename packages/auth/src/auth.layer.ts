import { Layer } from "effect";
import { AuthServiceLayer } from "./application/auth.service.impl";
import { GoogleProviderLayer, GitHubProviderLayer } from "./infrastructure/providers";
import { JwtServiceLayer } from "./infrastructure/jwt.service";
import { OAuthStateStoreLayer, AuthCodeStoreLayer } from "./infrastructure/state.store";
import { UserRepoLayer } from "./infrastructure/repos/user.repo";
import { OAuthAccountRepoLayer } from "./infrastructure/repos/oauth-account.repo";
import { ExchangeAccountRepoLayer } from "./infrastructure/repos/exchange-account.repo";
import { AgentRegistrationRepoLayer } from "./infrastructure/repos/agent-registration.repo";

export const AuthInfraLayer = Layer.mergeAll(
  GoogleProviderLayer,
  GitHubProviderLayer,
  JwtServiceLayer,
  OAuthStateStoreLayer,
  AuthCodeStoreLayer,
  UserRepoLayer,
  OAuthAccountRepoLayer,
  ExchangeAccountRepoLayer,
  AgentRegistrationRepoLayer,
);

/* AuthInfraLayer is provided at AppLayer level for cross-layer access. */
export const authLayer = AuthServiceLayer;
