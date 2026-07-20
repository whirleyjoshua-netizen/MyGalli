# Community Hub — Activity Card (replaces the Kollab AI strip slot) — design

**Date:** 2026-07-20
**Status:** Approved design (spec). Implementation plan next.
**Milestone:** M3d — a follow-on to M3c (utility strip). Branch `feat/community-m3d`, worktree `.claude/worktrees/community-m3d`, base `main` @ `1a5661b`.
**Predecessor:** `docs/superpowers/specs/2026-07-19-community-hub-m3c-utility-strip-design.md`

## Context & goal

M3c shipped the utility strip with three cards: **Notes**, an inert **Kollab AI** placeholder, and
**Tools**. The AI placeholder was misplaced.

**Corrected architecture (user, 2026-07-20):** Kollab AI is not a chat box. It is an *engine* the hub
owner commissions to compile, stitch and edit the clips members have dropped into the Kollab pool,
producing finished content (reels, highlights, montages). It therefore belongs **in the Kollab
column**, adjacent to the pool it consumes — which also gives it a natural scope (this hub's drops)
instead of an unbounded "ask anything" prompt. The strip no longer reserves a slot for it. **Building
the engine is future work and explicitly out of scope here.**

That leaves the third strip slot free. The two remaining cards are both owner-centric — Notes is what
the owner wants you to *know*, Tools is what the owner can *do* — so nothing in the strip serves the
member or visitor, who are most of the traffic. This milestone fills that gap.

### Decisions (user-approved)

- Replace the `ai` card with an **activity card**: orientation for visitors, a recent-activity pulse
  for members and owners.
- **No owner-specific "needs attention" variant.** The underlying signals are too thin to be honest —
  drops need no approval (they are public on arrival; `hidden` is a manual soft-hide), and
  "unanswered comment" is a guess. Owners see the same pulse as members.
- **7-day rolling window**, not "since your last visit" — the latter needs a `lastSeenAt` on
  `HubMember` (a migration) for roughly 10% more value.
- No new API route and no schema change.

## Requirements

### R1 — Config: `ai` → `activity`

`src/lib/types/hub-config.ts`: `HUB_UTILITY_KEYS` becomes `['notes', 'activity', 'tools']`;
`DEFAULT_HUB_CONFIG.utility` matches.

No migration and no backfill: `sanitizeHubConfig` already drops unknown keys and appends missing ones,
so a stored config containing `{key:'ai'}` self-heals to a valid `HubConfig` on the next read.

**Accepted cosmetic consequence:** an existing hub's saved config becomes `[notes, tools, activity]` —
the card lands *after* Tools rather than in the middle — until the owner reorders. This is the same
append-order behaviour M3a accepted when `events` was added to the sidebar. Do not add a migration to
fix ordering.

Update `hub-config.utility.test.ts` for the new key set, including a case asserting that a legacy
config carrying `ai` sanitizes cleanly.

### R2 — Activity counts on the public page

In the **community branch** of `src/app/[username]/hub/[slug]/page.tsx`, add three counts to the
existing `Promise.all`, all over a 7-day window (`now - 7 * 864e5`):

| Field | Query |
|---|---|
| `newPosts` | `db.hubPost.count({ hubId, createdAt: { gte: since } })` |
| `newDrops` | `db.hubDrop.count({ hubId, hidden: false, createdAt: { gte: since } })` |
| `newMembers` | `db.hubMember.count({ hubId, createdAt: { gte: since } })` |

`hidden: false` on drops matters — a soft-hidden drop must not be counted in a public-facing number.

Pass to `CommunityHubView` as one optional prop `activity?: { newPosts: number; newDrops: number; newMembers: number }`,
defaulted at the use site so `HubBuilderPreview` (which renders the view without it) keeps compiling.
Next event and member count are already fetched and threaded — do not re-query them.

A pure helper `src/lib/hub-activity.ts` holds the display logic and is unit-tested:
- `activityRows(counts)` → the non-zero rows to render, in a stable order (posts, clips, members),
  each `{ key, label }` with correct singular/plural ("1 new post" vs "4 new posts").
- `isQuiet(counts)` → true when every count is zero.

Keeping this pure means the role/pluralisation/empty-state logic is testable without rendering.

### R3 — `ActivityCard` replaces `AiCard`

In `src/components/hub/community/CommunityUtilityStrip.tsx`, delete `AiCard` and add `ActivityCard`,
reusing the existing `Shell` wrapper.

- **Visitor** (`!joined && !isPrivileged`): the hub tagline (truncated), member count as social proof,
  and a **Join** button wired to the *existing* `toggleJoin` handler that `CommunityHubView` already
  owns for the header — thread the handler down, do not duplicate the fetch logic. A delta list is
  meaningless to someone with no history, so visitors never see the pulse.
- **Member / owner**: the pulse rows from `activityRows`, each a jump link to its surface (posts →
  feed, clips → Kollab rail, members → sidebar Members widget). Plus a `Next: <title> · <date>` line
  when an upcoming event exists.
- **Quiet week** (`isQuiet`): "It's been quiet — share something." for members/owners. This state is
  common for young hubs, so it must read as an invitation, not a dead card.
- `preview` mode makes the Join button inert, consistent with the rest of the strip.

**Jump links:** scroll to the target section. The pool and sidebar are siblings in the same grid, so a
`scrollIntoView` on a ref/id is sufficient — no routing.

### R4 — Builder label

`src/components/hub/builder/WidgetsToolsSection.tsx`: the `LABELS`/`SUBS` maps change the `ai` entry
(`"Kollab AI"` / `"Reserved for Kollab AI — coming soon"`) to `activity` /
`"Activity"` / `"What's happened lately"`. The toggle behaviour is unchanged.

## Security / correctness notes

- The counts are aggregate integers over a hub a viewer can already see (the page is read-gated by
  `canViewCommunityHub` before this branch runs), so they leak nothing new. `hidden: false` keeps
  soft-hidden drops out of the public number.
- The Join button must reuse the existing handler so the 401→`/login` redirect and member-count
  update behave identically to the header's.
- No count may be rendered from a client fetch — all three come from the server render, so a visitor
  cannot probe a draft hub's activity.

## Verification plan

- **Unit:** `hub-activity.ts` (row order, singular/plural at 1, zero rows omitted, `isQuiet` true only
  when all zero); `hub-config` for the new key set including legacy-`ai` sanitization; component tests
  for the three branches (visitor sees Join and no pulse; member sees pulse; quiet state).
- **Browser smoke — REQUIRED before merge**, per the M3b lesson (a CSP bug shipped because every
  server-side test passed while the browser failed): visitor vs member vs owner rendering, Join from
  the card actually joins, jump links scroll to the right sections, quiet state on a fresh hub, and a
  clean console.
- **Static:** `tsc --noEmit`, `eslint` (worktree `root:true` workaround), `pnpm test`, `next build`.
  Note the vitest worker-timeout flake — a "failure" whose passed-files + errors equals the total file
  count is machine contention, not a defect; re-run the skipped files.

## Non-goals

The Kollab AI engine itself (future, lives in the Kollab column), `lastSeenAt`-based "since your last
visit", per-user read state, notification-style badges, illustrated theming (still M4), and any change
to Notes or Tools.
