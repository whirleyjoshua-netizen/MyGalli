# Community Hub M3b — The Kollab Pool (design)

**Date:** 2026-07-19
**Status:** Approved design (spec). Implementation plan next.
**Milestone:** M3b in the Community Hub roadmap (M1 public page → M2 builder → M3a events → **M3b Kollab pool** → M3c Notes+Tools → M4 real Kollab AI + appearance + SEO).

## Vision context (why this exists)

A community hub is the **collection + collaboration** layer; **Kollab AI** (future, M4+) is the **creation** layer on top. Members drop raw content (clips, photos) into one shared community pool; a later AI engine compiles/edits/stitches that pool into finished content (reels, highlights, montages). The separate app at `C:\Users\whirl\Kollab_ai` is a QR-code video-capture tool (Next.js 16 + Supabase, **no AI yet**, no integration API) — it is the seed of the "drop content" idea, not something we integrate against now. M3b builds the **pool**; the AI engine is explicitly deferred.

## Scope (M3b)

**In:** a member content **drop-zone** for community hubs — **photos + video only** — rendered as a **prominent full-width section** on the community public page, with owner moderation. This is the attributed, per-community media reservoir the future AI consumes.

**Out (deferred):**
- The AI engine (stitch/compile/edit) → M4.
- Notes surfacing (reuse `HubNote`) + a "Tools" strip → M3c.
- Reactions/comments on drops; albums/folders within the pool; links/files/audio/PDF in the pool.

## Decisions (user-approved)

- **Scope:** Kollab pool only (Notes + Tools moved to M3c).
- **Placement:** full-width section, directly under the community header, **above** the feed+sidebar grid; config-toggleable.
- **Content types:** `image` + `video` only (every drop is a stitchable asset). No links/files/audio/PDF.
- **Upload:** client-direct-to-Blob (existing `/api/upload` can't do video — MIME blocked + ~4.5MB serverless body ceiling).
- **Video cap:** ~100MB.

## Architecture

### 1. Data — new `HubDrop` model
Own model, mirroring how M3a added `HubEvent` (additive migration, no backfill):

```
model HubDrop {
  id           String   @id @default(cuid())
  hubId        String
  hub          Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  authorId     String
  author       User     @relation(fields: [authorId], references: [id])
  type         String   // 'image' | 'video'
  url          String
  thumbnailUrl String?
  caption      String?
  mimeType     String?
  width        Int?
  height       Int?
  hidden       Boolean  @default(false)
  createdAt    DateTime @default(now())
  @@index([hubId, createdAt])
}
```

- `authorId` attribution is what makes drops member-contributed and future-AI-consumable.
- `hidden` = moderation soft-hide; kept in DB (pool retains it for the AI) but excluded from public lists.
- Migration `20260719000000_hub_drop` (additive, sorts after existing hub_config/hub_event migrations; no backfill). Add the back-relation on `Hub` (and `User` if required by Prisma).

### 2. Upload — client-direct-to-Blob
- **`POST /api/hubs/[id]/drops/upload`** — Vercel Blob `handleUpload` token route.
  - `onBeforeGenerateToken`: authorize caller is a hub **member** (`canParticipate`) AND `whoCanDrop` allows them; restrict `allowedContentTypes` to `image/*` + `video/*`; `maximumSizeInBytes` ≈ 100MB.
  - `onUploadCompleted`: no-op/best-effort (dev has no public callback URL); the row is created by the client via the create route below.
- **Client flow:** browser calls `upload(filename, file, { access:'public', handleUploadUrl })` → gets Blob URL + progress → then `POST /api/hubs/[id]/drops` with `{type,url,thumbnailUrl?,caption?,mimeType?,width?,height?}`.
- **Video poster:** capture first frame client-side (`<video>`→`<canvas>`→JPEG blob) and upload as `thumbnailUrl`. Fallback if capture fails: render `<video preload="metadata">` + ▶ overlay (no server ffmpeg).
- `src/lib/upload-validate.ts` extended with video MIME types + a video size limit (reusable).

### 3. APIs (mirror events/posts conventions)
- **`POST /api/hubs/[id]/drops`** — create. `canParticipate` + `whoCanDrop` server-enforced; **rate-limited** (`hub-drop-create`, 20/min); validates `type`∈{image,video} + url shape; **notifies** owner+collabs (`hub_drop`); returns `{id}`.
- **`GET /api/hubs/[id]/drops`** — list. Read-gated via `canViewCommunityHub` (published or privileged). Newest-first; cursor pagination `?before=<createdAt|id>`; excludes `hidden` for public; owner/collab see all (with a flag). Returns drops + author DTO (userId/username/name/avatar only — same minimal shape as members).
- **`DELETE /api/hubs/[id]/drops/[dropId]`** — `author ‖ canModerate`; IDOR-scoped `findFirst({ id, hubId })` → 404. Best-effort Blob delete of the asset.
- **`PATCH /api/hubs/[id]/drops/[dropId]`** — `canModerate` hide/unhide.
- Pure helper **`src/lib/hub-drops.ts`** — `validateDropInput`, `toDropDTO` — unit-tested (like `hub-events.ts`).

### 4. Config
Extend `HubConfig` (`src/lib/types/hub-config.ts`) with a top-level block (NOT a sidebar widget — it's full-width):

```
kollab: { enabled: boolean; whoCanDrop: 'members' | 'owner-only' }
// DEFAULT: { enabled: true, whoCanDrop: 'members' }
```

`sanitizeHubConfig` (`src/lib/hub-config.ts`) fills `kollab` for old configs (⇒ no regression; existing communities gain the section enabled). Add a `canDropToPool(config, isPrivileged, isMember)`-style helper mirroring `canPostWithAccess`, enforced server-side in the create + upload-token routes.

### 5. Public surface
Rendered by `CommunityHubView` (`src/components/hub/community/`), full-width, directly under `CommunityHeader`, above the feed+sidebar grid; hidden when `config.kollab.enabled === false`.

- **New component** `CommunityKollab.tsx` (+ a `KollabLightbox` and a `DropButton`/uploader). Fetches `GET …/drops` (short-circuited to `[]` when `preview` prop set, like `CommunityFeed`).
- Header "Kollab" + subtitle "Drop your clips & photos into the community pool."
- **"Drop content"** button — visible to members allowed by `whoCanDrop`; opens picker + shows upload progress; optimistic prepend on success.
- Responsive media grid, uniform `aspect-square object-cover` tiles: image = thumbnail; video = poster (thumbnailUrl) + ▶ overlay.
- Click tile → **lightbox** modal: image full-res / video with controls; caption + author.
- **"Load more"** (cursor). Owner/collab get hover hide/delete controls on each tile.
- Empty state invites the first drop.
- **Header stat:** add a **Kollab count** to `CommunityHeader` stats (mirror the Events-count wiring in `[username]/hub/[slug]/page.tsx`).

### 6. Builder (owner)
In `HubBuilder` → "Layout & Sections" (`src/components/hub/builder/`):
- A **Kollab** row: enable toggle + `whoCanDrop` select (writes `config.kollab`).
- A **"Manage drops"** modal (mirrors `HubEventsModal`): grid of all drops (incl. hidden), hide/unhide + delete.
- Live preview reflects the enable toggle (`CommunityKollab` with `preview` renders an empty/sample state).

### 7. Notifications
Add `hub_drop` to the `NotificationType` union + a `notifications-format.ts` case ("dropped content in …"). Fan-out via `postNotifyTargets` (owner + collabs, never self), same as `hub_event`.

## Security / correctness notes
- Read-gate parity: `GET /drops` uses `canViewCommunityHub` exactly like posts/events (draft community → 404 for anon/non-privileged; owner/collab bypass).
- Blob token route must NOT issue tokens to non-members or for disallowed MIME/size — the token route is the real upload authz boundary.
- Author DTO leaks only public identity fields (mirror `toMemberDTO`).
- Rate-limit create to blunt spam floods of the pool.
- `hidden` filtering must be server-side (never rely on client to omit).

## Verification plan (matches M2/M3a rhythm)
- Dedicated **git worktree from the start** (shared-checkout hazard — see shared-worktree lessons); give subagents absolute worktree paths + branch-verify before commit.
- SDD ~8–10 tasks; opus whole-branch review before merge.
- tsc 0 + lint 0 + scoped unit tests (`hub-drops`, `hub-config` kollab, drops routes) + **real-login E2E** on a throwaway `pages_m3b` DB covering: drop create → `hub_drop` notify fan-out → public list excludes hidden → `whoCanDrop:owner-only` member-403 → moderation hide/delete → cross-hub IDOR 404 → read-gate on draft community. Prod smoke: `GET /api/hubs/<bogus>/drops` → 404 (route live, table exists, not 500).
- Vercel build (tsc+lint+build+`prisma migrate deploy`) = the real gate before prod.

## Open/accepted minors
- `onUploadCompleted` can't fire in local dev (no public callback URL) — acceptable; client-create is the source of truth. Consider verifying the Blob URL host server-side in the create route.
- Video poster capture may fail for some codecs → graceful `<video preload="metadata">` fallback.
- No dedup of identical uploads (fine for M3b).
- Cleanup debt to expect: worktree + `pages_m3b` throwaway DB (remove when machine idle).
