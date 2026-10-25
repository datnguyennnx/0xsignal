import { Effect, Layer } from "effect";
import * as auth from "@0xsignal/auth";
import { CredentialVerifier } from "../../integrations/hyperliquid/data-sources/credential-verifier";
import type { HttpError } from "../../platform/http/error-response";
import type { RouteEnvironment } from "../contracts";

export const TestRouteEnvLayer = Layer.mergeAll(
  Layer.mock(auth.AuthService, {}),
  Layer.mock(auth.ExchangeAccountRepo, {}),
  Layer.mock(auth.ExchangeCredentialRepo, {}),
  Layer.mock(CredentialVerifier, {}),
);

/**
 * Unsafe on purpose: presents an arbitrary runtime value as a handler failure,
 * violating the declared `HttpError` error channel. The router's defensive
 * decode exists precisely to survive exactly such values, so tests must be able
 * to produce them; production code must never construct one.
 */
export const injectUnhandledFailure = (
  failure: unknown,
): Effect.Effect<Response, HttpError, RouteEnvironment> =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the cast is the point of this helper
  Effect.fail(failure) as Effect.Effect<Response, HttpError, RouteEnvironment>;
