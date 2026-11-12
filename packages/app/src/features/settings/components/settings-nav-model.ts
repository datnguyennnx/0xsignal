import { Palette, SlidersHorizontal, Terminal, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SettingsTab = "profile" | "api-console" | "appearance" | "interface";

export const SETTINGS_NAV_ITEMS: ReadonlyArray<{
  value: SettingsTab;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "profile", label: "Profile", icon: User },
  { value: "api-console", label: "Trading Wallet", icon: Terminal },
  { value: "appearance", label: "Appearance", icon: Palette },
  { value: "interface", label: "Interface", icon: SlidersHorizontal },
];

export function isSettingsTab(value: unknown): value is SettingsTab {
  return SETTINGS_NAV_ITEMS.some((item) => item.value === value);
}
