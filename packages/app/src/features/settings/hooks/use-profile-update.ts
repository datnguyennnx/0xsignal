import { useState } from "react";
import { toast } from "sonner";

import { useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { api } from "@/services/api";
import { useOwnAddress } from "@/hooks/use-effective-address";

import { applyProfileUpdate } from "../lib/profile-update";

export type ProfileSaveState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "error"; message: string };

export interface ProfileUpdateControls {
  save: (displayName: string) => Promise<boolean>;
  state: ProfileSaveState;
  reset: () => void;
}

export function useProfileUpdate(): ProfileUpdateControls {
  const queryClient = useQueryClient();
  const address = useOwnAddress() ?? "";
  const [state, setState] = useState<ProfileSaveState>({ status: "idle" });

  const save = async (rawDisplayName: string): Promise<boolean> => {
    const displayName = rawDisplayName.trim();
    if (displayName === "") {
      setState({ status: "error", message: "Display name required" });
      return false;
    }
    if (displayName.length > 100) {
      setState({
        status: "error",
        message: "Display name must be 100 characters or fewer",
      });
      return false;
    }

    setState({ status: "pending" });
    try {
      const updated = await api.updateProfile({ displayName });

      // The store backs every avatar/name surface in the app; local form state
      // alone would leave them showing the previous profile.
      applyProfileUpdate(updated);

      // Approval labels are account-scoped, so refresh that cache too when a
      // wallet is connected. The display name itself changes no approval.
      if (address !== "") {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.user.agentRegistrations(address),
        });
      }

      setState({ status: "idle" });
      toast.success("Profile updated");
      return true;
    } catch (err) {
      console.error("[Settings] Failed to update profile:", err);
      setState({ status: "error", message: "Failed to update profile. Try again." });
      return false;
    }
  };

  return {
    save,
    state,
    reset: () => {
      setState({ status: "idle" });
    },
  };
}
