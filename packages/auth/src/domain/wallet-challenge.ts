/**
 * A short-lived, single-use proof-of-control challenge for a wallet address.
 * The message is stored verbatim so the verification step signs exactly what
 * the server issued, never a client-supplied string.
 */
export interface WalletChallenge {
  readonly id: string;
  readonly userId: string;
  readonly walletAddress: string;
  readonly nonce: string;
  readonly message: string;
  readonly expiresAt: string;
  readonly consumedAt?: string;
}
