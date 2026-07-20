# Community Hub Activity Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inert "Kollab AI" card in the community hub utility strip with an activity card — orientation for visitors, a 7-day activity pulse for members and owners.

**Architecture:** One config key renamed (`ai` → `activity`), three counts added to the public page's existing query, one pure helper for display logic, one component swap, one builder label change. No schema migration and no new API route.

**Tech Stack:** Next.js 15.5.19 App Router, React 19, TypeScript, Tailwind, Prisma/PostgreSQL, Vitest, lucide-react.

## Global Constraints

- Worktree `C:\Users\whirl\pages-mvp\.claude\worktrees\community-m3d`, branch `feat/community-m3d`. **Run `git branch --show-current` before every commit** — this repo has concurrent sessions sharing checkouts.
- **No schema migration and no new API route.** If a task appears to need one, stop and raise it.
- Component tests use **`fireEvent` from `@testing-library/react`**. `@testing-library/user-event` is NOT a dependency of this repo — do not import it.
- Tests: `npx vitest run <path>`. The worktree may have no `.env`; set `JWT_SECRET=test-secret-for-local-run-only-1234567890` if a test needs it.
- Lint in a worktree: temporarily write `{ "root": true, "extends": "next/core-web-vitals" }` to `.eslintrc.json`, run `npx eslint . --ext .ts,.tsx`, then `git checkout -- .eslintrc.json`. **`next lint` fails in a worktree** (plugin conflict with the parent checkout).
- Do NOT add an `eslint-disable` for a rule this ESLint config doesn't define — that is itself a lint error.
- If `tsc` reports unknown Prisma models, run `npx prisma generate` in the worktree — the nested worktree resolves to the parent checkout's `node_modules`, whose client can be stale.

---

### Task 1: `hub-activity` helper (pure display logic)

**Files:**
- Create: `src/lib/hub-activity.ts`
- Test: `src/lib/hub-activity.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ActivityCounts = { newPosts: number; newDrops: number; newMembers: number }`, `ActivityRow = { key: 'posts'|'clips'|'members'; label: string }`, `activityRows(counts): ActivityRow[]`, `isQuiet(counts): boolean`. Tasks 2–4 consume these unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/lib/hub-activity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { activityRows, isQuiet, type ActivityCounts } from './hub-activity'

const counts = (p: number, d: number, m: number): ActivityCounts =>
  ({ newPosts: p, newDrops: d, newMembers: m })

describe('activityRows', () => {
  it('returns rows in a stable order: posts, clips, members', () => {
    expect(activityRows(counts(4, 7, 2)).map((r) => r.key)).toEqual(['posts', 'clips', 'members'])
  })

  it('labels plurals', () => {
    expect(activityRows(counts(4, 7, 2)).map((r) => r.label))
      .toEqual(['4 new posts', '7 clips added', '2 new members'])
  })

  // Off-by-one in pluralisation is the classic bug here.
  it('labels singulars at exactly 1', () => {
    expect(activityRows(counts(1, 1, 1)).map((r) => r.label))
      .toEqual(['1 new post', '1 clip added', '1 new member'])
  })

  it('omits zero rows entirely', () => {
    expect(activityRows(counts(0, 3, 0)).map((r) => r.key)).toEqual(['clips'])
  })

  it('returns nothing when all counts are zero', () => {
    expect(activityRows(counts(0, 0, 0))).toEqual([])
  })

  it('treats negative or non-finite counts as zero rather than rendering nonsense', () => {
    expect(activityRows(counts(-2, Number.NaN, 3)).map((r) => r.key)).toEqual(['members'])
  })
})

describe('isQuiet', () => {
  it('is true only when every count is zero', () => {
    expect(isQuiet(counts(0, 0, 0))).toBe(true)
    expect(isQuiet(counts(0, 0, 1))).toBe(false)
    expect(isQuiet(counts(5, 0, 0))).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/hub-activity.test.ts`
Expected: FAIL — module `./hub-activity` not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/hub-activity.ts`:

```ts
export type ActivityCounts = { newPosts: number; newDrops: number; newMembers: number }
export type ActivityRow = { key: 'posts' | 'clips' | 'members'; label: string }

// Counts arrive from Prisma aggregates, but this helper is also fed by tests and
// (later) by a preview with no data — coerce rather than trusting the caller.
const safe = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

export function activityRows(counts: ActivityCounts): ActivityRow[] {
  const posts = safe(counts.newPosts)
  const clips = safe(counts.newDrops)
  const members = safe(counts.newMembers)
  const rows: ActivityRow[] = []
  if (posts) rows.push({ key: 'posts', label: plural(posts, 'new post', 'new posts') })
  if (clips) rows.push({ key: 'clips', label: plural(clips, 'clip added', 'clips added') })
  if (members) rows.push({ key: 'members', label: plural(members, 'new member', 'new members') })
  return rows
}

export function isQuiet(counts: ActivityCounts): boolean {
  return activityRows(counts).length === 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/hub-activity.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub-activity.ts src/lib/hub-activity.test.ts
git commit -m "feat(activity): pure helper for activity rows and quiet state"
```

---

### Task 2: Config key `ai` → `activity`

**Files:**
- Modify: `src/lib/types/hub-config.ts`
- Test: `src/lib/hub-config.utility.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `HUB_UTILITY_KEYS = ['notes','activity','tools']`; `HubUtilityKey` gains `'activity'` and loses `'ai'`. Tasks 3–4 switch on these.

**Why no migration:** `sanitizeHubConfig` already drops unknown keys and appends missing ones, so a stored config containing `{key:'ai'}` self-heals. Accepted cosmetic consequence: existing hubs get `[notes, tools, activity]` — the card lands after Tools until the owner reorders. Do NOT add a migration to fix ordering.

- [ ] **Step 1: Write the failing test**

In `src/lib/hub-config.utility.test.ts`, replace the existing key-set expectations and add the legacy case. The defaults test becomes:

```ts
  it('defaults to all three cards enabled, in order', () => {
    expect(sanitizeHubConfig(null).utility).toEqual([
      { key: 'notes', enabled: true },
      { key: 'activity', enabled: true },
      { key: 'tools', enabled: true },
    ])
  })

  it('exports exactly the three keys', () => {
    expect([...HUB_UTILITY_KEYS]).toEqual(['notes', 'activity', 'tools'])
  })

  // Hubs saved while the strip still had a Kollab AI slot must not break.
  it('drops a legacy ai key and appends activity', () => {
    const legacy = { utility: [{ key: 'notes', enabled: true }, { key: 'ai', enabled: true }, { key: 'tools', enabled: false }] }
    expect(sanitizeHubConfig(legacy).utility).toEqual([
      { key: 'notes', enabled: true },
      { key: 'tools', enabled: false },
      { key: 'activity', enabled: true },
    ])
  })
```

Also update any other assertion in this file that names `'ai'` so it names `'activity'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/hub-config.utility.test.ts`
Expected: FAIL — the default set still contains `'ai'`.

- [ ] **Step 3: Rename the key**

In `src/lib/types/hub-config.ts`:

```ts
export const HUB_UTILITY_KEYS = ['notes', 'activity', 'tools'] as const
```

and in `DEFAULT_HUB_CONFIG.utility` change the middle entry to `{ key: 'activity', enabled: true }`.

`src/lib/hub-config.ts` needs **no change** — it iterates `HUB_UTILITY_KEYS` generically.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/hub-config.utility.test.ts src/lib/hub-config.test.ts src/lib/hub-config.kollab.test.ts`
Expected: PASS. `tsc` will now fail in the components that still reference `'ai'` — Tasks 3 and 4 fix those. Do not "fix" them here by casting.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/hub-config.ts src/lib/hub-config.utility.test.ts
git commit -m "feat(activity): rename the ai utility key to activity"
```

---

### Task 3: Activity counts on the public page

**Files:**
- Modify: `src/app/[username]/hub/[slug]/page.tsx` (community branch)
- Modify: `src/components/hub/community/CommunityHubView.tsx` (accept + forward the prop)

**Interfaces:**
- Consumes: `ActivityCounts` (Task 1).
- Produces: `CommunityHubView` gains `activity?: ActivityCounts`; it forwards `activity`, `joined`, and its existing `toggleJoin` handler into `CommunityUtilityStrip` (Task 4 consumes them).

- [ ] **Step 1: Add the counts to the page query**

In the community branch's existing `Promise.all` (the one already fetching members, items, posts count, events, drops), add three entries and widen the destructuring to match — **array position must line up exactly**:

```ts
      db.hubPost.count({ where: { hubId: hub.id, createdAt: { gte: activitySince } } }),
      db.hubDrop.count({ where: { hubId: hub.id, hidden: false, createdAt: { gte: activitySince } } }),
      db.hubMember.count({ where: { hubId: hub.id, createdAt: { gte: activitySince } } }),
```

Declare the window immediately above the `Promise.all`:

```ts
    // 7-day rolling window. "Since your last visit" would need a lastSeenAt on
    // HubMember (a migration) for marginal extra value — see the design spec.
    const activitySince = new Date(Date.now() - 7 * 864e5)
```

`hidden: false` on drops is required — a soft-hidden drop must never appear in a public-facing count.

Then pass to the view:

```tsx
        activity={{ newPosts: newPostsCount, newDrops: newDropsCount, newMembers: newMembersCount }}
```

- [ ] **Step 2: Accept and forward the prop**

In `CommunityHubView.tsx` add `activity` to the destructured params and the prop type as
`activity?: ActivityCounts` (import the type from `@/lib/hub-activity`), then pass down to the strip
along with the join state and handler:

```tsx
          activity={activity ?? { newPosts: 0, newDrops: 0, newMembers: 0 }}
          joined={joined}
          onToggleJoin={toggleJoin}
```

`toggleJoin` and `joined` already exist in this component (they drive the header's Follow button) — reuse them, do not add a second fetch path.

Keep `activity` optional: `HubBuilderPreview` renders `CommunityHubView` without it.

- [ ] **Step 3: Verify tsc**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `CommunityUtilityStrip.tsx` (it doesn't accept the new props yet and still references `'ai'`). Task 4 resolves them.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[username]/hub/[slug]/page.tsx" src/components/hub/community/CommunityHubView.tsx
git commit -m "feat(activity): 7-day activity counts on the community page"
```

---

### Task 4: `ActivityCard` replaces `AiCard`

**Files:**
- Modify: `src/components/hub/community/CommunityUtilityStrip.tsx`
- Test: `src/components/hub/community/CommunityUtilityStrip.test.tsx`

**Interfaces:**
- Consumes: `activityRows`/`isQuiet`/`ActivityCounts` (Task 1), the `'activity'` key (Task 2), `activity`/`joined`/`onToggleJoin` props (Task 3).
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Append to `src/components/hub/community/CommunityUtilityStrip.test.tsx`. Note the shared `base`
object in this file must gain the new props — update it rather than duplicating:

```tsx
const activity = { newPosts: 4, newDrops: 7, newMembers: 2 }

describe('Activity card', () => {
  it('shows orientation and a join control to a visitor, not a pulse', () => {
    render(<CommunityUtilityStrip {...base} activity={activity} joined={false} memberCount={12} tagline="A test community" />)
    expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument()
    expect(screen.getByText('A test community')).toBeInTheDocument()
    expect(screen.queryByText('4 new posts')).toBeNull()
  })

  it('shows the pulse to a member', () => {
    render(<CommunityUtilityStrip {...base} activity={activity} joined />)
    expect(screen.getByText('4 new posts')).toBeInTheDocument()
    expect(screen.getByText('7 clips added')).toBeInTheDocument()
    expect(screen.getByText('2 new members')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /join/i })).toBeNull()
  })

  it('shows the pulse to an owner even though they are not "joined"', () => {
    render(<CommunityUtilityStrip {...base} activity={activity} joined={false} isPrivileged isOwner />)
    expect(screen.getByText('4 new posts')).toBeInTheDocument()
  })

  it('invites a member to post when the week was quiet', () => {
    render(<CommunityUtilityStrip {...base} activity={{ newPosts: 0, newDrops: 0, newMembers: 0 }} joined />)
    expect(screen.getByText(/it's been quiet/i)).toBeInTheDocument()
  })

  it('calls the shared join handler rather than its own fetch', () => {
    const onToggleJoin = vi.fn()
    render(<CommunityUtilityStrip {...base} activity={activity} joined={false} onToggleJoin={onToggleJoin} />)
    fireEvent.click(screen.getByRole('button', { name: /join/i }))
    expect(onToggleJoin).toHaveBeenCalledTimes(1)
  })
})
```

Update the file's shared `base` to include `activity: { newPosts: 0, newDrops: 0, newMembers: 0 }`,
`joined: false`, `memberCount: 0`, `tagline: null`, `onToggleJoin: () => {}` so the earlier tests
still construct a valid component.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/hub/community/CommunityUtilityStrip.test.tsx`
Expected: FAIL — the strip has no `ActivityCard`.

- [ ] **Step 3: Implement the card**

In `CommunityUtilityStrip.tsx`: extend the component's props with
`activity: ActivityCounts`, `joined: boolean`, `memberCount: number`, `tagline: string | null`,
`onToggleJoin: () => void`; import `activityRows`, `isQuiet`, `type ActivityCounts` from
`@/lib/hub-activity`; swap `Sparkles` for `Activity` and `UsersRound` in the lucide import (drop
`Sparkles` if now unused — an unused import is a lint error).

Change the dispatcher line:

```tsx
    if (key === 'activity') return <ActivityCard key="activity" activity={activity} joined={joined} isPrivileged={isPrivileged} memberCount={memberCount} tagline={tagline} preview={preview} onToggleJoin={onToggleJoin} />
```

Delete `AiCard` entirely and add:

```tsx
function ActivityCard({
  activity, joined, isPrivileged, memberCount, tagline, preview, onToggleJoin,
}: {
  activity: ActivityCounts
  joined: boolean
  isPrivileged: boolean
  memberCount: number
  tagline: string | null
  preview?: boolean
  onToggleJoin: () => void
}) {
  // A delta list means nothing to someone with no history here, so a visitor
  // gets orientation instead.
  if (!joined && !isPrivileged) {
    return (
      <Shell icon={<UsersRound className="h-4 w-4 text-primary" />} title="Community">
        {tagline && <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{tagline}</p>}
        <p className="mb-2 text-xs text-muted-foreground">{memberCount} {memberCount === 1 ? 'member' : 'members'}</p>
        <button
          onClick={() => { if (!preview) onToggleJoin() }}
          className="mt-auto w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Join community
        </button>
      </Shell>
    )
  }

  const rows = activityRows(activity)
  return (
    <Shell icon={<Activity className="h-4 w-4 text-primary" />} title="This week">
      {isQuiet(activity) ? (
        <p className="text-xs text-muted-foreground">It&apos;s been quiet — share something.</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.key}>
              <button
                onClick={() => document.getElementById(jumpTargetId(r.key))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  )
}

const jumpTargetId = (key: 'posts' | 'clips' | 'members'): string =>
  key === 'clips' ? 'hub-kollab' : key === 'members' ? 'hub-members' : 'hub-feed'
```

Then add the matching `id` attributes to the three column wrappers in `CommunityHubView.tsx`
(`hub-kollab` on the pool wrapper, `hub-feed` on the feed wrapper, `hub-members` on the sidebar
wrapper) so the jump links have targets. Read that file's grid and add the ids to the existing
`order-*` wrapper divs — do not restructure the grid.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/hub/community/CommunityUtilityStrip.test.tsx src/components/hub/community/CommunityHubView.test.tsx`
Expected: PASS — the 5 new tests plus every pre-existing test in both files.

- [ ] **Step 5: Verify tsc + commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add src/components/hub/community/
git commit -m "feat(activity): activity card replaces the inert Kollab AI slot"
```

---

### Task 5: Builder label

**Files:**
- Modify: `src/components/hub/builder/WidgetsToolsSection.tsx`
- Test: `src/components/hub/builder/WidgetsToolsSection.test.tsx`

- [ ] **Step 1: Write the failing test**

In `WidgetsToolsSection.test.tsx`, change the label assertion:

```tsx
  it('lists the three utility cards with labels', () => {
    render(<WidgetsToolsSection config={DEFAULT_HUB_CONFIG} onChange={() => {}} hubId="h1" />)
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Activity')).toBeInTheDocument()
    expect(screen.queryByText('Kollab AI')).toBeNull()
    expect(screen.getByText('Tools')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/hub/builder/WidgetsToolsSection.test.tsx`
Expected: FAIL — "Kollab AI" is still rendered.

- [ ] **Step 3: Update the label maps**

In `WidgetsToolsSection.tsx`:

```ts
const LABELS: Record<HubUtilityKey, string> = { notes: 'Notes', activity: 'Activity', tools: 'Tools' }
```

and in `SUBS` replace the `ai` entry with:

```ts
  activity: "What's happened lately",
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/components/hub/builder/WidgetsToolsSection.test.tsx` → PASS.
Run: `npx tsc --noEmit` → 0 errors.

```bash
git add src/components/hub/builder/
git commit -m "feat(activity): builder label for the activity card"
```

---

### Task 6: Verification + browser smoke

**Files:** none (verification only).

**The browser pass happens BEFORE merge.** A previous milestone shipped a CSP bug that every server-side test missed because the failure only existed in a browser.

- [ ] **Step 1: Static gate**

```bash
npx tsc --noEmit                  # expect 0
npx vitest run                    # expect all pass
npx next build                    # expect exit 0
```
Lint via the worktree workaround → **0 errors** (warnings are pre-existing).

If the suite reports "errors" whose count plus the passed-file count equals the total number of test files on disk, those are vitest worker-spawn timeouts under machine load, not failures — extract the skipped files from the log and re-run them separately.

If `next build` reports stale `.next/types` errors after a branch switch, delete `.next` and rebuild.

- [ ] **Step 2: Seed a throwaway DB**

```bash
docker start pages-mvp-postgres-1
docker exec pages-mvp-postgres-1 psql -U pages -d postgres -c "DROP DATABASE IF EXISTS pages_m3d;" -c "CREATE DATABASE pages_m3d OWNER pages;"
```
With `DATABASE_URL`/`DATABASE_URL_UNPOOLED` = `postgresql://pages:pages@127.0.0.1:5434/pages_m3d`, run `npx prisma migrate deploy`.

Seed **two** community hubs: one **active** (owner + a member, several posts, drops and a member all created within the last 7 days, plus one upcoming event) and one **fresh/quiet** (no posts, no drops, no recent members) to exercise the quiet branch.

- [ ] **Step 3: Browser smoke (real Chrome, `next start`)**

Build, then `npx next start -p 3021`. Use the `superpowers-chrome:browsing` skill. Verify against server truth:

1. **Visitor** (no auth) on the active hub: sees "Community" orientation with the tagline, member count and a **Join** button — and **no** pulse rows.
2. Clicking **Join** as a logged-in non-member actually creates the `HubMember` row (check the DB), and the card flips to the pulse.
3. **Member**: sees the pulse rows with correct counts matching the seed.
4. **Owner**: sees the pulse (owners are not "joined" but must not get the visitor card).
5. **Quiet hub**: a member sees "It's been quiet — share something."
6. Jump links scroll to the feed / Kollab rail / Members widget.
7. Legacy config: set one hub's `config.utility` to include `{"key":"ai"}` directly in the DB, reload, and confirm the page renders with an Activity card and does not crash.
8. **Console has no errors** on load or after interaction.

- [ ] **Step 4: Builder check**

Open `/hubs/<id>` → "Widgets & Tools": the row reads **Activity / "What's happened lately"**, no "Kollab AI" anywhere, and toggling it off removes the card from the live preview and the public page after autosave.

- [ ] **Step 5: Clean up + merge**

Drop `pages_m3d`, remove scratch scripts, confirm `git status` clean, merge `origin/main` into the branch, re-run the static gate, and merge only after the browser smoke passed.

---

## Self-review notes (author)

- **Spec coverage:** R1 config rename → Task 2; R2 counts + pure helper → Tasks 1, 3; R3 ActivityCard (visitor/member/quiet branches, shared join handler, jump links) → Task 4; R4 builder label → Task 5; verification → Task 6.
- **Type consistency:** `ActivityCounts`/`activityRows`/`isQuiet` defined in Task 1 and consumed unchanged in Tasks 3–4. The `'activity'` key from Task 2 is switched on in Tasks 4–5. `onToggleJoin`/`joined` come from `CommunityHubView`'s existing state (Task 3) and are consumed in Task 4.
- **Deliberate ordering:** Task 2 renames the key and knowingly leaves `tsc` red until Task 4 — the plan says so explicitly so an implementer doesn't paper over it with a cast.
- **Known implementer checkpoint:** Task 4 adds `id` attributes to `CommunityHubView`'s existing column wrappers. Read that file and add them to the current `order-*` divs; do not restructure the three-column grid (it was verified in a browser last milestone).
- **Not in scope, by decision:** the Kollab AI engine (moves to the Kollab column, future), `lastSeenAt`-based "since your last visit", and any owner-specific "needs attention" variant (signals too thin to be honest).
