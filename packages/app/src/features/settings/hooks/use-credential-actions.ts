import { toast } from "sonner";
import { api } from "@/services/api";
import { truncateAddress } from "@/core/utils/formatters";
import { useAuthStore } from "@/stores/use-auth-store";

/** Wallet linking for the API console. Trading is signed in-wallet, never by a stored key. */
export function useCredentialActions() {
  const refreshWalletStatus = useAuthStore((s) => s.refreshWalletStatus);

  const linkWallet = async (walletAddress: string): Promise<void> => {
    try {
      await api.createWallet({ walletAddress });
      toast.success("Wallet linked", {
        description: `${truncateAddress(walletAddress)} linked to your account.`,
      });
      void refreshWalletStatus();
    } catch (err) {
      console.error("[ApiConsole] Failed to link wallet", err);
      toast.error("Unable to link wallet", {
        description: "Check your wallet connection and try again.",
      });
    }
  };

  return { linkWallet };
}
