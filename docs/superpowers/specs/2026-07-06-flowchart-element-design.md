# Flowchart / Workflow Element — Design

**Date:** 2026-07-06
**Status:** Approved (brainstorm complete) → ready for implementation plan
**Branch:** `worktree-flowchart` (off `origin/main` @ 8390edd)

## Summary

A new page element, `flowchart`, that lets a page owner build a **branching tree
of blocks** (a Zapier-style workflow / flowchart) in an **auto-layout builder**
— no dragging. Each block can optionally **link** to one of the owner's pages,
one of their boards, an external URL (or a future Hub). The published page
renders the laid-out diagram; a public visitor **clicks a block** to see its
details and open its link.

Everything lives in the **element JSON** (`Display.sections`) — **no new DB
tables and no new API for the element itself**. The only server interaction is
reading the owner's existing pages/boards to populate the link picker, via the
existing `GET /api/displays`.

### Terminology note

The user referred to linking blocks to a "hub." As of 2026-07-06, the folders/
files **Hub** concept is only a draft spec and is **not built**. What shipped is
**Boards** (a `Display` of `kind:'collection'` that groups member pages, public
at `/{username}/{slug}`). This element covers "link to a hub" via the **Boards**
picker source today; a true Hub becomes just another link source when it ships
(links are plain URLs — see Link model).

### v1 scope

- Element type `flowchart`; a **branching tree** (each block has ≤ 1 parent;
  branches split and do **not** rejoin; multiple roots allowed = a forest).
- **Auto-layout** top-down (tidy-tree), computed by a pure function — no graph
  library, no dragging.
- **Public experience:** a clickable diagram. Clicking a block opens a detail
  popover with its title/description and an "Open →" button to its link.
- **Link targets:** the owner's Pages, the owner's Boards, and External URLs
  (Future Hub is supported for free via the URL model).

### v1 explicitly excludes (clean follow-ons)

- A **"run / play"** step-through walkthrough mode.
- **Free-drag** positioning / pan-zoom canvas.
- Branches that **rejoin** (merges / diamonds) and **cycles**.
- Live "My Hubs" picker source (until the Hub feature ships; URLs already work).

## Data model

Added to `CanvasElement` (`src/lib/types/canvas.ts`) — all in element JSON:

```ts
flowTitle?: string
flowNodes?: FlowNode[]
```

```ts
interface FlowNode {
  id: string               // stable node id (e.g. `fn-<ts>-<rand>`)
  title: string
  description?: string
  icon?: string            // single emoji, optional
  color?: string           // accent color, optional (default token)
  linkUrl?: string         // resolved destination (root-relative internal, or https/mailto external)
  linkLabel?: string       // friendly label for the picked target (e.g. page title, "External link")
  parentId?: string        // the block this one follows; undefined/null = a root
  branchLabel?: string     // optional label drawn on the arrow from parent → this node (e.g. "Yes")
}
```

**Why `parentId` on the child:** it structurally guarantees a **tree/forest**
(each node has at most one parent), which is exactly the chosen flow shape.
Edges are derived (`parentId → id`); no separate edges array to keep in sync.
`branchLabel` rides on the child because it labels that child's incoming arrow.

**Invariants (enforced in the editor):**
- A node's `parentId` must reference an existing node, never itself, and never
  one of its own descendants (prevents cycles → keeps it a DAG/tree).
- Roots = nodes with no `parentId`. A forest (multiple roots) is valid.

## Layout engine — `src/lib/flowchart-layout.ts` (pure, unit-tested)

A dependency-free tidy-tree layout:

```ts
interface LaidOutNode extends FlowNode { x: number; y: number; w: number; h: number }
interface LaidOutEdge { fromId: string; toId: string; label?: string
  x1: number; y1: number; x2: number; y2: number }
interface FlowLayout { nodes: LaidOutNode[]; edges: LaidOutEdge[]; width: number; height: number }

function layoutFlow(nodes: FlowNode[], opts?: { nodeW?; nodeH?; gapX?; gapY? }): FlowLayout

// Cycle-prevention helper (same file — both are pure tree functions):
function descendantIds(nodes: FlowNode[], id: string): Set<string>
```

Algorithm (classic tidy tree, per root):
1. Build children map from `parentId`; identify roots (no parent).
2. Assign **depth** (y-row) by distance from the root.
3. Assign **x** by a post-order sweep: a leaf takes the next free x-slot; a
   parent centers over its children's span. Lay out multiple roots left-to-right
   without overlap.
4. Emit node boxes (x, y, w, h) and edges with parent-bottom → child-top
   coordinates.

Pure and deterministic → straightforward to unit-test (single chain, branch,
forest, deep tree). No React-Flow / dagre dependency.

## Three surfaces

### 1. Editor — `FlowchartElement.tsx` (a block list, not a canvas)

Standard editor props `{ element, onChange, onDelete, isSelected, onSelect }`.

- **Optional flow title** field.
- **"Add block"** button appends a `FlowNode` (default title "New step").
- **Block list** — each block is a compact card with:
  - title, description, emoji icon, accent color
  - **link picker** (see below)
  - **"Comes after →"** dropdown: choose the parent block. The dropdown excludes
    the block itself and its descendants (cycle prevention). "— (start / root)"
    = no parent.
  - optional **branch label** (shown on the arrow from its parent)
  - delete
- **Live preview**: the auto-laid-out diagram (reuses the public renderer in a
  non-interactive preview mode) so the owner sees the shape as they edit.

**Link picker** (a small popover): tabs/sources —
- **My Pages** and **My Boards**: one `GET /api/displays` call (returns the
  owner's Displays where `kind != 'profile'`); split by `kind` (`'page'` vs
  `'collection'`). Selecting one sets `linkUrl = /{username}/{slug}` and
  `linkLabel = <title>`. (`username` from the client auth store.)
- **External URL**: a text field; the value is passed through
  `safeHref` (`src/lib/editor/safe-href.ts`) — only `http(s)`, `mailto`, or
  root-relative are accepted; anything else clears the link.
- **None**: clear the link (the block is a plain step).
- *Future:* a "My Hubs" source drops in here unchanged once Hub ships.

### 2. Public — `PublicFlowchartElement.tsx`

Props `{ element }`.

- Runs `layoutFlow(element.flowNodes)` and renders:
  - node **cards** absolutely positioned inside a relatively-positioned stage
    (icon, title, truncated description, accent);
  - all **arrows** in one **SVG overlay** (parent-bottom → child-top), with
    `branchLabel` text near the arrow;
- **Click a block → detail popover**: title, full description, and, if
  `linkUrl` is set, an **"Open →"** button. Internal (root-relative) links open
  in the same tab; external links open in a new tab with
  `rel="noopener noreferrer"`. A block with no link just shows its detail.
- **Responsive:** the stage sits in an `overflow: auto` container so a wide
  diagram scrolls within its own box; the page body never scrolls sideways.
  Empty flow → a neutral placeholder.

### 3. Published page

`src/lib/render-elements.tsx` renders `<PublicFlowchartElement element={element} />`.

## Wiring (standard add-an-element seams)

1. `ElementType` union + the `flow*` fields + `createElement('flowchart')` default
   in `src/lib/types/canvas.ts`. Default = one root block ("Start") so the
   element isn't empty on insert.
2. `src/components/elements/FlowchartElement.tsx` (editor) +
   `PublicFlowchartElement.tsx` (public).
3. `src/lib/flowchart-layout.ts` (+ test).
4. `SlashCommandMenu.tsx` — entry under **Data & Visuals**
   (`{ id: 'flowchart', label: 'Flowchart', icon: Workflow, description: 'Branching workflow of linked blocks', category: 'Data & Visuals' }` — lucide `Workflow`).
5. `ColumnCanvas.tsx` `renderElement` case (preview → Public, else editor).
6. `src/components/elements/index.ts` exports.
7. `src/lib/render-elements.tsx` case.

No `PageEditor` edit (its `default:` case delegates to `createElement()`).

## Security / safety

- **External links** only via `safeHref` (http(s)/mailto/root-relative). External
  targets get `rel="noopener noreferrer"` and `target="_blank"`.
- **Internal links** are stored as root-relative `/{username}/{slug}` strings
  built from the picker result — no arbitrary hosts.
- The element writes only to its own JSON; no new endpoints, no cross-tenant
  surface. The picker reads only the owner's own displays via existing
  `GET /api/displays` (already `getUser`-gated).
- No user HTML is rendered — titles/descriptions render as text.

## Testing

- **`layoutFlow` (pure):** single chain; a branch (parent → 2+ children);
  a forest (2 roots); a deeper tree — assert relative positions (children below
  parent, siblings non-overlapping, parent centered) and edge endpoints.
- **Cycle prevention (pure helper):** `descendantIds(nodes, id)` used by the
  editor's parent dropdown — a node can't pick itself or a descendant.
- **Link safety:** external via `safeHref` (bad scheme → cleared); internal
  stays root-relative.
- **Public render (component):** given nodes → renders N cards + (N−roots)
  arrows; clicking a linked block shows the detail popover with an "Open →"
  pointing at `linkUrl`; a block without a link shows no "Open".

## Success criteria

1. Owner adds a Flowchart element; it starts with a "Start" block.
2. Owner adds blocks, sets each block's parent and (optionally) a link to a page,
   a board, or an external URL, plus branch labels on a decision's arrows.
3. The editor preview and the published page show the same auto-laid-out tree.
4. A visitor clicks a block and sees its details; "Open →" navigates to the
   linked page/board/URL (external in a new tab).
5. The editor prevents a block from being parented to itself or a descendant.
