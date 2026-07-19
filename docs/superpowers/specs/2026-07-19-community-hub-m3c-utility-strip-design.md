# Community Hub M3c — Utility Strip + Three-Column Layout (design)

**Date:** 2026-07-19
**Status:** Approved design (spec). Implementation plan next.
**Milestone:** M3c in the Community Hub roadmap (M1 public page → M2 builder → M3a events → M3b Kollab pool → **M3c utility strip** → M4 appearance/theming + real Kollab AI + SEO).
**Base:** `main` @ `a7827ea` (M3b live in prod). Branch `feat/community-m3c`, isolated worktree `.claude/worktrees/community-m3c`.
**Mockup:** user-supplied, 2026-07-19 — utility strip (Notes / Kollab AI / Tools) above a themed two-column page.

## Context & goal

M3b shipped the Kollab pool as a full-width band between the header and the feed. The mockup has no
such band, and stacking a utility strip on top of it would put three full-width sections above the
feed. This milestone adds the strip **and** rebalances the page into three columns so the pool keeps
its prominence without pushing the feed below the fold.

Nothing here needs a migration or a new API — M3c is composition over surfaces that already exist.
That is deliberate: M3b was a large, security-sensitive milestone, and this one should be small.

### Decisions (user-approved)

- **Layout:** three columns — Kollab pool as a **left rail (260px)**, feed centre (`1fr`), existing
  widgets right (320px). Container widens `max-w-5xl` → `max-w-7xl`.
- **Strip:** full-width, above the header. Three cards: **Notes**, **Kollab AI**, **Tools**.
- **Notes:** reuse `HubNote` as-is. Owner-authored only (see constraint below).
- **Kollab AI:** rendered but **inert** — reserves the slot; the real assistant is M4.
- **Tools:** **owner/collaborator only.** Visitors see a two-card strip.
- **No illustrated theming** (signpost, frog, vines, forest footer, verified badge) — all M4.

### Constraint recorded: notes are owner-only

`HubNote` has **no `authorId`**, and `/api/hubs/[id]/notes` gates on `hub.userId !== me.id` → 404 —
owner-only, not even collaborators. The mockup's "Share ideas and connect" reads member-writable, but
member-authored notes would need a schema change (`authorId` + a participation gate + moderation).
**M3c keeps notes owner-only**; member notes are a separate, later decision. The Notes card is
therefore an *announcement* surface, not a discussion surface.

## Requirements

### R1 — Config: `utility` strip block

Extend `src/lib/types/hub-config.ts`, mirroring the existing `sidebar` shape exactly:

```
export const HUB_UTILITY_KEYS = ['notes', 'ai', 'tools'] as const
export type HubUtilityKey = (typeof HUB_UTILITY_KEYS)[number]
export type HubUtilityWidget = { key: HubUtilityKey; enabled: boolean }
// HubConfig gains:  utility: HubUtilityWidget[]
// DEFAULT_HUB_CONFIG.utility = [notes, ai, tools], all enabled
```

`sanitizeHubConfig` already appends missing sidebar widgets; extend the same treatment to `utility`
so existing saved configs gain the strip enabled with no migration and no regression. Update
`hub-config.test.ts` for the new block. The strip renders nothing when every card is disabled.

### R2 — Three-column layout

`CommunityHubView`:
- Container `max-w-5xl` → `max-w-7xl`.
- Grid becomes `lg:grid-cols-[260px_1fr_320px]`; `CommunityKollab` moves **out** of its full-width
  band into the first column, `CommunityFeed` second, `CommunitySidebar` third.
- When `config.kollab.enabled === false`, the grid falls back to today's
  `lg:grid-cols-[1fr_320px]` (feed + widgets) — no empty rail.
- **Mobile/tablet:** single column, order **feed → pool → widgets** (the feed is the reason people
  visit; the pool must not push it down on a phone). Use explicit `order-*` utilities, since DOM
  order is pool-first for desktop.
- `CommunityKollab` needs a **narrow variant**: 2-up thumbnail grid instead of the current
  `sm:grid-cols-3 md:grid-cols-4`. Same lightbox, same "Load more", same owner hover controls.

### R3 — The strip shell

New `src/components/hub/community/CommunityUtilityStrip.tsx`, rendered by `CommunityHubView` above
the header card, full-width.

- Grid of up to three cards: `md:grid-cols-3`, stacking on mobile.
- **Capped height** with internal scrolling on the Notes card — the strip must not push the header
  and feed far below the fold. Target: strip ≤ ~180px tall on desktop.
- Cards render only when enabled in config *and* permitted for the viewer (Tools is privileged-only),
  so the grid must handle 1–3 children gracefully rather than assuming three.
- `preview` prop short-circuits any fetching, consistent with `CommunityFeed`/`CommunityKollab`, so
  the builder's live preview stays fetch-free.

### R4 — Notes card

- Server-rendered from data the page already has access to: add `db.hubNote.findMany` to the
  **community branch** of `[username]/hub/[slug]/page.tsx` (today notes are fetched only in the
  data-room branch, *after* the community branch returns — see `page.tsx:114`).
- Filter with the existing `visibleNotes(notes, isOwner)` **server-side**, so private notes never
  reach a visitor's HTML. Pass only `{id, title, content, color}` — no `visibility`, no
  `linkedItemId` leakage.
- Card shows the first 2 notes (title + truncated content), then **"View all notes →"** opening a
  modal with the full list. Empty state invites the owner to add the first note.
- **Owner only** sees a **`+`** that opens a small compose form → `POST /api/hubs/[id]/notes`
  (existing route). Optimistic prepend on success. The route rejects collaborators, so the page must
  thread a new **`isOwner`** prop — `CommunityHubView` today receives only `isPrivileged`
  (owner *or* collaborator), which would show a `+` that 404s.
- **No new API and no schema change.**

### R5 — Kollab AI card (inert slot)

- Renders the mockup's prompt box **disabled**, with a clear "Coming soon" affordance and one line of
  copy ("Ask, brainstorm, get ideas.").
- No network calls, no `ANTHROPIC_API_KEY` usage, no route. The point is to reserve the exact slot so
  M4 drops the assistant in without re-layout.
- Must not look broken or like a bug: disabled styling + explicit label, not a dead input.

### R6 — Tools card (owner/collab only)

Four buttons, all navigation over existing surfaces — **no new API**:

| Button | Action |
|---|---|
| Polls | Opens the feed composer with a poll block ready, via a `pollNonce` counter threaded view → feed → composer (a counter, not a boolean, so repeat presses re-fire) |
| Events | Opens the existing `HubEventsModal` |
| Files | Opens `HubResourcesModal` (**new — see R6a**) |
| Links | Same modal |

### R6a — `HubResourcesModal`: close the files/links gap

**Discovered during planning:** community hubs have **no** files/links manager. `/hubs/[id]` renders
`HubBuilder` when `hub.community` is true and `HubEditor` (where `HubItem`s are managed) otherwise —
so a community owner cannot populate the Resources widget at all. The Tools card's Files/Links
buttons would have nothing to open.

M3c therefore adds `src/components/hub/builder/HubResourcesModal.tsx` over the **existing**
owner-gated endpoints — `GET /api/hubs/[id]` (returns `items`), `POST /api/hubs/[id]/items`,
`DELETE /api/hubs/[id]/items/[itemId]`. List file/link items, add one (type + title + url), delete
one. `HubItem.visibility` defaults to `"public"`, so additions appear in the public widget
immediately. Still no new API route and no migration.

- Hidden entirely for non-privileged viewers — gated on `isPrivileged`, which
  `CommunityHubView` already receives.
- "View all tools →" is **omitted** in M3c (the mockup shows it, but there is no fifth tool to show;
  adding a dead link is worse than omitting it). Recorded as an intentional mockup deviation.

### R7 — Builder

`HubBuilderNav` already reserves a disabled **"Widgets & Tools — Top utility widgets"** entry in its
`SOON` list. M3c **enables that section** (rather than bolting toggles onto Layout & Sections) with a
new `WidgetsToolsSection`: enable toggles for the three utility cards writing `config.utility`, plus
a "Manage files & links" button opening `HubResourcesModal` (R6a). `BuilderSection` gains
`'widgets'`. Live preview reflects the toggles.

## Security / correctness notes

- Notes filtering is **server-side** via `visibleNotes` — never ship private note bodies to the
  client and hide them in CSS.
- The Notes card's `+` posts to the existing owner-gated route; the client-side owner check is a UX
  affordance, not the boundary.
- Tools is `isPrivileged`-gated in render, but every action it triggers already enforces its own
  authz server-side — the card grants no new capability.
- `sanitizeHubConfig` must coerce a malformed `utility` block to the default rather than throw, same
  contract as `sidebar` (a bad config can never break public render).

## Verification plan

- **Unit:** `hub-config` for the `utility` block (default shape, append-on-missing, malformed →
  default, all-disabled); `visibleNotes` already covered — add a test that the community page's note
  DTO omits `visibility`.
- **Component:** strip renders 2 cards for a visitor and 3 for an owner; Notes card hides private
  notes; layout falls back to two columns when the pool is disabled.
- **Browser smoke — REQUIRED before merge, not after.** M3b shipped a CSP bug that every server-side
  test missed because the failure only existed in a browser. M3c is almost entirely client-side
  layout, so a real-Chrome pass is the primary gate: strip renders at 3 breakpoints, columns collapse
  in the right order on mobile, Notes modal opens, owner `+` creates a note, Tools buttons open their
  targets, pool rail still uploads and lightboxes.
- **Static:** `tsc --noEmit`, `eslint` (with the worktree `root:true` workaround), `pnpm test`,
  `next build`.
- Vercel build + deploy is the final prod gate.

## Non-goals (later)

Real Kollab AI (M4), illustrated theming / signpost / frog / forest footer / verified badge (M4),
member-authored notes (needs `authorId` — separate decision), note reordering or colour editing from
the strip, a "View all tools" surface, search wiring (the hub search input remains disabled).

## Open/accepted minors carried from M3b

Not fixed here, still open: upload token permits 100MB **images** (not just video); a failed drop
create after a successful Blob upload orphans the blob; optimistic drop row shows the author as
"you" until reload.
