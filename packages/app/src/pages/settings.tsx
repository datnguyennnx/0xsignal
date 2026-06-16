import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { User, Palette, Terminal } from "lucide-react";
import { cn } from "@/core/utils/cn";
import { ApiConsole } from "@/features/settings/components/api-console";
import { AppearanceSettings } from "@/features/settings/components/appearance";
import { ProfileSettings } from "@/features/settings/components/profile";

type SettingsTab = "profile" | "api-console" | "appearance";

const SIDEBAR_ITEMS: Array<{
  value: SettingsTab;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    value: "profile",
    label: "Profile",
    icon: <User className="size-4 shrink-0" />,
  },
  {
    value: "api-console",
    label: "API Console",
    icon: <Terminal className="size-4 shrink-0" />,
  },
  {
    value: "appearance",
    label: "Appearance & Theme",
    icon: <Palette className="size-4 shrink-0" />,
  },
];

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const tab = searchParams.get("tab");
    if (tab === "api-console") return "api-console";
    if (tab === "appearance") return "appearance";
    return "profile";
  });
  // Dynamic document title
  useEffect(() => {
    document.title = "Settings | 0xsignal";
  }, []);

  return (
    <div className="container-fluid py-[clamp(1.5rem,3vw,3rem)] space-y-[clamp(1rem,1.5vw,1.5rem)] animate-in fade-in duration-200 ease-premium w-full">
      <div className="max-w-5xl mx-auto space-y-[clamp(0.125rem,0.2vw,0.25rem)] px-1">
        <h1 className="text-[clamp(1.125rem,1.5vw,1.5rem)] font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-[clamp(0.75rem,0.85vw,0.875rem)] text-muted-foreground">
          Configure your account preferences, themes, and exchange credentials.
        </p>
      </div>

      <div className="max-w-5xl mx-auto w-full bg-card/50 p-[clamp(1rem,1.5vw,1.5rem)] rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-12 w-full min-h-[300px]">
          {/* Left Column: Sidebar Navigation */}
          <div className="col-span-1 md:col-span-3 border-b md:border-b-0 md:border-r border-border/10 py-[clamp(1rem,1.5vw,1.5rem)] pr-[clamp(1rem,1.5vw,1.5rem)] flex flex-col gap-1">
            {SIDEBAR_ITEMS.map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  setActiveTab(item.value);
                  setSearchParams(item.value === "profile" ? {} : { tab: item.value }, {
                    replace: true,
                  });
                }}
                className={cn(
                  "w-full flex items-center gap-[clamp(0.5rem,0.6vw,0.625rem)] px-[clamp(0.625rem,0.8vw,0.875rem)] py-[clamp(0.5rem,0.8vw,0.75rem)] rounded-lg text-left transition-all duration-150 cursor-pointer",
                  activeTab === item.value
                    ? "bg-accent text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50 font-medium"
                )}
              >
                <span
                  className={cn(
                    activeTab === item.value ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {item.icon}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[clamp(0.6875rem,0.8vw,0.8125rem)] tracking-tight">
                    {item.label}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="col-span-1 md:col-span-9 py-[clamp(1rem,1.5vw,1.5rem)] pl-[clamp(1rem,1.5vw,1.5rem)] md:pl-[clamp(1.5rem,2.5vw,2rem)]">
            <div className="t-page-slide">
              <section
                className="t-page flex flex-col gap-5"
                data-active={activeTab === "profile" || undefined}
                key="profile"
              >
                <ProfileSettings />
              </section>
              <section
                className="t-page flex flex-col gap-5"
                data-active={activeTab === "api-console" || undefined}
                key="api-console"
              >
                <ApiConsole />
              </section>
              <section
                className="t-page flex flex-col gap-5"
                data-active={activeTab === "appearance" || undefined}
                key="appearance"
              >
                <AppearanceSettings />
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
