# Whiteboard Element — Design

**Date:** 2026-07-06
**Status:** Approved (brainstorm) → ready for implementation plan
**Branch:** `worktree-whiteboard-element` (worktree off `main` @ `8390edd`)

## Summary

A new **Pro-gated canvas element** `whiteboard`: the owner designs a fixed
**artboard** in the editor using fabric.js (pen, shapes, text, sticky notes,
images, with select/move/resize/delete + color/stroke/fill), and the published
page shows the finished board as a **read-only PNG image**. No new Prisma model
— all state lives in the element's JSON in `Display.sections`, like every other
element. "Ripped from Canva" is interpreted as *match Canva's whiteboard
authoring feel and toolset* using our own implementation (no Canva code/assets).

## Locked decisions (from brainstorming)

| Decision | Choice |
| --- | --- |
| Who draws / what visitors see | **Owner authors** in the editor; visitors see a **read-only** rendering |
| Canvas shape | **Fixed artboard** (size presets), not an infinite canvas |
| Toolset (v1) | Pen + highlighter; shapes (rect/ellipse/line/arrow); text + sticky notes; image upload. Baseline: select/move/resize/delete + color/stroke/fill |
| Engine | **fabric.js**, dynamically imported (editor-only; never shipped to the public page) |
| Public render | **PNG snapshot** stored as a Blob URL; public page is a plain `<img>` |
| Pro gating | **Pro-gated at insertion**, reusing the existing `card`-element gate pattern |
| Storage | Element JSON in `Display.sections` (no new model); board images uploaded to Blob so the JSON holds URLs, not base64 |

## Architecture

### 1. Element data model — fields on `CanvasElement` (`src/lib/types/canvas.ts`)

```ts
whiteboardScene?: string        // fabric.js canvas JSON (source of truth, editable)
whiteboardWidth?: number        // logical artboard width  (default 800)
whiteboardHeight?: number       // logical artboard height (default 450 = 16:9)
whiteboardBackground?: 'blank' | 'grid' | 'dots'   // default 'blank'
whiteboardPreviewUrl?: string   // rendered PNG (Blob URL) shown on the public page
```

`createElement('whiteboard')` default:
```ts
{ ...base, whiteboardScene: '', whiteboardWidth: 800, whiteboardHeight: 450, whiteboardBackground: 'blank', whiteboardPreviewUrl: '' }
```

Board images (the image tool) upload to the **existing `/api/upload`** (Blob,
images ≤10MB) and are added to the fabric scene by URL, so `whiteboardScene`
stays compact (URLs, not base64).

### 2. Public render = PNG snapshot (key performance decision)

On edit, the editor exports the fabric canvas to a **PNG at 2× (retina)**,
uploads it to Blob via `/api/upload`, and stores the returned URL in
`whiteboardPreviewUrl`. The published page renders `PublicWhiteboardElement`,
which is a **plain responsive `<img>`** in a fixed aspect-ratio box
(`whiteboardWidth`:`whiteboardHeight`). Consequences:

- **Zero fabric.js on the public site** — visitors download only a PNG.
- No CSP/worker changes: `img-src` already allows `blob:`/`data:`/Blob storage.
- `whiteboardScene` remains the editable source of truth; the PNG is the display
  artifact, regenerated on each meaningful edit.

If `whiteboardPreviewUrl` is empty, the public component renders nothing; the
editor shows a blank artboard.

### 3. Editor component — `src/components/elements/WhiteboardElement.tsx`

- **Lazy-loads fabric** via dynamic `import('fabric')` inside a `useEffect`, so
  fabric loads only in the editor and only when a whiteboard is mounted. It is
  never imported by the public page or `render-elements.tsx`.
- Mounts a fabric `Canvas` on a `<canvas>` ref at the logical artboard size
  (`whiteboardWidth`×`whiteboardHeight`), CSS-scaled to the column width.
- Initializes from `whiteboardScene` via `canvas.loadFromJSON` (empty → blank).
- **Toolbar** (its own sub-component `WhiteboardToolbar.tsx` to keep the element
  file focused):
  - Tools: select · pen · highlighter · rectangle · ellipse · line · arrow ·
    text · sticky note · image.
  - Style controls: stroke color, fill color/none, stroke width.
  - Actions: delete selection, **undo / redo** (bounded in-memory history stack
    of scene JSON, cap ~50), clear board.
  - Artboard: size presets (16:9 / 4:3 / 1:1), background (blank / grid / dots).
- Persistence: on canvas mutation (fabric `object:modified`/`object:added`/
  `object:removed`/`path:created`), **debounced (~600ms)**:
  1. `onChange({ whiteboardScene: JSON.stringify(canvas.toJSON()) })`.
  2. Regenerate preview: `canvas.toDataURL({ multiplier: 2, format: 'png' })` →
     upload to `/api/upload` → `onChange({ whiteboardPreviewUrl: url })`.
- Image tool: file input → `/api/upload` → `fabric.Image.fromURL(url)` added to
  the canvas.
- Editor props are the standard element contract
  `{ element, onChange, onDelete, isSelected, onSelect }`.

**File boundaries:** `WhiteboardElement.tsx` (canvas lifecycle + persistence),
`WhiteboardToolbar.tsx` (controls UI), and a pure helper module
`src/lib/whiteboard.ts` (see §6). Keeps each file single-responsibility and the
imperative fabric code isolated from the pure logic.

### 4. Public component — `src/components/elements/PublicWhiteboardElement.tsx`

```tsx
export function PublicWhiteboardElement({ element }: { element: CanvasElement }) {
  if (!element.whiteboardPreviewUrl) return null
  // responsive <img>, aspect from width/height, alt text
}
```
No fabric, no interactivity. Aspect ratio from `whiteboardWidth`/`Height`.

### 5. Pro gating (reuses the existing `card` pattern)

The editor already gates a Pro element at insertion. In
`PageEditor.handleCommandSelect` the `card` case does:
```ts
setShowSlashMenu(false)
if (!isPro(user)) { setUpgradeOpen(true); return }
```
(`user` from `useAuthStore()`, `isPro` from `@/lib/plan`, `UpgradePrompt` bound
to `setUpgradeOpen`.) The `whiteboard` case mirrors this, then inserts normally:
```ts
case 'whiteboard': {
  setShowSlashMenu(false)
  if (!isPro(user)) { setUpgradeOpen(true); return }
  Object.assign(newElement, createElement('whiteboard'))
  break
}
```
Additionally, the slash-menu entry carries a `pro: true` flag so the menu shows a
small **Pro badge** (a minor addition to `SlashCommandMenu`'s command type +
render). Published whiteboards remain viewable by anyone (only *insertion* is
gated).

### 6. Pure logic — `src/lib/whiteboard.ts` (unit-tested)

Extract the non-fabric logic so it is testable under jsdom (fabric/canvas is
not):
- `ARTBOARD_PRESETS: { label, width, height }[]` (16:9 = 800×450, 4:3 = 800×600,
  1:1 = 600×600).
- `pushHistory(stack: string[], scene: string, cap = 50): string[]` — bounded
  history push (drops oldest past `cap`).
- `previewFilename(elementId: string): string` — stable name for the uploaded
  PNG (e.g. `whiteboard-<id>.png`).
- `isBlankScene(scene?: string): boolean` — true for empty/`''`/`{objects:[]}`,
  used to decide whether to regenerate a preview / render the public img.

### 7. Wiring — the documented add-an-element checklist

1. `ElementType` union + the fields above (`src/lib/types/canvas.ts`).
2. `createElement('whiteboard')` default (single source of defaults).
3. `WhiteboardElement.tsx` + `WhiteboardToolbar.tsx` + `PublicWhiteboardElement.tsx`.
4. `SlashCommandMenu.tsx`: add `{ id: 'whiteboard', label: 'Whiteboard', icon: PenTool, description: 'Draw & design on a board', category: 'Media', pro: true }` (`PenTool` from lucide-react); extend the command type with `pro?: boolean` and render a Pro badge when set. (Category `Media` is already in `CATEGORY_ORDER`.)
5. `PageEditor.handleCommandSelect`: add the `whiteboard` case (§5).
6. `ColumnCanvas.tsx` `renderElement` switch: `case 'whiteboard'` → in preview
   mode render `PublicWhiteboardElement`, else `WhiteboardElement` with the
   standard props.
7. `src/components/elements/index.ts`: export `WhiteboardElement` +
   `PublicWhiteboardElement`.
8. `src/lib/render-elements.tsx`: `case 'whiteboard'` → `<PublicWhiteboardElement element={element} />` (the published page).

### 8. Dependencies, CSP, performance

- **New dependency:** `fabric` (v6). Permissive license. Imported **only** via
  dynamic `import()` in `WhiteboardElement.tsx` → it lands in a lazily-loaded
  chunk; no other page or the public site pays the bundle cost. Add to
  `package.json`; verify it builds under Next 15 / React 19 (fabric is
  framework-agnostic/imperative, so React 19 is fine).
- **CSP:** no changes. Board images and the preview PNG use the existing
  `/api/upload` → Blob; `img-src` already allows those hosts plus `data:`/`blob:`.
- **Performance:** public pages ship a single PNG. Editor debounces scene save +
  preview upload to avoid churn.

### 9. Testing strategy

- **Unit (`src/lib/whiteboard.ts`):** `pushHistory` (bounded, drops oldest),
  `previewFilename` (stable), `isBlankScene` (empty/blank vs populated),
  `ARTBOARD_PRESETS` shape.
- **Component smoke:** `PublicWhiteboardElement` renders an `<img>` with the
  preview URL and renders nothing when the URL is empty (testing-library, no
  fabric involved).
- **Pro-gate:** a focused test that the `whiteboard` slash entry is `pro: true`
  and (if feasibly unit-testable) that `handleCommandSelect` routes a free user
  to the upgrade prompt — otherwise covered by manual smoke.
- **Manual browser smoke (in the plan):** add a whiteboard as a Pro user; draw
  with each tool; add an image; undo/redo; change size + background; confirm the
  scene persists on reload and the published page shows the PNG. Confirm a free
  user gets the upgrade prompt.
- fabric canvas interaction is not unit-testable under jsdom — the pure helpers
  carry the automated coverage; drawing is verified manually.

## Edge cases

| Case | Behavior |
| --- | --- |
| Empty board | Public renders nothing; editor shows blank artboard. |
| Preview upload fails | Keep the previous `whiteboardPreviewUrl`; scene JSON still saves; surface a non-blocking toast. |
| Very large scene | Acceptable; images are URLs (not base64) so JSON stays modest. No hard cap in v1. |
| Free user selects whiteboard | Upgrade prompt (`setUpgradeOpen`), no insertion. |
| Collaboration / version conflicts | Whiteboard scene is ordinary element JSON inside `sections`; saved via the normal Display `PATCH` (existing version/collab handling applies). |
| Retina / scaling | PNG exported at 2×; displayed responsively via `<img>`. |

## Deferred (NOT in v1)

Infinite/pannable canvas; smart connectors that snap between objects (arrow is a
plain shape); templates; a layers panel; real-time collaboration; visitor
drawing on the published page; on-board comments; downloadable export; frames;
per-object animation.
