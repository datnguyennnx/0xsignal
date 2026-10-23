import { User, LogOut, Lock } from "lucide-react";
import type { AuthMeResponse } from "@0xsignal/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ProfileHeading() {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
        <User className="size-4 text-primary" />
        Profile
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Manage your avatar, display name, and account.
      </p>
    </div>
  );
}

export function ProfileLoading() {
  return (
    <div className="flex flex-col gap-[clamp(1rem,1.5vw,1.5rem)]">
      <ProfileHeading />
      <div className="flex items-center justify-center py-8">
        <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/40" />
      </div>
    </div>
  );
}

interface ProfileSignedOutProps {
  readonly onSignIn: () => void;
}

export function ProfileSignedOut({ onSignIn }: ProfileSignedOutProps) {
  return (
    <div className="flex flex-col gap-[clamp(1rem,1.5vw,1.5rem)]">
      <ProfileHeading />
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Lock className="size-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">Sign in to manage your profile</p>
          <p className="text-sm text-muted-foreground">
            Sign in to manage your avatar, display name, and account.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onSignIn}>
          Sign In
        </Button>
      </div>
    </div>
  );
}

interface ProfileCardProps {
  readonly user: AuthMeResponse;
  readonly displayName: string;
  readonly onDisplayNameChange: (value: string) => void;
  readonly onSignOut: () => void;
}

export function ProfileCard({
  user,
  displayName,
  onDisplayNameChange,
  onSignOut,
}: ProfileCardProps) {
  const avatarUrl = user.avatarUrl;

  return (
    <div className="flex flex-col gap-[clamp(1rem,1.5vw,1.5rem)]">
      <ProfileHeading />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-14 ring-1 ring-border/20">
            {avatarUrl !== null && avatarUrl !== "" ? (
              <AvatarImage src={avatarUrl} alt="Avatar" />
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
          onChange={(e) => {
            onDisplayNameChange(e.target.value);
          }}
          maxLength={100}
          autoComplete="name"
        />
      </div>

      <div className="flex justify-end">
        <Button variant="destructive" size="sm" onClick={onSignOut} className="gap-1.5">
          <LogOut className="size-3.5" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
