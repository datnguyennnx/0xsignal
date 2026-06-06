import { useState } from "react";
import { User, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/core/providers/auth-context";
import { api } from "@/services/api";
import { SaveBar } from "@/components/save-bar";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

export function ProfileSettings() {
  const { user, isLoading, signOut } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const initialDisplayName = user?.displayName ?? "";
  const hasChanges = displayName !== initialDisplayName;
  useUnsavedChanges(hasChanges);

  const handleSave = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
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
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setDisplayName(initialDisplayName);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-[clamp(1rem,1.5vw,1.5rem)]">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <User className="size-4 text-primary" />
            Profile
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Manage your avatar, display name, and account.
          </p>
        </div>
        <div className="border-t border-border/10" />
        <div className="flex items-center justify-center py-8">
          <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-[clamp(1rem,1.5vw,1.5rem)]">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <User className="size-4 text-primary" />
            Profile
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Manage your avatar, display name, and account.
          </p>
        </div>
        <div className="border-t border-border/10" />
        <p className="text-sm text-muted-foreground">Sign in to manage your profile.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-[clamp(1rem,1.5vw,1.5rem)]">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <User className="size-4 text-primary" />
            Profile
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Manage your avatar, display name, and account.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-14 ring-1 ring-border/20">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt="Avatar" />
              ) : (
                <AvatarFallback>
                  <User className="size-6 text-muted-foreground" />
                </AvatarFallback>
              )}
            </Avatar>
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">{user.displayName ?? "Unnamed"}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.provider} account</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="display-name">Display Name</Label>
          <Input
            id="display-name"
            type="text"
            placeholder="Your display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            autoComplete="name"
          />
        </div>

        <div className="flex justify-end">
          <Button variant="destructive" size="sm" onClick={signOut} className="gap-1.5">
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </div>
      </div>

      <SaveBar open={hasChanges} onSave={handleSave} onReset={handleReset} isSaving={isSaving} />
    </>
  );
}
