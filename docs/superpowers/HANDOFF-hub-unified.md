# Handoff: Unified Hub (feat/hub-unified)

**Written 2026-07-22 for a Claude Code session continuing this work on another device.**

You are picking up the `feat/hub-unified` branch. It adds two things to community Hubs: **Announcements** (done) and a **Files tab** (not started). Both were designed together but ship independently. The plan was "two plans, one branch, one deploy."

## Read these first (both committed on this branch)

1. **Design spec:** `docs/superpowers/specs/2026-07-22-hub-unified-design.md` — the full approved design for BOTH halves (Parts A/B/C, decisions D1–D6). This is your source of truth.
2. **Plan 1 (Announcements):** `docs/superpowers/plans/2026-07-22-hub-announcements.md` — already executed. Tasks 1–6 done and committed; Task 7 (verification) is partly done (see below).

The per-task SDD ledger and review reports lived in `.superpowers/sdd/` which is **gitignored** — they did NOT transfer. You do not need them; the code and the spec/plan are all committed.

## What is DONE (Plan 1 — Announcements)

Commits `a1cb307`..`b39170a` on this branch. Every task was implemented TDD and reviewed clean. Delivered:

- **`HubAnnouncement` model** + migration `prisma/migrations/20260722000000_hub_announcement/` (applied to the dev DB; will apply to prod Neon on merge to main).
- **`src/lib/hub-announcements.ts`** — `validateAnnouncementBody` (trim, non-empty, ≤280) + `toAnnouncementDTO`.
- **`src/app/api/hubs/[id]/announcements/route.ts`** — GET (latest 10, `canViewCommunityHub` gate) + POST (`canModerate`-only, rate-limited, member→403).
- **`src/app/api/hubs/[id]/announcements/[announcementId]/route.ts`** — DELETE (hub-scoped IDOR guard, `canModerate`-only).
- **`HubAnnouncementBanner.tsx`** + **`HubAnnouncementComposer.tsx`** — rotating banner with `‹ 1/N ›` pager, owner ＋/✕ controls, member read-only, empty state differs owner vs member.
- Wired into **`CommunityHeader.tsx`** (the previously-blank band), threaded through **`CommunityHubView.tsx`** (prop `announcements?: AnnouncementDTO[]`, default `[]`), and **SSR'd** in `src/app/[username]/hub/[slug]/page.tsx` (added last in the `Promise.all`, name `announcementRows`).

**Static gates already GREEN on this branch:** `tsc --noEmit` clean; `next lint` 0 errors; all announcement + community test suites pass.

### Deferred Minors from Plan 1 reviews (fix in the final wave, none blocking)
- `HubAnnouncementBanner` hardcodes the composer's `currentUser` to `{username:'you'}`. Harmless — the banner never displays author. Optional: add a real `currentUser` prop.
- The banner's `remove()`/delete optimistic path has no test (jsdom lacks `window.confirm`). Add one with `vi.spyOn(window,'confirm').mockReturnValue(true)`.
- `GET /announcements` fetches collaborator rows even when the caller is logged out (`me` is null). Harmless extra query; can short-circuit.

## What is NOT DONE (Plan 2 — Files tab)

**Plan 2 has not been written yet.** Write it (superpowers:writing-plans), then execute it (superpowers:subagent-driven-development) on THIS branch. It is Part B of the spec. Summary of the approved decisions (D1–D6 in the spec):

- Every hub is both a community and a file data-room (one `Hub` model already holds both relation sets — no schema merge). New hubs are unified; existing community hubs gain the Files tab; existing file-only data-rooms are left untouched.
- The decorative "Home" label in `CommunityHubView.tsx` (~line 92) becomes a real **Home | Files** tab bar, tab state in the URL `?tab=files`.
- The Files tab renders the existing rich data-room components (`HubFolderTree` + `HubItemList` + `HubFileViewer`) scoped to the hub, reusing `src/lib/hub-access.ts` server-side visibility filtering.
- **Owner/collaborator manage files** (upload, folders, delete, visibility); **members browse public items only, no upload** (member contributions go through the moderated Kollab pool). File-mutation APIs already gate ownership — verify, don't assume.
- The Tools card "Files" button (`CommunityUtilityStrip.tsx`, currently opens `HubResourcesModal`) is rewired to select the Files tab. `HubResourcesModal` is retired for files; the Links tool keeps its own list.

### The one real architecture fork to resolve when writing Plan 2
The community Files tab needs a **read path** (members see visibility-filtered public items — the existing SSR path in the non-community branch of `page.tsx` already does this via `resolveHubVisibility`) AND a **manage path** (owner/collab upload/organize — all ~300 lines of handlers currently live only in `HubEditor.tsx`, which is the non-community owner view; note that a *community* hub's "Edit" button goes to `HubBuilder`, which does NOT do files — so the Files tab is genuinely the only file-management surface a community hub has). Decide between:
- **(a)** extract a reusable `HubFileBrowser` from `HubEditor`'s file portion, used by both `HubEditor` and the new Files tab, or
- **(b)** a new focused `HubFilesTab` that reuses the leaf components (`HubFolderTree`/`HubItemList`/`HubFileViewer`) and re-implements the fetch+handlers standalone with a `canManage` gate.

Brainstorm this fork before writing Plan 2. Keep the announcement banner on the **Home** tab only.

## ⚠️ Environment blockers to clear before you can finish

1. **DISK.** On the origin device, C: was at ~36MB free / 100% full — this caused phantom test-worker failures and blocks `next dev`. If your device has the same problem, free space first (pnpm store, stale `.next` caches, OneDrive). The runtime + browser smoke and the deploy cannot run until disk is healthy.
2. **This is a git worktree pattern on the origin device.** On your device, just work in the normal checkout on branch `feat/hub-unified` (`git fetch && git checkout feat/hub-unified`).
3. **DB env override for any Prisma/DB command:** `export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` and `export DATABASE_URL_UNPOOLED="$DATABASE_URL"` (127.0.0.1, never localhost). Never `migrate dev` or `migrate diff --from-url` — hand-author SQL, then `migrate deploy`.
4. **Tests:** run in chunks with `--maxWorkers=2` and `JWT_SECRET` set; unconstrained `pnpm test` is unreliable on a loaded machine. `hub-access.test.ts` fails without `JWT_SECRET` — that's environmental, not a code defect.
5. **No `@testing-library/user-event`** in this repo — use `fireEvent`.

## Finish sequence

1. Free disk if needed.
2. Brainstorm the Plan-2 architecture fork → write Plan 2 (`docs/superpowers/plans/2026-07-22-hub-files-tab.md`) → execute it on this branch.
3. Fix the deferred Plan-1 Minors above during the final wave.
4. **Whole-branch final review** (superpowers:requesting-code-review, most capable model) over the merge-base..HEAD diff.
5. **Runtime smoke** (real `next dev` + forged `galli-auth` cookie): announcements POST member→403 / owner→201 / empty→400, GET public→200, DELETE member→403/owner→200, and the announcement text present in the SSR'd HTML of a published hub; plus the Files-tab access checks from Plan 2.
6. **Browser smoke** (superpowers-chrome:browsing) of the banner + Files tab.
7. **Merge to main** via superpowers:finishing-a-development-branch. Main auto-deploys to mygalli.com (`prisma migrate deploy && next build`), so the announcement migration applies to prod Neon on merge. Watch the Vercel deploy via GitHub check-runs (`gh api repos/whirleyjoshua-netizen/MyGalli/commits/<sha>/check-runs`), NOT `commits/<sha>/status`.

## Also on your radar (separate, do NOT fold into this branch)
- A pre-existing vuln (already on main): `isOwnDropAsset` proves "some asset of this hub", not "this row's own upload" — a member can destroy another member's Kollab asset by re-declaring its URL then deleting it. Real fix = put the drop id in the blob path. Its own branch, not this one.
- If a `playing_with_neon` table exists in prod Neon (a stray from the Neon SQL-editor demo snippet), drop it: `DROP TABLE playing_with_neon;`.
