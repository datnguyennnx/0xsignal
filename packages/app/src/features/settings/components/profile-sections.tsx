import { User, LogOut, Lock } from "lucide-react";
import type { AuthMeResponse } from "@0xsignal/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

function ProfileHeading() {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="flex items-center gap-inline type-title font-semibold text-foreground">
        <User className="size-icon" />
        Profile
      </h3>
      <p className="type-body text-muted-foreground">
        Manage your avatar, display name, and account.
      </p>
    </div>
  );
}

export function ProfileLoading() {
  return (
    <div className="flex flex-col gap-stack">
      <ProfileHeading />
      <div className="flex flex-col gap-inline py-6">
        <Skeleton className="h-(--control-h) w-full max-w-(--measure-form)" />
        <Skeleton className="h-(--control-h) w-2/3 max-w-(--measure-form)" />
      </div>
    </div>
  );
}

interface ProfileSignedOutProps {
  readonly onSignIn: () => void;
}

export function ProfileSignedOut({ onSignIn }: ProfileSignedOutProps) {
  return (
    <div className="flex flex-col gap-stack">
      <ProfileHeading />
      <div className="flex flex-col items-center gap-stack py-6 text-center">
        <Lock className="size-icon-lg text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Sign in to manage your profile</p>
          <p className="type-body text-muted-foreground">
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
    <div className="flex flex-col gap-stack">
      <ProfileHeading />

      <div className="flex items-center gap-stack">
        <Avatar className="size-(--avatar-size)">
          {avatarUrl !== null && avatarUrl !== "" ? (
            <AvatarImage src={avatarUrl} alt="Avatar" />
          ) : (
            <AvatarFallback>
              <User className="size-[calc(var(--icon)*1.5)] text-muted-foreground" />
            </AvatarFallback>
          )}
        </Avatar>
        <div className="flex flex-col gap-1">
          <p className="type-control font-medium text-foreground">
            {user.displayName ?? "Unnamed"}
          </p>
          <p className="type-label text-muted-foreground capitalize">{user.provider} account</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
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
          className="max-w-(--measure-form)"
        />
      </div>

      <Button variant="destructive" onClick={onSignOut} className="gap-inline self-end">
        <LogOut className="size-icon" />
        Sign out
      </Button>
    </div>
  );
}
