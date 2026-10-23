import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { SaveBar } from "@/components/save-bar";
import { useAuthStore } from "@/stores/use-auth-store";
import { api } from "@/services/api";
import { useFormDirtyTracker } from "../hooks/use-form-dirty";
import { ProfileCard, ProfileLoading, ProfileSignedOut } from "./profile-sections";

export function ProfileSettings() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const initialDisplayName = user?.displayName ?? "";
  const hasChanges = displayName !== initialDisplayName;
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
      toast.success("Profile updated");
    } catch (err) {
      console.error("[Settings] Failed to update profile:", err);
      toast.error("Failed to update profile. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setDisplayName(initialDisplayName);
  };

  if (isLoading) {
    return <ProfileLoading />;
  }

  if (user === null) {
    return (
      <ProfileSignedOut
        onSignIn={() => {
          void navigate("/login");
        }}
      />
    );
  }

  return (
    <>
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
    </>
  );
}
