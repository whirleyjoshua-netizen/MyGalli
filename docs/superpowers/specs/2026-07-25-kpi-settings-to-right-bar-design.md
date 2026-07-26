# KPI Settings → Right Bar (Inspector migration, reference element) — Design

**Date:** 2026-07-25
**Status:** Approved for planning

## Goal

Consolidate a KPI element's configuration into the right-column inspector, and remove the redundant on-card settings gear — as the **reference implementation** for a broader migration of config-type elements. Prove the pattern on one element before fanning out.

## Background: the two settings, and a bug

Today a selected KPI element offers its configuration in **two** places:

1. **On the card** — a ⚙ gear (top-right) opens a floating "KPI Settings" panel holding **prefix, suffix, trend direction, trend text, colour**. Label and value are typed directly on the card (inline WYSIWYG).
2. **In the right column** — the "Elements" tab lists every element as an expandable row; KPI is one of only 4 with a registered inspector, so its row expands to show `KPIInspector`.

**Field-naming note (no bug — corrected during planning):** the stored `CanvasElement` fields are `kpiLabel`, `kpiValue`, `kpiPrefix`, `kpiSuffix`, `kpiTrend`, `kpiTrendValue`, `kpiColor`. The `KPIElement` *component* takes plainer prop names (`label`, `value`, …); `ColumnCanvas` translates between the two in both directions (read `element.kpiLabel → label` prop; write `updates.label → kpiLabel`). The inspector receives the raw `element` and an `onChange` that writes `Partial<CanvasElement>` directly, so it correctly reads and writes the `kpi*` fields. The existing 2-field `KPIInspector` (label + value) is not broken — it is simply incomplete, missing the config that only the on-card gear currently exposes. `starter-inspectors.test.tsx` asserting `{ kpiLabel: … }` is likewise correct and stays.

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
| D1 | The inspector holds the **full** KPI config: `kpiLabel`, `kpiValue`, `kpiPrefix`, `kpiSuffix`, `kpiTrend`, `kpiTrendValue`, `kpiColor`. | One complete settings surface. Including label/value (also inline on the card) is harmless — both ultimately bind to the same stored field and stay in sync — and it makes the inspector the single home for everything the deleted gear held. |
| D2 | The card keeps its **inline label/value/prefix typing** unchanged. | That is the live WYSIWYG editing the user explicitly wants to keep. prefix editable in both places binds to the same stored `kpiPrefix`, so no divergence. |
| D3 | The on-card **gear, floating panel, and `showSettings` state are deleted**. | The whole point: one place for config. Trend/suffix/colour become reachable only via the inspector. |
| D4 | The card keeps its **delete button** and the **trend badge display**. | Delete is a card affordance, not config. The trend badge is output, not a control. |

## Changes

### 1. `src/components/editor/panel/inspectors/KPIInspector.tsx` (rewrite)

Extend the current 2-field inspector to the complete config. **The inspector writes stored `CanvasElement` field names directly** (not the element component's translated prop names):

- **Label** → `onChange({ kpiLabel })`, reads `element.kpiLabel`
- **Value** → `onChange({ kpiValue })`, reads `element.kpiValue`
- **Prefix** / **Suffix** → `onChange({ kpiPrefix })` / `onChange({ kpiSuffix })`
- **Trend** — three buttons Up / None / Down → `onChange({ kpiTrend: 'up' | 'neutral' | 'down' })`, reads `element.kpiTrend`
- **Trend text** → `onChange({ kpiTrendValue })`
- **Colour** — one swatch per `COLOR_THEMES` key → `onChange({ kpiColor })`, reads `element.kpiColor`

`COLOR_THEMES` currently lives inside `KPIElement.tsx` (keys: `blue`, `green`, `red`, `purple`, `orange`, `slate` — matching the `kpiColor` union). Export it from there so the inspector renders the same swatches without duplicating the list. Defaults match the element: `kpiTrend ?? 'neutral'`, `kpiColor ?? 'blue'`.

Uses the inspector's existing visual language (the `bg-muted`/`border-border`/`focus:ring-primary` styling already in `KPIInspector`), not the KPI card's slate palette — it lives in the neutral right panel.

### 2. `src/components/elements/KPIElement.tsx` (trim)

- Delete the ⚙ gear `<button>` (the one calling `setShowSettings`).
- Delete the entire floating **Settings Panel** block (`{showSettings && isSelected && (…)}`).
- Delete the `const [showSettings, setShowSettings] = useState(false)` line.
- Remove now-unused imports (`Settings`, `X`, and `useState` if nothing else uses it — check).
- **Keep:** the inline label/value/prefix inputs, the suffix display span, the trend badge, the delete `<button>`, the gradient accent.

The card's controls row collapses from `[⚙][🗑]` to just `[🗑]`.

### 3. `src/components/editor/panel/inspectors/starter-inspectors.test.tsx` (extend, not fix)

The existing KPI case asserts `onChange` with `{ kpiLabel: 'Revenue' }` — this is **correct** (`kpiLabel` is the real stored field) and stays. The dedicated `KPIInspector.test.tsx` (below) covers the newly added fields; no change is required here beyond leaving it green. Only touch it if the label input's accessible name changes.

## Non-goals / explicitly out of scope

- **Auto-expanding the KPI inspector when the card is selected.** Today the user selects the element, then expands its row in the right panel. Wiring canvas-selection → right-panel-expansion is a real UX improvement but is existing behaviour shared by all inspectors; it belongs to the migration's framework, not this reference element. Note it as a follow-up.
- Any other element.
- The `TextStylePanel` styling gears (they stay, per the principle).
- The Image/Button inspectors' correctness (they may have their own field-name issues; not touched here).

## Testing

**Unit**
- `KPIInspector`: editing Label → `{ kpiLabel }`; Value → `{ kpiValue }`; Prefix → `{ kpiPrefix }`; Suffix → `{ kpiSuffix }`; clicking Up/Down/None → `{ kpiTrend }`; Trend text → `{ kpiTrendValue }`; clicking a colour swatch → `{ kpiColor }`. Active trend and colour reflect `element.kpiTrend`/`element.kpiColor`.
- `KPIElement`: when selected, renders a delete control but **no** settings gear; editing the inline value input still calls `onChange({ value })` (the component's prop name — `ColumnCanvas` translates it to `kpiValue`); no floating "KPI Settings" panel exists in the DOM.
- `starter-inspectors.test.tsx`: unchanged, still green.

**Browser smoke** (production build)
- Insert a KPI; select it — the card shows only the delete control, no gear.
- Open the right **Elements** tab, expand the KPI row; the inspector shows label, value, prefix, suffix, trend, trend text, colour.
- Change trend to Up and pick a colour in the inspector; the card updates live (badge + theme).
- Type a value directly on the card; it stays editable and updates.
