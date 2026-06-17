import { Effect, Redacted } from "effect";
import { ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";
import { ExchangeAccountRepo } from "@0xsignal/auth";
import { ExchangeCredentialRepo } from "@0xsignal/auth";
import { HyperliquidInternalError } from "../../../domain/errors";
import type { ExchangeError } from "../../../application/exchange/contracts";

export const validatePrivateKey = (raw: string): `0x${string}` | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const key = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  const hex = key.startsWith("0x") ? key.slice(2) : key;
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  return key as `0x${string}`;
};

export const buildCoinToAsset = (meta: {
  universe: Array<{ name: string }>;
}): Map<string, number> =>
  new Map(meta.universe.map((u: { name: string }, i: number) => [u.name, i]));

export const makeExchangeClient = (privateKey: `0x${string}`): ExchangeClient => {
  const wallet = privateKeyToAccount(privateKey);
  const transport = new HttpTransport();
  return new ExchangeClient({ transport, wallet });
};

export type AccountRepoService = typeof ExchangeAccountRepo.Service;
export type CredentialRepoService = typeof ExchangeCredentialRepo.Service;

export type ResolvedCredentials = {
  readonly exchange: ExchangeClient;
  readonly vaultAddress?: string;
};

export const resolveExchangeCredentials = (
  userId: string,
  accountRepo: AccountRepoService,
  credentialRepo: CredentialRepoService,
): Effect.Effect<ResolvedCredentials, ExchangeError> =>
  Effect.gen(function* () {
    const account = yield* accountRepo.findPrimary(userId, "hyperliquid");
    const credential = yield* credentialRepo.getActiveForAccount(account.id, "agent");
    const decrypted = yield* credentialRepo.getDecryptedAgent(credential.id, userId);

    const rawKey = Redacted.value(decrypted.privateKey);
    const privateKey = validatePrivateKey(rawKey);
    if (!privateKey) {
      return yield* Effect.fail(
        new HyperliquidInternalError({
          message: "Invalid decrypted private key from credential store",
        }),
      );
    }

    return {
      exchange: makeExchangeClient(privateKey),
      vaultAddress: decrypted.vaultAddress,
    };
  });
