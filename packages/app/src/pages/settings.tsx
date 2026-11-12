import { useSearchParams } from "react-router";
import { ApiConsole } from "@/features/settings/components/api-console";
import { AgentRegistrationsWarning } from "@/features/settings/components/agent-registrations-warning";
import { AppearanceSettings } from "@/features/settings/components/appearance";
import { InterfaceSettings } from "@/features/settings/components/interface-settings";
import { ProfileSettings } from "@/features/settings/components/profile";
import {
  isSettingsTab,
  SETTINGS_NAV_ITEMS,
  type SettingsTab,
} from "@/features/settings/components/settings-nav-model";
import { SettingsNav } from "@/features/settings/components/settings-nav";
import { Surface } from "@/components/surface/surface";
import { Tabs, TabsContent } from "@/components/ui/tabs";

/*
 * The settings card's single content frame. It is the fluid grid track, so it
 * fills the row; the left inset and vertical rhythm live here instead of in
 * each pane, so switching tabs cannot move the content.
 */
export function SettingsContentFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-slot="settings-content-frame"
      className="flex w-full min-w-0 flex-col md:py-4 md:pl-4"
    >
      {children}
    </div>
  );
}

const SETTINGS_PANES: Record<SettingsTab, () => React.ReactNode> = {
  profile: () => <ProfileSettings />,
  "api-console": () => <ApiConsole />,
  appearance: () => <AppearanceSettings />,
  interface: () => <InterfaceSettings />,
};

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: SettingsTab = isSettingsTab(tabParam) ? tabParam : "profile";

  const selectTab = (tab: SettingsTab) => {
    setSearchParams(tab === "profile" ? {} : { tab }, { replace: true });
  };

  return (
    <div className="mx-auto flex w-full max-w-(--measure-settings) flex-col gap-panel">
      <div className="flex flex-col gap-1">
        <h1 className="type-heading font-semibold tracking-tight">Settings</h1>
        <p className="type-body text-muted-foreground">
          Configure your account preferences, themes, and exchange credentials.
        </p>
      </div>

      {/* Kept above the tabs so the alert does not shift the tab layout; only
          the Trading Wallet tab (which shows approvals) enables the query. */}
      <AgentRegistrationsWarning enabled={activeTab === "api-console"} />

      <Surface tier="content" as="section" className="w-full p-panel">
        <Tabs
          value={activeTab}
          onValueChange={(value: unknown) => {
            if (isSettingsTab(value)) selectTab(value);
          }}
          orientation="vertical"
          className="grid w-full grid-cols-1 gap-0 md:grid-cols-[var(--settings-nav-w)_minmax(0,1fr)]"
        >
          <SettingsNav />
          <SettingsContentFrame>
            {SETTINGS_NAV_ITEMS.map((item) => (
              <TabsContent key={item.value} value={item.value} className="outline-none">
                <h2 className="sr-only">{item.label}</h2>
                {SETTINGS_PANES[item.value]()}
              </TabsContent>
            ))}
          </SettingsContentFrame>
        </Tabs>
      </Surface>
    </div>
  );
}
