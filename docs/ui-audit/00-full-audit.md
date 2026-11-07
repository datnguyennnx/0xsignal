# 0xsignal UI Consistency Audit — Combined Report

| Field           | Value                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Date            | 2026-11-06                                                                                           |
| Scope           | `packages/app/src` — primitives, surfaces, feature components, screens, dialogs                      |
| Source of truth | `packages/app/src/index.css` (962 lines)                                                             |
| Method          | Static read + mechanical scan (TS/TSX, excluding `index.css`, `node_modules`, `dist`)                |
| Render          | None. No app was rendered; visual claims are read-verified and marked `UNVERIFIED`                   |
| Findings        | 61 rows after de-dupe (briefed roll-up: 29 High / 22 Medium / 10 Low; §5 row tags are authoritative) |
| Paths           | All `file:line` paths below are relative to `packages/app/src/` unless absolute                      |

## Discrepancy: the brief names a stylesheet that does not exist

> The audit brief references `liquid-glass-theme.css`. It does **not** exist anywhere in the repository: **0 filename matches** for `*liquid-glass*` and **0 string matches** for `liquid-glass` across the tree. `packages/app/src/index.css` (962 lines) is the only application stylesheet and the real token source. Every token claim in this report is grounded there. `UNVERIFIED` only for render-only behavior.

## 1. Executive summary

The system has a credible token layer and a real Surface contract, but the cascade and the component layer both bypass it: `thickness="thick"` is silently overridden, the depth-0 blur gate leaks onto controls, and Base UI's presence-only `data-active` never matches the CSS rules written for it. Contrast and state handling are the weakest areas (5% alpha control fill used as text at ~1.05:1; `/60` muted text at ~1.99:1; focus rings removed on interactive containers), and chart paint partially survives theme switches while candles do not. **Verdict: not shippable as consistent — 61 findings, 29 High under the briefed roll-up; the system needs a cascade repair before new surfaces are added.** Biggest risks: the thick no-op (A-01), control blur leak (A-02), dead active-state paint (S-01), contrast failures (C-01, C-02), and stale chart colors after theme switch (P-01..P-04, H-02).

**First action:** land Batch 1 (P-01..P-04) alone — it is behavior-visible on every theme switch — then freeze tokens and repair the cascade in Batch 2 before any styling work resumes.

## 2. Scorecard

Formula: `score = 100 − weighted severity (8/High, 3/Medium, 1/Low)`, normalized to the area's surface count. Scores are not raw counts.

| Area            | Score  | Findings       | High   | Medium | Low   |
| --------------- | ------ | -------------- | ------ | ------ | ----- |
| Canvas          | 90     | 4              | 1      | 2      | 1     |
| Content         | 55     | 4              | 3      | 1      | 0     |
| Control         | 60     | 3              | 2      | 1      | 0     |
| Glass           | 58     | 7              | 4      | 3      | 0     |
| Color semantics | 55     | 9              | 7      | 2      | 0     |
| States          | 52     | 5              | 3      | 2      | 0     |
| Elevation       | 68     | 2              | 1      | 1      | 0     |
| Shape/size      | 62     | 4              | 0      | 2      | 2     |
| Charts          | 72     | 7              | 5      | 2      | 0     |
| Accessibility   | 50     | 9              | 6      | 3      | 0     |
| Theme parity    | 58     | 6              | 0      | 4      | 2     |
| **Overall**     | **61** | **60 defects** | **32** | **23** | **5** |

Row 61 is `H-01` (PASS, 0 defects). The briefed 29/22/10 split predates final triage and differs from the row tags; where they conflict, the row tag governs the remediation batch. Accessibility (50) and States (52) are the lowest scores and match the highest defect density.

## 3. Scope and coverage

| Dimension             | Count                    | Coverage                                                                                              |
| --------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| UI primitives         | 19                       | All opened in full (`components/ui/*`)                                                                |
| Surface modules       | 5 production (+1 test)   | All opened (`surface.tsx`, `tiers.ts`, `surface-context.ts`, `scroll-edge.tsx`, `ambient-canvas.tsx`) |
| Feature components    | 92 files (87 production) | Every file cited in §5 opened; remainder covered by mechanical scan                                   |
| Screens / routes      | 9 screens / 12 routes    | Route hosts plus redirect/wildcard targets read                                                       |
| Dialog/modal surfaces | 9                        | Primitive hosts read; feature dialogs cited where defective                                           |
| CSS                   | 1 file, 962 lines        | Fully read                                                                                            |
| Mechanical scan       | All production TS/TSX    | Excludes `index.css`, `node_modules`, `dist`                                                          |

Skipped: test files, stories, and generated types (no styling surface). No screen was rendered, so geometry, blur, and stacking verdicts are static (`UNVERIFIED` where noted). `L-01` (header over panel) and `L-02` (header scroll-away) are structural reads from z-index and overflow declarations.

| #   | Route            | Kind           | Screen                        |
| --- | ---------------- | -------------- | ----------------------------- |
| 1   | `/login`         | screen         | Login                         |
| 2   | `/auth/callback` | screen         | Auth callback                 |
| 3   | `/trade`         | screen         | Trade                         |
| 4   | `/portfolio`     | screen         | Portfolio                     |
| 5   | `/whales`        | screen         | Whales                        |
| 6   | `/whales/:id`    | screen         | Whale detail                  |
| 7   | `/calendar`      | screen         | Calendar                      |
| 8   | `/settings`      | screen         | Settings                      |
| 9   | `*`              | screen         | Not found                     |
| 10  | `/`              | redirect       | → `/trade` (`inferred`)       |
| 11  | `/auth`          | redirect       | → `/login` (`inferred`)       |
| 12  | `/portfolio/:id` | wildcard child | Portfolio detail (`inferred`) |

Counts are asserted from the router host; redirect targets are `inferred` because no render was performed.

## 4. Token inventory

| Family          | Representative tokens                                                               | State                                                 |
| --------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Neutrals        | `--neutral-0` … `--neutral-900`                                                     | Healthy                                               |
| Surface / layer | `--surface-*`, `--layer-content-fill`, `--layer-raised-fill`                        | Healthy, but `@theme` mappings unused (T-04)          |
| Glass / tier    | `--glass-fill-*`, `--plate-fill`, `--tier-floating-fill`, `--tier-edge`             | Duplicated roles (T-02, T-03)                         |
| Control         | `--control-bg`, `--control-hover-bg`, `--control-active-bg`, `--control-active-rim` | Canonical, under-consumed                             |
| Option card     | `--option-card-bg/-hover/-active/*-border`                                          | Healthy                                               |
| Semantic        | `--gain`, `--loss`, `--warn`, `--info`, `--semantic-*`                              | Exist; components re-derive them (A-05)               |
| Data series     | `--data-1` … `--data-8`, `--data-grid/-axis/-crosshair`                             | Exist; orderbook/funding use gain/loss instead (C-03) |
| Typography      | `--text-compact`, `--text-data`, `--text-micro`, `--text-heading`                   | Duplicate `data`/`micro` (T-01)                       |
| Control metrics | `--control-h-*`, `--control-px-*`, `--control-text-*`, `--control-radius-*`         | Healthy, responsive via `clamp()`                     |
| Radius / shadow | `--radius-panel/-overlay/-control/-chip`, `--shadow-e1..e3`                         | Healthy                                               |
| Layout          | `--app-header-height`, `--app-page-pad/-gap`, `--trading-region-height`             | Exist; under-used (L-01, L-02, L-06)                  |
| Motion          | `--duration-fast/-base/-exit`, `--page-fade-*`                                      | Healthy                                               |

- **BROKEN-REF: none.** Every `var(--…)` resolves in both `:root,.light` and `.dark`.
- **UNUSED: 11 `@theme` color mappings** — `surface-canvas`, `surface-base`, `surface-raised`, `surface-overlay`, `surface-inset`, `surface-floating`, `glass-border`, `glass-thin`, `glass`, `glass-thick`, `info` (T-04). Components use raw `bg-surface-*` or `var()` instead.
- **Duplicate roles:** `--text-data` == `--text-micro` (0.75rem); `--glass-border` == `--border` with `--tier-edge` as a third alias; `--blur-glass/--saturate-glass` duplicate `--glass-blur/--glass-saturate`.
- **Naming lie:** `tiers.ts:31-37` defaults `solid`, `content`, `control` to `material: "glass"`, but `index.css:669-679` paints `.tier-content` and `.tier-solid` with opaque `--layer-*-fill` and `backdrop-filter: none`. The attribute says glass; the paint is opaque. This is the root of A-01 and decision (b).

## 5. Findings

Severity is per row. `Defect` states the observed behavior; `Fix` is the canonical direction, not the patch.

### A — Surface placement and glass contract

| ID   | Code  | Sev    | File:line                                                                                               | Defect                                                                                                                                                                                      | Canonical fix                                                              | Token                                         |
| ---- | ----- | ------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------- |
| A-01 | L1/L4 | High   | `pages/settings.tsx:63-69` + `index.css:657-679`                                                        | `tier="content" material="glass" thickness="thick"` loses to the later equal-specificity `.tier-content[data-material="glass"]`; thick is a no-op and the shell paints opaque content fill. | Fix cascade order or scope thick to floating/control; never content+thick. | `--layer-content-fill` / `--glass-fill-thick` |
| A-02 | L1/L4 | High   | `index.css:619-652` + `main-layout.tsx:30` + `api-console-body.tsx:110`                                 | Depth-0 blur gate matches `.tier-control`, so controls get 24px blur; the control rule also kills the thin fill, making `data-thickness` dead on controls.                                  | Scope blur to `:not(.tier-control)`; controls use `--control-bg` only.     | `--control-bg` / `--glass-blur`               |
| A-03 | L5/L4 | High   | `dialog.tsx:250-252`, `modal.tsx:273-275`, `button.tsx:49-50`, `toggle.tsx:40-41`, `settings.tsx:80-83` | Hand-rolled tier attrs duplicate the Surface contract; some omit `data-glass-depth`, so identical tiers paint differently.                                                                  | Use `Surface` or a shared `surfaceAttrs()`; remove hardcoded depth.        | `data-tier/material/thickness`                |
| A-04 | X2/L5 | High   | `sonner.tsx:17-22,37`                                                                                   | Tier class only, no `data-material`/`thickness`/`depth`; paint survives only via Sonner CSS vars.                                                                                           | Wrap in Surface or emit tier attrs.                                        | `--tier-floating-fill`                        |
| A-06 | L3/E1 | Medium | `orderbook-depth.tsx:382-393`                                                                           | Hover popup is glass-thin floating with 36px overlay lift; should read as a plate/detail.                                                                                                   | `material="plate"` or `--shadow-tooltip`.                                  | `--plate-fill` / `--shadow-tooltip`           |
| A-07 | L4    | Medium | `indicator-chips.tsx:28-34`                                                                             | Glass over media without `variant="clear" overMedia dim`.                                                                                                                                   | clear + overMedia + dim, or plate.                                         | `--clear-dimming`                             |
| A-08 | L2    | Medium | `orderbook-widget.tsx:155-163` vs `:140-144`                                                            | Tier lives on a backdrop Surface, not the padding/children root; empty and loaded DOM differ.                                                                                               | Make the root the Surface.                                                 | tier-content                                  |

### C — Color semantics, contrast, and fills

| ID   | Code  | Sev    | File:line                                                                                                    | Defect                                                                                             | Canonical fix                                              | Token                    |
| ---- | ----- | ------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------ |
| C-01 | C6/A1 | High   | `indicator-modal-explorer.tsx:59`                                                                            | `text-secondary` resolves to the 5% alpha control fill → ~1.05:1 text.                             | `text-secondary-foreground` or `text-foreground`.          | `--secondary-foreground` |
| C-02 | A1    | High   | `positions-table.tsx:23`, `shared-table-components.tsx:57`, `pagination.tsx:87`                              | `text-muted-foreground/60` → ~1.99:1 in light.                                                     | Full `--muted-foreground`.                                 | `--muted-foreground`     |
| C-03 | C1/C6 | High   | `orderbook-row-cells.tsx:36,43`                                                                              | Orderbook rows use `--gain/--loss` instead of market-data tokens.                                  | `--data-up` / `--data-down`.                               | `--data-*`               |
| C-04 | A2    | High   | `funding-history-rows.tsx:30-32`                                                                             | Funding sign is stripped; direction is color-only.                                                 | Render the signed amount.                                  | `--gain/--loss` + sign   |
| C-05 | C6    | High   | `trade-dropdown.columns.helpers.tsx:17,19`                                                                   | Sort arrows use gain/loss as direction, not price.                                                 | `text-foreground`.                                         | `--foreground`           |
| C-06 | C6    | High   | `order-form-fields.tsx:121,134`                                                                              | Buy/Sell label uses `--primary-foreground`, coupling it to primary, not gain/loss.                 | `--gain-foreground`/`--loss-foreground` or `--background`. | semantic pair            |
| C-07 | C2    | High   | `order-form-fields.tsx:156,249,264,283,298`; `order-size-field.tsx:112,139`; `close-limit-modal.tsx:112,137` | Fields override `bg-input` with `bg-background/80 border-border/40`; panel fill changes the value. | `bg-input`, `border-border`.                               | `--input`                |
| C-08 | C4    | High   | `button.tsx:12`; `native-select.tsx:27`                                                                      | `dark:bg-input/40` re-implements theme tokens; hover becomes a no-op in native-select.             | Remove dark branch; use control tokens.                    | `--control-bg`           |
| C-09 | C6    | High   | `api-console-body.tsx:109-115,32,118`; `market-terminal-header.tsx:81`                                       | `text-primary` used as an accent; light `--primary` is near-black.                                 | `--info` or `--data-1`.                                    | `--info`                 |
| C-10 | C6    | High   | `open-orders-table.tsx` (TP/SL link)                                                                         | `text-gain` on a TP/SL link that is not a long position.                                           | `text-foreground` / `--info`.                              | `--info`                 |
| C-11 | C7    | High   | `indicator-modal-explorer.tsx:59`; `insights-panel.tsx:111`                                                  | Raw `color-mix(... var(--ink) 8% ...)` in a class; not a token.                                    | `bg-secondary`.                                            | `--control-bg`           |
| C-12 | C3    | Medium | `tabs.tsx:51,70`                                                                                             | `data-active:bg-foreground/5` and `text-foreground/60` opacity hacks; active token unused.         | `--control-active-bg` / `--muted-foreground`.              | `--control-active-bg`    |

### S — State and interaction contract

| ID   | Code  | Sev    | File:line                                                    | Defect                                                                                                                         | Canonical fix                                  | Token                  |
| ---- | ----- | ------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------- |
| S-01 | M2    | High   | `index.css:637,645` vs `tabs.tsx:51,70`                      | Base UI emits `data-active` as presence, so `[data-active="true"]` never matches; canonical active paint is dead.              | Select `[data-active]`.                        | `--control-active-bg`  |
| S-02 | M2    | High   | `toggle.tsx:8`                                               | `aria-pressed:bg-accent` fights the tier pressed contract; pressed equals hover.                                               | Remove it; let the tier apply.                 | `--control-active-bg`  |
| S-03 | M3/A1 | High   | `whale-positions-table.tsx:202`                              | Focus ring removed (`outline-none`) and replaced by a `/5` tint.                                                               | `ring-2 ring-ring inset`.                      | `--ring`               |
| S-04 | A11y  | High   | `resizable-wrapper.tsx:196-222` + `corner-handles.tsx:33-48` | Resize handles are bare divs: no role, no keyboard, no aria.                                                                   | `role="separator"` + tabIndex + arrow keys.    | —                      |
| S-05 | C6/L2 | High   | `month-day-cell.tsx:32-34`                                   | `cn` merge lets `bg-muted` win over `bg-accent` when selected and out-of-month; `aria-pressed` true but paint says unselected. | One state per cell.                            | `--accent` / `--muted` |
| S-06 | A3    | Medium | `month-day-cell.tsx:33`                                      | Today only `ring-primary/40`; no `aria-current`.                                                                               | `aria-current` + `ring-ring`.                  | `--ring`               |
| S-07 | M3    | High   | `order-form-fields.tsx:188-227`                              | Real checkbox is `sr-only`; the painted box has no `peer-focus-visible` ring.                                                  | `peer-focus-visible:ring-2 ring-ring/40`.      | `--ring`               |
| S-08 | A2/M2 | High   | `appearance.tsx:18-31`                                       | Theme cards are buttons with no `aria-pressed`/radio and no focus ring; hover scale shifts the selection card.                 | `radiogroup`/`radio` + ring; static elevation. | `--ring`               |
| S-09 | A11y  | High   | `settings.tsx:73-118`                                        | Settings nav is plain buttons; no tablist, `aria-selected`, or `aria-controls`.                                                | Surface as button `role="tab"` + `tabpanel`.   | —                      |
| S-10 | M3    | High   | `dropdown-menu.tsx:80,105`                                   | Menu items lack a focus-visible ring.                                                                                          | `focus-visible:ring-ring/40`.                  | `--ring`               |
| S-11 | A2    | Medium | `twap-content.tsx:110-124`                                   | Sub-tabs have no `aria-pressed` or `role="tab"`.                                                                               | `role="tab"` + `aria-selected`.                | —                      |
| S-12 | A2    | Medium | `portfolio-pnl-chart.tsx:212-226`                            | Chart-view switcher is raw buttons with no `aria-selected`.                                                                    | Segmented primitive.                           | `--control-active-bg`  |

### L — Layout, stacking, scroll, and empty states

| ID   | Code    | Sev    | File:line                                                  | Defect                                                                                   | Canonical fix                                 | Token                     |
| ---- | ------- | ------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------- |
| L-01 | Z-index | High   | `side-panel.tsx:58` vs `main-layout.tsx:36`                | Mobile side panel `z-40` sits under the `z-50` header; header covers title and close.    | Raise above header or inset by header height. | `--app-header-height`     |
| L-02 | Scroll  | High   | `main-layout.tsx:35-40` + `asset-trading-grid.tsx:133-137` | Header is not sticky; the trade canvas can exceed the region and scroll the header away. | Sticky header or a main scroll container.     | `--app-header-height`     |
| L-03 | Scroll  | Medium | `whales.tsx:23-25` + `whale-positions-table.tsx:99`        | Surface is the region plus a ~48px `h2`; the page scrolls by the heading height.         | `flex-1 min-h-0` chain.                       | `--trading-region-height` |
| L-04 | Scroll  | Medium | `index.css:768-783` + `scroll-edge.tsx`                    | Only two scroll edges exist; whale table, settings body, and side panel hard-cut.        | One `ScrollEdge` per container.               | `--blur-glass`            |
| L-05 | Empty   | Medium | `calendar-board.tsx:131-147`                               | `EmptyState` and the full event-less grid render together.                               | Exclusive branches.                           | `EmptyState`              |
| L-06 | Spacing | Medium | `settings.tsx:51`                                          | Page padding 40–64px against 16px siblings.                                              | `--app-page-gap`.                             | `--app-page-pad`          |
| L-07 | Spacing | Medium | `month-grid.tsx:34,45` + `month-day-cell.tsx:31`           | 20px cell gutters against a 4px header; 8px outer inset.                                 | One gap source.                               | `--panel-gap`             |
| L-08 | Layout  | Low    | `settings.tsx:70,108-119`                                  | All tabs mount in one grid cell, leaving dead height.                                    | Active-only height/display.                   | —                         |

### T — Token system debt

| ID   | Code  | Sev    | File:line                         | Defect                                                                                                      | Canonical fix           | Token            |
| ---- | ----- | ------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------- |
| T-01 | Token | Medium | `index.css:40-41`                 | `--text-data` == `--text-micro` == 0.75rem; one generated utility is dead.                                  | Merge or differentiate. | —                |
| T-02 | Token | Medium | `index.css:237,374` vs `:196,333` | `--glass-border` is identical to `--border`; `--tier-edge` is a third alias.                                | Keep one edge token.    | —                |
| T-03 | Token | Medium | `index.css:123-124` vs `:219-220` | `--blur-glass/--saturate-glass` duplicate `--glass-blur/--glass-saturate`; `scroll-edge` uses the old pair. | Unify.                  | —                |
| T-04 | Token | Low    | `index.css:8-51`                  | 11 `@theme` color mappings unused (`surface-*`, `glass-*`, `info`).                                         | Prune or consume.       | —                |
| T-05 | Token | Low    | `index.css:116-119`               | Stale 0.875rem fallbacks in calendar/tooltip/dropdown/indicator modal; real radius is 20px.                 | Remove fallbacks.       | `--radius-panel` |
| T-06 | Token | Low    | `index.css:451-455`               | `scrollbar-gutter` on `*` reserves tracks on non-scrolling surfaces.                                        | `html` only.            | —                |

### P — Duplication and chart paint

| ID   | Code | Sev    | File:line                                                                    | Defect                                                                                           | Canonical fix                                     | Token              |
| ---- | ---- | ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------ |
| P-01 | D2   | High   | `use-chart-data.ts:80-89` vs `:103`                                          | Stable-identity early return fires before the `isDark` check; volume bars keep old theme colors. | Move the `isDark` check above the identity guard. | `--data-up/down`   |
| P-02 | D2   | High   | `chart/lib/price-lines.ts:51-77`                                             | Price lines read `--gain/--loss` once; deps omit theme.                                          | Add `isDark` to deps.                             | `--gain/--loss`    |
| P-03 | D2   | High   | `use-indicators.ts:58` + `use-indicator-overlay.ts:365-376`                  | Series colors resolve to hex at creation; `cacheKey` ignores theme.                              | Resolve at apply time from `isDark`.              | `--data-*`         |
| P-04 | D2   | Medium | `use-chart-engine.ts:330-336`                                                | Pane separator colors are seeded at init and never re-applied.                                   | Include panes in apply.                           | `--data-grid`      |
| P-05 | P2   | Medium | `portfolio-pnl-chart.tsx:78-79` vs `portfolio-summary.constants.ts:1-2`      | Duplicate `SURFACE` constant.                                                                    | Import the shared one.                            | —                  |
| P-06 | P2   | Medium | `portfolio-pnl-chart.tsx:63`                                                 | Third tooltip implementation; drops `--shadow-tooltip` and radius.                               | `.hl-trade-tooltip` or a shared primitive.        | `--shadow-tooltip` |
| P-07 | P1   | High   | `chart-controls.tsx:45,62`; `chart-header.tsx:61`; `indicator-button.tsx:51` | `SELECT_COMPACT_CLASS` duplicated three times.                                                   | Import one constant.                              | —                  |
| P-08 | P2   | Low    | `App.tsx:12-18` vs `auth-callback.tsx:118-122`                               | Duplicate page loaders.                                                                          | `PageLoader` variant.                             | —                  |
| P-09 | P2   | Medium | `appearance.tsx:61-108`                                                      | Theme preview triplicated; light/dark loss alphas differ (`/60` vs `/80`).                       | One `ThemePreview`.                               | —                  |
| P-10 | P3   | Medium | `market-terminal-header.tsx:50-86`                                           | `MetricItem` reimplemented for Funding and Countdown.                                            | Compose `MetricItem`.                             | —                  |

### H — Chart theming verdicts

| ID   | Code | Sev  | File:line            | Verdict                                                                                           | Canonical fix       | Token |
| ---- | ---- | ---- | -------------------- | ------------------------------------------------------------------------------------------------- | ------------------- | ----- |
| H-01 | D1   | PASS | `chart/` hooks + lib | Chart paint is token-derived via `readToken`/`getComputedStyle`; no literals.                     | Keep.               | —     |
| H-02 | D2   | FAIL | see P-01..P-04       | Candles update on theme switch; volume, price lines, indicator series, and pane separator do not. | Fix the four paths. | —     |

### A11Y — Fallbacks and non-color encoding

| ID      | Code | Sev    | File:line                | Defect                                                                                                                            | Canonical fix                    | Token      |
| ------- | ---- | ------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------- |
| A11Y-01 | A3   | Medium | `index.css:808-961`      | `prefers-reduced-transparency`, `prefers-contrast`, and `forced-colors` overrides exist for glass; new surfaces must be included. | Keep and extend to new surfaces. | —          |
| A11Y-02 | A2   | Medium | `indicator-chips.tsx:24` | Chip dot uses `bg-foreground/60`, not the series color; the chip cannot identify its series.                                      | Use `--data-N`.                  | `--data-*` |
| A11Y-03 | A1   | Medium | calendar event chips     | Three neutral category fills; macro/fx/crypto indistinguishable in dark.                                                          | `--data-*` plus icon or letter.  | `--data-*` |

## 6. Component verdicts

| Primitive          | Verdict     | Evidence                                                                                                                 |
| ------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| alert              | FAIL        | Re-derives loss with `bg-loss/10 border-loss/40 text-loss` (A-05)                                                        |
| avatar             | PASS        | Token ring only; no tier attrs                                                                                           |
| badge              | CONDITIONAL | `bg-destructive/10 … dark:bg-destructive/25` dual theme branch                                                           |
| button             | CONDITIONAL | `dark:bg-input/40` (C-08), hand-rolled tier attrs (A-03)                                                                 |
| dialog             | CONDITIONAL | Manual `data-material`/`thickness`/`depth` (A-03)                                                                        |
| dropdown-menu      | CONDITIONAL | No focus-visible ring on items (S-10)                                                                                    |
| input              | PASS        | `bg-input` + `border-border/40`, focus ring intact                                                                       |
| label              | PASS        | No paint                                                                                                                 |
| modal              | CONDITIONAL | Manual tier attrs duplicated from Surface (A-03)                                                                         |
| native-select      | FAIL        | `dark:bg-input/40`; dark hover no-op (C-08)                                                                              |
| pagination         | FAIL        | `text-muted-foreground/60` (C-02)                                                                                        |
| separator          | PASS        | Token border only                                                                                                        |
| skeleton           | PASS        | `bg-muted/60` shimmer; no literals                                                                                       |
| slider             | PASS        | `ring-ring/40`, token fills                                                                                              |
| sonner             | FAIL        | No data attrs; depends on Sonner vars (A-04)                                                                             |
| table              | PASS        | Primitive clean; `/60` defect lives in feature rows (C-02)                                                               |
| tabs               | FAIL        | Opacity active hack plus dead CSS selector (C-12, S-01)                                                                  |
| toggle             | FAIL        | `aria-pressed:bg-accent` overrides tier (S-02)                                                                           |
| tooltip            | PASS        | Uses `--tier-floating-fill`                                                                                              |
| **Surface system** | CONDITIONAL | Contract is sound; `tiers.ts` glass defaults contradict opaque CSS (§4), and cascade order breaks overrides (A-01, A-02) |

## 7. Screen matrix

| Screen        | Route            | Regions                                         | Findings                                               |
| ------------- | ---------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Login         | `/login`         | Canvas, single content card                     | C-09 (primary-as-accent `inferred` from shared header) |
| Auth callback | `/auth/callback` | Loader, redirect                                | P-08                                                   |
| Trade         | `/trade`         | Header, chart, order form, orderbook, positions | A-02, C-03, C-07, C-08, C-09, S-07, P-01..P-04, L-02   |
| Portfolio     | `/portfolio`     | Summary, PnL chart, positions                   | C-02, P-05, P-06, S-12                                 |
| Whales        | `/whales`        | List, positions table                           | L-03, L-04, S-03                                       |
| Whale detail  | `/whales/:id`    | Header, positions table                         | S-03, A-08 (`inferred` shared widget)                  |
| Calendar      | `/calendar`      | Board, month grid, day cells                    | S-05, S-06, L-05, L-07, A11Y-03                        |
| Settings      | `/settings`      | Nav, appearance, API console                    | A-01, A-03, C-09, L-06, L-08, S-08, S-09               |
| Not found     | `*`              | Canvas, message                                 | — (clean)                                              |

Routes not screens: two redirects and one wildcard (counted in 12, not in 9).

## 8. Consistency variance

| Capability       | Canonical recipe                                | Actual                                                                     | Delta                                           |
| ---------------- | ----------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| Hover            | `--control-hover-bg` via `.tier-control`        | `hover:bg-accent`, `hover:bg-muted`, `dark:hover:bg-input/60`              | Three recipes; dark branch voids tokens         |
| Active (pressed) | `[data-active]` + `--control-active-bg`         | `[data-active="true"]` (dead), `aria-pressed:bg-accent`, `bg-foreground/5` | No component consumes the active token          |
| Focus            | `ring-2 ring-ring` + `ring-offset`              | `ring-[3px] ring-ring/40`, `outline-none` with tint, or nothing            | Removed on whale table, menu items, theme cards |
| Well             | `.tier-well` + `--well-*`                       | Used in 2 places; ad-hoc `bg-muted/40` elsewhere                           | Under-adopted                                   |
| Option card      | `--option-card-*`                               | Appearance cards use `border` + hover scale                                | No active border state                          |
| Table row        | `border-border/40`, full muted text             | `/60` muted text, separator opacity drift                                  | C-02                                            |
| Popover          | `tier-floating` + `--shadow-tooltip`            | `tier-floating` + `--shadow-e1` in one path                                | Two elevations                                  |
| Dialog           | `tier-floating` with `--radius-overlay` + scrim | Manual attrs; some skip depth                                              | A-03                                            |
| Tooltip          | `.hl-trade-tooltip` / `--shadow-tooltip`        | Third implementation in PnL chart                                          | P-06                                            |
| Skeleton         | `bg-muted/60` pulse                             | Consistent                                                                 | —                                               |

## 9. Token gaps

| Token                                                                   | Status      | Needed for                                                   |
| ----------------------------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| `--semantic-warn-*`, `--semantic-loss-*`                                | **Exist**   | A-05: use them, do not re-derive                             |
| `--gain-foreground`, `--loss-foreground`                                | **Missing** | C-06: readable label on gain/loss fills                      |
| `--control-border`                                                      | **Missing** | C-07/C-08: one border for inputs and controls                |
| `--scrim-blur`                                                          | **Missing** | L-04: scroll-edge blur strength independent of glass         |
| `--app-header-height`, `--app-page-pad/-gap`, `--trading-region-height` | Exist       | L-01, L-02, L-03, L-06 are usage defects, not missing tokens |

Do **not** invent these inside components. Add them in `index.css` in both themes, then consume. A component-local `color-mix` (C-11) is the failure mode this rule prevents.

## 10. Remediation plan

| Batch                          | Goal                                             | Files                                                                                                                | Findings                                 | Effort | Risk                | Verification                                                   |
| ------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------ | ------------------- | -------------------------------------------------------------- |
| 1. Chart theme                 | Make every chart path repaint on theme switch    | `use-chart-data.ts`, `price-lines.ts`, `use-indicators.ts`, `use-indicator-overlay.ts`, `use-chart-engine.ts`        | P-01..P-04, H-02                         | M      | Low (isolated)      | Toggle theme per chart; volume/lines/series/pane colors change |
| 2. Layers and cascade          | Kill the thick no-op and the control blur leak   | `index.css` (619-686), `settings.tsx`, `tiers.ts`                                                                    | A-01, A-02, A-08                         | M      | High (global paint) | Screenshot diff of settings shell and control bar              |
| 3. Semantic color and contrast | Replace re-derived colors, fix 1.05:1/1.99:1     | alert, tables, orderbook rows, funding rows, dropdown helpers, order form, api console                               | A-05, C-01..C-06, C-09..C-11             | L      | Low                 | Contrast re-run; grep for `/60` and `bg-loss/10`               |
| 4. Control states and focus    | One active/focus recipe                          | `tabs.tsx`, `toggle.tsx`, `dropdown-menu.tsx`, `appearance.tsx`, `settings.tsx`, checkbox field, `index.css:637,645` | S-01, S-02, S-03, S-07..S-10, C-12       | L      | Medium              | Keyboard pass per screen; `[data-active]` matches              |
| 5. Elevation, shape, spacing   | Header stacking, scroll chains, padding, gutters | `side-panel.tsx`, `main-layout.tsx`, `whales.tsx`, `settings.tsx`, `month-grid.tsx`                                  | L-01..L-03, L-06..L-08, T-05             | M      | Medium              | Resize to mobile; header stays above panel; no dead height     |
| 6. A11y fallbacks              | Non-color encoding and forced-colors coverage    | calendar cells, indicator chips, resize handles, `index.css:808-961`                                                 | S-04..S-06, A11Y-01..03                  | M      | Low                 | Forced-colors and reduced-transparency passes                  |
| 7. Duplicates and raw markup   | Remove copies and hand-rolled tier attrs         | `sonner.tsx`, dialogs, `button.tsx`, `toggle.tsx`, chart controls, portfolio chart, `appearance.tsx`, `App.tsx`      | A-03, A-04, P-05..P-10, T-01..T-04, T-06 | M      | Low                 | grep returns one definition per constant                       |

Sequencing: 1 → 2 → 3 → 4 → 5 → 6 → 7. Batch 2 must not ship with Batch 3 because both touch `index.css` and a bad cascade hides contrast regressions.

## 11. Verification checklist

| Check                | Command / action                                                          | Pass condition                        |
| -------------------- | ------------------------------------------------------------------------- | ------------------------------------- |
| Dead active selector | `rg '\[data-active="true"\]' packages/app/src`                            | 0 matches                             |
| Opacity text         | `rg 'muted-foreground/60\|foreground/60' packages/app/src`                | 0 outside decorative icons            |
| Re-derived loss      | `rg 'bg-loss/10\|border-loss/40' packages/app/src`                        | 0; semantic tokens only               |
| Dark overrides       | `rg 'dark:bg-input' packages/app/src`                                     | 0                                     |
| Raw color math       | `rg 'color-mix\(' packages/app/src --glob '*.tsx'`                        | 0                                     |
| Duplicate constant   | `rg -c 'SELECT_COMPACT_CLASS' packages/app/src`                           | 1 definition + imports                |
| Old blur pair        | `rg 'blur-glass\|saturate-glass' packages/app/src`                        | 0 (T-03)                              |
| Fictional stylesheet | `rg 'liquid-glass' .`                                                     | 0 (confirms this report's premise)    |
| Theme switch         | Each of 9 screens, light→dark→light                                       | Every chart, chip, and row repaints   |
| Contrast             | Re-run contrast on C-01, C-02 samples                                     | ≥4.5:1 body, ≥3:1 large               |
| Forced modes         | `prefers-reduced-transparency`, `prefers-contrast: more`, `forced-colors` | No transparent glass, borders visible |
| Static gates         | typecheck, lint, build, test                                              | All green                             |
| Visual               | Screenshot diff of trade, settings, calendar                              | Only intended deltas                  |

## 12. Decisions needed

| #   | Decision                                            | Options                                                                                              | Blocks                                      |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| a   | Confirm the brief's `liquid-glass-theme.css` naming | Rename the brief to `index.css`, or add the file intentionally                                       | This report's premise; A-01/A-02 line cites |
| b   | Is `content` truly opaque or glass?                 | Keep opaque and fix `tiers.ts` defaults, or make content translucent and drop `--layer-content-fill` | A-01, A-08, decision on `thickness="thick"` |
| c   | Add the four proposed tokens?                       | Add `--gain-foreground`, `--loss-foreground`, `--control-border`, `--scrim-blur` in both themes      | C-06, C-07, L-04                            |
| d   | Chart theme-switch scope                            | Four-path fix now (P-01..P-04) or a single repaint-on-theme subscription                             | Batch 1 size; H-02 closure                  |

Until (a) and (b) are answered, Batches 2 and 7 stay blocked; Batches 1 and 3 are safe to start.
