import { toast } from "sonner";
import { api, deriveAgentAddress } from "@/services/api";
import { truncateAddress } from "@/core/utils/formatters";
import { useAuthStore } from "@/stores/use-auth-store";

interface SaveCredentialInput {
  privateKey: string;
  label: string;
}

const saveCredential = async ({ privateKey, label }: SaveCredentialInput): Promise<boolean> => {
  if (privateKey.trim() === "") {
    toast.error("API key required", {
      description: "Enter your Hyperliquid API key.",
    });
    return false;
  }

  try {
    const wallets = await api.listWallets();
    const primaryWallet = wallets[0];
    if (primaryWallet === undefined) {
      toast.error("No wallet linked", {
        description: "Link a wallet first.",
      });
      return false;
    }

    await api.createCredential({
      accountId: primaryWallet.id,
      agentAddress: deriveAgentAddress(privateKey),
      agentPrivateKey: privateKey.trim(),
      label: label.trim() || undefined,
    });

    toast.success("Credential saved", {
      description: "Encrypted at rest.",
    });
    return true;
  } catch (err) {
    console.error("[ApiConsole] Failed to save credential", err);
    toast.error("Unable to save credential", {
      description: "Check your API key and try again.",
    });
    return false;
  }
};

/** Credential + wallet mutations for the API console, with their user-facing feedback. */
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

  return { linkWallet, saveCredential };
}
