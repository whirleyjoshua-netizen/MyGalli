# Collection Boards — Slice 1 Design

**Date:** 2026-07-06
**Status:** Approved (brainstorm) → ready for implementation plan
**Branch:** `worktree-collection-boards`

## Context & framing

Galli's `Display` already fuses Notion's two halves: it is a structured record
(title, slug, category, `kind`, `coverImage`, `views`) *and* a full rich
document (the canvas of elements). Collection Boards add the one layer *above*
`Display`: a **Collection** — a curated group of Displays presented as a
published, shareable page.

The full vision (schema/properties, relations, rollups, multiple view types,
data ingestion, live-capture) is 4–5 independent subsystems. Per the
scope-discipline guardrail — *every collection feature must terminate in a
published page* — we decompose into a sequence of small, shippable specs. **This
document is slice 1 only.**

### Slice 1 scope

**Board + membership + Gallery view.** A Pro user creates a board, adds their own
pages to it, arranges them, designs the board's home page, and publishes it as a
discoverable gallery of page cards.

### Explicitly deferred to later slices

Custom properties (PropertyDef), relations, rollups, extra view types
(leaderboard/list/etc.), data import, live-capture as a property. None are built
or half-built here; the data model is shaped so they slot in later without a
rewrite.

## Decisions locked during brainstorming

| Decision | Choice |
| --- | --- |
| What a board *is* | A `Display` with `kind:'collection'` (reuses editor/publishing/route/analytics) |
| Gallery rendering | A new canvas element `collection-view`, not a bolted-on layout |
| Membership source | Owner's own `kind:'page'` Displays only |
| Membership multiplicity | Many-to-many (a page can belong to several boards) |
| Pro gating | Boards are **Pro-only** to create/edit/manage; public viewing is open |
| Public gallery contents | Only members that are themselves `published:true` |
| Ordering | Manual drag-to-order (`position`) |
| Deleted member | Auto-drops (cascade) |
| Discovery | Published boards appear in Explore + feed (require category on publish) |

## Architecture

### 1. Data model — one new table

A board reuses the entire `Display` model via `kind:'collection'`. No new columns
on `Display` (`kind` already exists alongside `'page'`/`'profile'`). Reused as-is:
`slug`, `title`, `description`, `coverImage`, `sections` (the board's editable
canvas), `background`, `spacing`, `headerCard`, `published`, `category`, `views`,
`analytics`, `shareLinks`, `version`.

Membership is one new join table:

```prisma
model CollectionMember {
  id           String   @id @default(cuid())
  collectionId String   // the board Display (kind:'collection')
  memberId     String   // a member Display (kind:'page')
  position     Int      @default(0)
  createdAt    DateTime @default(now())
  collection   Display  @relation("CollectionMembers", fields: [collectionId], references: [id], onDelete: Cascade)
  member       Display  @relation("MemberOfCollections", fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([collectionId, memberId])
  @@index([collectionId])
  @@index([memberId])
}
```

`Display` gains two back-relations (no columns):

```prisma
// on model Display
collectionMembers CollectionMember[] @relation("CollectionMembers")  // rows where this display is the board
memberOf          CollectionMember[] @relation("MemberOfCollections") // rows where this display is a member
```

Properties of this shape:
- Many-to-many falls out of the join table.
- `onDelete: Cascade` on both FKs → deleting a board *or* a member page removes
  its rows automatically (the "deleted member auto-drops" rule, for free).
- `position` gives manual ordering; `@@unique([collectionId, memberId])` blocks
  duplicate membership.

Migration is generated non-interactively:
`prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script`
→ new `prisma/migrations/<ts>_add_collection_member/migration.sql` →
`prisma migrate deploy`. No change to `Display` columns.

### 2. The `collection-view` element

The gallery is a **canvas element** dropped onto the board's page, so the board is
a fully editable home page (hero + intro copy *above* the gallery) and slice 3's
Leaderboard becomes just another element. Follows the documented add-an-element
checklist:

1. `ElementType` union + fields in `src/lib/types/canvas.ts`.
2. `createElement()` default (single source of defaults — `PageEditor`'s
   `default:` case delegates here, so no `PageEditor` edit needed).
3. `src/components/elements/CollectionView.tsx` (editor) +
   `PublicCollectionView.tsx` (public).
4. `SlashCommandMenu.tsx` — new entry; its category must be in `CATEGORY_ORDER`.
5. `ColumnCanvas.tsx` `renderElement` switch (preview → Public, else editor).
6. `src/components/elements/index.ts`.
7. `src/lib/render-elements.tsx` case (the published page).

**Element config is display-only:**

```ts
{
  type: 'collection-view',
  viewType: 'gallery',              // only option in slice 1; the seam for later views
  columns: 3,                       // 2 | 3 | 4 grid density
  showCategory: true,
  showDescription: false,
}
```

**Membership is NOT stored in the element.** It lives in `CollectionMember` rows
(board-level), so it survives element edits/deletes and is queryable for slice 3
rollups. The element is purely: the renderer + a "Manage members" button.

Editor props `{element, onChange, onDelete, isSelected, onSelect}`; Public props
`{element}` — but the public renderer also needs the member data (see §5).

### 3. Member management

REST surface, all Pro-gated and ownership-checked:

- `GET    /api/collections/[id]/members` — list rows (with member Display summary), ordered by `position`.
- `POST   /api/collections/[id]/members` — body `{ memberId }`; adds at end.
- `DELETE /api/collections/[id]/members` — body `{ memberId }`; removes.
- `PATCH  /api/collections/[id]/members` — body `{ order: string[] }` (memberIds in new order); rewrites `position`.

Ownership is enforced with the established IDOR-safe pattern
(`updateMany`/`deleteMany where { ..., collection: { userId } }` or an explicit
board-ownership check before write). `[id]` is the board Display id, which must be
`kind:'collection'` and owned by the caller.

**"Manage members" modal** (standard `isOpen/onClose/config/onChange` modal
pattern): lists the owner's own `kind:'page'` Displays (excludes `'profile'` and
other `'collection'` boards, and the board itself), checkbox to add/remove, drag
to set order. Candidate list reuses the existing "my displays" query with a
`kind:'page'` filter.

### 4. Board lifecycle

- **Create:** new "New Board" item (with `ProBadge`) in the dashboard create menu.
  `POST /api/displays` extended to accept `kind:'collection'` (Pro-gated). Seeds a
  default title + one `collection-view` element in `sections`, then opens the
  editor. Free user → 403 + `UpgradePrompt`.
- **Edit:** the normal `PageEditor` (renders any Display's canvas). Membership via
  the element's Manage-members modal.
- **Publish:** existing `PublishDialog` — requires a category (unchanged behavior).
- **Discover:** Explore/feed queries currently exclude only `kind:'profile'`, so
  `kind:'collection'` is included automatically. Add a small "Board" badge +
  member count to its Explore/feed card. (Verify the exact query filters during
  implementation.)

### 5. Public rendering & visibility

The public route `src/app/[username]/[slug]/page.tsx` already renders Displays.
The only new wiring: when the Display is `kind:'collection'`, the loader fetches
its `CollectionMember` rows **joined to members filtered `published: true`,
ordered by `position`**, and passes them into `render-elements.tsx` so
`PublicCollectionView` renders member cards (reusing `ExploreCard` styling) that
link to each member's public URL (`/[username]/[slug]`).

- Drafts (unpublished members) are hidden on the public page; the editor shows
  them with a "draft — hidden" tag.
- Deleted members are already gone (cascade).
- Empty board publicly → the canvas renders with an empty-gallery state.

The **published + position-ordered member filter is a pure function**
(`selectVisibleMembers(rows) → orderedPublishedMembers`), unit-tested like
`element-aggregate.ts`. This keeps the IO (Prisma fetch) thin and the logic
testable.

### 6. Pro gating

`isPro()` (from `src/lib/plan.ts`) gates: **create board**, **save board edits**,
**manage members** (all four member routes). Free users:
- Can view any public board and see boards in Explore/feed.
- Clicking "New Board" → `UpgradePrompt` (existing component).
- Any API write to a collection/members as a non-Pro → 403.

Uses existing `ProBadge` / `UpgradePrompt` (`src/components/pro/*`). No billing
work — Pro is still set in DB, consistent with current gating.

### 7. Edge cases

| Case | Behavior |
| --- | --- |
| Empty board | Editor: "Add pages to your board" prompt. Public: canvas renders, gallery shows empty state. |
| Member unpublished after adding | Hidden publicly; flagged "draft — hidden" in editor. |
| Member page deleted | Row cascades away; disappears everywhere. |
| Board added to itself / another board | Blocked — candidate list is `kind:'page'` only; API rejects non-`page` `memberId`. |
| Duplicate add | Blocked by `@@unique([collectionId, memberId])`; API is idempotent. |
| Non-owner hits member API | 403/404 via ownership check. |

## Testing strategy

**Unit (pure functions):**
- `selectVisibleMembers` — filters to `published`, sorts by `position`, drops
  nothing else; stable on empty and single-item inputs.
- reorder/position logic — `order: string[]` → correct `position` assignment;
  ignores ids not in the board.
- Pro-gate branch — `isPro` true/false → allow/deny.

**API route tests:**
- Add/remove/reorder as owner → success; as non-owner → 403/404.
- Add a non-`page` (`profile`/`collection`) member → rejected.
- Duplicate add → idempotent, no dup row.
- Create board as free user → 403.

**Manual/verify:** create board → add 3 pages, reorder, unpublish one → publish
board → confirm public gallery shows 2 in order, links resolve; confirm board
appears in Explore with a category.

## Migration & rollout notes

- One migration: `add_collection_member` (new table only; no `Display` column
  change). Generate via `migrate diff`, apply via `migrate deploy`. Safe on the
  live Neon DB (additive).
- No data backfill needed.
- Shared dev DB with the other worktree: this migration is additive and
  independent; coordinate timing so we don't both run `migrate deploy`
  simultaneously.

## Out of scope (future slices)

1. **Slice 2 — Property schema:** typed `PropertyDef`s per member (generalize
   `KitProfileField`/`TrackerFieldDef`), per-member property storage, property
   display on gallery cards.
2. **Slice 3 — Leaderboard view + rollups:** a second `viewType`, aggregations
   across members (generalize `element-aggregate.ts`).
3. **Slice 4 — Relations:** Display↔Display joins (Athlete→School).
4. **Later:** data import/ingestion, live-capture-as-property, additional views.
