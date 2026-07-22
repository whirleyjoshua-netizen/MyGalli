# Unified Hub: Files Tab + Announcements — Design Spec

**Date:** 2026-07-22
**Branch:** `feat/hub-unified` (worktree `.claude/worktrees/hub-unified`, based on `origin/main` `496ba35`)
**Status:** approved in brainstorm, ready for planning

## Goal

Make a community Hub and a file-storage Hub one and the same thing: every unified hub has the community experience (feed, members, Kollab, events) **and** a file-storage data-room reachable from a **Files** tab, and shows owner **announcements** to members the moment they arrive.

## Why

Three problems on the current community hub page:

1. **The "two hubs" split is confusing.** A hub is either a community (`community: true`, renders `CommunityHubView`) or a file data-room (`community: false`, renders `HubEditor`). They are one `Hub` model rendered two ways, and users experience them as separate products.
2. **The Files tool is a decoy.** The Tools card's "Files" button opens a flat `HubResourcesModal` (title+url rows), not the rich folder-tree + `HubFileViewer` data-room. A community hub has no real file room.
3. **A large blank band** sits in the header card between the title and the counts, and members have nothing to see "when they walk in."

## Current state (as of `496ba35`)

- **One `Hub` model** (`prisma/schema.prisma`) with a `community Boolean @default(false)`. It already declares BOTH the file relations (`folders HubFolder[]`, `items HubItem[]`) and the community relations (`posts`, `members`, `drops`, `hubEvents`, `notes`, `collaborators`, `hubReports`, `hubBans`). Nothing to merge at the schema level.
- **Render branch:** `src/app/[username]/hub/[slug]/page.tsx:30` and `:70` branch on `hub.community`. Community → `CommunityHubView`; else → the file/data-room view.
- **Creation:** `POST /api/hubs` (`src/app/api/hubs/route.ts:29-30`) sets `community: body.community === true` and `published: isCommunity`. The community creation path (`CreateCommunityModal` / `NewCommunityModal`) already passes `community: true`.
- **The "Home" tab** (`src/components/hub/community/CommunityHubView.tsx:93`) is decorative — a static `<span>` with an active-tab underline plus a **disabled** search input. No real tab switching exists.
- **The Files tool** (`src/components/hub/community/CommunityUtilityStrip.tsx:215`) calls `onOpenResources`, which opens `HubResourcesModal` — a flat list of `HubItem` rows (`type: 'file' | 'link'`, title + url). Same `HubItem` table the "Resources" count reads.
- **The rich data-room** components already exist and are used by the non-community render path: `HubFolderTree`, `HubFileViewer`, the folders/items API, and `src/lib/hub-access.ts` (per-folder/item `visibility` + bcrypt `passcodeHash` + signed unlock cookie, all server-filtered).
- **The blank band** is empty flex space in `src/components/hub/community/CommunityHeader.tsx:30` between the `flex-1` title block (`:37`) and the right-aligned actions/counts column (`:55`).
- **`HubPost` has no `pinned` field.** No announcement/pinned concept exists. `HubNote` (top-strip Notes) is a separate hub-wide note concept, not an announcement.

## Decisions (locked in brainstorm)

| # | Decision |
|---|---|
| D1 | **Every hub is both.** New hubs are created unified (community + files + announcements). Existing community hubs gain the Files tab + announcements automatically (their `folders`/`items` are just empty). Existing file-only data-rooms (`community: false`) are left rendering exactly as today — no forced conversion. |
| D2 | **Files is a tab**, not a modal or a separate route. `CommunityHubView`'s decorative Home label becomes a real **Home \| Files** tab bar, tab state in the URL (`?tab=files`). |
| D3 | The Files tab renders the **existing rich data-room** (`HubFolderTree` + `HubFileViewer` + folders/items), scoped to the hub id, reusing `hub-access.ts` server-side filtering. |
| D4 | **Files are owner/collaborator-managed only.** Members browse and download `public` items; they do not upload. Member contributions go through the moderated Kollab pool ([[hub-kollab-tile]]). |
| D5 | Both the **Tools "Files" button** and the **Files tab** point to the same place (the tab). The flat `HubResourcesModal` is retired for files. The **Links** tool keeps its own lightweight list (`HubItem type='link'`). |
| D6 | **Announcements** = a new `HubAnnouncement` model, owner/collaborator-managed, shown as a **rotating banner** in the header band with a `‹ 1/N ›` pager. Members read-only. No per-member read/dismiss state. |

## Part A — Unification (framing, minimal code)

No schema merge and no data migration for the merge itself. Unification is achieved by:

1. The community view becomes the canonical hub page and gains the Files tab (Part B) and announcements (Part C).
2. New-hub creation lands people in the unified experience. The community creation path already sets `community: true`; confirm the primary "create hub" entry points route there so a new hub is unified by default. Do **not** change the file-only creation path or flip any existing hub's `community` flag.
3. Existing community hubs need no migration — the new features read relations that already exist (empty).

## Part B — The Files tab

### Tab bar
Replace the decorative Home label in `CommunityHubView.tsx` with a real tab bar:
- Tabs: **Home** | **Files**. Active tab from the URL search param `?tab=files` (absent/other ⇒ Home), using the App Router's `useSearchParams` + shallow navigation, wrapped in `<Suspense>` as the repo already does for `?tab=` elsewhere (My Pond).
- **Home** renders exactly today's content (announcements banner, Kollab, feed, members, utility strip). The disabled search box stays on Home; wiring search is out of scope.
- **Files** replaces the 3-column body with the data-room.

### Files content
Reuse the existing data-room components, scoped to `hub.id`:
- `HubFolderTree` (left), `HubFileViewer` (preview), the folders/items list.
- Server-side access via `src/lib/hub-access.ts` — unchanged. Items/folders whose `visibility` is not `public` are filtered server-side for non-privileged viewers; passcode unlock via the existing signed cookie.

### Access (D4)
- **Owner / collaborators** (`canModerate`): create folders, upload, set visibility, delete. Full management.
- **Members / public**: browse + download `public` items only. No upload control is rendered for them, and the upload/folder-mutation APIs already gate on ownership — confirm they reject non-privileged callers (they are the file-hub APIs; verify, don't assume).
- **Deliberate simplification:** community "members" get no special file visibility beyond `public`. Mapping a `members` visibility tier onto `HubMember` is a noted follow-up, not in scope.

### Entry points (D5)
- The **Files tab** and the Tools card's **Files button** both select the Files tab. The Files button's handler changes from "open `HubResourcesModal`" to "navigate to `?tab=files`".
- `HubResourcesModal` is retired for files. **Links** tool unchanged (its own quick list).

## Part C — Announcements

### Data model
```prisma
model HubAnnouncement {
  id        String   @id @default(cuid())
  hubId     String
  hub       Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation("HubAnnouncementAuthor", fields: [authorId], references: [id])
  body      String
  createdAt DateTime @default(now())
  @@index([hubId, createdAt])
}
```
Plus the back-relation `announcements HubAnnouncement[]` on `Hub` and the named relation on `User`. Additive, hand-authored migration (`migrate diff --from-url` is contaminated on the shared dev DB — write the SQL by hand, then `migrate deploy`).

### API — `/api/hubs/[id]/announcements`
- `GET` — the most recent 10, newest first. Any hub viewer (respects `canViewCommunityHub`).
- `POST` — create. `canModerate` only (owner/collaborator). Rate-limited (follow the drop-route pattern, e.g. 20/min, `prefix: 'hub-announcement'`). Body validated: trimmed, non-empty, ≤ 280 chars.
- `DELETE /[announcementId]` — `canModerate` only. Hub-scoped `findFirst({ id, hubId })` → 404 on mismatch (IDOR-safe, mirrors the drop `[dropId]` route).

### Pure lib — `src/lib/hub-announcements.ts`
- `validateAnnouncementBody(raw): { ok: true, value } | { ok: false, error }` — trim, non-empty, ≤ 280.
- `toAnnouncementDTO(row)` — `{ id, body, createdAt, author: { username, name, avatar } }`.

### UI
- **`HubAnnouncementBanner.tsx`** — presentational. Given the list: shows the most recent (📢 icon, body, "posted Nh ago"), a `‹ 1/N ›` pager stepping client-side through the list. Owner/collaborator also get a delete (✕) on the shown item and a ＋ / "Post announcement" affordance.
- **`HubAnnouncementComposer.tsx`** — owner inline composer (single text field + Post), used by the ＋ affordance. Optimistic insert with rollback on non-2xx (the pattern used across hub components).
- **Empty state:** members see nothing — the band collapses and the header looks like today. Owner/collaborator see a muted "📢 Post your first announcement" prompt so it's discoverable.
- **`CommunityHeader.tsx`** mounts the banner in the blank flex band (`:30`–`:54` region). The banner must not break the header's responsive flex layout (stacks on mobile).
- **SSR:** the public page fetches the latest announcements in the existing `Promise.all` in `page.tsx` and passes them down, so a member sees the banner on arrival with no client flash.

## Module boundaries

| Unit | Responsibility | Depends on |
|---|---|---|
| `HubAnnouncement` model + migration | data | — |
| `src/lib/hub-announcements.ts` | pure validate + DTO | — |
| `GET/POST /api/hubs/[id]/announcements` | list + create, `canModerate` gate | `community.ts`, `hub-announcements.ts` |
| `DELETE …/[announcementId]` | delete, hub-scoped, `canModerate` | same |
| `HubAnnouncementBanner.tsx` | rotating banner + pager (presentational) | — |
| `HubAnnouncementComposer.tsx` | owner create composer | banner |
| `CommunityHeader.tsx` (modify) | mount banner in the blank band | banner |
| `CommunityHubView.tsx` (modify) | Home\|Files tab bar; mount data-room on Files | file components |
| `HubFilesTab.tsx` (new wrapper) | mount `HubFolderTree`+`HubFileViewer` scoped to hub, community-styled | existing file components, `hub-access.ts` |
| `CommunityUtilityStrip.tsx` (modify) | Files button → `?tab=files` | — |

## Security invariants

1. **File visibility is server-filtered** by `hub-access.ts` — a non-`public` item's URL must never reach a non-privileged client. Unchanged from the file-hub behavior; the Files tab must not bypass it.
2. **File mutations are owner/collaborator-only** — the folders/items/upload APIs already gate on ownership; the Files tab renders management controls only for `canModerate`, and the server is the real gate.
3. **Announcement create/delete is `canModerate`-only**, hub-scoped against IDOR (`findFirst({ id, hubId })`).
4. **Announcement body is validated and length-capped** server-side (≤ 280), not just in the client.
5. No new public write endpoint; a member can never create or delete an announcement or a file.

## Testing

- **Pure:** `validateAnnouncementBody` (empty → error, >280 → error, trims), `toAnnouncementDTO`.
- **Routes:** announcements GET (viewer ok), POST (member → 403, owner → 201, empty body → 400), DELETE (cross-hub → 404, member → 403, owner → 200). File-mutation APIs reject non-privileged (regression check on the reused routes).
- **Components:** tab bar switches Home↔Files on `?tab`; Files tab hides upload/管理 controls for a non-privileged viewer; announcement banner renders latest + pager steps; empty state differs owner vs member; composer optimistic insert + rollback.
- **SSR:** the public page includes the latest announcement in server-rendered HTML for a member (no flash, no leak of a non-public file URL).

## Out of scope

- Converting existing file-only data-rooms to unified hubs (D1 — left as-is; a per-hub convert button is a possible later follow-up).
- A `members` file-visibility tier mapped onto `HubMember` (D4 simplification).
- Wiring the Home search box (disabled today).
- Per-member announcement read/dismiss state.
- Member file uploads (would need Kollab-style moderation).
- Pinned feed posts / reactions on announcements.

## Related

[[community-hub]], [[hub-kollab-tile]], [[hub-feature-vision]], the in-hub file viewer + access-control work recorded in [[community-hub]].
