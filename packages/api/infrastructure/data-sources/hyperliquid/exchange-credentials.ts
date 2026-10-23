import { Effect, Layer, Redacted } from "effect";
import { ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";
import { ExchangeAccountRepo } from "@0xsignal/auth";
import { ExchangeCredentialRepo } from "@0xsignal/auth";
import {
  ExchangeCredentials,
  type ResolvedExchangeCredentials,
} from "../../../application/exchange/credentials.contracts";
import type { ExchangeError } from "../../../application/exchange/contracts";
import { HyperliquidInternalError } from "../../../domain/errors";

const isPrivateKeyHex = (value: string): value is `0x${string}` =>
  /^0x[0-9a-fA-F]{64}$/.test(value);

const validatePrivateKey = (raw: string): `0x${string}` | null => {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const key = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return isPrivateKeyHex(key) ? key : null;
};

const makeExchangeClient = (privateKey: `0x${string}`): ExchangeClient => {
  const wallet = privateKeyToAccount(privateKey);
  const transport = new HttpTransport();
  return new ExchangeClient({ transport, wallet });
};

type AccountRepoService = typeof ExchangeAccountRepo.Service;
type CredentialRepoService = typeof ExchangeCredentialRepo.Service;

const resolveExchangeCredentials = (
  userId: string,
  accountRepo: AccountRepoService,
  credentialRepo: CredentialRepoService,
): Effect.Effect<ResolvedExchangeCredentials, ExchangeError> =>
  Effect.gen(function* () {
    const account = yield* accountRepo.findPrimary(userId, "hyperliquid");
    const credential = yield* credentialRepo.getActiveForAccount(account.id, "agent");
    const decrypted = yield* credentialRepo.getDecryptedAgent(credential.id, userId);

    const rawKey = Redacted.value(decrypted.privateKey);
    const privateKey = validatePrivateKey(rawKey);
    if (privateKey === null) {
      return yield* Effect.fail(
        new HyperliquidInternalError({
          message: "Invalid decrypted private key from credential store",
        }),
      );
    }

    return {
      exchange: makeExchangeClient(privateKey),
      ...(decrypted.vaultAddress !== undefined && { vaultAddress: decrypted.vaultAddress }),
    };
  });

export const exchangeCredentialsLayer: Layer.Layer<
  ExchangeCredentials,
  never,
  ExchangeAccountRepo | ExchangeCredentialRepo
> = Layer.effect(
  ExchangeCredentials,
  Effect.gen(function* () {
    const accountRepo = yield* ExchangeAccountRepo;
    const credentialRepo = yield* ExchangeCredentialRepo;

    return ExchangeCredentials.of({
      resolve: (userId) => resolveExchangeCredentials(userId, accountRepo, credentialRepo),
    });
  }),
);
