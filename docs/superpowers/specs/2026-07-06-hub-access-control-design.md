# Hub Access Control (private / passcode / collaborators) — design

Date: 2026-07-06
Status: draft (awaiting user review)
Part of: [[hub-feature-vision]] — brings Phase 3 (access) to the shipped Hub MVP, at
item/folder granularity. Later phases (per-recipient/expiring links, identified
analytics) remain out of scope.

## Goal

Let a Hub owner make individual folders/items **private**, so only the owner,
invited **collaborators**, or someone who enters a **passcode** can see them — the
"coach keeps player notes private, shares some with other coaches" case. Enforced
**server-side** (private content is never sent to unauthorized viewers, not merely
hidden in the UI). Locking is a **Pro** feature; viewing/unlocking is free.

## Confirmed decisions

- Private node visible to: **owner (always) · hub collaborators (always) · passcode-holders (if a passcode is set).**
- **Lock scope:** primarily **folders** (a locked folder gates its whole subtree); items can also be marked private (and optionally carry their own passcode).
- **Collaborators are view-only** in v1 (see private content; cannot edit the hub).
- **Pro-gated:** owner must be Pro to set visibility/passcode/invite collaborators. Viewing + entering a passcode + being a collaborator are always free.
- **Privacy inherits down the tree** (a private folder → its entire subtree is private).
- **Reload-after-unlock** flow (entering a passcode sets a cookie; the page reloads and the server now includes that subtree).

## Data model

Additive migration (nullable/defaulted columns + one new table — safe on live Neon;
use a migration timestamp **later than the latest existing migration at build time**,
since concurrent work keeps adding migrations).

- `HubFolder`: `visibility String @default("public")` (`public`|`private`), `passcodeHash String?`.
- `HubItem`: `visibility String @default("public")` (`public`|`private`), `passcodeHash String?`.
- New:
```prisma
model HubCollaborator {
  id        String   @id @default(cuid())
  hubId     String
  hub       Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([hubId, userId])
  @@index([hubId])
  @@index([userId])
}
```
(`Hub` gains `collaborators HubCollaborator[]`; `User` gains a back-relation.)

Passcodes are stored **hashed** with the same password-hash utility used for
`User.password` (never plaintext); `passcodeHash` is never sent to the client.

## The security model (pure, unit-tested resolver)

The heart of the feature is a pure function, e.g.
`resolveHubVisibility({ folders, items, viewer, unlockedIds }) → Map<nodeId, 'visible'|'locked'|'hidden'>`:

- **viewer** ∈ `owner | collaborator | public`. Owner/collaborator → every node `visible`.
- For a **public** viewer, per node:
  - **restricted** = the node's own `visibility === 'private'` OR any ancestor folder is `private` (inheritance).
  - not restricted → `visible`.
  - restricted but **unlocked** (the node's id, or an ancestor folder's id, is in `unlockedIds`) → `visible`.
  - restricted, not unlocked, and there is a **passcode gate** on its chain (the node itself, or an ancestor folder, has a `passcodeHash`) → `locked` (the nearest such gate is the unlock target; its subtree stays hidden until unlocked).
  - restricted, not unlocked, no passcode gate (collaborator-only) → `hidden`.

The function takes only booleans (`hasPasscode`), never the hashes. It is exhaustively
tested (public/private, no-passcode → hidden, passcode → locked, unlocked → visible,
nested locks, owner/collaborator see-all).

## Server-side enforcement (public viewer)

The RSC loader at `/[username]/hub/[slug]` (built in the Hub MVP) is extended:
1. Resolve the **viewer's identity** from the auth cookie (a small `getUserFromCookies()`
   helper using `next/headers` `cookies()` + the existing JWT verify) → owner? collaborator
   (a `HubCollaborator` row)? else public.
2. Read the **unlock cookie** `hub_unlock_{hubId}` — a JWT signed with the app secret whose
   payload is `{ hubId, unlocked: string[] }` (httpOnly; can't be forged) → `unlockedIds`.
3. Run `resolveHubVisibility`. Build a **filtered payload**:
   - `hidden` nodes → omitted entirely (no id/name/content leaves the server).
   - `locked` folders/items → a stub `{ id, name/title, locked: true }` with **no children/url/content**.
   - `visible` nodes → full data.
4. Pass the filtered tree to `HubViewer`, which renders `locked` nodes as a **🔒 placeholder
   with an "Enter passcode" input**. On correct unlock the page reloads and the now-unlocked
   subtree is included.

`generateMetadata` uses the same publish-gate as today (unchanged); private content
never appears in metadata.

## APIs

- **Item/folder privacy** — extend the existing `PATCH /api/hubs/[id]/folders/[folderId]`
  and `.../items/[itemId]` (owner-gated already) to accept `visibility` and `passcode`.
  Setting `passcode` (non-empty string) → hash + store; `passcode: null`/`''` → clear.
  **Owner must be Pro** to set `visibility='private'` or a passcode (else 403 + upgrade).
- **Collaborators** — `GET/POST/DELETE /api/hubs/[id]/collaborators` (owner + Pro).
  POST `{ username }` → resolve to a user, create `HubCollaborator` (idempotent via unique),
  and notify them via the existing notifications helper. DELETE `{ userId }`.
- **Unlock** — `POST /api/hubs/[id]/unlock` (public, no auth) `{ nodeId, passcode }` →
  load the node (folder/item) in this hub, verify `passcode` against its `passcodeHash`;
  on success append `nodeId` to the signed `hub_unlock_{hubId}` cookie and return `{ ok }`.
  **Rate-limited** (reuse `src/lib/rate-limit.ts`, e.g. 10/min/IP) to prevent brute force;
  wrong passcode → 401 without revealing anything.

## Editor + tools UI

- **Per folder/item ⋮ → Privacy** (in `HubFolderTree`/`HubItemList`): toggle Public/Private;
  when Private, an optional "Set passcode" field. Private nodes show a 🔒 badge. Non-Pro
  owner → the control shows an upgrade prompt (existing `UpgradePrompt`).
- **Hub Tools menu** (a `Tools ▾` in `HubEditor`) → **Collaborators**: a modal to invite by
  username, list current collaborators, remove. Pro-gated.

## Pro gating

`isPro(owner)` gates: setting `visibility='private'`, setting a passcode, and all
collaborator writes. Everything a *visitor* does (view, unlock, be a collaborator) is free.
Reuses `src/lib/plan.ts` + `src/components/pro/{ProBadge,UpgradePrompt}`.

## Testing

- **`resolveHubVisibility`** — the security-critical pure function: full matrix (public
  folder visible; private-no-passcode hidden; private+passcode locked; after unlock visible;
  nested private inside an unlocked folder still locked; owner/collaborator see all; item
  inheriting a private ancestor).
- **Passcode hash/verify** — round-trips; wrong passcode fails.
- **Unlock cookie** — sign→verify round-trips; a tampered cookie fails verification (→ treated as no unlocks).
- **APIs** — set `visibility`/passcode as non-Pro → 403; as Pro owner → ok; unlock with wrong
  passcode → 401 and rate-limited; collaborator add/remove owner+Pro only; a non-collaborator/
  non-owner public request never receives `hidden` node data (assert the filtered payload).

## Non-goals (v1)

Collaborator editing/co-management; per-recipient or expiring links; element-level privacy
inside a published page; audit of *who* viewed what (Phase 4); changing the existing
publish-gate.

## Build order (plan will sequence)

1. Models + migration (visibility/passcodeHash on folder+item, `HubCollaborator`).
2. `resolveHubVisibility` pure resolver + unlock-cookie sign/verify helper (+ tests).
3. APIs: PATCH visibility/passcode (Pro), collaborators CRUD, unlock (rate-limited).
4. Viewer enforcement: `getUserFromCookies`, filtered loader, `HubViewer` locked placeholders + unlock prompt.
5. Editor UI: per-node Privacy control + badges; Hub Tools → Collaborators modal.

## Files (high level)

New: `src/lib/hub-access.ts` (resolver + cookie helpers, + test), collaborators + unlock
API routes, a `HubCollaboratorsModal` + privacy controls under `src/components/hub/`.
Modified: `prisma/schema.prisma` + migration, the item/folder PATCH routes,
`src/app/[username]/hub/[slug]/page.tsx` + `HubViewer.tsx`, `HubEditor`/`HubFolderTree`/`HubItemList`.
