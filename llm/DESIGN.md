# Institutional Quant Trading Design System

## 1. Visual Theme & Atmosphere

A monochrome analytical workspace designed for clarity, focus, and execution safety.

The interface uses grayscale hierarchy, with semantic color reserved strictly for gain, loss, and warning states.

The design blends quantitative precision with Apple-inspired spatial fluidity. Depth is created through tonal contrast, translucency, and blur instead of heavy borders.

All surfaces prioritize clarity, stability, and legibility.

---

## 2. Color Palette & Roles

### Core Monochrome

- Background 0: `oklch(0.08 0 0)`
- Background 1: `oklch(0.10 0 0)`
- Surface 1: `oklch(0.12 0 0)`
- Surface 2: `oklch(0.15 0 0)`
- Surface 3: `oklch(0.18 0 0)`
- Overlay: `oklch(1 0 0 / 0.04)`

### Text Roles

- Primary: `oklch(0.97 0 0)`
- Secondary: `oklch(0.84 0 0)`
- Tertiary: `oklch(0.65 0 0)`
- Quaternary: `oklch(0.48 0 0)`
- Inverse: `oklch(0.08 0 0)`

### Borders & Dividers

- Soft Border: `oklch(1 0 0 / 0.05)`
- Hairline: `oklch(1 0 0 / 0.07)`
- Divider: `oklch(1 0 0 / 0.04)`

### Semantic Colors

- Gain: `oklch(0.72 0.17 150)`
- Loss: `oklch(0.64 0.21 25)`
- Warn: `oklch(0.77 0.16 80)`

### Principles

The UI remains predominantly monochrome. Semantic colors are used only when conveying trading meaning.

---

## 3. Tailwind v4 Theme Tokens

```css
@import "tailwindcss";

@theme {
  --color-bg-0: oklch(0.08 0 0);
  --color-bg-1: oklch(0.1 0 0);
  --color-surface-1: oklch(0.12 0 0);
  --color-surface-2: oklch(0.15 0 0);
  --color-surface-3: oklch(0.18 0 0);
  --color-overlay: oklch(1 0 0 / 0.04);

  --color-text-primary: oklch(0.97 0 0);
  --color-text-secondary: oklch(0.84 0 0);
  --color-text-tertiary: oklch(0.65 0 0);
  --color-text-quaternary: oklch(0.48 0 0);
  --color-text-inverse: oklch(0.08 0 0);

  --color-border-soft: oklch(1 0 0 / 0.05);
  --color-border-hairline: oklch(1 0 0 / 0.07);
  --color-divider: oklch(1 0 0 / 0.04);

  --color-gain: oklch(0.72 0.17 150);
  --color-loss: oklch(0.64 0.21 25);
  --color-warn: oklch(0.77 0.16 80);

  --radius-panel: 1rem;
  --radius-control: 9999px;
  --radius-field: 0.875rem;

  --spacing-touch: 2.75rem;
}
```

---

## 4. Typography Rules

### Font Stack

- UI: Inter, SF Pro Text, system-ui
- Display: SF Pro Display, Inter
- Mono: JetBrains Mono, SF Mono

### Numeric Rules

- Always use `tabular-nums`
- Use `slashed-zero` for identifiers
- Right-align all numeric values

### Scale

| Role    | Size                     | Weight |
| ------- | ------------------------ | ------ |
| Display | clamp(28px, 2vw, 48px)   | 600    |
| Title   | clamp(20px, 1.2vw, 32px) | 600    |
| Section | clamp(18px, 0.8vw, 24px) | 600    |
| Body    | clamp(14px, 0.3vw, 16px) | 400    |
| Compact | clamp(13px, 0.2vw, 14px) | 500    |
| Data    | clamp(12px, 0.2vw, 14px) | 500    |

Typography should feel compact, aligned, and precise.

---

## 5. Component Guidelines

### Panels

Modular analytical surfaces using tonal contrast and subtle depth. Avoid heavy borders.

### Buttons

- Primary: high contrast neutral
- Secondary: low contrast monochrome
- Destructive: requires confirmation

### Tables

- Right-aligned numeric columns
- Stable column widths
- Minimal hover states

### Inputs

- Pill or rounded shapes
- Clear focus states
- No layout shift

### Navigation

Quiet and secondary to data. Use contrast instead of color.

---

## 6. Layout Principles

### Structure

Modular multi-panel workspace:

- Watchlist
- Chart
- Orders
- Positions

### Spacing

4px base grid with compact density.

### Stability

No layout shift. Fixed structure across states.

---

## 7. Depth & Elevation

| Level | Description       |
| ----- | ----------------- |
| 0     | Base background   |
| 1     | Panel surface     |
| 2     | Overlay with blur |
| 3     | Active emphasis   |

Depth is created via contrast and blur, not shadows.

---

## 8. Responsive Behavior

| Breakpoint | Behavior        |
| ---------- | --------------- |
| Mobile     | Single column   |
| Tablet     | Split panels    |
| Desktop    | Multi-panel     |
| Wide       | Expanded layout |

### Mobile

- Thumb-friendly
- Safe-area aware
- Core actions always accessible

---

## 9. Risk & Execution UX

Execution flows must:

- Prevent accidental actions
- Show instrument, size, and cost clearly
- Require confirmation for high-risk actions

---

## 10. Tailwind Utility Direction

### Priorities

- `clamp()` typography
- `tabular-nums slashed-zero`
- OKLCH theme tokens
- `backdrop-blur`
- Minimal borders

### Motion

Subtle and functional only. No distraction.

---

## 11. Agent Prompt Guide

### Identity

- Institutional quant trading UI
- Monochrome + semantic color
- Apple-like depth
- Tailwind v4 + OKLCH
- Numeric precision

### Prompt Structure

Define:

1. Context
2. Device
3. Layout
4. Data structure
5. Risk level

Then refine visuals.

### Iteration Order

Context → Layout → Data → Safety → Visual polish

```

```
