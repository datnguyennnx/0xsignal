import { Layer } from "effect";
import { AuthServiceLayer } from "./application/auth.service.impl";
import { GoogleProviderLayer } from "./infrastructure/providers/google.provider";
import { GitHubProviderLayer } from "./infrastructure/providers/github.provider";
import { JwtServiceLayer } from "./infrastructure/jwt.service";
import { OAuthStateStoreLayer, AuthCodeStoreLayer } from "./infrastructure/state.store";
import { EncryptionServiceLayer } from "./infrastructure/encryption.service";
import { UserRepoLayer } from "./infrastructure/repos/user.repo";
import { OAuthAccountRepoLayer } from "./infrastructure/repos/oauth-account.repo";
import { ExchangeAccountRepoLayer } from "./infrastructure/repos/exchange-account.repo";
import { ExchangeCredentialRepoLayer } from "./infrastructure/repos/exchange-credential.repo";

export const AuthInfraLayer = Layer.mergeAll(
  GoogleProviderLayer,
  GitHubProviderLayer,
  JwtServiceLayer,
  OAuthStateStoreLayer,
  AuthCodeStoreLayer,
  EncryptionServiceLayer,
  UserRepoLayer,
  OAuthAccountRepoLayer,
  ExchangeAccountRepoLayer,
  ExchangeCredentialRepoLayer.pipe(Layer.provideMerge(EncryptionServiceLayer)),
);

/* AuthInfraLayer is provided at AppLayer level for cross-layer access. */
export const authLayer = AuthServiceLayer;
