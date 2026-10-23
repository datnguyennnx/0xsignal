import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ElementType, JSX } from "react";
import { cn } from "cn";

export interface LiquidGlassProps {
  as?: keyof JSX.IntrinsicElements;
  borderRadius?: number | "inherit";
  blur?: number;
  saturation?: number;
  brightness?: number;
  refraction?: boolean;
  chromatic?: number;
  edge?: number;
  tint?: string;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_BLUR = 8;
const DEFAULT_SATURATION = 1.6;
const DEFAULT_BRIGHTNESS = 1.05;
const DEFAULT_EDGE = 1.5;

/** Below this box the refracted edge is a sub-pixel detail; a plain blur reads the same. */
const MIN_REFRACTION_WIDTH = 168;
const MIN_REFRACTION_HEIGHT = 56;

const MAP_MAX_DIMENSION = 256;
const MAP_NEUTRAL = 128;
const MAP_NEUTRAL_RANGE = 127;
const DISPLACEMENT_SCALE = 12;

const SHEEN_BACKGROUND =
  "linear-gradient(135deg, light-dark(hsl(0 0% 100% / .26), hsl(0 0% 100% / .07)) 0%, transparent 42%, transparent 64%, light-dark(hsl(0 0% 100% / .10), hsl(0 0% 100% / .03)) 100%)";

const RIM_BOX_SHADOW =
  "inset 0 1px 0 0 light-dark(hsl(0 0% 100% / .6), hsl(0 0% 100% / .18)), 0 0 0 1px light-dark(hsl(0 0% 0% / .08), hsl(0 0% 100% / .10)), 0 16px 40px -18px light-dark(hsl(220 20% 15% / .18), hsl(0 0% 0% / .55))";

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function parseCssLength(value: string): number {
  const match = /^[+-]?\d*\.?\d+/.exec(value.trim());
  return match === null ? 0 : Number(match[0]);
}

/**
 * Refraction through an SVG displacement filter is only reliable where the
 * engine composes `url()` backdrop filters; WebKit and Gecko fall back to blur.
 */
function detectRefraction(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  if (/firefox|fxios/i.test(ua)) return false;
  if (/^((?!chrome|chromium|edg|android).)*safari/i.test(ua)) return false;
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("backdrop-filter", "url(#x)")
  );
}

interface GlassPreferences {
  constrained: boolean;
  reducedMotion: boolean;
}

function useGlassPreferences(): GlassPreferences {
  const [state, setState] = useState<GlassPreferences>({
    constrained: false,
    reducedMotion: false,
  });
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return () => {};
    }
    const transparency = window.matchMedia("(prefers-reduced-transparency: reduce)");
    const colors = window.matchMedia("(forced-colors: active)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setState({
        constrained: transparency.matches || colors.matches,
        reducedMotion: motion.matches,
      });
    };
    update();
    const lists = [transparency, colors, motion];
    for (const list of lists) {
      list.addEventListener("change", update);
    }
    return () => {
      for (const list of lists) {
        list.removeEventListener("change", update);
      }
    };
  }, []);
  return state;
}

/**
 * Renders a rounded-rect signed-distance field into a displacement map. Layers
 * nearer the border pull harder (the `t` band), and a finite-difference gradient
 * turns that band into a normal encoded around neutral 128 in R/G.
 */
function buildDisplacementMap(
  width: number,
  height: number,
  radius: number,
  strength: number,
): string | null {
  if (width <= 0 || height <= 0) return null;
  // Half the device resolution: the map is a smooth gradient upscaled by feImage,
  // so sub-CSS-pixel detail buys nothing but costs a JS pass and a PNG encode.
  const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2) * 0.5;
  const cap = MAP_MAX_DIMENSION / Math.max(width * dpr, height * dpr);
  const scale = cap < 1 ? dpr * cap : dpr;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const halfW = width / 2;
  const halfH = height / 2;
  const r = Math.max(0, Math.min(radius, Math.min(halfW, halfH)));
  const hx = halfW - r;
  const hy = halfH - r;
  const band = Math.max(6, r * 0.6);
  const stepX = width / w;
  const stepY = height / h;

  const sdf = (x: number, y: number): number => {
    const qx = Math.abs(x) - hx;
    const qy = Math.abs(y) - hy;
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    return Math.hypot(ox, oy) - r;
  };

  const image = ctx.createImageData(w, h);
  const data = image.data;
  for (let y = 0; y < h; y++) {
    const py = (y + 0.5) * stepY - halfH;
    for (let x = 0; x < w; x++) {
      const px = (x + 0.5) * stepX - halfW;
      const d = sdf(px, py);
      const t = clamp01(1 - Math.abs(d) / band);
      const gx = sdf(px + 0.5, py) - sdf(px - 0.5, py);
      const gy = sdf(px, py + 0.5) - sdf(px, py - 0.5);
      const len = Math.hypot(gx, gy) || 1;
      const m = t * strength;
      const nx = (gx / len) * m;
      const ny = (gy / len) * m;
      const i = (y * w + x) * 4;
      data[i] = Math.max(0, Math.min(255, MAP_NEUTRAL + nx * MAP_NEUTRAL_RANGE));
      data[i + 1] = Math.max(0, Math.min(255, MAP_NEUTRAL + ny * MAP_NEUTRAL_RANGE));
      data[i + 2] = MAP_NEUTRAL;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

export function LiquidGlass({
  as = "span",
  borderRadius = "inherit",
  blur = DEFAULT_BLUR,
  saturation = DEFAULT_SATURATION,
  brightness = DEFAULT_BRIGHTNESS,
  refraction = false,
  edge = DEFAULT_EDGE,
  tint = "transparent",
  className,
  style,
}: LiquidGlassProps): JSX.Element {
  const rawId = useId();
  const filterId = useMemo(() => `liquid-glass-${rawId.replaceAll(":", "")}`, [rawId]);

  const { constrained, reducedMotion } = useGlassPreferences();
  const [supported] = useState(detectRefraction);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const hostRef = useRef<Element | null>(null);

  const refractionEnabled = refraction && !constrained && !reducedMotion;
  const refractionSupported = supported && refractionEnabled;
  const refractionActive = refractionSupported && mapUrl !== null;

  useEffect(() => {
    let frame = 0;
    let observer: ResizeObserver | null = null;
    const cleanup = () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };

    const host = hostRef.current;
    if (!refractionSupported || host === null) {
      return cleanup;
    }

    const rebuild = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width < MIN_REFRACTION_WIDTH || rect.height < MIN_REFRACTION_HEIGHT) {
        setMapUrl(null);
        return;
      }
      const cs = window.getComputedStyle(host);
      const parsed =
        borderRadius === "inherit" ? parseCssLength(cs.borderTopLeftRadius) : borderRadius;
      const radius = Number.isFinite(parsed) ? parsed : 0;
      const url = buildDisplacementMap(rect.width, rect.height, radius, edge);
      if (url !== null) setMapUrl((current) => (current === url ? current : url));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(rebuild);
    };
    rebuild();
    observer = new ResizeObserver(schedule);
    observer.observe(host);
    return cleanup;
  }, [refractionSupported, borderRadius, edge]);

  const optics = `saturate(${saturation}) brightness(${brightness})`;
  const backdropFilter = refractionActive
    ? `url(#${filterId}) blur(${blur}px) ${optics}`
    : constrained
      ? optics
      : `blur(${blur}px) ${optics}`;

  const setHost = useCallback((node: Element | null) => {
    hostRef.current = node;
  }, []);

  const Component: ElementType = as;

  return (
    <Component
      aria-hidden="true"
      data-liquid-glass=""
      data-liquid-glass-refraction={refractionActive ? "on" : "off"}
      data-liquid-glass-motion={reducedMotion && !constrained ? "none" : undefined}
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]",
        className,
      )}
      style={style}
    >
      <span
        ref={setHost}
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          borderRadius: "inherit",
          background: tint,
          backdropFilter,
          WebkitBackdropFilter: backdropFilter,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{ borderRadius: "inherit", background: SHEEN_BACKGROUND }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{ borderRadius: "inherit", boxShadow: RIM_BOX_SHADOW }}
      />
      {refractionActive ? (
        <svg
          aria-hidden="true"
          focusable="false"
          width="0"
          height="0"
          className="pointer-events-none absolute"
        >
          <filter
            id={filterId}
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={mapUrl ?? undefined}
              x="0"
              y="0"
              width="100%"
              height="100%"
              preserveAspectRatio="none"
              result="map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={DISPLACEMENT_SCALE}
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feGaussianBlur in="displaced" stdDeviation="0.5" />
          </filter>
        </svg>
      ) : null}
    </Component>
  );
}
