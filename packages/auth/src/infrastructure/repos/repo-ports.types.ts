import type { Effect } from "effect";
import type { ExchangeAccount } from "../../domain/exchange-account";
import type { WalletChallenge } from "../../domain/wallet-challenge";
import type {
  AccountNotFound,
  DuplicateLabel,
  WalletAddressClaimed,
  WalletChallengeAddressMismatch,
  WalletChallengeExpired,
  WalletChallengeNotFound,
  WalletChallengeUsed,
} from "../../domain/errors";

export interface IssueWalletChallengeParams {
  readonly userId: string;
  readonly walletAddress: string;
  readonly nonce: string;
  readonly message: string;
  readonly expiresAt: Date;
}

export interface WalletChallengeLookupParams {
  readonly userId: string;
  readonly walletAddress: string;
  readonly nonce: string;
}

export type WalletChallengeLookupError =
  | WalletChallengeNotFound
  | WalletChallengeExpired
  | WalletChallengeUsed
  | WalletChallengeAddressMismatch;

export interface WalletChallengeRepoPort {
  /** Replaces any outstanding challenge for the same user + address. */
  readonly issue: (params: IssueWalletChallengeParams) => Effect.Effect<WalletChallenge>;

  readonly findActive: (
    params: WalletChallengeLookupParams,
  ) => Effect.Effect<WalletChallenge, WalletChallengeLookupError>;

  /** Atomically marks the challenge consumed; a second call fails as used. */
  readonly consume: (
    params: WalletChallengeLookupParams,
  ) => Effect.Effect<void, WalletChallengeLookupError>;
}

export interface CreateExchangeAccountParams {
  readonly userId: string;
  readonly exchangeSlug: string;
  readonly nodeType: "wallet" | "sub" | "vault";
  readonly parentId?: string;
  readonly walletAddress: string;
  readonly chain?: string;
  readonly label?: string | undefined;
  readonly color?: string;
  readonly sortOrder?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface VerifyWalletParams {
  readonly userId: string;
  readonly exchangeSlug: string;
  readonly walletAddress: string;
  readonly nonce: string;
  readonly label?: string | undefined;
}

export interface ExchangeAccountRepoPort {
  readonly create: (
    params: CreateExchangeAccountParams,
  ) => Effect.Effect<ExchangeAccount, AccountNotFound | DuplicateLabel | WalletAddressClaimed>;

  /**
   * Records a proven signature for the wallet. The address's rows are locked so
   * one signer at a time wins; an address proven by another user stays theirs.
   */
  readonly verifyWallet: (
    params: VerifyWalletParams,
  ) => Effect.Effect<ExchangeAccount, AccountNotFound | DuplicateLabel | WalletAddressClaimed>;

  readonly findById: (
    id: string,
    userId: string,
  ) => Effect.Effect<ExchangeAccount, AccountNotFound>;

  readonly findByUserId: (
    userId: string,
    exchangeSlug?: string,
  ) => Effect.Effect<readonly ExchangeAccount[]>;

  readonly findPrimary: (
    userId: string,
    exchangeSlug: string,
  ) => Effect.Effect<ExchangeAccount, AccountNotFound>;

  readonly findWithDescendants: (accountId: string) => Effect.Effect<readonly ExchangeAccount[]>;

  readonly resolveMasterWallet: (accountId: string) => Effect.Effect<string, AccountNotFound>;

  readonly setPrimary: (accountId: string, userId: string) => Effect.Effect<void, AccountNotFound>;

  readonly deactivate: (accountId: string, userId: string) => Effect.Effect<void, AccountNotFound>;
}
