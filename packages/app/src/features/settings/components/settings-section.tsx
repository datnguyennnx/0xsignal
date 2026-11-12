import type { ReactNode } from "react";
import { cn } from "cn";

interface SettingsSectionProps {
  className?: string;
  children: ReactNode;
}

export function SettingsSection({ className, children }: SettingsSectionProps) {
  return (
    <section className={cn("flex w-full min-w-0 flex-col", className)}>
      <div className="flex w-full min-w-0 max-w-(--measure-form) flex-col gap-stack">
        {children}
      </div>
    </section>
  );
}
