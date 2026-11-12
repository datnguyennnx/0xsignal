import { useState } from "react";
import { useNavigate } from "react-router";

import { SaveBar } from "@/components/save-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useFormDirtyTracker } from "../hooks/use-form-dirty";
import { useProfileSettings } from "../hooks/use-profile-settings";
import { useProfileUpdate } from "../hooks/use-profile-update";

import { ProfileCard, ProfileLoading, ProfileSignedOut } from "./profile-sections";
import { SettingsSection } from "./settings-section";

export function ProfileSettings() {
  const navigate = useNavigate();
  const { state: profileState, signOut } = useProfileSettings();
  const userDisplayName =
    profileState.status === "ready" ? (profileState.data.displayName ?? "") : "";
  // `null` means "showing the account's name"; a string is the user's draft.
  // Deriving instead of resyncing keeps a rehydrated name from being overwritten.
  const [draft, setDraft] = useState<string | null>(null);
  const displayName = draft ?? userDisplayName;
  const { save, state: saveState, reset: resetSaveState } = useProfileUpdate();

  const hasChanges = draft !== null && draft !== userDisplayName;
  useFormDirtyTracker("settings-profile", hasChanges);

  const handleSave = async () => {
    const saved = await save(displayName);
    if (saved) setDraft(null);
  };

  const handleReset = () => {
    setDraft(null);
    resetSaveState();
  };

  if (profileState.status === "loading") {
    return (
      <SettingsSection>
        <ProfileLoading />
      </SettingsSection>
    );
  }

  if (profileState.status === "idle") {
    return (
      <SettingsSection>
        <ProfileSignedOut
          onSignIn={() => {
            void navigate("/login");
          }}
        />
      </SettingsSection>
    );
  }

  return (
    <SettingsSection>
      <ProfileCard
        user={profileState.data}
        displayName={displayName}
        onDisplayNameChange={setDraft}
        onSignOut={() => {
          void signOut();
        }}
      />

      {saveState.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{saveState.message}</AlertDescription>
        </Alert>
      ) : null}

      <SaveBar
        open={hasChanges}
        onSave={() => {
          void handleSave();
        }}
        onReset={handleReset}
        isSaving={saveState.status === "pending"}
      />
    </SettingsSection>
  );
}
