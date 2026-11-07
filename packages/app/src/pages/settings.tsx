import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { User, Palette, Terminal } from "lucide-react";
import { cn } from "cn";
import { ApiConsole } from "@/features/settings/components/api-console";
import { AgentRegistrationsWarning } from "@/features/settings/components/agent-registrations-warning";
import { AppearanceSettings } from "@/features/settings/components/appearance";
import { ProfileSettings } from "@/features/settings/components/profile";
import { Surface } from "@/components/surface/surface";

type SettingsTab = "profile" | "api-console" | "appearance";

const SETTINGS_TABS: Array<{
  value: SettingsTab;
  label: string;
  icon: React.ReactNode;
  render: () => React.ReactNode;
}> = [
  {
    value: "profile",
    label: "Profile",
    icon: <User className="size-4 shrink-0" />,
    render: () => <ProfileSettings />,
  },
  {
    value: "api-console",
    label: "Trading Wallet",
    icon: <Terminal className="size-4 shrink-0" />,
    render: () => <ApiConsole />,
  },
  {
    value: "appearance",
    label: "Appearance & Theme",
    icon: <Palette className="size-4 shrink-0" />,
    render: () => <AppearanceSettings />,
  },
];

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: SettingsTab =
    SETTINGS_TABS.find((item) => item.value === tabParam)?.value ?? "profile";
  useEffect(() => {
    document.title = "Settings | 0xsignal";
  }, []);

  const activeLabel = SETTINGS_TABS.find((item) => item.value === activeTab)?.label ?? "";

  return (
    <div className="container-fluid py-[clamp(1.5rem,3vw,3rem)] space-y-[clamp(1rem,1.5vw,1.5rem)] animate-in fade-in duration-200 ease-premium w-full">
      <div className="max-w-5xl mx-auto space-y-[clamp(0.125rem,0.2vw,0.25rem)] px-1">
        <h1 className="text-[length:var(--text-heading)] font-semibold tracking-tight">Settings</h1>
        <p className="text-[length:var(--text-data)] text-muted-foreground">
          Configure your account preferences, themes, and exchange credentials.
        </p>
      </div>

      <div className="max-w-5xl mx-auto w-full">
        <AgentRegistrationsWarning />
      </div>

      <Surface
        tier="content"
        as="section"
        material="glass"
        thickness="thick"
        className="max-w-5xl mx-auto w-full p-[clamp(1rem,1.5vw,1.5rem)]"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 w-full min-h-[300px]">
          <div className="col-span-1 md:col-span-3 md:border-r border-border/25 py-[clamp(1rem,1.5vw,1.5rem)] pr-[clamp(1rem,1.5vw,1.5rem)] flex flex-col gap-1">
            {SETTINGS_TABS.map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  setSearchParams(item.value === "profile" ? {} : { tab: item.value }, {
                    replace: true,
                  });
                }}
                data-material="glass"
                data-thickness="thin"
                data-active={activeTab === item.value || undefined}
                className={cn(
                  "tier-control w-full flex items-center gap-[clamp(0.5rem,0.6vw,0.625rem)] px-[clamp(0.625rem,0.8vw,0.875rem)] py-[clamp(0.5rem,0.8vw,0.75rem)] rounded-lg text-left transition-colors duration-150 cursor-pointer",
                  activeTab === item.value
                    ? "text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60 font-medium",
                )}
              >
                <span
                  className={cn(
                    activeTab === item.value ? "text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.icon}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[length:var(--text-micro)] tracking-tight">
                    {item.label}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="col-span-1 md:col-span-9 py-[clamp(1rem,1.5vw,1.5rem)] pl-[clamp(1rem,1.5vw,1.5rem)] md:pl-[clamp(1.5rem,2.5vw,2rem)]">
            <h2 className="sr-only">{activeLabel}</h2>
            <div className="t-page-slide">
              {SETTINGS_TABS.map((item) => (
                <section
                  key={item.value}
                  className="t-page flex flex-col gap-5"
                  data-active={activeTab === item.value || undefined}
                  inert={activeTab !== item.value}
                >
                  {item.render()}
                </section>
              ))}
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
}
