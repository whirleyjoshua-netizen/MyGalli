# Public "last updated" indicator — design

**Date:** 2026-07-15
**Branch:** `last-updated-indicator` (off `main` @ `985a0d0`)

## Problem

A visitor landing on a public page has no way to tell whether it is current. A
portfolio edited last week and one abandoned two years ago look identical. Owners
who actively maintain their pages have no way to show it.

Some owners will not want edit recency public — a page can be deliberately
timeless, and "last touched 14 months ago" is unflattering. So the indicator is
opt-in, per page, off by default.

## The trap this design exists to avoid

`Display.updatedAt` looks like the obvious source. **It is wrong, and using it
would ship a bug that grows worse the more successful a page is.**

Every page view runs (`src/app/api/analytics/track/route.ts`):

```ts
if (eventType === 'view') {
  await db.display.update({ where: { id: displayId }, data: { views: { increment: 1 } } })
}
```

`updatedAt` is declared `@updatedAt`, so Prisma restamps it on *every* write to
the row — including that view increment. Therefore:

- `updatedAt` means "last viewed **or** edited", not "last edited".
- A badge built on it reads "Updated just now" on any page with a live visitor.
- It is self-defeating: the badge attracts the views that keep resetting it.
- The failure scales with popularity — a busy page is *permanently* "just now".

Hence a dedicated `contentUpdatedAt`, written only where we choose.

Only two code paths write to a Display row (verified by grep across `src/`):

| Path | Purpose | Stamps `contentUpdatedAt`? |
|---|---|---|
| `api/analytics/track/route.ts` | view counter | **No** |
| `api/displays/[id]/route.ts` (PATCH) | the editor | Only on visible edits |

## Decisions (settled with the user)

| Question | Decision |
|---|---|
| What counts as an update | Anything a visitor can see |
| Where it appears | Public page only (`/[username]/[slug]`) |
| Format | Relative, with exact date on hover |
| Opt-in | Per-page toggle, default **off** |

Rejected: account-wide setting (no per-page control); default-on (retroactively
publishes edit recency for every existing page without the owner asking); showing
on cards (dense, and needs the field in several more queries — revisit if asked).

## Data model

Two columns on `Display`:

```prisma
showLastUpdated  Boolean   @default(false)  // owner opt-in
contentUpdatedAt DateTime?                  // stamped only on visible edits
```

`contentUpdatedAt` is nullable and that nullability is meaningful: it encodes
"we have never observed a visible edit", which is distinct from any real date.

## Write path — `PATCH /api/displays/[id]`

The route already computes `touchesContent` over `COLLAB_FIELDS`
(`sections`, `background`, `spacing`, `headerCard`, `tabs`) for optimistic
concurrency. This design adds a second, wider set:

```ts
// A visitor sees the canvas, but also the title, blurb and cover.
const VISIBLE_FIELDS = [...COLLAB_FIELDS, 'title', 'description', 'coverImage'] as const
```

- If an update touches any `VISIBLE_FIELDS` → set `contentUpdatedAt = new Date()`.
- `published`, `category`, and the view counter deliberately do **not** stamp.
  Publishing is not an edit; a visitor sees no change.
- Toggling `showLastUpdated` alone does **not** stamp — with one exception below.

`showLastUpdated` joins the field allowlist in the route. It is owner-only for
free: `splitUpdate` rejects any field outside `COLLAB_FIELDS` for collaborators.
A collaborator may edit the page but may not decide whether its edit history is
public. This must be covered by a test rather than left as an inference.

## Backfill: none, deliberately

Existing rows get `NULL`. The badge stays hidden — and since the toggle defaults
off, nobody is affected.

Backfilling `contentUpdatedAt = updatedAt` was rejected: for any page with
traffic, today's `updatedAt` is a view timestamp, so the backfill would bake a
falsehood into permanent storage and publish it as fact. Backfilling from
`createdAt` was rejected as understating every edited page.

**Bootstrap instead:** when the owner switches `showLastUpdated` **on** while
`contentUpdatedAt` is `NULL`, set it to now. That is the owner asserting "this
page is current as of now" — an owner-initiated claim, not history we invented.
It also avoids a dead toggle that appears to do nothing until the next edit.

## Read path

`src/app/[username]/[slug]/page.tsx` selects both new fields and renders the
badge only when `showLastUpdated && contentUpdatedAt`.

The page is a server component and already dynamic (it reads the auth cookie),
so a server-rendered relative time is computed per request. No staleness, and no
hydration mismatch — the value never differs between server and client because
there is no client render of it.

## Formatter — `src/lib/last-updated.ts` (new, pure)

```ts
export function formatLastUpdated(date: Date, now: Date): string
```

`now` is injected so tests are deterministic rather than racing the clock.

Not reusing `src/lib/time-ago.ts`: it is tuned for bulletin posts, returns
compact forms (`3d`, `5h`), and caps at days — a year-old page would render
"Updated 412d ago". It stays as-is; its consumers are unaffected.

Progression. Boundaries are exact and exclusive; each is a test case. Units are
fixed spans (a "month" is 30 days), not calendar arithmetic — the output is an
approximation by design, and the tooltip carries the precise date.

| Elapsed (`now - date`) | Output |
|---|---|
| < 60 s | `just now` |
| < 60 min | `N minutes ago` |
| < 24 h | `N hours ago` |
| < 7 days | `N days ago` |
| < 30 days | `N weeks ago` — `floor(days / 7)` |
| < 365 days | `N months ago` — `floor(days / 30)` |
| >= 365 days | absolute date, e.g. `Jul 15, 2025` |

Each count is floored, so 90 minutes is `1 hour ago`. Singular at 1: `1 minute
ago`, never `1 minutes ago`.

A future date (clock skew between DB and server) renders `just now` rather than
"in 3 hours".

## Component

A small server component rendering:

```html
<time dateTime="2026-07-15T09:00:00.000Z" title="July 15, 2026 at 9:00 AM">
  Updated 3 days ago
</time>
```

`<time>` is machine-readable, `title` is the hover date, and the visible text is
the relative form. Styling stays subdued — this is a footnote, not a headline.

## Toggle UI

A `LastUpdatedSettingsBody` inside a new `Section_` in
`src/components/editor/panel/PageTab.tsx`, following that file's existing
one-body-per-section pattern.

Unlike `PageTab`'s other bodies (which edit JSON config blobs), this flag is a DB
column, so it persists via the same PATCH the editor already issues.

Copy must state the consequence plainly: the date becomes public.

## Migration

Hand-authored SQL containing only these two `ADD COLUMN`s, then
`prisma migrate deploy`.

`prisma migrate diff --from-url $DATABASE_URL` is **contaminated** on the shared
dev database — concurrent branches' tables make it emit spurious `DROP TABLE`
statements alongside the intended change. Both columns are additive with
defaults/nullable, so the migration is safe on prod's clean Neon branch.

## Testing

- **Formatter** — TDD, pure, deterministic via injected `now`. Each boundary in
  the table above, plus the future-date guard.
- **API (the load-bearing test)** — a title edit stamps `contentUpdatedAt`; a
  view increment does **not**. This is the whole feature's correctness, and it is
  the exact bug this design exists to prevent, so it is asserted rather than
  assumed.
- **API** — a collaborator PATCHing `showLastUpdated` is rejected 403.
- **Bootstrap** — enabling with `contentUpdatedAt = NULL` sets it; enabling when
  already set leaves it untouched.
- **Page** — badge renders when opted in, is absent when opted out, and is absent
  when `contentUpdatedAt` is `NULL`.

## Out of scope

- Cards on Explore / profile / dashboard.
- Share pages (`/s/[code]`) — same content, different door; revisit if wanted.
- Backfilling history for existing pages.
- Any change to `time-ago.ts` or its consumers.
