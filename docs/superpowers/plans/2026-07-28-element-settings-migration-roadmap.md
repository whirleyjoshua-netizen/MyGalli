# Element Settings → Right Bar — Migration Roadmap (WIP handoff)

**Date:** 2026-07-28
**Branch:** `feat/kpi-inspector-migration` (KPI reference done + pushed)
**Purpose:** Hand-off notes to continue the migration on another device.

## The goal (recap)

Move each element's **configuration** out of on-card settings gears and into the right-column inspector, so the card stays live on the canvas while you edit it in the column. Only visual/inline card settings stay on the card.

## What's done

- **KPI is the finished reference implementation** on this branch (`feat/kpi-inspector-migration`, pushed). Commits:
  - spec: `docs/superpowers/specs/2026-07-25-kpi-settings-to-right-bar-design.md`
  - plan: `docs/superpowers/plans/2026-07-25-kpi-settings-to-right-bar.md`
  - code: on-card gear + floating panel deleted from `KPIElement.tsx`; `KPIInspector.tsx` now holds the full config; `COLOR_THEMES` exported from `KPIElement`.
  - Verified end-to-end (unit + production-build browser smoke: no gear on card, inspector edits update the card live).
- **PR not yet opened** (`gh` not installed here). Open at:
  https://github.com/whirleyjoshua-netizen/MyGalli/pull/new/feat/kpi-inspector-migration

## The classification principle

For each element with a settings gear, decide:

- **Config gear → migrate.** The gear opens element *setup* (options, data, trend, colour). Move that into the element's inspector; delete the on-card gear. Keep any inline live-typed fields on the card.
- **Styling gear → leave.** The gear opens `TextStylePanel` (font, size, colour, alignment). That is the visual card setting; it stays on the card.

## Remaining work — 7 config-gear elements (of the original 11)

Registry now has `image`, `kpi`, `button`, `slideshow`, `shortanswer`, `rating`, `mcq`, `poll`; the rest still fall through to `DefaultInspector`. Each remaining one needs the KPI three-step treatment.

**Done — the four form elements (2026-07-29):** ShortAnswer, Rating, MCQ, Poll. Each shipped as its own commit with a TDD inspector test.

Convention settled while doing them: **list-type content (MCQ/Poll options) stays inline on the card** — it is live-typed and needs the canvas width. The inspector shows the option count and points the author at the card. Only true config (toggles, scale, style, limits) moves.

| Element | File | Notes |
|---|---|---|
| ~~MCQ~~ | ~~`MCQElement.tsx`~~ | ✅ done — options stayed on the card. |
| ~~Poll~~ | ~~`PollElement.tsx`~~ | ✅ done — options stayed on the card. |
| ~~Rating~~ | ~~`RatingElement.tsx`~~ | ✅ done. |
| ~~ShortAnswer~~ | ~~`ShortAnswerElement.tsx`~~ | ✅ done. |
| Chart | `ChartElement.tsx` | Largest — type / data rows / 3D effects. **Do LAST.** Split it: config → inspector, data-row editor stays inline (same reasoning as MCQ/Poll options). |
| Card | `CardElement.tsx` | App-card config. |
| Code | `CodeElement.tsx` | Language / theme. |
| Comment | `CommentElement.tsx` | Section config. |
| CollectionView | `CollectionViewElement.tsx` | View/layout config. |
| Index | `IndexElement.tsx` | List vs cards, grouping. |
| Jersey | `JerseyElement.tsx` | Colours / signatures — mostly visual; check whether it's really a config gear or styling. |

**Styling gears that STAY** (do not touch): `TextElement`, `HeadingElement`, `ListElement`, `QuoteElement`, `CalloutElement` (all open `TextStylePanel`).

## The per-element recipe (proven on KPI)

1. **Inspector** (`src/components/editor/panel/inspectors/<Type>Inspector.tsx`): create it, register in `inspectors/registry.tsx`, and edit the element's config fields. Write it TDD (see `KPIInspector.test.tsx`).
2. **Element**: delete the on-card gear `<button>`, the floating settings panel, its `showSettings` state, and now-unused imports. Keep inline live-typed fields + the delete button.
3. **Verify**: unit tests, then a production-build browser smoke (gear gone, inspector edits update the card live).

## CRITICAL gotcha — stored field names vs component prop names

**The inspector writes STORED `CanvasElement` field names; the element component often uses translated prop names.** KPI stores `kpiLabel`/`kpiValue`/… but the `KPIElement` component receives `label`/`value` props — `ColumnCanvas` translates both directions. The inspector receives the raw `element` and an `onChange` writing `Partial<CanvasElement>`, so it must use the **stored** names (`kpiLabel`, not `label`).

**Before writing any element's inspector, check its `case '<type>':` in `ColumnCanvas.tsx`** to see which `element.*` fields feed its props and how `onChange` maps back. Do not assume the prop name equals the stored name. (This is the mistake that made the first KPI spec wrong.)

**Confirmed 2026-07-29: there are two contracts, and both are live.**

- *Translated* (KPI, MCQ, Rating, ShortAnswer): `ColumnCanvas` maps `element.mcqQuestion → question` and rebuilds a `patch` on the way back. The element component never sees stored names.
- *Raw* (Poll, and the newer elements — acknowledgment, tracker, …): `ColumnCanvas` passes `element` and `onChange` straight through, so stored names **are** the prop names.

Either way the inspector always writes stored names — but knowing which contract you are in tells you whether the element component's own prop list is a reliable guide. For translated elements it is not.

## Environment gotchas

- **Prisma client staleness:** `npx tsc` / `next build` may fail with unrelated errors in `src/app/api/live/[liveFeedId]/route.ts` (or similar) because the shared `node_modules` Prisma client gets regenerated against a different schema by parallel worktree activity. Fix: `npx prisma generate`, then re-run. Not a code error.
- **PDF / browser smoke:** use `npx next build && npx next start`, never `next dev` — pdf.js and some client bundles fail through this worktree's symlinked `node_modules` under dev.
- **Shipping:** the "open a PR, never merge to `main` directly" note was a constraint of the *other* device only. On the Windows main checkout we merge to `main` and push (`main` auto-deploys to prod), after tsc + targeted vitest + eslint on the changed files.

## Follow-up worth doing alongside the fan-out

~~**Auto-expand the inspector when a card is selected on canvas.**~~ **ALREADY DONE — do not re-implement.** Verified 2026-07-28 on `main`. This landed 2026-07-03 in `0424b78` (`fix(editor): reveal panel on canvas selection`), which is *newer* than this branch's base, which is why it looked outstanding from here.

The framework already does all of it:

- `PageEditor.tsx` `onSelectElement` — sets selection, `setPanelTab('elements')`, `setPanelCollapsed(false)`.
- `PageEditor.tsx` — `expandedElementId={selectedElementId(selection)}` feeds `ElementsTab`, so canvas selection expands the row.
- `PageEditor.tsx` `toggleRow` — single-open accordion; toggling a row sets/clears the canvas selection (both directions stay in sync).
- `ElementRow.tsx` — `useEffect` scrolls the opened row into view (`block: 'nearest'`).
- Covered by `PageEditor.integration.test.tsx` → *"clicking the element on the canvas reveals its inspector in the panel"*.

**Implication for the fan-out:** there is no framework prerequisite. Go straight to migrating the 11 elements — each new inspector inherits reveal/expand/scroll for free just by being registered in `inspectors/registry.tsx`.

## Also open (unrelated to this roadmap)

- **`feat/checklist-element`** — pushed, PR pending: https://github.com/whirleyjoshua-netizen/MyGalli/pull/new/feat/checklist-element
- Pre-existing failing test on `main`: `src/app/api/messages/upload/route.test.ts` ("400 when the file is not audio"). Not caused by this work; confirm it's the only failure when running the suite.
