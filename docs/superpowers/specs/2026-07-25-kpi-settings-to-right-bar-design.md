# KPI Settings → Right Bar (Inspector migration, reference element) — Design

**Date:** 2026-07-25
**Status:** Approved for planning

## Goal

Consolidate a KPI element's configuration into the right-column inspector, and remove the redundant on-card settings gear — as the **reference implementation** for a broader migration of config-type elements. Prove the pattern on one element before fanning out.

## Background: the two settings, and a bug

Today a selected KPI element offers its configuration in **two** places:

1. **On the card** — a ⚙ gear (top-right) opens a floating "KPI Settings" panel holding **prefix, suffix, trend direction, trend text, colour**. Label and value are typed directly on the card (inline WYSIWYG).
2. **In the right column** — the "Elements" tab lists every element as an expandable row; KPI is one of only 4 with a registered inspector, so its row expands to show `KPIInspector`.

**Bug:** the existing `KPIInspector` edits fields named `kpiLabel` and `kpiValue`, but the KPI element actually reads `label` and `value`. The inspector is therefore **orphaned** — it edits fields nothing renders. `starter-inspectors.test.tsx` asserts this broken behaviour (`onChange` called with `{ kpiLabel: … }`), so the bug is currently green in tests. This migration fixes it.

## The classification principle (applies to the whole migration, not just KPI)

- **Config gears → move into the right-bar inspector; delete the on-card gear.** Genuine setup (KPI trend/colour, chart type/data, form options). This is the redundant "second icon."
- **Visual-styling gears stay on the card.** Elements whose gear opens `TextStylePanel` (font, size, colour, alignment) — Text, List, Heading, Quote, Callout. That *is* the visual card setting; it stays.
- **Inline live-typed fields stay on the card.** KPI's label/value typed on the tile — the WYSIWYG editing stays live.

KPI is the first config-gear element migrated.

## Scope of this spec

**Only KPI.** No other element changes. The fan-out to remaining config-gear elements is separate specs, each following the pattern proven here.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | The inspector holds the **full** KPI config: label, value, prefix, suffix, trend, trendValue, colour. | One complete settings surface. Including label/value (also inline on the card) is harmless — both bind to the same field and stay in sync — and it fixes the orphaned-field bug the registry/test expect the inspector to edit "label". |
| D2 | The card keeps its **inline label/value/prefix typing** unchanged. | That is the live WYSIWYG editing the user explicitly wants to keep. prefix editable in both places binds to the same `element.prefix`, so no divergence. |
| D3 | The on-card **gear, floating panel, and `showSettings` state are deleted**. | The whole point: one place for config. Trend/suffix/colour become reachable only via the inspector. |
| D4 | The card keeps its **delete button** and the **trend badge display**. | Delete is a card affordance, not config. The trend badge is output, not a control. |

## Changes

### 1. `src/components/editor/panel/inspectors/KPIInspector.tsx` (rewrite)

Replace the two orphaned inputs with the real, complete config, all wired to the fields the element reads:

- **Label** → `onChange({ label })`
- **Value** → `onChange({ value })`
- **Prefix** / **Suffix** → `onChange({ prefix })` / `onChange({ suffix })`
- **Trend** — three buttons Up / None / Down → `onChange({ trend: 'up' | 'neutral' | 'down' })`
- **Trend text** → `onChange({ trendValue })`
- **Colour** — one swatch per `COLOR_THEMES` key → `onChange({ color })`

`COLOR_THEMES` currently lives inside `KPIElement.tsx` (keys: `blue`, `green`, `purple`, …). Export it from there (or lift the key list into a tiny shared constant) so the inspector renders the same swatches without duplicating the list. The inspector reads `element.color`, `element.trend`, etc. with the same defaults the element uses (`trend = 'neutral'`, `color = 'blue'`).

Uses the inspector's existing visual language (the `bg-muted`/`border-border`/`focus:ring-primary` styling already in `KPIInspector`), not the KPI card's slate palette — it lives in the neutral right panel.

### 2. `src/components/elements/KPIElement.tsx` (trim)

- Delete the ⚙ gear `<button>` (the one calling `setShowSettings`).
- Delete the entire floating **Settings Panel** block (`{showSettings && isSelected && (…)}`).
- Delete the `const [showSettings, setShowSettings] = useState(false)` line.
- Remove now-unused imports (`Settings`, `X`, and `useState` if nothing else uses it — check).
- **Keep:** the inline label/value/prefix inputs, the suffix display span, the trend badge, the delete `<button>`, the gradient accent.

The card's controls row collapses from `[⚙][🗑]` to just `[🗑]`.

### 3. `src/components/editor/panel/inspectors/starter-inspectors.test.tsx` (fix)

The KPI case asserts `onChange` with `{ kpiLabel: 'Revenue' }`. Change it to the real field: render with `{ label: '' }` and assert `onChange` called with `{ label: 'Revenue' }`. (Image and Button cases are unrelated — leave them.)

## Non-goals / explicitly out of scope

- **Auto-expanding the KPI inspector when the card is selected.** Today the user selects the element, then expands its row in the right panel. Wiring canvas-selection → right-panel-expansion is a real UX improvement but is existing behaviour shared by all inspectors; it belongs to the migration's framework, not this reference element. Note it as a follow-up.
- Any other element.
- The `TextStylePanel` styling gears (they stay, per the principle).
- The Image/Button inspectors' correctness (they may have their own field-name issues; not touched here).

## Testing

**Unit**
- `KPIInspector`: editing Label → `{ label }`; Value → `{ value }`; Prefix → `{ prefix }`; Suffix → `{ suffix }`; clicking Up/Down/None → `{ trend }`; Trend text → `{ trendValue }`; clicking a colour swatch → `{ color }`. Active trend and colour reflect the element's current values.
- `KPIElement`: when selected, renders a delete control but **no** settings gear; editing the inline value input still calls `onChange({ value })`; no floating "KPI Settings" panel exists in the DOM.
- `starter-inspectors.test.tsx`: KPI case now asserts the real `label` field and passes.

**Browser smoke** (production build)
- Insert a KPI; select it — the card shows only the delete control, no gear.
- Open the right **Elements** tab, expand the KPI row; the inspector shows label, value, prefix, suffix, trend, trend text, colour.
- Change trend to Up and pick a colour in the inspector; the card updates live (badge + theme).
- Type a value directly on the card; it stays editable and updates.
