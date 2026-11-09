---
name: flatten-render-path
description: Remove pointless wrapper elements and shorten the path from request to painted UI in a React 19 + Vite 8 app. Use when markup is div soup, layers exist only to hold padding or position, screens wait on request waterfalls or effect chains before they render, or the user wants a leaner, faster render path.
disable-model-invocation: true
argument-hint: "[optional route, screen, or concern to focus on]"
---

Start a thorough clean-up of the render path of this app and complete it to the end. Treat this as a goal, not a task list.

"Render path" means everything between the user's intent (a URL, a click, a tick of data) and the pixels: the DOM tree that is built, and every hop that must finish before the next can start (network request, chunk load, data fetch, effect, state update, layout read).

## The one idea

Every decision comes from one question:

> **Does this layer have a job of its own?**

A layer is a DOM node, a component boundary, or a hop.

- A **node** has a job only if deleting it would change something visible, semantic, interactive or measurable. If nothing changes, it is surplus: delete it and put its styling where it belongs.
- A **hop** has a job only if the next step truly needs its output. If it doesn't, start it earlier, run it in parallel, hoist it, preload it, merge it, or delete it.
- Everything is decided by what the layer buys, not by how it got there.

A **special case** (a wrapper "for spacing", a `setTimeout` to wait for the DOM, `min-h-0` on four levels to fix one scroll bug, an effect that copies a prop into state) is a symptom: styling or data was decided at the wrong level. Don't patch these one by one. Collect them, find what they share, and redesign so they stop being special.

### Legitimate jobs of a DOM node (check before deleting)

Scroll container · positioning context (`relative`, `sticky`) · stacking context (`z-index`, `transform`, `filter`, `opacity < 1`, `isolation`) · containing block for fixed descendants (`transform`, `filter`, `backdrop-filter`, `contain`) · `container-type` · clipping (`overflow: hidden` for radius) · flex/grid context · `min-width: 0` truncation boundary · ref or measurement target (`ResizeObserver`) · event delegation target · `key` boundary · portal mount point · animation target · semantic element or landmark · focus or `aria-*` owner.

### Legitimate jobs of a hop

Needs the previous output (a dependent request, a measured size, a user choice) · crosses a real boundary (network, worker) · protects the first paint from heavy, non-critical code (a lazy chunk the first paint does not use).

## 1. Ask first

Besides flattening, two optional additions exist. List them exactly as below and ask which to do. Do only the chosen ones.

| Addition     | What it does                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **Guards**   | Add cheap checks (lint rule, AST test, build-graph budget) so wrappers and waterfalls cannot creep back.                    |
| **Evidence** | Write a before/after table: DOM nodes and depth, wrapper-only nodes, critical-path hops and bytes, commits per interaction. |

## 2. Prepare (before changing anything)

- **Render skeleton:** script a view of every component's JSX with only tags, key props and control flow (no classes, no logic), so whole screens fit in context.
- **Static wrapper scan:** with the TypeScript compiler API, list JSX elements (`div`, `span`) that have exactly one JSX child, no handlers, no `ref`, no `key`, and only layout classes. Also record JSX nesting depth and class count per element per component.
- **Runtime wrapper scan:** in the browser console on each route, list pass-through boxes (same rect as their only child, painting nothing):

  ```js
  [...document.querySelectorAll("#root *")].filter((el) => {
    if (el.children.length !== 1 || el.childNodes.length !== 1) return false;
    const s = getComputedStyle(el);
    const a = el.getBoundingClientRect();
    const b = el.firstElementChild.getBoundingClientRect();
    const inert =
      s.display === "block" &&
      s.position === "static" &&
      s.overflow === "visible" &&
      s.transform === "none" &&
      s.filter === "none" &&
      s.opacity === "1" &&
      s.isolation === "auto" &&
      s.contain === "none" &&
      s.zIndex === "auto" &&
      s.containerType === "normal" &&
      s.willChange === "auto" &&
      s.backgroundColor === "rgba(0, 0, 0, 0)" &&
      s.backgroundImage === "none" &&
      s.boxShadow === "none" &&
      s.borderTopWidth === "0px";
    return inert && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
  });
  ```

  Record node count and maximum depth per route as well.

- **Render-path map:** for each route, the chain from URL to paint: HTML → entry → route chunk → component chunks → data → images and fonts. Get it from the build manifest (`build.manifest: true`: `imports` load in parallel, `dynamicImports` start only when the `import()` runs) and from the Network waterfall (Initiator column). Record the longest sequential chain, its hop count and its bytes.
- **Commit baseline:** use the React Profiler on 3 hot flows (route entry, a data tick, a filter or tab change). Record commits per flow and which components commit.
- **Geometry baseline:** removing wrappers can shift layout silently. Script the bounding rects of key elements on every route at 3 viewports (for example 390, 1440, 2560) and save them. Compare after every cluster.
- **Verification baseline:** typecheck, lint, tests, build, a production build size table (gzip per chunk), and the geometry and profiler recordings above. Run it all now so later failures are attributable.
- **Decision log:** keep one working file (e.g. `render-path-log.md`, not part of the final change) with the problem list and the fixes. Re-read it after any context compaction. Do not create other documents.
- **Where to start:** the routes with the most traffic, the heaviest DOM, and the longest sequential chain.
- **Subagents:** give each subagent one route or module and have it return only `file:line | kind | one-line why`. Merge and dedupe yourself. Machines find, you judge.

## 3. List every problem (no edits yet)

Walk the app route by route, asking the one question. Every wrong answer is one of three kinds. The lines under "Look for" are concrete signals, not an exhaustive list: keep going until a sweep turns up nothing new.

### Dead layers: nodes that do no job

- **Pass-through wrappers.** Look for: `div > div` with the same box; an outer element carrying only `w-full`, `flex-1`, `min-h-0`, `h-full`; a wrapper that only holds padding, margin or gap; a wrapper around a single child inside a flex or grid container; a `flex` parent with one child; a grid with one cell.
- **Decoration siblings.** Look for: a `relative` wrapper with an `absolute inset-0 -z-10` sibling that paints the background (two nodes paint one panel); a backdrop element inside every popup or tooltip. Fix: apply the material to the element itself, or use `::before`.
- **Spacer elements.** Look for: empty `div`s with a height or width. Fix: `gap`, margin, or padding on the parent.
- **Keys and conditionals.** Look for: a wrapper that exists only to carry a `key` (use `<Fragment key>`), or only to host `{cond && …}`.
- **Component wrappers.** Look for: `Row`, `Stack`, `Section`, `PanelBody` components that render a `div` plus a class; HOCs and providers placed inside render for a static value; components that only forward props; `forwardRef` wrappers (React 19 passes `ref` as a prop).
- **Slot-produced nodes.** Look for: Base UI or Radix triggers wrapped in an extra element instead of using the `render` or `asChild` slot to merge onto the real element; icon wrappers (`span > svg`) that only set size.
- **Nesting ladders.** Look for: `ul > li > div > div`; `section > div > div` where the section could be the layout container; `container` inside `container`; tables inside extra scroll wrappers; semantic elements wrapped in `div`s, then given `div` children for layout.
- **Why it matters:** each node costs style recalculation, layout, memory, and reading time, and each hidden "relative" or "overflow" creates a context that other code silently depends on.

### Slow hops: steps that wait for something they don't need

Network and chunk hops:

- **Request waterfalls.** Look for: fetch started in `useEffect` after mount (HTML → JS → chunk → render → request); dependent queries chained through `enabled: !!x` when the inputs were known from the URL; sequential `await`s of independent requests; a request started only by the deepest component of the tree.
- **Late discovery.** Look for: route chunks fetched only after the router matches, with no preload on link hover, focus or idle; a lazy component inside a lazy route (chained `import()`); CSS, fonts or LCP images discovered by the parser late; no `preconnect` to the API origin.
- **Heavy code on the first-paint path.** Look for: charts, KaTeX, wallet and chain libraries, markdown, date libraries imported statically from the entry or from a barrel file; `import * as`; barrel files that defeat tree shaking; the same module duplicated across chunks.
- **Boundaries in the wrong place.** Look for: one Suspense boundary high enough that the whole screen waits for one widget; many nested boundaries that reveal sequentially; boundaries around children that resolve instantly; lazy chunks smaller than a request's overhead (a hop that buys nothing).
- **Vite 8 / Rolldown specifics.** Check the installed version's docs and types before using any option name (`build.rolldownOptions`, `output.advancedChunks` or `codeSplitting`, `build.modulePreload`, `build.manifest` may differ by version). Vite preloads a dynamically imported chunk's own static dependencies, but the chunk itself is requested only when `import()` runs. Look for: chunking that produces many small sequential chunks or one giant one; vendor code split from nothing it can share.

Render and commit hops:

- **Effect chains.** Look for: `useEffect(() => setX(f(props)))` (derived state: a second render per change); an effect that sets state read by another effect; state reset through an effect when a `key` would do; reacting to state in an effect when the event handler already knows; `useEffect` + `fetch` + `setState` where the query library or `use()` applies.
- **Measure-then-render.** Look for: mount → measure → `setState` → re-render where CSS (container queries, `min()`, grid) can size it; one `ResizeObserver` per component instead of a shared one.
- **Fan-out.** Look for: context values rebuilt every render; whole-store subscriptions; list rows that all re-render on one tick; heavy updates with no `useTransition` or `useDeferredValue`; `memo` that never prevents a render.
- **Layout thrash.** Look for: reads (`getBoundingClientRect`, `offsetHeight`) interleaved with writes in loops or in render; animation through layout properties.
- **Waiting by guessing.** Look for: `setTimeout`, double `requestAnimationFrame`, or polling used to wait for the DOM or for another module.

### Surplus: layers and hops with no reason of their own

- Pass-through components, error boundaries at every level, `memo`, `useMemo` and `useCallback` on cheap or already-stable values (or everywhere, if the React Compiler is adopted), lazy boundaries around tiny components, `preload` hints nothing consumes, duplicate fetches of the same data, polyfills the build target already covers, unused CSS.
- **Dead code:** unused exports, files nothing imports, unused dependencies. Tools: `knip`, `ts-prune`, compiler warnings. Verify with grep before deleting; code reached by route string or reflection is not dead.

### Special cases (collect separately)

Search for each and log every hit: `setTimeout|requestAnimationFrame` waiting for DOM; effects whose only job is `setState`; `key={Math.random()}` or index keys on changing lists; `display: contents`; `isolate`, `-z-10`, or `z-index` wars caused by wrapper stacking; `min-h-0`, `overflow-hidden` or `h-full` repeated on several levels of one chain (the flex chain is wrong, not missing a class); `position: relative` sprinkled on many wrappers; `will-change` sprinkled; refs forwarded through three layers; `@ts-ignore` near layout code.

Then ask of each: what requirement does this reveal? A group sharing a cause usually points at one missing concept (a Panel that is its own layout container, a single scroller, "start the request at route match").

### Record format

Write each problem as `path:line` plus one plain sentence about _what it costs or what it hides_. See the example at the end.

## 4. Redesign from first principles

Imagine each screen had been built knowing today's layout and data needs. For the whole list at once:

1. For each route, write in the log the **target tree** (at most 12 lines) and the **target waterfall** (at most 5 hops, e.g. HTML → entry + route chunk + data in parallel → skeleton → content).
2. Cluster problems that share a cause. The best fix usually solves several and looks nothing like any of them (the Surface becomes the layout container; data starts at route match or link hover; one scroller replaces four).
3. For each cluster, state the missing concept in one line and which pieces change together under it.
4. Sanity-check every fix against the one question. A fix that looks tidier but adds a layer with no job, or makes a hop wait for something it doesn't need, is wrong.
5. Write each fix above the problems it solves in the decision log.

Do not fix special cases one by one. Do not start editing until the fixes cover the list.

## 5. Fix everything on the list

- Apply fixes cluster by cluster, running the baseline after each. Make one commit per cluster if the user allows commits; otherwise leave the changes uncommitted and say so. Revert a cluster that changes geometry or behavior unintentionally.
- **Deleting a wrapper means moving its job**, not dropping its classes. Put padding on the parent or the child, `gap` on the parent, sizing and `min-h-0` on the element that really owns them, materials on the element itself. Check the legitimate-jobs list, keyboard and focus order, refs, keys, and the geometry baseline.
- Prefer mechanical, scripted changes (`ast-grep`, codemods) for patterns that repeat (unwrap a pass-through, replace a spacer with `gap`), so every site changes the same way. Review the diff and run the formatter.
- **React 19:** drop `forwardRef` (ref is a prop); use `<Context>` as the provider; derive during render or reset with `key` instead of effect-driven state; move logic into event handlers; use `use()`, `useOptimistic`, `useActionState` and async transitions where they remove effects; place Suspense boundaries per independent widget; use `Activity` (19.2) for hidden tabs and `useEffectEvent` (19.2) for event-in-effect when the installed version has them; use resource hints (`preload`, `preinit`, `preconnect`) from `react-dom`; use document metadata elements instead of manual `document.title` effects; evaluate the React Compiler and, if adopted, delete the manual memoization it makes redundant.
- **Data:** start each request at the earliest point that knows its inputs: route match, link hover or focus, or the route module's top level. Run independent requests in parallel (`useSuspenseQueries`, `Promise.all`). Replace `enabled` chains with real dependencies only. Reuse the query cache so a prefetch and the component share one request.
- **Chunks (Vite 8):** keep heavy, non-critical libraries off the entry and off other routes' chains; preload a route chunk on intent; remove barrel files on hot paths; split vendor code only where it is shared; remove lazy boundaries that cost a hop and save nothing. Re-run the manifest chain after every change.
- Remove the special cases the redesign makes unnecessary. Keep the ones the system still genuinely needs, and make them explicit and located in one place.
- Don't micro-optimize. Measure each hop fix with the baseline; revert fixes that show no gain. Deleting a node with no job is always a gain.

### If the user chose Guards

Add only checks that are cheap and low-noise:

- An AST test that fails on a single-child pass-through `div` or `span` without an annotated job, on JSX depth or class-count budgets, on `forwardRef`, and on `setTimeout` used to wait for the DOM.
- A build-graph budget from the manifest: maximum sequential `dynamicImports` depth per route, and a rule that named heavy libraries are not reachable from the entry.
- An import restriction (for example `dependency-cruiser`) for the same rule.

### If the user chose Evidence

Write the before/after table from the baseline numbers: nodes and depth per route, wrapper-only nodes, critical-path hops and bytes, commits per flow, gzip size of the entry and each route. Mark anything not measured as unverified, with the snippet that would measure it.

## 6. Check, and repeat until done

After each round, sweep again with fresh eyes: spawn subagents (one per route, or one per kind: dead layers, slow hops, surplus, special cases) that have not seen your reasoning, and re-run the scripted checks (static and runtime wrapper scans, depth, manifest chain, profiler flows, geometry comparison). New problems often appear because earlier fixes exposed them. Add them to the log and repeat steps 3 to 5.

**Done** means all of these hold:

- Every remaining wrapper has a named job from the legitimate-jobs list; the runtime wrapper scan returns nothing unexplained.
- Every route's sequential chain is as short as its real dependencies allow, and the first paint does not wait for code or data it does not use.
- No effect-driven derived state, no timing guesses, and no repeated `min-h-0`/`overflow` fixes remain.
- Geometry matches the baseline at all recorded viewports, apart from changes you intended and logged.
- Fresh subagents find nothing left that is worth fixing.
- Typecheck, lint, tests and build pass, and the profiler flows commit no more than the baseline.

Anything not worth fixing (high risk, low payoff, needs a product decision) is listed in the final report with a reason, not silently skipped.

## Decision log example

The problems:

```md
- `features/trade/OrderbookWidget.tsx:154` wraps the panel in `div.relative` only to host an absolute `Surface` sibling; two nodes paint one panel.
- `components/ui/Tooltip.tsx:52` renders a `-z-10` backdrop `Surface` inside every popup, so each tooltip is two layers.
- `features/whales/WhaleTable.tsx:108` has `div.relative.flex-1.min-h-0 > div.overflow-auto > table`; the middle wrapper only forwards the scroll chain.
- `pages/Portfolio.tsx:12` starts the summary request in `useEffect` after mount: HTML, entry, route chunk, render, then the request.
- `features/portfolio/Chart.tsx:30` copies `props.period` into state in an effect, causing a second render per change.
- `features/chart/IndicatorModal.tsx:8` imports KaTeX statically, so it ships on every route.
- `components/ui/Button.tsx:5` uses `forwardRef` and adds a wrapper `span` for icon sizing.
- `features/calendar/Grid.tsx:44` has `setTimeout(measure, 50)` to wait for the grid to lay out.
- `features/settings/Shell.tsx:20` adds `overflow-hidden min-h-0 h-full` on four nested levels to stop one scroll bar from overflowing.
```

Then with the fixes written above the problems they solve:

```md
- Make `Surface` the layout container and paint the material on the element itself, so no backdrop sibling exists.
  - `features/trade/OrderbookWidget.tsx:154` wraps the panel in `div.relative` only to host an absolute `Surface` sibling; two nodes paint one panel.
  - `components/ui/Tooltip.tsx:52` renders a `-z-10` backdrop `Surface` inside every popup, so each tooltip is two layers.
- Give each scrolling region exactly one scroller and size it with the grid or flex track that owns it.
  - `features/whales/WhaleTable.tsx:108` has `div.relative.flex-1.min-h-0 > div.overflow-auto > table`; the middle wrapper only forwards the scroll chain.
  - `features/settings/Shell.tsx:20` adds `overflow-hidden min-h-0 h-full` on four nested levels to stop one scroll bar from overflowing.
- Start data at route match and on link hover, sharing the query cache with the component, and load heavy code only on the routes that use it.
  - `pages/Portfolio.tsx:12` starts the summary request in `useEffect` after mount: HTML, entry, route chunk, render, then the request.
  - `features/chart/IndicatorModal.tsx:8` imports KaTeX statically, so it ships on every route.
- Derive during render and size with CSS, so no effect has to run before the screen is right.
  - `features/portfolio/Chart.tsx:30` copies `props.period` into state in an effect, causing a second render per change.
  - `features/calendar/Grid.tsx:44` has `setTimeout(measure, 50)` to wait for the grid to lay out.
- Adopt React 19 refs and slots: `ref` as a prop, the `render` slot instead of an extra element.
  - `components/ui/Button.tsx:5` uses `forwardRef` and adds a wrapper `span` for icon sizing.
```

Notice the pattern: the fix names a missing concept (a layout container, one scroller, "start at the earliest known input"), and one fix absorbs problems of different kinds (a wrapper, a z-index sibling, a timeout, an effect, an import).
