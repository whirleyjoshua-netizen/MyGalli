# Kollab AI — The Stitching Engine (design)

**Date:** 2026-07-22
**Branch:** `feat/kollab-ai-stitching` (worktree `/Users/jenniferjordan/joshwhirley/mg-kollab-ai`, based on `origin/main` `181b9e5`)
**Status:** Approved in brainstorm, ready for planning
**Milestone:** M4 — the "real Kollab AI" deferred by M3b and by the Kollab tile spec.

## Goal

Turn the Kollab pool from a reservoir of member drops into a creation surface: a member picks a preset (or types what they want), and Kollab compiles the pool into a **browser-played reel** — a timed sequence of the actual drops with transitions, captions, and a title — driven by an AI-generated edit decision list.

## Why now

M3b built the pool and explicitly deferred "the AI engine (stitch/compile/edit) → M4". The Kollab tile spec re-deferred it, naming "the Kollab AI stitching engine — still the future occupant of this column." The pool now has what an engine needs: attributed, owner-approved, per-community media with stable Blob URLs and poster frames.

## Decisions (locked in brainstorm)

| # | Decision |
|---|---|
| D1 | **Output is a browser-played reel, not a rendered file.** No ffmpeg, no render queue, no worker. The AI returns a JSON edit list; a player component renders it live. Sharing is a URL. |
| D2 | **Controls are presets + an optional free-text prompt**, with a target length. Presets work on metadata alone so day one is useful; the prompt box is what the content understanding buys. |
| D3 | **Drops are tagged at approval time** by a Claude Haiku 4.5 vision call, stored on the row. The director then runs on text only — no vision at stitch time. |
| D4 | **Reels persist and are owner-published.** A member generates a private draft; the owner publishes it. Mirrors the existing drop-approval gate. |
| D5 | **`whoCanStitch` config**, `'members' \| 'owner-only'`, default `'members'` — mirrors `whoCanDrop` exactly. |
| D6 | **No music in v1.** The schema reserves the field; nothing populates it. A licensed audio bed is a rights problem, not an engineering one. |
| D7 | **Drops with a null `consentText` are eligible.** See Consent below. |

## Current state (as of `181b9e5`)

- `HubDrop` — `prisma/schema.prisma:701-723`. Has `type`, `url`, `thumbnailUrl`, `caption`, `mimeType`, `width`, `height`, `status`, `consentText`. **No duration field.**
- `PATCH /api/hubs/[id]/drops/[dropId]` takes `{ action: 'approve' | 'reject' }`; the approve write is at `route.ts:86`.
- `POST /api/hubs/[id]/drops` sets `nextStatusFor(isPrivileged)` — a privileged author's drop lands `approved` without review.
- `KollabTile.tsx` has two actions (Drop content / See content); `KollabViewer.tsx` has `Approved` / `Pending` tabs.
- `config.kollab` is `{ enabled, whoCanDrop }` (`src/lib/types/hub-config.ts:15`).
- `consentTextFor()` (`src/lib/hub-consent.ts`) renders *"By dropping content you allow {hub} to feature and remix it in this community."*, snapshotted per drop at creation.
- **Precedent to follow:** `src/app/api/workspaces/[id]/filter-suggest/route.ts` already calls `claude-opus-4-8` with `output_config.format` (`type: 'json_schema'`) and passes the result through `validateFilter` as an untrusted boundary. This spec copies that shape.

## Data model

```prisma
model HubDrop {
  // ...existing fields...
  durationSec  Float?    // video length, captured client-side at upload
  aiTags       Json?     // { tags: string[], desc, subjects, quality, model, at }
}

model KollabReel {
  id        String   @id @default(cuid())
  hubId     String
  hub       Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  creatorId String
  creator   User     @relation(fields: [creatorId], references: [id])
  preset    String?  // 'recent' | 'best' | 'event' | 'everyone'
  prompt    String?
  title     String
  edl       Json     // [{ dropId, in, out }]
  status    String   @default("draft")  // 'draft' | 'published'
  createdAt DateTime @default(now())
  @@index([hubId, status, createdAt])
}
```

Additive migration, hand-authored (repo convention — `migrate diff --from-url` is contaminated on the shared dev DB). No backfill.

**The EDL stores `dropId` only — never a URL.** Clip URLs are re-resolved from live `HubDrop` rows when a reel is read. A drop later deleted, rejected, or hidden therefore disappears from every reel that referenced it, with no cascade to write and no stale-URL moderation hole. A reel whose drops are gone simply plays shorter.

**No duration backfill is required.** `durationSec` exists to help the director *plan* runtimes; the player loads each clip and knows the true duration, so it clamps `out` at playback. Existing videos with a null duration still stitch — the director just plans them conservatively (assumes a short default) and the player corrects.

## Module boundaries

| Unit | Responsibility | Depends on |
|---|---|---|
| `src/lib/kollab/tag-drop.ts` (new) | one Haiku 4.5 vision call → `{tags, desc, subjects, quality}`; never throws to the caller | `@anthropic-ai/sdk`, `hub-drops.ts` (`isOwnDropAsset`) |
| `src/lib/kollab/edl.ts` (new) | pure: `EDL_SCHEMA`, `validateEdl(raw, candidates)`, `edlRuntime(edl)` | nothing |
| `src/lib/kollab/director.ts` (new) | build candidate digest → Opus 4.8 call → return raw JSON | `edl.ts`, `@anthropic-ai/sdk` |
| `src/lib/kollab/candidates.ts` (new) | preset → Prisma query → capped candidate list | `db` |
| `POST /api/hubs/[id]/kollab/reels` (new) | authz, rate limit, orchestrate, persist draft | all of the above |
| `GET /api/hubs/[id]/kollab/reels` (new) | list published (+ own drafts); hydrate EDL with live drop URLs | `community.ts` |
| `PATCH /api/hubs/[id]/kollab/reels/[reelId]` (new) | publish/unpublish — moderator only | `community.ts` |
| `DELETE …/[reelId]` (new) | creator ‖ moderator; IDOR-scoped `findFirst({id, hubId})` → 404 | |
| `KollabReelPlayer.tsx` (new) | plays a hydrated EDL: preload, cross-fade, Ken Burns, overlays | nothing |
| `KollabReelRequest.tsx` (new) | preset + prompt + length modal | nothing |
| `KollabViewer.tsx` (extend) | third tab `Reels (N)` | `KollabReelPlayer` |
| `KollabTile.tsx` (extend) | third button **Make a reel**, gated on `canStitch` | `KollabWordmark` |

## Tagging

Hooked into the two places a drop becomes `approved`:

1. `PATCH …/drops/[dropId]` with `action: 'approve'` — after the status write at `route.ts:86`.
2. `POST …/drops` when `nextStatusFor(isPrivileged)` returns `'approved'` (owner's own drop, no self-review).

One Claude **Haiku 4.5** call per drop, vision on `thumbnailUrl` (poster frame for video, thumbnail for image), passed as `source: {type: 'url'}` — guarded by the existing `isOwnDropAsset(hubId, url)` so an arbitrary URL can never be handed to the vision API. Structured output via `output_config.format`.

**Best-effort and non-blocking. A tagging failure must never fail an approval.** On any error — missing API key, 429, 5xx, malformed output — `aiTags` stays null, a warning is logged, and the approval succeeds. A null-tagged drop is still a stitch candidate on metadata alone.

Roughly $0.001 per drop; a 1,000-drop pool is about a dollar, paid once and spread over months.

## The director

1. **Candidates** — SQL filters to `status: 'approved'` in the hub, narrowed by preset (date window, event, author), ordered newest-first, **capped at 120 rows** to bound prompt tokens.
2. **Digest** — each candidate rendered as one text line: id, type, duration, caption, author handle, relative date, tags, description, quality. No images.
3. **Call** — `claude-opus-4-8`, `thinking: {type: 'adaptive'}`, `output_config: { effort: 'medium', format: { type: 'json_schema', schema: EDL_SCHEMA } }`.
4. **Validate** — `validateEdl()` is the trust boundary, exactly as `validateFilter` is for workspaces.
5. **Persist** — `KollabReel` row with `status: 'draft'`.

> **Implementation gotcha:** with `thinking` enabled, `message.content[0]` is a *thinking* block, not text. Find the text block by `type === 'text'` — do not index `[0]`. The existing `filter-suggest` route indexes `[0]` because it runs without thinking; do not copy that line verbatim.

`validateEdl` rejects, with a 422: any `dropId` not in the candidate set; `in`/`out` non-finite, negative, or inverted; `out` beyond a known `durationSec`; duplicate clips; more than 40 clips; total runtime more than 2× the requested target. A hallucinated id must never reach the player.

## Config

`config.kollab` in `src/lib/types/hub-config.ts` gains one key:

```ts
kollab: { enabled: boolean; whoCanDrop: HubWhoCanDrop; whoCanStitch: HubWhoCanStitch }
// DEFAULT: { enabled: true, whoCanDrop: 'members', whoCanStitch: 'members' }
```

`sanitizeHubConfig` fills `whoCanStitch` for stored configs that predate it, the same way it filled `kollab` itself in M3b. A `canStitchReel(config, isPrivileged, isMember)` helper mirrors `canDropToPool`, enforced server-side in the create route. `LayoutSectionsSection.tsx` gains a select beside the existing `whoCanDrop` one.

## UI

**Tile** — a third button, **Make a reel**, below *See content*. Hidden entirely when `canStitch` is false. Disabled with a muted label when the pool has fewer than 3 approved drops (nothing to cut).

**Request modal** — four preset radios (This week's recap ~30s / Best of the pool ~45s / From an event / Everyone's drops ~60s), an optional 200-char prompt box, a length select, and **Make it**. Shows a progress state while the director runs; a stitch is one Opus call and will take several seconds.

**Reels tab** — `Approved (N)` · `Reels (N)` · `Pending (N)`, the last still moderator-only. Cards show title, runtime, clip count, creator, and a draft/published badge. Drafts are visible only to their creator and to moderators. Owner controls: Publish / Unpublish / Delete.

**Player** — full-bleed modal. Preloads the next clip while the current one plays, cross-fades between them, Ken Burns pan on stills, title card at the head, caption and author overlay per clip. **Muted autoplay with tap-to-unmute** — browser policy leaves no alternative. Esc closes, focus-trapped, matching `KollabViewer`.

## Consent

`consentTextFor()` has always read *"…allow {hub} to feature and **remix** it in this community"*, and that sentence is snapshotted onto each drop at creation precisely so the text can never change retroactively. Stitching is the remix that sentence describes.

`consentText` is nullable, so drops created before that column shipped carry no snapshot. **Those drops are eligible for stitching.** The rationale: the template has never differed, so the absent snapshot reflects when the column landed rather than a different agreement — and no reel reaches an audience without a human owner publishing it, so a member who objects has a review step standing between their clip and the public.

This is the one decision in this spec most worth revisiting. Excluding null-consent drops is equally defensible and would be a one-line change to `candidates.ts`; it would also empty the candidate pool for any community whose drops all predate the column.

## Security invariants

1. **Only `status: 'approved'` drops enter the candidate set.** Pending and rejected content must never reach the director, the EDL, or the player.
2. **`validateEdl` runs server-side on every stitch.** The model is untrusted input; a `dropId` outside the candidate set is a 422, never a fetch.
3. **EDL rows store ids, not URLs.** Clip URLs are resolved at read time from live rows, so moderation of a drop propagates to every reel automatically.
4. **`whoCanStitch` is enforced in the route**, not the client — same as `whoCanDrop`.
5. **Drafts are private** to their creator and moderators; the public list returns published reels only, and the unpublished count never appears in a public payload.
6. **Vision calls only ever receive our own Blob URLs**, gated by `isOwnDropAsset`.
7. **Rate limit** `hub-reel-create` at 5/min per user — each stitch is a real Opus call. Existing drop limits (20/min create, 30/min upload-token) are unchanged.
8. **Cross-hub IDOR** — every reel lookup is `findFirst({ id, hubId })` → 404, matching the drops routes.

## Error handling

- **No `ANTHROPIC_API_KEY`** → the create route returns a clear 500 ("Kollab AI is not configured"), mirroring `filter-suggest`. Tagging silently no-ops.
- **Anthropic 429 / 5xx** → 429 / 502 passthrough with a retry-friendly message, mirroring `filter-suggest`'s error ladder.
- **Model returns nothing or unparseable JSON** → 502 / 422, "Couldn't build that reel. Try rephrasing."
- **Fewer than 3 candidates** → 400 before any model call. Don't spend a token on an impossible request.
- **A clip fails to load mid-playback** → the player skips it and continues. One dead Blob URL must not kill the reel.

## Testing

Pure functions:
- `validateEdl` — rejects unknown `dropId`, inverted `in`/`out`, `out` past a known duration, duplicates, over-length; accepts a well-formed list.
- `edlRuntime` — sums clip durations correctly with a null-duration clip present.
- `canStitchReel` — owner true under `owner-only`; plain member false; member true under `members`.
- `sanitizeHubConfig` — fills `whoCanStitch` for a config that lacks it; tolerates unknown keys.

Routes:
- `POST /reels` → 403 for a member when `whoCanStitch: 'owner-only'`.
- `POST /reels` → 400 with fewer than 3 approved drops, and **no Anthropic call is made**.
- `POST /reels` → candidate set excludes `pending` and `rejected` rows.
- `GET /reels` → anonymous sees published only; creator sees own drafts; moderator sees all.
- `PATCH publish` → 403 for the creator when not a moderator, 200 for the owner.
- `DELETE` against another hub's reel → 404.
- Approve with the vision call throwing → drop still lands `approved`, `aiTags` null, response 200.

Components:
- Tile hides **Make a reel** when `canStitch` is false; disables it under 3 drops.
- Reels tab renders a draft badge for the creator and hides drafts from a non-creator member.
- Player skips a clip whose media errors.

Migration:
- Verify the additive columns and the new table against the real dev DB before they go near prod Neon.

## Build shape

**Phase 1 (headless, fully testable):** migration → `edl.ts` → `candidates.ts` → `tag-drop.ts` + approval hooks → `director.ts` → the four routes → config + `canStitchReel`.

**Phase 2 (surface):** `KollabReelPlayer` → `KollabReelRequest` → viewer tab → tile button → builder select.

Roughly 10–12 SDD tasks. Dedicated worktree from the start (already created). Verification follows the M3b/tile rhythm: `tsc` 0 + lint 0 + scoped unit tests + a real-login E2E on a throwaway DB, then full smoke tests before pushing. Vercel build (`tsc` + lint + build + `prisma migrate deploy`) is the real gate before prod.

## Out of scope

- Rendering an actual MP4 file. Explicitly deferred by D1; the EDL is designed to be the input to a renderer if that changes.
- Music beds and licensing (D6).
- Per-clip trimming or reordering by hand after generation — the reel is regenerate-don't-edit for now.
- Vision on video *interiors*. The tagger sees the poster frame only, so "the goal at 0:04" is beyond this scope; the director knows what a clip looks like, not what happens inside it.
- Cross-hub or global reels. Everything is scoped to one hub's pool.

## Related

`docs/superpowers/specs/2026-07-19-community-hub-m3b-kollab-pool-design.md`,
`docs/superpowers/specs/2026-07-21-hub-kollab-tile-design.md`
