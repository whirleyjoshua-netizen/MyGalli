# Editor Side-Panel Redesign — Design Spec

**Date:** 2026-07-03
**Status:** Approved (design), pending implementation plan
**Area:** Page editor (`src/components/editor/PageEditor.tsx` and the canvas/settings subsystem)

## Problem

The editor works but feels utilitarian. Configuration is spread across a flat row of 8+ top-toolbar buttons (Header, Tabs, Background, Spacing, Preview, Collaborate, Share, Publish) and a stack of **modal dialogs** (`BackgroundSettings`, `SpacingSettings`, `ColumnStyleSettings`, `HeaderCardEditor`, `TabEditor`) that cover the canvas and interrupt flow. There is no single, premium "control surface." As the product adds **deeper, Pro-tier settings** to elements (e.g. an upcoming slideshow auto-rotation feature with cadence + preset images), the current model has nowhere clean to put them — every new knob either bloats the canvas or spawns another modal.

## Goal

Replace the modal-heavy chrome with a **persistent, collapsible right-docked control panel** — a Figma/Framer-style inspector — that becomes the home for element settings, page settings, and all future advanced/Pro depth. Deliver a modern, premium feel **without rewriting all ~60 element editors up front.**

## Guiding principle: two tiers split by frequency

The premium feel comes from a consistent, predictable split — not from moving everything into the panel:

- **Canvas = direct manipulation of the obvious.** Type text, pick an image, reorder, delete. High-frequency actions stay where you see them; the canvas remains live and WYSIWYG.
- **Panel = configuration & everything advanced.** An element's deeper knobs, and **all future Pro settings**, live in the inspector. New depth (slideshow rotation, image filters, etc.) is **born in the panel** from day one. The panel is the natural home + upsell surface for Pro gating.

## Approved UX decisions

These were validated with the user via visual mockups:

1. **Panel placement & behavior** — docked on the **right**, **collapsible** (a chevron collapses/expands it). The canvas is **reactive**: it reflows to fill the freed width when the panel collapses (panel is part of the flex layout, never an overlay floating above the canvas).
2. **Two panel tabs** at the top:
   - **Elements** — the layers list + selected element's settings.
   - **Page** — background, spacing, tabs, header card (everything migrated out of the top toolbar/modals).
3. **List structure = grouped by section** (chosen over a flat list and over a full section→column→element tree). The list shows **section group headers** (e.g. "Section 1 · full", "Section 2 · 2-col"), each with a small **⚙ gear** that opens that section's layout settings (column count, and existing column-style options) in the same accordion. Elements appear as rows under their section group.
4. **Accordion interaction (single-open)** — clicking an element row expands **its settings inline**, pushing rows below it down. Opening one row **auto-collapses** any other open row (single-open), so the panel never becomes an endless scroll. The opened row **auto-scrolls to the top** of the panel body and its title stays pinned while its settings scroll.
5. **Element inspector contents** — each element's inspector shows its basic settings, plus an **"Advanced" section** (Pro-gated where applicable) that is the designated home for new deep features. Pro sections render an `UpgradePrompt`-style lock for free users (reusing existing `src/lib/plan.ts` `isPro` + `src/components/pro/*`).
6. **Adding elements — keep both routes.** The existing slash `/` menu on the canvas (fast, in-place) **and** a **+ Add element** affordance in the panel (per section group). Both create the element via the existing `createElement()` and drop it into the active section/column; it then appears in the list.
7. **Slimmed top bar** retains only: back arrow · editable title · save status · presence avatars · **Collaborate · Preview · Share · Publish**. Background, Spacing, Tabs, and Header buttons are **removed** from the top bar (their functionality moves to the Page tab).
8. **Selection is synced both ways** — clicking an element on the canvas highlights its row in the panel and opens its inspector; clicking a row in the panel highlights/selects the element on the canvas.

## Architecture

### Selection state must lift out of `ColumnCanvas`

Today `selectedElement` is **local state inside `ColumnCanvas`** (`src/components/canvas/ColumnCanvas.tsx`). For canvas↔panel sync, selection must be **lifted to `PageEditor`** and passed down to both the canvas and the panel.

Introduce a shared selection shape:

```ts
// Selection identifies an element OR a section (for the section ⚙) OR nothing.
type EditorSelection =
  | { kind: 'element'; sectionId: string; columnId: string; elementId: string }
  | { kind: 'section'; sectionId: string }
  | null
```

`PageEditor` owns `selection` + `setSelection`. It passes:
- to `ColumnCanvas`: `selection` + `onSelect(selection)` (replacing the internal `selectedElement` useState). Canvas highlights the selected element and calls `onSelect` on click; it no longer owns selection.
- to the new panel: `selection`, `setSelection`, plus the page model (sections, background, spacing, tabs, header) and their setters — reusing the existing `getActiveSections/setActiveSections` and the per-tab `getActive*` abstractions already in `PageEditor`.

Preview mode continues to disable selection (no inspector, panel hidden).

### New components

```
src/components/editor/panel/
  ControlPanel.tsx          — the shell: collapse state, Elements/Page tabs, layout
  ElementsTab.tsx           — section-grouped layers list + accordion inspectors + "+ Add element"
  PageTab.tsx               — hosts background / spacing / tabs / header settings sections
  SectionRow.tsx            — a section group header (label + ⚙) with its element rows
  ElementRow.tsx            — one list row (icon + label); expands to its inspector (accordion)
  inspectors/
    registry.tsx            — ELEMENT_INSPECTORS: maps ElementType → inspector component
    ImageInspector.tsx      — (example) basic fields + Advanced (Pro) section
    ...                     — migrated opportunistically, one element at a time
    DefaultInspector.tsx    — fallback for not-yet-migrated element types
```

**Inspector registry pattern.** Decouple per-element settings from `ColumnCanvas` via a registry:

```ts
interface InspectorProps {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  isPro: boolean
}
type Inspector = React.ComponentType<InspectorProps>
const ELEMENT_INSPECTORS: Partial<Record<ElementType, Inspector>> = { image: ImageInspector, /* … */ }
```

`ElementRow` looks up `ELEMENT_INSPECTORS[element.type]`, falling back to `DefaultInspector`. `onChange` calls the **existing** `updateElement(sectionId, columnId, elementId, updates)` in `PageEditor` — the data flow is unchanged; only *where the controls live* moves. This is what lets us migrate elements gradually instead of all at once.

### Migration strategy (why this is safe & incremental)

- **Canvas keeps working exactly as today.** `renderElement` still renders each element with inline content editing. We do **not** delete inline editing.
- Elements that render their own **selected-state settings toolbars inline** keep doing so until migrated. As each element's inspector is authored in the panel, its redundant inline settings UI is trimmed (content editing stays on canvas per the two-tier principle).
- `DefaultInspector` ensures **every** element type has a usable panel entry from day one (shows label, delete/duplicate, and a note that detailed settings are on the block for un-migrated types).
- **Page settings reuse existing components.** `BackgroundSettings`, `SpacingSettings`, `HeaderCardEditor`, `TabEditor`, `ColumnStyleSettings` are today rendered as modals (`isOpen`/`onClose`). They are already controlled components taking `config` + `onChange`. `PageTab` (and the section ⚙) render their **inner content inline** instead of inside a modal shell. Minimal refactor: extract each modal's body into a presentational sub-component the panel can host, or render the existing component in an "inline" mode. No settings logic is rewritten.

### Layout & reflow

`PageEditor`'s root becomes a horizontal flex: `[ canvas (flex-1) ][ ControlPanel (fixed width, collapsible) ]`. Collapsing the panel animates its width to a thin rail (showing the expand chevron + tab icons); `flex-1` canvas reflows automatically. Panel width is a sensible fixed value (e.g. ~320px) with the collapsed rail ~48px. Preview mode hides the panel entirely (canvas full-bleed), matching today's preview behavior.

### Adding elements

- **Slash menu**: unchanged mechanism (`openSlashMenu` → `SlashCommandMenu` → `handleCommandSelect`), which already inserts into the current section/column.
- **Panel + Add element**: each `SectionRow` gets a "+ Add element" that opens the same `SlashCommandMenu` (or a panel-hosted variant) targeting that section's (first/last) column, then selects the new element so its inspector opens. Reuses `createElement()` and the existing insert path.

## Out of scope (YAGNI / later phases)

- Rewriting all ~60 element inspectors at once. Only a **starter set** is migrated in the first plan; the rest use `DefaultInspector` and migrate over time.
- The slideshow auto-rotation Pro feature itself (its own spec) — this redesign only guarantees it a **home** (Advanced section in the slideshow inspector).
- Drag-to-reorder **within the panel list** — canvas drag (existing dnd-kit) still handles reordering. Panel reordering can be a later enhancement.
- Full section→column→element tree (rejected). Changing a section's column **count** post-creation is included via the section ⚙ (new small capability), but nested column drag in the panel is not.
- Left-docked or detachable panel; multi-select; keyboard-driven inspector navigation.

## Phasing (for the implementation plan)

1. **Panel shell + layout reflow + collapse** — `ControlPanel` with Elements/Page tabs, flex layout, collapse rail; panel hidden in preview.
2. **Lift selection** out of `ColumnCanvas` into `PageEditor`; two-way canvas↔panel highlight/select.
3. **Elements tab** — section-grouped list (`SectionRow`/`ElementRow`), single-open accordion with auto-scroll, `DefaultInspector` fallback, panel "+ Add element".
4. **Page tab** — host Background, Spacing, Tabs, Header inline; remove those 4 buttons from the top bar; section ⚙ hosts layout (column count) + column style.
5. **Starter inspectors** — migrate a handful of high-value elements (e.g. Image, KPI, Button, Slideshow) into real inspectors with an **Advanced (Pro)** section, proving the registry + Pro-gating pattern.

Each phase is independently shippable and leaves the editor fully functional.

## Success criteria

- Configuring background/spacing/tabs/header no longer opens a modal; all happen in the Page tab.
- Clicking an element on the canvas opens its settings in the panel and highlights its row; clicking a row selects the element on canvas.
- The panel collapses and the canvas reflows to fill the space.
- The slideshow (and any element) has a clear Advanced/Pro section in its inspector where new deep settings land.
- No regression: existing inline content editing, slash-menu adding, drag reordering, autosave, collaboration/presence, publish, and preview all still work.
