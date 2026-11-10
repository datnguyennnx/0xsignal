import { useSyncExternalStore, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Segmented, type SegmentedOption } from "@/components/ui/segmented";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import type {
  AmbientPreset,
  DensityPreset,
  GlassPreset,
  MarketColorsPreset,
  RadiusPreset,
  UiScalePreset,
} from "@/lib/appearance";
import { SettingsSection } from "./settings-section";

const GLASS_OPTIONS: readonly SegmentedOption<GlassPreset>[] = [
  { value: "clear", label: "Clear" },
  { value: "balanced", label: "Balanced" },
  { value: "frosted", label: "Frosted" },
];

const AMBIENT_OPTIONS: readonly SegmentedOption<AmbientPreset>[] = [
  { value: "off", label: "Off" },
  { value: "subtle", label: "Subtle" },
  { value: "vivid", label: "Vivid" },
];

const DENSITY_OPTIONS: readonly SegmentedOption<DensityPreset>[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" },
];

const UI_SCALE_OPTIONS: readonly SegmentedOption<UiScalePreset>[] = [
  { value: "small", label: "Small" },
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
  { value: "xl", label: "XL" },
];

const RADIUS_OPTIONS: readonly SegmentedOption<RadiusPreset>[] = [
  { value: "sharp", label: "Sharp" },
  { value: "default", label: "Default" },
  { value: "round", label: "Round" },
];

const MARKET_COLORS_OPTIONS: readonly SegmentedOption<MarketColorsPreset>[] = [
  { value: "default", label: "Default" },
  { value: "swapped", label: "Swapped" },
  { value: "colorblind", label: "Colorblind" },
];

const REDUCED_TRANSPARENCY_QUERY = "(prefers-reduced-transparency: reduce)";

function subscribeReducedTransparency(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const query = window.matchMedia(REDUCED_TRANSPARENCY_QUERY);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

function getReducedTransparencySnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_TRANSPARENCY_QUERY).matches;
}

function useReducedTransparency(): boolean {
  return useSyncExternalStore(
    subscribeReducedTransparency,
    getReducedTransparencySnapshot,
    () => false,
  );
}

interface SettingRowProps {
  label: string;
  hint: string;
  children: ReactNode;
}

function SettingRow({ label, hint, children }: SettingRowProps) {
  return (
    <div className="grid gap-field md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-stack">
      <div className="flex min-w-0 flex-col gap-field">
        <span className="type-control font-medium text-foreground">{label}</span>
        <span className="type-data text-muted-foreground">{hint}</span>
      </div>
      <div className="flex w-full md:w-auto md:justify-end">{children}</div>
    </div>
  );
}

interface SegmentedRowProps<T extends string> {
  label: string;
  hint: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
}

function SegmentedRow<T extends string>({
  label,
  hint,
  value,
  options,
  disabled = false,
  onChange,
}: SegmentedRowProps<T>) {
  return (
    <SettingRow label={label} hint={hint}>
      <Segmented
        aria-label={label}
        value={value}
        options={options}
        sizing="intrinsic"
        disabled={disabled}
        className="w-full md:w-auto"
        onValueChange={onChange}
      />
    </SettingRow>
  );
}

function InterfaceHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-stack sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-field">
        <h3 className="type-title font-semibold text-foreground">Interface</h3>
        <p className="type-body text-muted-foreground">Tune material, density and readability.</p>
        <p className="type-body text-muted-foreground">
          Changes apply instantly and persist on this device.
        </p>
      </div>
      <div className="sm:shrink-0">{children}</div>
    </div>
  );
}

function SettingGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-stack">
      <div className="flex flex-col gap-field">
        <h4 className="type-title font-semibold text-foreground">{title}</h4>
        <p className="type-body text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col gap-field">{children}</div>
    </section>
  );
}

function InterfaceControls() {
  const glass = useAppearanceStore((s) => s.glass);
  const ambient = useAppearanceStore((s) => s.ambient);
  const density = useAppearanceStore((s) => s.density);
  const uiScale = useAppearanceStore((s) => s.uiScale);
  const radius = useAppearanceStore((s) => s.radius);
  const marketColors = useAppearanceStore((s) => s.marketColors);
  const update = useAppearanceStore((s) => s.update);
  const reset = useAppearanceStore((s) => s.reset);
  const reducedTransparency = useReducedTransparency();

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[64rem] flex-col gap-section">
      <InterfaceHeading>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            reset();
            toast.success("Interface settings reset to defaults");
          }}
        >
          <RotateCcw className="size-icon" />
          Reset to defaults
        </Button>
      </InterfaceHeading>
      {reducedTransparency ? (
        <p className="type-body text-muted-foreground">
          Your system requests reduced transparency, so glass and ambient glow are disabled.
        </p>
      ) : null}
      <SettingGroup title="Material" description="Surface translucency and ambient lighting.">
        <SegmentedRow
          label="Glass"
          hint="Transparency of panels and controls."
          value={glass}
          options={GLASS_OPTIONS}
          disabled={reducedTransparency}
          onChange={(value) => {
            update({ glass: value });
          }}
        />
        <SegmentedRow
          label="Ambient glow"
          hint="Colored light behind the interface."
          value={ambient}
          options={AMBIENT_OPTIONS}
          disabled={reducedTransparency}
          onChange={(value) => {
            update({ ambient: value });
          }}
        />
      </SettingGroup>
      <SettingGroup title="Layout" description="Spacing, text size and corner rounding.">
        <SegmentedRow
          label="Density"
          hint="Spacing between elements."
          value={density}
          options={DENSITY_OPTIONS}
          onChange={(value) => {
            update({ density: value });
          }}
        />
        <SegmentedRow
          label="Text size"
          hint="Base scale for all text."
          value={uiScale}
          options={UI_SCALE_OPTIONS}
          onChange={(value) => {
            update({ uiScale: value });
          }}
        />
        <SegmentedRow
          label="Corners"
          hint="Roundness of panels and controls."
          value={radius}
          options={RADIUS_OPTIONS}
          onChange={(value) => {
            update({ radius: value });
          }}
        />
      </SettingGroup>
      <SettingGroup title="Data" description="How gains and losses are colored.">
        <SegmentedRow
          label="Market colors"
          hint="Gain and loss palette."
          value={marketColors}
          options={MARKET_COLORS_OPTIONS}
          onChange={(value) => {
            update({ marketColors: value });
          }}
        />
      </SettingGroup>
    </div>
  );
}

export function InterfaceSettings() {
  return (
    <SettingsSection measure="wide">
      <InterfaceControls />
    </SettingsSection>
  );
}
