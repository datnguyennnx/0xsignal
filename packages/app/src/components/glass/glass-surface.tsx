import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
} from "react";
import type * as React from "react";
import type { JSX } from "react";
import { cn } from "cn";

export type GlassRenderer = "auto" | "webgl" | "svg" | "css";
export type GlassVariant = "regular" | "clear";

export interface GlassOptics {
  blur?: number;
  distortion?: number;
  chromatic?: number;
  displacement?: number;
  tint?: string;
}

export interface GlassSurfaceProps {
  as?: keyof JSX.IntrinsicElements;
  variant?: GlassVariant;
  renderer?: GlassRenderer;
  backdrop?: React.ReactNode;
  dimension?: { width: number; height: number };
  borderRadius?: number | string;
  optics?: GlassOptics;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const GLASS_MAX_INSTANCES = 6;

const DEFAULT_BLUR = 12;
const DEFAULT_DISTORTION = 0.08;
const DEFAULT_CHROMATIC = 0.004;
const DEFAULT_SVG_DISPLACEMENT = 12;

type GlassSource = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

interface GlassSurfaceEntry {
  source: GlassSource;
  target: HTMLCanvasElement;
  width: number;
  height: number;
  distortion: number;
  chromatic: number;
}

interface RegisteredEntry extends GlassSurfaceEntry {
  ctx: CanvasRenderingContext2D;
}

const VERTEX_SOURCE = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENT_SOURCE = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform float u_distort;
uniform float u_chromatic;
out vec4 outColor;
void main() {
  vec2 centered = v_uv - 0.5;
  vec2 offset = centered * u_distort;
  float r = texture(u_src, v_uv - offset + vec2(u_chromatic, 0.0)).r;
  float g = texture(u_src, v_uv - offset).g;
  float b = texture(u_src, v_uv - offset - vec2(u_chromatic, 0.0)).b;
  outColor = vec4(r, g, b, 1.0);
}`;

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

/**
 * A single WebGL2 context shared by every registered surface. Surfaces blit the
 * rendered frame into their own 2D canvas, so no per-instance WebGL context is
 * ever created.
 */
class GlassWebGLManager {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private textures = new Map<number, WebGLTexture>();
  private entries = new Map<number, RegisteredEntry>();
  private nextId = 1;
  private raf = 0;
  private failed = false;
  private lost = false;

  available(): boolean {
    return this.ensure();
  }

  hasCapacity(): boolean {
    return this.entries.size < GLASS_MAX_INSTANCES;
  }

  register(entry: GlassSurfaceEntry): number | null {
    if (!this.ensure()) return null;
    const gl = this.gl;
    if (!gl) return null;
    if (this.entries.size >= GLASS_MAX_INSTANCES) return null;
    const ctx = entry.target.getContext("2d");
    if (!ctx) return null;
    const texture: WebGLTexture | null = gl.createTexture();
    if (texture === null) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const id = this.nextId++;
    this.textures.set(id, texture);
    this.entries.set(id, { ...entry, ctx });
    this.start();
    return id;
  }

  unregister(id: number): void {
    const gl = this.gl;
    const texture = this.textures.get(id);
    if (gl && texture) gl.deleteTexture(texture);
    this.textures.delete(id);
    this.entries.delete(id);
    if (this.entries.size === 0) this.cancel();
  }

  private ensure(): boolean {
    if (this.failed) return false;
    if (this.gl && this.program) return true;
    if (typeof document === "undefined") return false;
    try {
      if (!this.canvas) {
        const canvas = document.createElement("canvas");
        canvas.width = 8;
        canvas.height = 8;
        this.canvas = canvas;
      }
      if (!this.gl) {
        const gl = this.canvas.getContext("webgl2", {
          alpha: true,
          antialias: false,
          depth: false,
          stencil: false,
          premultipliedAlpha: false,
        });
        if (!gl) {
          this.failed = true;
          return false;
        }
        this.gl = gl;
        this.canvas.addEventListener("webglcontextlost", this.onContextLost, false);
        this.canvas.addEventListener("webglcontextrestored", this.onContextRestored, false);
      }
      this.build();
      return this.program !== null;
    } catch {
      this.failed = true;
      return false;
    }
  }

  private build(): void {
    const gl = this.gl;
    if (!gl) return;
    const vertex = this.compile(gl.VERTEX_SHADER, VERTEX_SOURCE);
    const fragment = this.compile(gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
    if (!vertex || !fragment) return;
    const program: WebGLProgram | null = gl.createProgram();
    if (program === null) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
      gl.deleteProgram(program);
      return;
    }
    this.program = program;
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "a_pos");
    if (aPos >= 0) {
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    }
    this.uniforms = {
      src: gl.getUniformLocation(program, "u_src"),
      distort: gl.getUniformLocation(program, "u_distort"),
      chromatic: gl.getUniformLocation(program, "u_chromatic"),
    };
  }

  private compile(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    if (!gl) return null;
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private start(): void {
    if (this.raf || this.entries.size === 0) return;
    this.raf = requestAnimationFrame(this.tick);
  }

  private cancel(): void {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private tick = (): void => {
    this.raf = 0;
    this.render();
    if (this.entries.size > 0) this.start();
  };

  private render(): void {
    const gl = this.gl;
    const canvas = this.canvas;
    if (!gl || !canvas || !this.program || this.lost) return;
    gl.useProgram(this.program);
    for (const [id, entry] of this.entries) {
      const texture = this.textures.get(id);
      if (!texture) continue;
      const width = Math.max(1, Math.floor(entry.width));
      const height = Math.max(1, Math.floor(entry.height));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      this.upload(gl, entry.source);
      gl.uniform1i(this.uniforms.src ?? null, 0);
      gl.uniform1f(this.uniforms.distort ?? null, entry.distortion);
      gl.uniform1f(this.uniforms.chromatic ?? null, entry.chromatic);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      entry.ctx.clearRect(0, 0, width, height);
      entry.ctx.drawImage(canvas, 0, 0);
    }
  }

  private upload(gl: WebGL2RenderingContext, source: GlassSource): void {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  private onContextLost = (event: Event): void => {
    event.preventDefault();
    this.lost = true;
    this.program = null;
    this.buffer = null;
    this.uniforms = {};
    this.textures.clear();
    this.cancel();
  };

  private onContextRestored = (): void => {
    this.lost = false;
    this.build();
    this.start();
  };
}

const manager = new GlassWebGLManager();

interface GlassContextValue {
  manager: GlassWebGLManager;
  maxInstances: number;
}

const GlassContext = createContext<GlassContextValue | null>(null);

export function GlassProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const value = useMemo<GlassContextValue>(
    () => ({ manager, maxInstances: GLASS_MAX_INSTANCES }),
    [],
  );
  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>;
}

export function useGlassContext(): unknown {
  return useContext(GlassContext);
}

function useManager(): GlassWebGLManager {
  return useContext(GlassContext)?.manager ?? manager;
}

function asSource(node: Element | null): GlassSource | null {
  if (
    node instanceof HTMLImageElement ||
    node instanceof HTMLVideoElement ||
    node instanceof HTMLCanvasElement
  ) {
    return node;
  }
  return null;
}

function supportsSvgFilters(): boolean {
  if (typeof window === "undefined") return false;
  const cssSupported =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("backdrop-filter", "url(#x)");
  const svgSupported =
    "SVGFEDisplacementMapElement" in window && "SVGFETurbulenceElement" in window;
  return cssSupported && svgSupported;
}

const PREFERENCE_QUERIES = [
  "(prefers-reduced-transparency: reduce)",
  "(prefers-contrast: more)",
  "(prefers-reduced-motion: reduce)",
  "(forced-colors: active)",
];

function useConstrainedPreferences(): boolean {
  const [constrained, setConstrained] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return () => {};
    }
    const lists = PREFERENCE_QUERIES.map((query) => window.matchMedia(query));
    const update = () => {
      setConstrained(lists.some((list) => list.matches));
    };
    update();
    for (const list of lists) {
      list.addEventListener("change", update);
    }
    return () => {
      for (const list of lists) {
        list.removeEventListener("change", update);
      }
    };
  }, []);
  return constrained;
}

export function GlassSurface({
  as = "div",
  variant = "regular",
  renderer = "auto",
  backdrop,
  dimension,
  borderRadius,
  optics,
  className,
  style,
  children,
}: GlassSurfaceProps): JSX.Element {
  const gl = useManager();
  const rawId = useId();
  const filterId = useMemo(() => `glass-filter-${rawId.replaceAll(":", "")}`, [rawId]);
  const [backdropNode, setBackdropNode] = useState<HTMLSpanElement | null>(null);
  const [failedTierInputs, setFailedTierInputs] = useState<string | null>(null);
  const targetRef = useRef<HTMLCanvasElement | null>(null);
  const constrained = useConstrainedPreferences();

  const blur = optics?.blur ?? DEFAULT_BLUR;
  const distortion = optics?.distortion ?? DEFAULT_DISTORTION;
  const chromatic = optics?.chromatic ?? DEFAULT_CHROMATIC;
  const svgScale = optics?.displacement ?? DEFAULT_SVG_DISPLACEMENT;
  const tint = optics?.tint;
  const radius = typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius;

  const source = asSource(backdropNode?.firstElementChild ?? null);
  const tierInputs = `${renderer}|${String(dimension?.width)}x${String(dimension?.height)}|${String(constrained)}`;
  const webglFailed = failedTierInputs === tierInputs;

  const tier: GlassRenderer = useMemo(() => {
    if (constrained || renderer === "css") {
      return "css";
    }
    if (renderer === "svg") {
      return supportsSvgFilters() ? "svg" : "css";
    }
    if (!webglFailed && source !== null && gl.hasCapacity()) {
      return "webgl";
    }
    return supportsSvgFilters() ? "svg" : "css";
  }, [constrained, renderer, webglFailed, source, gl]);

  useEffect(() => {
    let registeredId: number | null = null;
    const demoteToFallback = () => {
      setFailedTierInputs(tierInputs);
    };
    if (tier === "webgl") {
      const target = targetRef.current;
      const entrySource = asSource(backdropNode?.firstElementChild ?? null);
      if (target === null || entrySource === null) {
        demoteToFallback();
      } else {
        const width = Math.max(1, Math.round(dimension?.width ?? (target.clientWidth || 1)));
        const height = Math.max(1, Math.round(dimension?.height ?? (target.clientHeight || 1)));
        target.width = width;
        target.height = height;
        registeredId = gl.register({
          source: entrySource,
          target,
          width,
          height,
          distortion,
          chromatic,
        });
        if (registeredId === null) {
          demoteToFallback();
        }
      }
    }
    return () => {
      if (registeredId !== null) {
        gl.unregister(registeredId);
      }
    };
  }, [tier, backdropNode, tierInputs, dimension, gl, distortion, chromatic]);

  const composited: CSSProperties = {
    position: style?.position ?? "relative",
    isolation: "isolate",
    overflow: "hidden",
    background:
      variant === "clear" ? "var(--glass-bg-clear, transparent)" : "var(--glass-bg, transparent)",
    border: "1px solid var(--glass-border, transparent)",
    backdropFilter:
      tier === "svg" ? `url(#${filterId})` : `blur(${blur}px) saturate(var(--glass-saturate, 1))`,
    WebkitBackdropFilter:
      tier === "svg" ? `url(#${filterId})` : `blur(${blur}px) saturate(var(--glass-saturate, 1))`,
    ...(radius !== undefined && radius !== "" ? { borderRadius: radius } : null),
    ...(tint !== undefined && tint !== "" ? { backgroundColor: tint } : null),
    ...style,
  };

  const Component: ElementType = as;

  return (
    <Component
      className={cn(
        "relative isolate overflow-hidden",
        variant === "clear" ? "glass-clear" : "glass",
        className,
      )}
      style={composited}
    >
      {backdrop !== undefined && backdrop !== null ? (
        <span
          ref={setBackdropNode}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={radius !== undefined && radius !== "" ? { borderRadius: radius } : undefined}
        >
          {backdrop}
        </span>
      ) : null}
      {tier === "webgl" ? (
        <canvas
          ref={targetRef}
          aria-hidden="true"
          data-glass-renderer="webgl"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      ) : null}
      {tier === "svg" ? (
        <svg
          aria-hidden="true"
          focusable="false"
          width="0"
          height="0"
          className="pointer-events-none absolute"
        >
          <filter
            id={filterId}
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.009 0.013"
              numOctaves={2}
              seed={4}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={svgScale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </svg>
      ) : null}
      <span className="relative flex h-full w-full flex-1 flex-col">{children}</span>
    </Component>
  );
}
