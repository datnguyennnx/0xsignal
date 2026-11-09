import { useSearchParams } from "react-router-dom";
import { User, Palette, SlidersHorizontal, Terminal } from "lucide-react";
import { ApiConsole } from "@/features/settings/components/api-console";
import { AgentRegistrationsWarning } from "@/features/settings/components/agent-registrations-warning";
import { AppearanceSettings } from "@/features/settings/components/appearance";
import { InterfaceSettings } from "@/features/settings/components/interface-settings";
import { ProfileSettings } from "@/features/settings/components/profile";
import { Surface } from "@/components/surface/surface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SettingsTab = "profile" | "api-console" | "appearance" | "interface";

const SETTINGS_TABS: Array<{
  value: SettingsTab;
  label: string;
  icon: React.ReactNode;
  render: () => React.ReactNode;
}> = [
  {
    value: "profile",
    label: "Profile",
    icon: <User className="size-icon-sm shrink-0" />,
    render: () => <ProfileSettings />,
  },
  {
    value: "api-console",
    label: "Trading Wallet",
    icon: <Terminal className="size-icon-sm shrink-0" />,
    render: () => <ApiConsole />,
  },
  {
    value: "appearance",
    label: "Appearance",
    icon: <Palette className="size-icon-sm shrink-0" />,
    render: () => <AppearanceSettings />,
  },
  {
    value: "interface",
    label: "Interface",
    icon: <SlidersHorizontal className="size-icon-sm shrink-0" />,
    render: () => <InterfaceSettings />,
  },
];

function isSettingsTab(value: unknown): value is SettingsTab {
  return SETTINGS_TABS.some((item) => item.value === value);
}

function SettingsNav() {
  return (
    <div className="col-span-1 w-full py-2 pr-2 md:w-(--settings-nav-w) md:min-w-(--settings-nav-w) md:border-r">
      <TabsList
        aria-label="Settings sections"
        className="tier-identity w-full flex-col gap-1 [padding:0]!"
      >
        {SETTINGS_TABS.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className="group w-full justify-start gap-inline border-0 [border-radius:var(--radius-control)]! text-left hover:bg-(--control-hover-bg) data-active:bg-(--control-active-bg) data-active:text-info data-active:shadow-none!"
          >
            <span className="flex shrink-0 items-center text-muted-foreground group-data-[active]:text-info">
              {item.icon}
            </span>
            <span className="flex h-(--action-h) min-w-0 items-center type-control">
              {item.label}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: SettingsTab = isSettingsTab(tabParam) ? tabParam : "profile";

  const selectTab = (tab: SettingsTab) => {
    setSearchParams(tab === "profile" ? {} : { tab }, { replace: true });
  };

  return (
    <div className="container-fluid relative flex w-full flex-col gap-panel">
      <div className="mx-auto flex w-full max-w-(--measure-page) flex-col gap-panel">
        <div className="flex flex-col gap-1 px-4">
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
            className="grid w-full grid-cols-1 gap-0 md:grid-cols-[auto_minmax(0,1fr)]"
          >
            <SettingsNav />
            <div className="col-span-1 min-w-0 md:py-4 md:pl-4">
              {SETTINGS_TABS.map((item) => (
                <TabsContent key={item.value} value={item.value} className="outline-none">
                  <h2 className="sr-only">{item.label}</h2>
                  {item.render()}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </Surface>
      </div>
    </div>
  );
}
