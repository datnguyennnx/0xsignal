import { api } from "@/services/api";

/**
 * Prove control of a wallet before the backend links it. The only value signed
 * is the server-issued challenge string; order signing uses signTypedData in
 * services/exchange and never calls this path.
 */
export type SignChallengeMessage = (args: { message: string }) => Promise<`0x${string}`>;

export async function linkWalletWithSignature(
  walletAddress: string,
  signMessage: SignChallengeMessage,
): Promise<void> {
  const challenge = await api.requestWalletChallenge(walletAddress);
  const signature = await signMessage({ message: challenge.message });
  await api.createWallet({
    walletAddress,
    nonce: challenge.nonce,
    signature,
  });
}
