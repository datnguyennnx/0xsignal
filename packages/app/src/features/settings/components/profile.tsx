import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { SaveBar } from "@/components/save-bar";
import { useAuthStore } from "@/stores/use-auth-store";
import { api } from "@/services/api";
import { useFormDirtyTracker } from "../hooks/use-form-dirty";
import { ProfileCard, ProfileLoading, ProfileSignedOut } from "./profile-sections";
import { SettingsSection } from "./settings-section";

export function ProfileSettings() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const userDisplayName = user?.displayName ?? "";
  const [displayName, setDisplayName] = useState(userDisplayName);
  const [baselineDisplayName, setBaselineDisplayName] = useState(userDisplayName);
  const [isSaving, setIsSaving] = useState(false);

  // Adjust state during render when the store rehydrates a different name.
  const [prevUserDisplayName, setPrevUserDisplayName] = useState(userDisplayName);
  if (prevUserDisplayName !== userDisplayName) {
    setPrevUserDisplayName(userDisplayName);
    setBaselineDisplayName(userDisplayName);
  }

  const hasChanges = displayName !== baselineDisplayName;
  useFormDirtyTracker("settings-profile", hasChanges);

  const handleSave = async () => {
    const trimmed = displayName.trim();
    if (trimmed === "") {
      toast.error("Display name required");
      return;
    }
    if (trimmed.length > 100) {
      toast.error("Display name must be 100 characters or fewer");
      return;
    }
    setIsSaving(true);
    try {
      await api.updateProfile({ displayName: trimmed });
      setDisplayName(trimmed);
      setBaselineDisplayName(trimmed);
      toast.success("Profile updated");
    } catch (err) {
      console.error("[Settings] Failed to update profile:", err);
      toast.error("Failed to update profile. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setDisplayName(baselineDisplayName);
  };

  if (isLoading) {
    return (
      <SettingsSection measure="form">
        <ProfileLoading />
      </SettingsSection>
    );
  }

  if (user === null) {
    return (
      <SettingsSection measure="form">
        <ProfileSignedOut
          onSignIn={() => {
            void navigate("/login");
          }}
        />
      </SettingsSection>
    );
  }

  return (
    <SettingsSection measure="form">
      <ProfileCard
        user={user}
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        onSignOut={() => {
          void signOut();
        }}
      />

      <SaveBar
        open={hasChanges}
        onSave={() => {
          void handleSave();
        }}
        onReset={handleReset}
        isSaving={isSaving}
      />
    </SettingsSection>
  );
}
