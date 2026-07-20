# Community Hub — Trust & Safety — design

**Date:** 2026-07-20
**Status:** Approved design (spec). Implementation plan next.
**Milestone:** M5a. Branch `feat/community-safety`, worktree `.claude/worktrees/community-safety`, base `main` @ `5f51b4f`.
**Predecessors:** M3b (Kollab pool), M3c (utility strip), M3d (activity card).

## Context & goal

Community hubs today have **no moderation of any kind**. Verified in the codebase: there is no
report, ban, mute or block anywhere; `canModerate` (owner ‖ collaborator) gates only *delete*. The
sole remedy is deleting content after it is already public.

M3b made this materially worse: any member of a **published, Explore-discoverable** community can
push photos and video into a pool that renders to every visitor, with no approval step. One bad actor
means the owner plays whack-a-mole while the content is live.

Second, unrelated but same layer: the Kollab pool exists so the owner can later have **AI stitch
member clips into published content**, and members currently upload with **no consent record at all**.
The sibling product (`C:\Users\whirl\Kollab_ai`) snapshots `consent_text_snapshot` onto every video
for exactly this reason. Adding this later means thousands of clips with no record — it is far cheaper
now.

This milestone is the trust layer. Appearance/theming (M4) waits.

### Decisions (user-approved)

- **Reports go to the hub owner now, with a platform hook later.** `HubReport` rows are written
  platform-wide with a `status` field from day one, so a future Galli-level admin view is a query over
  existing data rather than a migration. No admin surface is built now.
- **Scope:** report + remove/ban + an optional drop-approval gate + the consent snapshot.
- **A ban blocks participation but preserves existing content.** Ban and content-removal stay separate
  decisions; a mass-delete is irreversible and can gut threads other members replied to.
- No community rules-acceptance gate (deferred).

## Requirements

### R1 — `HubReport` and `HubBan` (one additive migration)

```
model HubReport {
  id           String   @id @default(cuid())
  hubId        String
  hub          Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  reporterId   String
  reporter     User     @relation("HubReportReporter", fields: [reporterId], references: [id], onDelete: Cascade)
  targetType   String   // 'post' | 'comment' | 'drop' | 'member'
  targetId     String
  reason       String   // fixed vocabulary — see R2
  note         String?
  status       String   @default("open") // 'open' | 'actioned' | 'dismissed'
  createdAt    DateTime @default(now())
  resolvedAt   DateTime?
  resolvedById String?
  @@unique([hubId, reporterId, targetType, targetId])
  @@index([hubId, status])
}

model HubBan {
  id         String   @id @default(cuid())
  hubId      String
  hub        Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  userId     String
  user       User     @relation("HubBanUser", fields: [userId], references: [id], onDelete: Cascade)
  bannedById String
  reason     String?
  createdAt  DateTime @default(now())
  @@unique([hubId, userId])
  @@index([hubId])
}
```

- The `@@unique` on reports means **one report per person per target** — the queue cannot be flooded by
  repeat clicks, and it makes the write idempotent.
- **Ban is its own model, not a flag on `HubMember`,** because removing a member deletes that row; a
  flag would vanish with it and the user could rejoin immediately.
- Additive only, no backfill. Follow the repo's hand-authored-migration rule (`migrate diff` against
  the shared dev DB is contaminated by other branches' tables).

### R2 — Report API

`POST /api/hubs/[id]/reports` — body `{ targetType, targetId, reason, note? }`.
- Requires auth and `canParticipate` (only people in the community can report in it).
- `reason` from a fixed vocabulary: `spam | harassment | explicit | violence | other`. Reject anything else.
- `note` optional, ≤500 chars.
- Validates the target exists **and belongs to this hub**; on failure returns **404, never 403** — the
  route must not become an enumeration oracle for hidden or deleted content.
- **Rate-limited** (`hub-report-create`), and the `@@unique` makes a duplicate a no-op success rather
  than an error (never reveal "already reported by you" for someone else's report).
- Notifies owner + collaborators (`hub_report`).

`GET /api/hubs/[id]/reports` — `canModerate` only. Returns open reports with enough target context to
judge them (author, excerpt or thumbnail). Never exposes the reporter's identity to anyone but a
moderator.

`PATCH /api/hubs/[id]/reports/[reportId]` — `canModerate`, IDOR-scoped `findFirst({ id, hubId })` →
404. Sets `status` to `actioned` or `dismissed`, stamping `resolvedAt`/`resolvedById`.

### R3 — Enforcement: remove and ban

`POST /api/hubs/[id]/bans` — `canModerate`. Body `{ userId, reason? }`. Creates the `HubBan` **and**
deletes the `HubMember` row in one transaction.
- **Refuses to ban the hub owner** (403) — a collaborator must not be able to ban the owner.
- **Refuses to ban another collaborator** (403); only the owner may remove a collaborator, and that is
  the existing collaborator surface, not this one.
- Refuses self-ban.

`DELETE /api/hubs/[id]/bans/[userId]` — `canModerate`, lifts the ban (does not re-add membership).

**Enforcement points** (all server-side):
- `POST /api/hubs/[id]/join` → banned user gets 403.
- `canParticipate` must treat a banned user as a non-member, so posting, commenting, dropping and
  reacting all refuse. **This is the load-bearing change** — the ban is worthless if it only guards the
  join route. Every call site that currently derives `isMember` from a `HubMember` lookup needs the ban
  check alongside it.

Existing content is left untouched, per the approved decision.

### R4 — Drop approval gate (reuses `hidden`)

Config gains `kollab.requireApproval: boolean` (default **false** — no behaviour change for existing
hubs).

When true, `POST /api/hubs/[id]/drops` creates the row with `hidden: true`. Nothing else changes:
- the public list already filters `hidden` server-side;
- the builder's Manage-drops modal already has unhide, so **approval is "unhide"**;
- the pending count is `count({ hubId, hidden: true })`, not new state.

The uploader must tell the member their drop is pending review rather than silently swallowing it.

### R5 — Drop consent snapshot

`HubDrop` gains `consentText String?`.

The rendered consent sentence is stored **on the row at creation**, so later wording changes cannot
retroactively alter what any given member agreed to. The template lives in one constant
(`src/lib/hub-consent.ts`) with the hub title substituted at render time, mirroring Kollab v1's
`lib/consent.ts`.

Displayed as **visible copy above the drop button** — not a checkbox — e.g.
*"By dropping content you allow {hub} to feature and remix it in this community."*

Nullable because existing rows predate it; the AI engine must treat a null `consentText` as
"no recorded consent" and exclude those clips.

### R6 — Moderation UI

- **Report control** on posts, comments and drops (in the existing overflow/hover menus) and on a
  member row, opening a small reason picker. Hidden from the content's own author.
- **Moderation queue** in the builder: a new section listing open reports with target context and
  actions — Hide/Delete content, Remove & ban member, Dismiss. Reuses the existing modal patterns.
- The Kollab pool's owner controls gain **Approve** when `requireApproval` is on.

## Security / correctness notes

- Report route returns 404 (not 403) for a target that does not exist or belongs to another hub.
- Reporter identity is visible only to moderators.
- Ban checks are enforced **server-side at every participation path**, never by hiding UI.
- Owner and collaborators are unbannable via this surface.
- Rate-limit reports; the unique constraint is the second line of defence.
- A banned user must not be able to re-join by racing the join route — rely on the DB unique
  constraint plus the check, not a read-then-write.

## Verification plan

- **Unit:** report validation (bad reason, overlong note, cross-hub target → 404); ban rules
  (owner/collab/self refused); `canParticipate` returns false for a banned member; config sanitization
  of `requireApproval`; consent template substitution.
- **E2E** (real login, throwaway DB): member reports a drop → owner sees it in the queue → bans the
  author → author gets 403 on join, post, comment and drop → author's existing post is still visible →
  owner dismisses a second report → with `requireApproval` on, a new drop is invisible to the public
  until approved.
- **Browser smoke — REQUIRED before merge** (the standing rule after M3b's CSP bug): report a post as a
  member, moderate it as the owner, confirm the banned user's UI state, approve a pending drop, and a
  clean console.
- **Static:** `tsc --noEmit`, `eslint` (worktree `root:true` workaround), `pnpm test`, `next build`.
  Watch for the vitest worker-timeout flake — passed-files + errors = total files means contention, not
  failure.

## Non-goals

A Galli-level admin surface (the data hook exists; the UI does not), rules-acceptance gating, mute,
per-member content deletion on ban, appeals, automated/AI content classification, and rate-limiting
posts beyond what already exists.
