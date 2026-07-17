# Freebie Element — Design

**Date:** 2026-07-17
**Branch:** `feat/freebie-element`
**Slug:** `freebie` · **Slash category:** Commerce · **Tier:** Free

## Summary

A public "email-for-a-freebie" element (lead magnet). A visitor enters their
email (name optional) and instantly receives a preset message — optionally with
a download link to an owner-uploaded file. The visitor gets the payload
immediately; the owner keeps the captured email as a **lead** surfaced in the
Data tab.

This fills a real gap: nothing in Galli currently captures a visitor email in
exchange for auto-delivered content. It is the reverse of the Mailbox element
(visitor → owner messages); here the flow is owner → visitor, automated.

## Decisions (locked)

- **Payload:** preset message + *optional* file link. No file → works as a
  "get my discount code / secret link" tool.
- **Delivery:** instant. On submit the email sends immediately and the download
  link also appears inline on the page (no wait, no confirmation step).
- **Capture fields:** email required, name optional (owner toggle).
- **Delivery mechanism:** email contains a **download link** (Blob URL), never
  an attachment — better deliverability, no size cap, revocable later.
- **Storage:** dedicated `LeadCapture` model (not reused `FormResponse`) so
  leads are clean, per-element, exportable, and delivery-tracked.
- **No SMS/phone in v1.** We have zero SMS infrastructure; Twilio + A2P 10DLC is
  a separate, paid, compliance-heavy milestone. Deferred.

## Owner experience (editor)

`Freebie.tsx` editor card with:

- **Headline** — e.g. "Get my free press kit"
- **Button label** — e.g. "Send it to me"
- **Preset message** — the emailed body; plain text with support for an inline
  link and/or discount code (owner types it in)
- **Optional file** — uploaded via existing `/api/upload`, stored on Blob; the
  element keeps `fileUrl` + `fileName`
- **Success text** — shown on the page after submit ("Check your inbox! 📬")
- **Name field toggle** — on/off (email always on)

### Element data shape (`CanvasElement` fields, in `canvas.ts`)

```ts
// type: 'freebie'
freebieHeadline?: string
freebieButtonLabel?: string
freebieMessage?: string        // preset body emailed to visitor
freebieFileUrl?: string        // Blob URL, optional
freebieFileName?: string       // display name for the download link
freebieSuccessText?: string
freebieCollectName?: boolean   // default false
```

`createElement('freebie')` seeds friendly defaults (single source in
`canvas.ts`; no `PageEditor` edit).

## Visitor experience (public)

`PublicFreebie.tsx` renders headline + email input (+ optional name) + button.

On submit → `POST /api/freebie/[displayId]`:

1. **Rate limit** — reuse `rateLimit`, 30/min/IP (`prefix: 'freebie'`).
2. **Validate** — email format; body has `elementId`, `email`.
3. **Verify display** — exists and `published` (mirror forms/submit).
4. **Resolve element** — find the `freebie` element with `elementId` inside the
   display's `sections` JSON (server-side) to read `freebieMessage` /
   `freebieFileUrl` / `freebieFileName`. Never trust message/file from the
   client — always read from the stored display so a crafted request can't make
   us email arbitrary content.
5. **Store lead** — `LeadCapture` row (hash IP like forms/submit).
6. **Send email** — `sendEmail()` with the preset message + a download-link CTA
   if `freebieFileUrl` present. New builder in `src/lib/email.ts`
   (`freebieEmail({ name, message, fileUrl, fileName })`).
7. **Mark delivered** — set `delivered: true` on success; leave `false` on send
   failure (email still logged in dev fallback).
8. **Respond** — `{ success: true, fileUrl?, fileName? }` so the page swaps the
   form for success text and shows the inline download link.

## Storage — `LeadCapture` model

```prisma
model LeadCapture {
  id         String   @id @default(cuid())
  displayId  String
  elementId  String
  email      String
  name       String?
  delivered  Boolean  @default(false)
  ipHash     String?
  createdAt  DateTime @default(now())

  display    Display  @relation(fields: [displayId], references: [id], onDelete: Cascade)

  @@index([displayId, elementId])
  @@index([displayId, createdAt])
}
```

- `Display` gets `leadCaptures LeadCapture[]` back-relation.
- **Migration:** hand-author `migration.sql` with ONLY the `LeadCapture`
  CREATE TABLE + indexes (shared dev DB `migrate diff` is contaminated — do not
  auto-generate). Then `prisma migrate deploy`. Prod Neon is clean so the same
  additive migration deploys fine. Set `DATABASE_URL_UNPOOLED` alongside
  `DATABASE_URL` for Prisma commands.

## Owner analytics (Data tab)

New element-analytics card under the existing Data tab (`element-cards/`
pattern): per-freebie-element **Leads** list — email, name, delivered status,
captured time, plus a total count. Reads a small
`GET /api/analytics/[displayId]/leads` (owner-auth, groups by `elementId`).
Export can be a later add; v1 just lists them.

## Anti-abuse & edge cases

- Rate limit per IP (30/min); email-format validation server-side.
- Content emailed is **always** the owner's stored preset — a forged request
  cannot make Galli send arbitrary text/files to a third party. Low spam-cannon
  risk.
- No file attached → email is just the preset message.
- `RESEND_API_KEY` unset (dev) → existing console fallback; inline page link
  still returned so the flow is testable locally.
- Unpublished display or unknown `elementId` → 4xx, no send, no lead stored.

## The 7 element seams (implementation checklist)

1. `ElementType` union + `CanvasElement` fields + `createElement()` default — `canvas.ts`
2. `elements/Freebie.tsx` (editor) + `elements/PublicFreebie.tsx` (public)
3. `SlashCommandMenu.tsx` — add under Commerce in `CATEGORY_ORDER`
4. `ColumnCanvas.tsx` `renderElement` — preview → Public, else editor
5. `elements/index.ts` — export
6. `render-elements.tsx` — public render path (`[slug]` + share `/s/[code]`)
7. New: `LeadCapture` model + migration; `POST /api/freebie/[displayId]`;
   `freebieEmail()` in `email.ts`; `GET /api/analytics/[displayId]/leads` +
   Data-tab Leads card

## Testing

- Unit: email-format validation + `freebieEmail()` HTML builder (pure).
- Unit: server-side element resolution (crafted `elementId` / wrong element
  type / unpublished display are all rejected).
- Route: `POST /api/freebie/[displayId]` happy path stores a `LeadCapture` and
  returns `fileUrl` when a file is set; rejects unpublished / bad email.
- Browser smoke (deferred to end): create a freebie element → publish → submit
  as a visitor → lead appears in Data tab → email logged in dev console.

## Out of scope (v1)

- SMS / phone delivery (separate Twilio milestone).
- Double opt-in / verified newsletter list.
- Multi-file "package" payloads (lean on Hub later).
- CSV export of leads (list view only for now).
- Revocable / time-limited download links (permanent Blob URL for v1).
