import { Layer } from "effect";
import * as auth from "@0xsignal/auth";
import { CredentialVerifier } from "../../integrations/hyperliquid/data-sources/credential-verifier";

export const TestRouteEnvLayer = Layer.mergeAll(
  Layer.mock(auth.AuthService, {}),
  Layer.mock(auth.ExchangeAccountRepo, {}),
  Layer.mock(auth.ExchangeCredentialRepo, {}),
  Layer.mock(CredentialVerifier, {}),
);
