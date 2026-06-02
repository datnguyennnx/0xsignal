import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/core/providers/auth-context";
import { api } from "@/services/api";

export function UserNav() {
  const { isAuthenticated, isLoading, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [prevAvatarSrc, setPrevAvatarSrc] = useState<string | null>(null);

  const avatarSrc = user?.avatarUrl?.trim() || null;

  if (avatarSrc !== prevAvatarSrc) {
    setPrevAvatarSrc(avatarSrc);
    setImgError(false);
  }

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* best-effort */
    }
    signOut();
    navigate("/trade/BTC", { replace: true });
  }, [signOut, navigate]);

  if (isLoading) {
    return <div className="size-8 rounded-full bg-muted animate-pulse" />;
  }

  if (!isAuthenticated) {
    return (
      <Button
        variant="default"
        size="sm"
        className="h-8 px-3 text-xs font-medium"
        onClick={() => navigate("/login")}
      >
        Log in
      </Button>
    );
  }

  const initials = user?.displayName
    ? user.displayName.slice(0, 2).toUpperCase()
    : user?.userId
      ? user.userId.slice(0, 2).toUpperCase()
      : "U";

  // Shared avatar renderer
  const renderAvatar = (className = "size-10", fallbackClass = "text-sm font-medium") => (
    <Avatar className={className}>
      {avatarSrc && !imgError ? (
        <AvatarImage
          src={avatarSrc}
          alt={user?.displayName ?? "Avatar"}
          className="object-cover"
          onError={() => setImgError(true)}
          onLoad={() => setImgError(false)}
        />
      ) : null}
      <AvatarFallback className={fallbackClass}>{initials}</AvatarFallback>
    </Avatar>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative size-8 rounded-full">
          {renderAvatar("size-8", "text-xs font-medium")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[240px] border-border/20" align="end" sideOffset={10}>
        <div className="flex flex-col gap-1.5 p-2">
          {/* Settings Menu Item */}
          <DropdownMenuItem
            onClick={() => navigate("/settings")}
            className="flex items-center gap-2 cursor-pointer py-2 px-2.5 text-xs font-medium text-foreground/90 hover:text-foreground hover:bg-accent transition-colors rounded-md"
          >
            <Settings className="size-3.5 text-muted-foreground" />
            <span>Settings</span>
          </DropdownMenuItem>

          {/* Log Out */}
          <DropdownMenuItem
            onClick={handleLogout}
            className="flex items-center gap-2 cursor-pointer py-2 px-2.5 text-xs font-medium text-foreground/90 hover:text-foreground hover:bg-accent transition-colors rounded-md"
          >
            <LogOut className="size-3.5" />
            <span>Log out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
