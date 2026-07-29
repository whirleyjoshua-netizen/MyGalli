# CRM App — Design

**Date:** 2026-07-29
**Status:** Approved, ready for planning

## Summary

A lightweight CRM for creators and freelancers taking inbound through their Galli page. Listed in the Library's Apps section, it lives at `/crm` as a dashboard tool rather than a page-canvas card.

The premise: **Galli already captures leads and has nowhere to put them.** Five existing models collect contact details, each in its own silo. The CRM is the missing destination that unifies them into one contact record with a timeline and a pipeline.

| Source model | Email | Name |
| --- | --- | --- |
| `LeadCapture` | required | yes |
| `Booking` (appointments) | required | yes |
| `WaitlistSignup` | required | optional |
| `Comment` | `authorEmail?` | yes |
| `FormResponse` | inside `responses` JSON | inconsistent |

## Decisions

| Decision | Choice |
| --- | --- |
| Shape | Dashboard tool at `/crm`, listed in the Apps storefront |
| Audience | Creator / freelancer taking inbound |
| Identity | Normalized email is the merge key; auto-merge on match |
| Pipeline | Custom stages per user |
| Outbound | None — tracking only |
| Gating | Pro (`user.plan === 'pro'`), enforced in API routes and UI |

Tracking-only avoids email deliverability entirely, which matters because `EMAIL_FROM` is unset and Resend only delivers to the account owner until the domain is verified.

## Data model

All three tables are **owner-scoped**, not display-scoped: one creator with five pages gets one pipeline. `ownerId` is derived from `display.userId` at ingest time.

```prisma
model CrmStage {
  id      String @id @default(cuid())
  ownerId String
  name    String
  order   Int
  color   String @default("#39D98A")
  @@unique([ownerId, name])
  @@index([ownerId, order])
}

model CrmContact {
  id         String    @id @default(cuid())
  ownerId    String
  stageId    String
  mergeKey   String    // normalized email, or "manual:<cuid>"
  email      String?
  name       String?
  followUpAt DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  @@unique([ownerId, mergeKey])
  @@index([ownerId, stageId])
}

model CrmActivity {
  id         String   @id @default(cuid())
  contactId  String
  source     String   // form | booking | waitlist | lead-capture | comment | note
  sourceId   String?  // originating row id — idempotency
  displayId  String?
  summary    String
  payload    Json
  occurredAt DateTime
  @@unique([source, sourceId])
  @@index([contactId, occurredAt])
}
```

### Why `mergeKey` rather than a nullable unique email

Manually-added contacts have no email. A nullable composite unique **does not enforce in Postgres** — two null-email rows both insert (the same trap hit by the Acknowledgment element). `mergeKey` is always non-null: the normalized email when one exists, `"manual:<cuid>"` otherwise. The constraint then actually holds.

Normalization is lowercase + trim. `Josh@X.com ` and `josh@x.com` are the same contact.

### Stage semantics

- Stages seed on first CRM open, idempotently: New → Contacted → Qualified → Won.
- Deleting a stage reassigns its contacts to the stage on its left, or to the right if it is the first.
- Deleting the last remaining stage is blocked.
- Reassign-then-delete runs in a single transaction.

## Ingestion

A single seam at `src/lib/crm/ingest.ts`:

```ts
ingestLead({ displayId, email, name, source, sourceId, summary, payload, occurredAt })
```

Behavior:

1. Resolve `ownerId` from `displayId`. Unknown display is a silent no-op.
2. No usable email and no existing contact → no contact, no activity (anonymous comments and email-less form submits are dropped).
3. Upsert `CrmContact` on `(ownerId, mergeKey)`, placing new contacts in the lowest-`order` stage.
4. Create `CrmActivity`, skipped when `(source, sourceId)` already exists so a retried submit cannot double-log.

Five call sites, roughly three lines each, placed **after** the source route's own write succeeds and wrapped in `try/catch` that logs and swallows. A CRM failure must never fail a booking or a form submit.

`FormResponse` needs an email-sniffing helper over the `responses` JSON — first field whose type or question text indicates an email. This is the one piece of guesswork in the system and gets its own unit test.

`ingestLead` **runs for free users too.** Their leads accumulate while the CRM UI stays gated, so upgrading reveals a populated pipeline rather than an empty one. This costs nothing and materially improves the upgrade moment.

## UI

Route: `/(dashboard)/crm`, reachable from the Apps storefront and the sidebar.

### Board view (default)

Horizontally-scrolling kanban, one column per stage. Cards show name, email, the source icon of the most recent activity, and a follow-up chip when `followUpAt` is past.

Drag-to-restage, plus a per-card stage dropdown — drag alone is unusable on touch and by keyboard. Column headers carry inline rename, a color dot, and delete with the reassignment consequence spelled out ("3 contacts will move to Contacted").

### Contact drawer

Opens on card click: editable identity block, stage selector, follow-up date, then the merged **activity timeline** newest-first. Every booking, form submit, waitlist join, and note in one column. This timeline is the entire pitch of the feature and should be the visually strongest element on the screen.

Adding a note posts a `CrmActivity` with `source: 'note'`.

### List view

A toggle, not a separate route. Table sorted by last activity, filterable by stage and source, searchable across name and email. This is what keeps 400 contacts usable once the board stops being.

## Apps storefront

`src/lib/cards/registry.ts` currently models only card providers. Rather than distort `CardProviderConfig`, add a sibling list in the same file:

```ts
export interface AppToolConfig {
  id: string
  name: string
  description: string
  icon: string
  href: string
  status: 'live' | 'coming-soon'
  plan: 'free' | 'pro'
}

export function listedTools(): AppToolConfig[]
```

The Library page renders tools and card providers as two sections of one storefront. `listedApps()` and every shipped card are untouched — no migration, no regression risk.

## Gating

- `/crm` redirects non-Pro users to an upgrade screen.
- **Every** `/api/crm/**` route independently checks `isPro(user)` from `src/lib/plan.ts` and returns 403. UI-only gating is not gating.
- `ingestLead` is the deliberate exception and runs regardless of plan.

## Error handling

- Ingestion failures log and swallow; they never propagate to a visitor-facing route.
- Stage deletion is transactional.
- Restaging validates that the target stage belongs to the caller. A stage or contact id owned by another user returns **404, not 403**, so the board cannot be used to probe for existence.

## Testing

Vitest. Run one suite at a time — concurrent suites produce phantom worker-spawn timeouts in this repo.

**`ingest.test.ts`**
- Creates a new contact from a first-touch lead
- Merges onto an existing contact when the email matches
- Normalizes case and whitespace (`Josh@X.com ` ≡ `josh@x.com`)
- No email → `manual:` key; two email-less contacts coexist
- Duplicate `(source, sourceId)` logs exactly one activity
- Unknown `displayId` is a no-op

**`stages.test.ts`**
- Delete reassigns contacts left; first stage reassigns right
- Deleting the last stage is blocked
- Seeding is idempotent

**`route.test.ts`**
- Free user receives 403 on every CRM endpoint
- Cross-owner contact and stage ids return 404

**`form-email.test.ts`**
- Email sniffing over `FormResponse.responses` across field-type and question-text variants, including the no-email case

## Out of scope for v1

Deferred deliberately: CSV export, outbound email, custom fields, deal values, and binding contacts to Galli `User` accounts.

CSV export is the expected first follow-up but is not on the critical path to "my leads are in one place."

## Notes for implementation

- Migrations here are non-interactive: hand-author `prisma/migrations/<ts>_<name>/migration.sql` and run `migrate deploy`. Never `migrate dev`, and never point `--shadow-database-url` at a real database.
- `next dev` returns 500s for new models until restarted after `prisma generate`.
- Pro gating is currently aspirational — no billing exists. The CRM is the strongest argument yet for building checkout, and that should be weighed before shipping this behind a gate nobody can pass.
