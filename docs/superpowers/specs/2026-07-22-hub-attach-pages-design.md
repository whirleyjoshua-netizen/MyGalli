# Attach Pages to a Community Hub — Design Spec

## Goal

Let a community Hub member attach one of their own published Pages to the Hub. Attachments
wait in a moderation queue until the Hub owner or a mod approves them. Approved Pages appear
in a new **Pages** tab beside Home and Files.

## Why

A community Hub can already hold files (Files tab) and member-submitted media (Kollab drops),
but there is no way to surface the thing the product is actually built around — a Page. Members
who make something good in a community have nowhere to put it except a link in the feed, where
it scrolls away.

## Current state (as of `c407dc8`)

- `Hub.community: Boolean @default(false)` selects the renderer. Community hubs render
  `CommunityHubView`; everything else renders `HubViewer` and requires `Hub.displayId`.
- `Hub.displayId` is the *single* backing Display for non-community hubs. It is not a general
  attachment mechanism and this feature does not touch it.
- `CommunityTabs` / `tabFromParam` already drive tabs off `?tab=`, so a new tab is deep-linkable
  with no router work.
- `HubItem` (`type` ∈ `file | image | link | note | pdf | video | embed`) is owner-managed
  data-room content. It has no `authorId` and no moderation status.
- `HubDrop` is the closest precedent: member-submitted, `status` ∈ `pending | approved | rejected`,
  with `reviewedAt` / `reviewedById` audit stamps.
- Pages are `Display` rows. `Display.published: Boolean` gates public visibility.

## Decisions (locked in brainstorm)

| Question | Decision |
|---|---|
| Who attaches | Any member. Submission is `pending` until a mod approves. |
| Who approves | Hub owner and privileged users. |
| What can be attached | The attacher's **own, already-published** Pages. Not drafts, not other people's. |
| Pages vs Boards | Pages only — `Display.kind !== 'collection'`. This matches how the Gallery's own Pages tab defines a Page. Boards are out of scope for this pass. |
| Where it appears | A new **Pages** tab beside Home and Files. |
| Storage | A new `HubPage` join model — not `HubItem`, not `HubDrop`. |
| Unpublish behaviour | Hide the card, keep the attachment. Re-publishing restores it with no re-approval. |

### Why a new model rather than reusing one

Reusing `HubItem` would mean adding `authorId` and `status` to a model that is currently
owner-managed, and those columns would then leak into every Files tab query. Reusing `HubDrop`
would mean adding `type` filters throughout the working Kollab code (`counts.kollab`,
`pendingDropsCount`) and blurring what a "drop" is. Only a dedicated model gets deletion
correctness for free: a real FK to `Display` with `onDelete: Cascade` means deleting a Page
cannot leave a dangling attachment.

## Part A — Data model

```prisma
model HubPage {
  id           String    @id @default(cuid())
  hubId        String
  hub          Hub       @relation(fields: [hubId], references: [id], onDelete: Cascade)
  displayId    String
  display      Display   @relation(fields: [displayId], references: [id], onDelete: Cascade)
  addedById    String
  addedBy      User      @relation(fields: [addedById], references: [id], onDelete: Cascade)
  status       String    @default("pending")   // 'pending' | 'approved' | 'rejected'
  reviewedAt   DateTime?
  reviewedById String?                          // audit stamp, deliberately not a relation
  order        Int       @default(0)
  createdAt    DateTime  @default(now())

  @@unique([hubId, displayId])
  @@index([hubId, status])
}
```

`Hub`, `Display`, and `User` each gain the matching back-relation field.

`@@unique([hubId, displayId])` is the double-attach guard. Enforce it by letting the insert
raise and mapping Prisma `P2002` to `409` — do **not** check-then-insert, which races.

`reviewedById` is a plain string with no relation, matching the existing `HubDrop` convention.

## Part B — Server fetch

New `src/lib/hub-pages.ts`, mirroring `src/lib/hub-announcements.ts`:

- `HubPageDTO` — `{ id, displayId, title, slug, coverImage, ownerUsername, status, addedById, createdAt }`
- `toHubPageDTO(row)` — flattens the joined `display` and `addedBy`.

`src/app/[username]/hub/[slug]/page.tsx` adds one query to the existing `Promise.all` and passes
`hubPages` into `CommunityHubView`, following the exact path `announcements` already takes.

**The query must not return rows the viewer may not see.** Filter in the query, not in the
component — the same rule the Files tab comment already states. Concretely: select `approved`
rows always; additionally select `pending`/`rejected` rows only when the viewer is privileged or
is the row's `addedById`.

## Part C — API

Four routes under `src/app/api/hubs/[id]/pages/`, shaped like the announcements routes.

| Route | Who | Behaviour |
|---|---|---|
| `POST /api/hubs/[id]/pages` | member | Body `{ displayId }`. Creates the attachment. Members get `pending`; owner/mods get `approved` immediately — there is no reason to review your own submission. |
| `GET /api/hubs/[id]/pages` | viewer | Lists rows under the visibility rules above. |
| `PATCH /api/hubs/[id]/pages/[pageId]` | privileged | Body `{ status: 'approved' \| 'rejected' }`. Stamps `reviewedAt` / `reviewedById`. |
| `DELETE /api/hubs/[id]/pages/[pageId]` | attacher or privileged | Detaches. |

`POST` validation order — check cheapest and most-secret first, so the response never reveals
more than the caller already knows:

1. Hub exists and `hub.community === true`, else `403`.
2. Caller is a member (or privileged), else `403`.
3. `Display` exists **and** `display.userId === caller.id`, else `404` — a single combined check,
   so a caller cannot probe for the existence of Pages that are not theirs.
4. `display.kind !== 'collection'`, else `422` — Boards are not attachable in this pass.
5. `display.published === true`, else `422`.
6. Insert; map `P2002` to `409`.

## Part D — UI

- **`CommunityTabs`** — add a `pages` entry. `tabFromParam` already handles the query param.
- **`HubPagesTab.tsx`** — card grid of approved Pages (cover, title, `by @username`). For
  privileged viewers, a "Needs review" section above the grid with approve/reject per row. For
  the attacher, their own pending rows render inline with a `pending` badge.
- **`HubPageAttachModal.tsx`** — lists the caller's own Displays where `kind !== 'collection'`.
  Published ones are selectable; drafts render greyed with "publish first". Already-attached
  Pages render disabled with "already added", so the `409` is a backstop rather than the
  primary UX.

Empty states: members with nothing attached see a prompt to attach; non-members see nothing
rather than an empty shell.

## Visibility matrix

| Row status | Display published | Owner/mod | Attacher | Other member | Public viewer |
|---|---|---|---|---|---|
| `approved` | yes | visible | visible | visible | visible |
| `approved` | no | hidden | hidden | hidden | hidden |
| `pending` | any | in review queue | badge | hidden | hidden |
| `rejected` | any | hidden | badge | hidden | hidden |

Unpublishing hides the card but keeps the row, so re-publishing restores it without a second
approval. This is deliberate: re-review on every unpublish/publish cycle would be noise.

## Module boundaries

- `src/lib/hub-pages.ts` — DTO shape and mapping only. No Prisma queries, no auth logic.
- API routes — auth, validation, persistence. No presentation concerns.
- `HubPagesTab` — presentation and local optimistic state. Receives server-filtered rows and
  trusts them; it must not re-derive visibility.
- `HubPageAttachModal` — self-contained picker. Its only output is a chosen `displayId`.

## Security invariants

1. A member can only ever attach a Display they own. Enforced server-side; the picker is a
   convenience, not the control.
2. Unfiltered rows never reach the client. Visibility is applied in the query.
3. Only privileged users can move a row to `approved` or `rejected`.
4. Attaching to a non-community hub is rejected, so this cannot become a side channel into the
   data-room viewer.
5. Deleting a Page removes its attachments via FK cascade — no orphan rows, no scheduled cleanup.

## Testing

Route tests mirroring `src/app/api/hubs/[id]/announcements/route.test.ts`:

- attach succeeds for a member with a published, owned Display
- attach by a non-member → `403`
- attach of another user's Display → `404`
- attach of an unpublished Display → `422`
- attach of a Board (`kind === 'collection'`) → `422`
- duplicate attach → `409`
- owner attach lands `approved`, member attach lands `pending`
- `PATCH` by a non-privileged caller → `403`
- `DELETE` by the attacher succeeds; by an unrelated member → `403`

Component tests mirroring `HubFilesTab.test.tsx`:

- approved rows render; pending rows are absent for an unrelated member
- privileged viewer sees the review queue with approve/reject
- attacher sees their own pending row badged
- picker greys drafts and disables already-attached Pages

A query-level test asserting an unprivileged viewer's fetch returns no `pending` rows — the
invariant most likely to regress under later refactoring.

## Out of scope

- Merging the Kollab and Pages review queues into one "needs review" surface. Two queues is a
  known wart; revisit if mods report it chafing.
- Attaching other people's Pages, and the consent and takedown flow that would require.
- Attaching Boards (`kind === 'collection'`). Nothing in the schema blocks it later — the
  restriction lives in one validation check and one picker filter.
- Reordering attached Pages in the UI. `order` exists in the schema so it is not a migration
  later, but nothing writes it in this pass.
- Notifying a member when their submission is approved or rejected.

## Related

- `docs/superpowers/specs/2026-07-22-hub-unified-design.md` — Files tab and announcements
- `src/lib/hub-announcements.ts` — the DTO/mapping pattern this follows
- `HubDrop` in `prisma/schema.prisma` — the moderation pattern this follows
