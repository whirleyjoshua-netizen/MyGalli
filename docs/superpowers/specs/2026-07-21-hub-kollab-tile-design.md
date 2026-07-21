# Hub Kollab Tile + Approval Flow — Design Spec

**Date:** 2026-07-21
**Branch:** `feat/hub-kollab-tile` (worktree `.claude/worktrees/hub-kollab`, based on `origin/main` `ef49519`)
**Status:** approved in brainstorm, ready for planning

## Goal

Turn the Kollab pool from an inline thumbnail grid into a branded **Kollab tile** with two actions — **Drop content** and **See content** — where all content lives behind a viewer window, and **every member drop requires owner approval before anyone can see it**.

## Why

Two problems with the pool as shipped (M3b):

1. **No identity.** The pool is a plain text heading over a cramped grid in a 260px rail. Kollab is a named thing and should look like one.
2. **The safety gate is optional and awkward.** `config.kollab.requireApproval` defaults exist but an owner can leave the gate off, in which case a member's vulgar or irrelevant upload appears publicly the instant it lands. Approval, where enabled, is a hover-button on a thumbnail with no dedicated review surface, and `HubDrop.hidden` conflates "awaiting review" with "taken down".

## Current state (as of `ef49519`)

- `HubDrop` model — `prisma/schema.prisma:675-692`. Moderation is the single boolean `hidden`.
- `POST /api/hubs/[id]/drops` sets `hidden: config.kollab.requireApproval && !isPrivileged` (`route.ts:89`) and notifies the whole hub immediately via `postNotifyTargets` — **including for drops that are still hidden**.
- `PATCH /api/hubs/[id]/drops/[dropId]` takes `{ hidden: boolean }`, moderator-only. No audit trail, no reason, no author notification.
- `GET /api/hubs/[id]/drops` filters `hidden = false` server-side for non-privileged callers (`route.ts:28`). Cursor paginated, `PAGE = 24`.
- `CommunityKollab.tsx` (~250 lines) does upload, grid, lightbox, pagination, approve, remove, report, and consent copy in one component.
- `HubDropsModal.tsx` — Builder-side flat list with Hide/Unhide + Delete. No pending filter.
- Pool sits in the left rail of `CommunityHubView.tsx:99-116` under `id="hub-kollab"`; the Activity card deep-links to that id (`CommunityUtilityStrip.tsx:117-118`).

## Decisions (locked in brainstorm)

| # | Decision |
|---|---|
| D1 | The branded tile **replaces** the inline grid entirely. No thumbnails in the rail. |
| D2 | Wordmark is a **hand-built SVG**, orange gradient `#FF6B3D → #FF8A5B`, rounded geometric letterforms. Not the raster PNG, not recolored to Galli green. Kollab is a named sub-brand inside Galli. |
| D3 | Owner approval is **always on**. `config.kollab.requireApproval` is retired. No trusted-member bypass in this scope. |
| D4 | Review happens in a **Pending tab inside the viewer window**, not in the Builder. |
| D5 | Reject = `status='rejected'` + **the Blob asset is deleted**. Row kept for audit; file destroyed. |
| D6 | Notifications: owner on new pending; author on approve and on reject; the **hub-wide "new clips" notification moves from upload to approval**. |

## Data model

Replace the overloaded `hidden` boolean with an explicit status.

```prisma
model HubDrop {
  // ... existing fields ...
  status       String    @default("pending")  // 'pending' | 'approved' | 'rejected'
  reviewedAt   DateTime?
  reviewedById String?
  assetDeleted Boolean   @default(false)

  @@index([hubId, status, createdAt])
}
```

- Additive migration, hand-authored (per repo convention — `migrate diff --from-url` is contaminated on the shared dev DB).
- Backfill in the same migration: `UPDATE "HubDrop" SET status = CASE WHEN hidden THEN 'pending' ELSE 'approved' END;`
- `hidden` is **left in place** by this migration and dropped in a follow-up once nothing reads it. Never drop a column in the same deploy that stops writing it.
- `reviewedById` is a plain String (no FK) — an audit stamp, not a relation, so a reviewer's account deletion can't block it.

## Config changes

`config.kollab` in `src/lib/types/hub-config.ts`:

- `requireApproval` — **retired**. `sanitizeHubConfig` must keep tolerating the key on existing stored configs (drop it silently, never throw), the same way it tolerates the legacy `ai` utility key. No config migration is run; the field is simply no longer read.
- `enabled` and `whoCanDrop` — unchanged.
- `LayoutSectionsSection.tsx` — remove the "Require approval for member uploads" toggle. The "Manage drops" button and `HubDropsModal` stay for now as the owner's bulk hide/delete surface; they are not the review queue.

## Module boundaries

| Unit | Responsibility | Depends on |
|---|---|---|
| `src/lib/hub-drops.ts` (extend) | pure: `nextStatusFor(isPrivileged)`, `canReviewDrop({isPrivileged})`, status-aware `toDropDTO` | nothing |
| `GET /api/hubs/[id]/drops` (extend) | `?status=approved\|pending`; `pending` requires privilege else 403; default `approved` | `community.ts`, `hub-drops.ts` |
| `PATCH /api/hubs/[id]/drops/[dropId]` (rewrite) | body `{ action: 'approve' \| 'reject' }`; moderator-only; reject purges Blob | `hub-drops.ts`, `media-url.ts` |
| `KollabWordmark.tsx` (new) | the SVG wordmark, gradient, `size` prop | nothing |
| `KollabTile.tsx` (new) | presentational: wordmark, count line, two buttons, owner-only pending badge | `KollabWordmark` |
| `KollabViewer.tsx` (new) | modal shell, tabs, lightbox, focus trap, Esc | `KollabGrid` |
| `KollabGrid.tsx` (new) | one grid, mode `'approved' \| 'pending'`; pending mode renders author + approve/reject | `ReportButton` |
| `CommunityKollab.tsx` (shrink) | container: fetch, state, upload, renders tile + viewer | all of the above |

Splitting `CommunityKollab.tsx` is required by this change, not incidental refactoring — the file already does too much and the viewer would push it past 400 lines.

## Security invariants

These are carried forward from the existing implementation and must not regress:

1. **Pending and rejected rows are filtered server-side.** A non-privileged client must never receive the URL of an unapproved asset. Filtering in the client is not acceptable.
2. **Blob deletion is ownership-checked.** Reject purges only URLs passing `isOwnDropAsset(hubId, url)` — the guard that prevents the cross-tenant Blob-deletion issue raised in the M3b review. Host allowlisting alone is not ownership.
3. **The pending count is fetched privileged.** The public payload never carries a pending count or any pending metadata.
4. **`?status=pending` returns 403, not an empty list,** for unprivileged callers — an empty list would invite probing.
5. Existing rate limits stay: 20/min create, 30/min upload-token.

## UI

### Tile (replaces the grid, keeps `id="hub-kollab"`)

```
┌──────────────────────────┐
│        Kollab            │  SVG wordmark, orange gradient
│   24 clips & photos      │  muted; empty → "Be the first to drop something."
│  ┌────────────────────┐  │
│  │  ＋ Drop content    │  │  solid orange, primary
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │    See content     │  │  outline, secondary
│  └────────────────────┘  │
│  ⚠ 3 awaiting review     │  amber — OWNER/MODERATOR ONLY
└──────────────────────────┘
```

- Card chrome matches its neighbours (`rounded-2xl border border-border bg-surface p-5`) so the orange reads as an accent inside the Galli system.
- **Drop content** hidden entirely when `canDrop` is false (`whoCanDrop: 'owner-only'` and not privileged). Rule unchanged.
- **See content** always rendered; disabled with a muted label when there are zero approved items.
- Consent line (`consentTextFor`) moves into the upload confirmation, not the tile face.

### Viewer (modal, `max-w-5xl`, focus-trapped, Esc closes)

- Tabs: `Approved (N)` always. `Pending (N)` **only** for owner/collaborator.
- Approved grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`, `aspect-square`, video tiles keep the Play overlay. Click → existing lightbox. Hover keeps **Report** and **Remove** (author or moderator).
- Pending grid: author avatar + handle + relative time per tile, with **✓ Approve** / **✗ Reject** beneath. Reject confirms once, because the file is destroyed.
- Cursor pagination per tab, `PAGE = 24`, "Load more" as today.

## Flows

**Member drops** → upload token → `POST /drops` → row `status='pending'` → not inserted into the approved grid → notice "Uploaded — the owner will review it before it appears." → owner notified.

**Owner approves** → `PATCH { action:'approve' }` → `status='approved'`, `reviewedAt`/`reviewedById` stamped → item moves Pending → Approved optimistically, tile count +1, badge −1 → author notified "live in Kollab" → hub-wide "N new clips" notification fires **here**.

**Owner rejects** → confirm → `PATCH { action:'reject' }` → `status='rejected'`, Blob purged, `assetDeleted=true` → tile leaves Pending → author notified "wasn't approved". The author sees "Not approved" on their own submission; no one else sees it in any tab.

**Owner's own drop** → `nextStatusFor(isPrivileged) === 'approved'` → straight into the pool, no self-review.

## Error handling

- Every mutation is optimistic with rollback on non-2xx plus an inline notice — the pattern already used in `CommunityKollab`.
- **A failed Blob purge does not fail the reject.** The row is still marked `rejected` and `assetDeleted` stays `false`. The content is invisible either way; a stale file is a billing problem, not a safety one.
- Upload failures surface per-file; a partial multi-file upload keeps the successes.

## Testing

Pure functions:
- `nextStatusFor` — privileged → `'approved'`, member → `'pending'`.
- `canReviewDrop` — owner/collaborator true, author of the drop false.
- `toDropDTO` — never emits `url` for a `rejected` row.

Routes:
- `GET ?status=pending` → 403 unprivileged.
- `GET` default excludes both `pending` and `rejected` for everyone, privileged included.
- `PATCH approve` → 403 for the plain author, 200 for owner, stamps `reviewedAt`/`reviewedById`.
- `PATCH reject` → sets status, calls purge with an own-asset URL only.
- `PATCH` against another hub's drop → 404 (IDOR).
- Reject when purge throws → still 200, `assetDeleted` false.

Components:
- Tile hides **Drop content** when `canDrop=false`.
- Pending badge renders only for privileged.
- Pending tab absent for non-privileged.
- Approve moves an item between tabs and updates both counts.

Migration:
- Verify the backfill maps `hidden:true → pending` and `hidden:false → approved` against the real dev DB before it goes near prod Neon.

## Out of scope

- The **Kollab AI** stitching engine — still the future occupant of this column.
- Trusted-member bypass; bulk approve-all.
- The pre-existing `ModerationQueue.tsx:49` bug where it PATCHes `status:'actioned'` but the route only accepts `['open','resolved','dismissed']`, so the call 400s silently. Noted, not fixed here.
- Dropping the `hidden` column (follow-up migration).

## Related

[[community-hub]], [[hub-feature-vision]], `docs/superpowers/specs/2026-07-19-community-hub-m3b-kollab-pool-design.md`
