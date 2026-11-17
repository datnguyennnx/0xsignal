import { useSyncExternalStore, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";

import { Surface } from "@/components/surface/surface";
import { Button } from "@/components/ui/button";
import { Segmented, type SegmentedOption } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import {
  AMBIENT_PRESET_INTENSITY,
  DEFAULT_APPEARANCE,
  GLASS_PRESET_KNOBS,
  type AmbientPreset,
  type DensityPreset,
  type GlassPreset,
  type MarketColorsPreset,
  type RadiusPreset,
  type UiScalePreset,
} from "@/lib/appearance";

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
    <div className="grid gap-field md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center md:gap-stack">
      <div className="flex min-w-0 flex-col gap-field">
        <span className="type-control font-medium text-foreground">{label}</span>
        <span className="type-data text-muted-foreground">{hint}</span>
      </div>
      <div className="flex w-full min-w-0">{children}</div>
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
        sizing="fill"
        disabled={disabled}
        className="w-full"
        onValueChange={onChange}
      />
    </SettingRow>
  );
}

interface SliderRowProps {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

const SLIDER_STEP = 0.01;

function SliderRow({ label, hint, value, min, max, disabled = false, onChange }: SliderRowProps) {
  return (
    <div className="flex min-w-0 flex-col gap-field">
      <div className="flex min-w-0 items-start justify-between gap-inline">
        <div className="flex min-w-0 flex-col gap-field">
          <span className="type-control font-medium text-foreground">{label}</span>
          <span className="type-data text-muted-foreground">{hint}</span>
        </div>
        <span className="shrink-0 rounded-chip tier-well px-2 py-0.5 type-data tabular-nums text-muted-foreground">
          {value.toFixed(2)}
        </span>
      </div>
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={SLIDER_STEP}
        disabled={disabled}
        onValueChange={(next) => {
          onChange(typeof next === "number" ? next : (next[0] ?? value));
        }}
      />
    </div>
  );
}

/** Presets sit above; the knobs below them are opt-in fine tuning. */
function AdvancedRows({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-stack border-l border-border/40 pl-4">
      <span className="type-label font-medium tracking-wide text-muted-foreground uppercase">
        Advanced
      </span>
      <div className="flex min-w-0 flex-col gap-stack">{children}</div>
    </div>
  );
}

function GroupReset({ target, onClick }: { target: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="auto"
      aria-label={`Reset ${target} to defaults`}
      className="type-label text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      Reset
    </Button>
  );
}

/** Decorative wash so the glass tier has something to blur and tint against. */
function GlassPreview({ subdued }: { subdued: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative isolate flex min-h-32 items-center justify-center overflow-hidden rounded-panel p-panel",
        subdued ? "bg-muted" : "bg-(--accent)",
      )}
    >
      {subdued ? null : (
        <>
          <div className="absolute inset-0 bg-(--ambient-1)" />
          <div className="absolute inset-0 bg-(--ambient-2)" />
        </>
      )}
      <Surface
        tier="floating"
        material="glass"
        thickness="thick"
        radius="panel"
        className="relative w-full max-w-sm p-panel"
      >
        <p className="type-label tracking-wide text-muted-foreground uppercase">Preview</p>
        <p className="type-title font-semibold text-foreground">Floating glass</p>
        <p className="type-body text-muted-foreground">Sample content over the wash.</p>
      </Surface>
    </div>
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
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-stack">
      <div className="flex items-start justify-between gap-inline">
        <div className="flex min-w-0 flex-col gap-field">
          <h4 className="type-title font-semibold text-foreground">{title}</h4>
          <p className="type-body text-muted-foreground">{description}</p>
        </div>
        {action === undefined ? null : <div className="shrink-0">{action}</div>}
      </div>
      <div className="flex min-w-0 flex-col gap-stack">{children}</div>
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
  const glassAlpha = useAppearanceStore((s) => s.glassAlpha);
  const glassBlur = useAppearanceStore((s) => s.glassBlur);
  const glassEdge = useAppearanceStore((s) => s.glassEdge);
  const glassSaturate = useAppearanceStore((s) => s.glassSaturate);
  const glassBrightness = useAppearanceStore((s) => s.glassBrightness);
  const ambientIntensity = useAppearanceStore((s) => s.ambientIntensity);
  const noise = useAppearanceStore((s) => s.noise);
  const update = useAppearanceStore((s) => s.update);
  const reset = useAppearanceStore((s) => s.reset);
  const reducedTransparency = useReducedTransparency();

  const resetGlass = () => {
    const preset = DEFAULT_APPEARANCE.glass;
    const knobs = GLASS_PRESET_KNOBS[preset];
    // The preset alone is a no-op when it is already selected, so the knobs go with it.
    update({
      glass: preset,
      glassAlpha: knobs.alpha,
      glassBlur: knobs.blur,
      glassEdge: knobs.edge,
      glassSaturate: knobs.saturate,
      glassBrightness: knobs.brightness,
    });
  };

  const resetLighting = () => {
    const preset = DEFAULT_APPEARANCE.ambient;
    update({
      ambient: preset,
      ambientIntensity: AMBIENT_PRESET_INTENSITY[preset],
      noise: DEFAULT_APPEARANCE.noise,
    });
  };

  const resetLayout = () => {
    update({
      density: DEFAULT_APPEARANCE.density,
      uiScale: DEFAULT_APPEARANCE.uiScale,
      radius: DEFAULT_APPEARANCE.radius,
    });
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-section">
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
      <SettingGroup
        title="Glass"
        description="Start from a preset, then fine-tune how glass surfaces render."
        action={<GroupReset target="glass" onClick={resetGlass} />}
      >
        <SegmentedRow
          label="Preset"
          hint="A quick starting point for the knobs below."
          value={glass}
          options={GLASS_OPTIONS}
          disabled={reducedTransparency}
          onChange={(value) => {
            update({ glass: value });
          }}
        />
        <GlassPreview subdued={reducedTransparency} />
        <AdvancedRows>
          <SliderRow
            label="Transparency"
            hint="Opacity of glass fills; higher is more solid."
            value={glassAlpha}
            min={0.4}
            max={1.6}
            disabled={reducedTransparency}
            onChange={(value) => {
              update({ glassAlpha: value });
            }}
          />
          <SliderRow
            label="Blur"
            hint="Backdrop blur strength behind panels."
            value={glassBlur}
            min={0}
            max={2}
            disabled={reducedTransparency}
            onChange={(value) => {
              update({ glassBlur: value });
            }}
          />
          <SliderRow
            label="Edge definition"
            hint="Contrast of the rim around glass."
            value={glassEdge}
            min={0}
            max={1.6}
            disabled={reducedTransparency}
            onChange={(value) => {
              update({ glassEdge: value });
            }}
          />
          <SliderRow
            label="Saturation"
            hint="Color intensity seen through the glass."
            value={glassSaturate}
            min={0.8}
            max={2}
            disabled={reducedTransparency}
            onChange={(value) => {
              update({ glassSaturate: value });
            }}
          />
          <SliderRow
            label="Brightness"
            hint="Lift applied to the glass fill."
            value={glassBrightness}
            min={0.96}
            max={1.12}
            disabled={reducedTransparency}
            onChange={(value) => {
              update({ glassBrightness: value });
            }}
          />
        </AdvancedRows>
      </SettingGroup>
      <SettingGroup
        title="Lighting"
        description="Ambient light and film grain behind the interface."
        action={<GroupReset target="lighting" onClick={resetLighting} />}
      >
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
        <AdvancedRows>
          <SliderRow
            label="Ambient intensity"
            hint="Strength of the colored wash."
            value={ambientIntensity}
            min={0}
            max={1.5}
            disabled={reducedTransparency}
            onChange={(value) => {
              update({ ambientIntensity: value });
            }}
          />
          <SliderRow
            label="Noise"
            hint="Film grain layered over the backdrop."
            value={noise}
            min={0}
            max={1.5}
            onChange={(value) => {
              update({ noise: value });
            }}
          />
        </AdvancedRows>
      </SettingGroup>
      <SettingGroup
        title="Layout"
        description="Spacing, text size and corner rounding."
        action={<GroupReset target="layout" onClick={resetLayout} />}
      >
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
      <SettingGroup
        title="Data"
        description="How gains and losses are colored."
        action={
          <GroupReset
            target="data"
            onClick={() => {
              update({ marketColors: DEFAULT_APPEARANCE.marketColors });
            }}
          />
        }
      >
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
  return <InterfaceControls />;
}
