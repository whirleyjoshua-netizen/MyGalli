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

## Remaining work — 11 config-gear elements

None of these has a real inspector yet (the registry only has `image`, `kpi`, `button`, `slideshow`; all others fall through to `DefaultInspector`). Each needs the KPI three-step treatment.

| Element | File | Notes |
|---|---|---|
| Chart | `ChartElement.tsx` | Largest — type / data rows / 3D effects. Consider whether the data-row editor is "setup that needs the big canvas" (may stay inline per the original guidance). |
| MCQ | `MCQElement.tsx` | Question + options list. |
| Poll | `PollElement.tsx` | Options + voting config. |
| Rating | `RatingElement.tsx` | Scale / style. |
| ShortAnswer | `ShortAnswerElement.tsx` | Prompt / placeholder. |
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

## Environment gotchas

- **Prisma client staleness:** `npx tsc` / `next build` may fail with unrelated errors in `src/app/api/live/[liveFeedId]/route.ts` (or similar) because the shared `node_modules` Prisma client gets regenerated against a different schema by parallel worktree activity. Fix: `npx prisma generate`, then re-run. Not a code error.
- **PDF / browser smoke:** use `npx next build && npx next start`, never `next dev` — pdf.js and some client bundles fail through this worktree's symlinked `node_modules` under dev.
- **Shipping:** push the branch and open a PR; do **not** merge to `main` directly (workflow constraint). `gh` is not installed in this environment.

## Follow-up worth doing alongside the fan-out

**Auto-expand the inspector when a card is selected on canvas.** Today you select the element, then manually expand its row in the right panel. Wiring canvas-selection → right-panel-row-expansion is shared inspector-framework behaviour (in `ElementsTab` / `PageEditor` via `expandedElementId`) and would make the whole "edit in the column" flow feel immediate. It was deliberately left out of the KPI reference. Consider doing it once, in the framework, before migrating the remaining 11.

## Also open (unrelated to this roadmap)

- **`feat/checklist-element`** — pushed, PR pending: https://github.com/whirleyjoshua-netizen/MyGalli/pull/new/feat/checklist-element
- Pre-existing failing test on `main`: `src/app/api/messages/upload/route.test.ts` ("400 when the file is not audio"). Not caused by this work; confirm it's the only failure when running the suite.
