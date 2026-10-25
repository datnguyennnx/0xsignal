import { toast } from "sonner";
import { useSignMessage } from "wagmi";
import { truncateAddress } from "@/core/utils/formatters";
import { linkWalletWithSignature } from "@/services/wallet/link";
import { useAuthStore } from "@/stores/use-auth-store";

/** Wallet linking for the API console. Trading is signed in-wallet, never by a stored key. */
export function useCredentialActions() {
  const refreshWalletStatus = useAuthStore((s) => s.refreshWalletStatus);
  const { mutateAsync: signMessageAsync } = useSignMessage();

  const linkWallet = async (walletAddress: string): Promise<void> => {
    try {
      await linkWalletWithSignature(walletAddress, signMessageAsync);
      toast.success("Wallet linked", {
        description: `${truncateAddress(walletAddress)} linked to your account.`,
      });
      void refreshWalletStatus();
    } catch (err) {
      console.error("[ApiConsole] Failed to link wallet", err);
      toast.error("Unable to link wallet", {
        description: "Sign the verification message in your wallet and try again.",
      });
    }
  };

  return { linkWallet };
}
