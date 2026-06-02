import { Layer } from "effect";
import { AuthService } from "./application/auth.service";
import { AuthServiceLayer } from "./application/auth.service.impl";
import { GoogleProviderLayer } from "./infrastructure/providers/google.provider";
import { GitHubProviderLayer } from "./infrastructure/providers/github.provider";
import { JwtServiceLayer } from "./infrastructure/jwt.service";
import { OAuthStateStoreLayer, AuthCodeStoreLayer } from "./infrastructure/state.store";
import { EncryptionServiceLayer } from "./infrastructure/encryption.service";
import { UserRepoLayer } from "./infrastructure/repos/user.repo";
import { OAuthAccountRepoLayer } from "./infrastructure/repos/oauth-account.repo";
import { PostgresConnectionPool } from "@0xsignal/shared/db/postgres";

const AuthInfraLayer = Layer.mergeAll(
  GoogleProviderLayer,
  GitHubProviderLayer,
  JwtServiceLayer,
  OAuthStateStoreLayer,
  AuthCodeStoreLayer,
  EncryptionServiceLayer,
  UserRepoLayer,
  OAuthAccountRepoLayer
);

export const authLayer: Layer.Layer<AuthService, never, PostgresConnectionPool> =
  AuthServiceLayer.pipe(Layer.provide(AuthInfraLayer));
