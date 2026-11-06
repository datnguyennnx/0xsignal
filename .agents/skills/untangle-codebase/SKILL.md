---
name: untangle-codebase
description: Untangle and standardize a whole codebase in one pass so agents read less per change, break less without noticing, and debug faster. Use when the user wants a deep structural refactor, consolidation of duplicated or inconsistent code, removal of special cases, or a codebase "easier for agents to work in".
disable-model-invocation: true
argument-hint: "[optional area or concern to focus on]"
---

Start a thorough refactor of this codebase and complete it to the end. Treat this as a goal, not a task list.

## The one idea

Every refactor decision comes from one question:

> **Should these two pieces change together?**

- If yes, they must live together or visibly point at each other.
- If no, nothing may tie them.
- Everything depends on what changes less than itself.

Code is easy to change when a typical change lands in one place and nothing else breaks silently. Every problem you will find is the code answering that question wrongly. Read this section again whenever you are unsure about a fix: a fix is good only if it makes the answers more correct.

A **special case** (an `if` for one value, a retry, a swallowed exception, a parameter for one caller) is a symptom: a requirement the design never accounted for. Don't patch special cases one by one. Collect them, find what they have in common, and redesign so they stop being special.

## 1. Ask first

Besides untangling, two optional additions exist. List them exactly as below and ask which to do. Do only the chosen ones.

| Addition     | What it does                                                                         |
| ------------ | ------------------------------------------------------------------------------------ |
| **Comments** | Remove comments that only restate the code.                                          |
| **Tests**    | Remove tests that wouldn't catch a real bug, and fix the ones that fail without one. |

## 2. Prepare (before changing anything)

- **Skeleton:** script a view of the codebase with function bodies stripped (signatures, types, exports) so the whole thing fits in context.
- **Dependency graph:** script what imports what (`madge`, `dependency-cruiser`, `import-linter`, `go list -deps`, `cargo tree`, or a quick custom script). Rerun it throughout.
- **Change history:** use git as evidence. `git log --name-only` shows what changes together (files that co-change but share no import are hidden links) and what changes often (volatile). Files nobody touches in a year are stable.
- **Baseline:** record how to verify behavior (existing tests, build, typecheck, lint, a few real command or request outputs). If coverage is thin around code you will restructure, add characterization tests first that pin current behavior. Run it all now so later failures are attributable.
- **Decision log:** keep one working file (e.g. `refactor-log.md`, not part of the final change) with the problem list and the fixes. Re-read it after any context compaction. Do not create other documents.
- **Where to start:** begin where leverage is highest: the most volatile files, the most imported files, and the places with the most special cases.
- **Subagents:** for a codebase too big to hold in context, give each subagent one module and have it return only `file:line | kind | one-line why`. Merge and dedupe yourself. Machines find, you judge.

## 3. List every problem (no edits yet)

Walk the codebase, area by area, asking the one question. Every wrong answer is one of three kinds. For each, the lines under "Look for" are concrete signals to search for, not an exhaustive list: keep going until a sweep turns up nothing new.

### Hidden links: pieces that must change together, but nothing shows it

- **Copies of logic or values.** Look for: same literal (URL, timeout, status string, magic number) in several files; parallel switch/if chains on the same enum; two lists of the same things (routes, actions, permissions, fields); duplicated validation between client and server; types or schemas redefined by hand; a constant and a comment saying "keep in sync with X". Tools: `jscpd`, `grep` for repeated literals, compare every `switch` on the same discriminant.
- **Same job done N ways (inconsistency).** Look for: several error-handling styles, several ways of fetching, logging, config reading, naming, date handling, ID generation, or test setup. Each unstandardized way is a hidden link: someone fixing one forgets the others. Pick one standard per concern (prefer the one already dominant or most stable per git history), migrate the rest, and note it in the log.
- **Hidden shared state.** Look for: module-level mutable variables, singletons, globals, env vars read deep inside functions, files or caches one module writes and another reads, event names as bare strings, a flag set by one module to change another's behavior.
- **Layout that hides the change.** Look for: one feature scattered across `controllers/`, `services/`, `models/`, `types/`, `tests/`; related code in far-apart folders; a new feature requiring edits in 5+ places. Group by feature/domain, colocate tests and types.
- **Order and convention callers must "just know".** Look for: "call `init()` before X", "always call `track()`", "must be wrapped in a transaction", a function that is only safe after another ran, handlers that each repeat the same boilerplate. Make the right way the only way: encode it in a type, a single entry point, or middleware.

### Needless links: pieces tied together that change for different reasons

- **Callers depending on internals.** Look for: deep imports into another module's files; reaching through objects (`a.b.c.d`); callers knowing a storage format, a table shape, or a vendor's response shape; exported helpers that only exist for one outsider. Fix: a small interface that hides the internals.
- **Stable code importing volatile code.** Look for: domain logic importing a framework, ORM, SDK, UI, or vendor client; core types imported from a feature module. Fix: invert the dependency so the volatile side implements an interface owned by the stable side.
- **Callers' vocabulary leaking into general code.** Look for: a general function with a parameter, flag, or branch only one workflow understands (`isCheckout`, `fromAdmin`, `skipX`); boolean parameters; options bags that grow per caller. Fix: move the caller-specific part to the caller, or split the function.
- **Shallow modules.** Look for: an interface nearly as complex as its implementation; a function whose signature mirrors its body; many tiny classes or files that must be read together to understand one thing. Fix: merge, so a simple interface hides real work.
- **God modules.** Look for: files everything imports, `utils`/`common`/`helpers`/`types` dumping grounds, files that change in almost every commit. Split by reason to change, not by kind.
- **Cycles.** Any import cycle means two pieces that can't be understood or changed apart. Break them.

### Surplus: pieces with no reason of their own to change

- **Pass-through wrappers:** functions, classes, or layers that only forward calls. Remove the layer.
- **Speculative generality:** interfaces with one implementation that will never have a second, config for things that never vary, plugin points no plugin uses, unused parameters, feature flags that are permanently on or off.
- **Dead code:** unused exports, unreachable branches, commented-out code, unused dependencies, files nothing imports, stale scripts. Tools: `knip`, `ts-prune`, `vulture`, `deadcode`, `cargo udeps`, compiler warnings. Verify with grep before deleting; code reached by reflection, config, or routes by string name is not dead.

### Special cases (collect separately)

Search for each and log every hit: `if` on one specific value or ID; `TODO|HACK|FIXME|XXX|workaround|temporary|for now`; sleeps, timeouts, and retries (`sleep`, `setTimeout`, `retry`); empty or log-only `catch`/`except`/`recover`; `any`, `as`, `unsafe`, `@ts-ignore`, `# noqa`, lint-disable comments; skipped or disabled tests; parameters added for one caller; defensive checks for states the types already forbid; feature-specific branches inside shared code.

Then ask of each: what requirement does this reveal? Groups of special cases that share a cause usually point at one missing concept.

### Record format

Write each problem as `path:line` plus one plain sentence about _what breaks when something changes_. See the example at the end.

## 4. Redesign from first principles

Imagine the system had known today's requirements from the start. For the whole list at once:

1. Cluster problems that share a cause. The best fix usually solves several and looks nothing like any of them (a command list, a provider interface, a focus-restoring dialog).
2. For each cluster, state the missing concept in one line and which pieces change together under it.
3. Sanity-check every fix against the one question. A fix that looks tidier but ties together things that change apart, or separates things that change together, is wrong.
4. Write each fix above the problems it solves in the decision log.

Do not fix special cases one by one. Do not start editing until the fixes cover the list.

## 5. Fix everything on the list

- Apply fixes cluster by cluster, one commit per cluster, running the baseline after each. Revert a cluster that changes behavior unintentionally.
- Prefer mechanical, scripted changes (`ast-grep`, codemods, `sed` with review) for migrating many sites to a standard, so every site is changed the same way.
- Remove the special cases the redesign makes unnecessary. Keep the ones the system still genuinely needs, and make them explicit and located in one place.
- Lock in the standards so they don't drift back: add a lint rule, an import restriction, or an architecture test where one is cheap.
- Don't hunt for bugs separately. Bugs fixed along the way by a structural change are fine; mention them in the log.

### If the user chose Comments

- **Remove** comments that restate the implementation (`// sort first so the binary search works`). They change only when the code does, so they have no reason of their own to exist, even when phrased as a "why".
- **Keep** comments about something outside the code (`// the proxy drops websockets, so we poll`). They change when that external fact does, and the code can't show it.
- **Workaround comments** (`// wait 100ms because the cache isn't ready yet`) go when the redesign removes the problem behind them; if the problem remains, keep them.

### If the user chose Tests (do this last: tests are your safety net until then)

A test should fail on a regression, and only then.

- **Remove** tests that repeat the implementation (mirroring its logic or mocking everything it calls): they check one interpretation against itself.
- **Rewrite** tests tied to internals (private functions, call counts, mock wiring) so they depend on behavior, which changes less.
- **Remove** tests that can't fail (no assertions, assert on mocks, assert constants, snapshots of everything). To check, break the code on purpose; a test that stays green isn't checking anything.
- **Merge** duplicate tests of the same behavior in different places.
- **Fix** tests that fail without a real bug (flaky timing, order dependence, shared state, hard-coded dates).

## 6. Check, and repeat until done

After each round, sweep again with fresh eyes: spawn subagents (one per area, or one per kind: special cases, hidden links, needless links, surplus) that have not seen your reasoning, and re-run the scripted checks (dependency graph, duplicates, dead code, special-case greps). New problems often appear because earlier fixes exposed them. Add them to the log and repeat steps 3 to 5.

**Done** means all of these hold:

- As few special cases remain as possible; each remaining one is justified by a real requirement. The count is the best measure of progress.
- A typical change lands in one place.
- Every import is reasonable: no cycles, nothing imports something more volatile than itself.
- Each concern has one standard way of being done.
- Fresh subagents find nothing left that is worth fixing.
- Intended behavior matches the baseline, apart from bugs the refactor fixed. Run the full baseline one last time and report anything that differs.

Anything not worth fixing (high risk, low payoff, needs a product decision) is listed in the final report with a reason, not silently skipped.

## Decision log example

The problems:

```md
- `ui/LogoutDialog.tsx:30` waits 100ms after closing and hopes the message input can take focus by then.
- `ui/Toolbar.tsx:40` and `ui/Menu.tsx:22` call the same actions, each with its own check for when they're disabled.
- `checkout/submit.ts:9` depends directly on `payments/stripe.ts`.
- `shortcuts/keymap.ts:18` has a switch with one case per action, separate from the menu's list.
- `ui/CommandPalette.tsx:55` keeps its own list of actions, and it's missing the newer ones.
- `ui/SettingsDialog.tsx:61` sets a global `skipRefocus` flag to stop the logout dialog it opens from sending focus to the message input.
- `history/undo.ts:30` has a special case for every action that can be undone.
- `refunds/refund.ts:22` wraps every Stripe call in `if (order.provider === "paypal")`.
- Every action handler has to call `track()` by hand, and some don't.
- `ui/Toolbar.test.tsx` and `ui/Menu.test.tsx` test the same actions separately.
```

Then with the fixes written above the problems they solve:

```md
- Make the general `Dialog` give focus back to whatever had it before it opened, so the wait and the flag can both go.
  - `ui/LogoutDialog.tsx:30` waits 100ms after closing and hopes the message input can take focus by then.
  - `ui/SettingsDialog.tsx:61` sets a global `skipRefocus` flag to stop the logout dialog it opens from sending focus to the message input.
- Define a `PaymentProvider` interface that Stripe and PayPal both implement, so checkout and refunds no longer know which one they're using.
  - `checkout/submit.ts:9` depends directly on `payments/stripe.ts`.
  - `refunds/refund.ts:22` wraps every Stripe call in `if (order.provider === "paypal")`.
- Make every user action a command with a name, a handler and an undo, so the toolbar, menu, shortcuts, palette and undo history all run from one list.
  - `ui/Toolbar.tsx:40` and `ui/Menu.tsx:22` call the same actions, each with its own check for when they're disabled.
  - `shortcuts/keymap.ts:18` has a switch with one case per action, separate from the menu's list.
  - `ui/CommandPalette.tsx:55` keeps its own list of actions, and it's missing the newer ones.
  - `history/undo.ts:30` has a special case for every action that can be undone.
  - Every action handler has to call `track()` by hand, and some don't.
  - `ui/Toolbar.test.tsx` and `ui/Menu.test.tsx` test the same actions separately.
```

Notice the pattern: the fix names a missing concept, and one fix absorbs problems of different kinds (a sleep, a flag, copies, a missing convention, duplicate tests).
