import type { ReactNode } from "react";
import { cn } from "cn";

type Measure = "form" | "wide";

const MEASURE_CLASS: Record<Measure, string> = {
  form: "mx-auto max-w-(--measure-form)",
  wide: "max-w-none",
};

interface SettingsSectionProps {
  measure?: Measure;
  className?: string;
  children: ReactNode;
}

export function SettingsSection({ measure = "form", className, children }: SettingsSectionProps) {
  return (
    <section
      className={cn("flex w-full min-w-0 flex-col gap-stack", MEASURE_CLASS[measure], className)}
    >
      {children}
    </section>
  );
}
