# Database & API Audit — Galli (mygalli.com)
**Date:** 2026-06-30  
**Scope:** `prisma/schema.prisma`, migrations, `src/app/api/**`  
**Method:** Static analysis only (schema + route files; no live DB queries)

---

## Summary

The schema is well-structured with good index coverage on the most-used FK columns. Auth is solid (httpOnly JWT, bcrypt cost 12, rate-limited login/signup). The main risks are: **unbounded list queries** on social endpoints (followers/following can return thousands of rows), **missing rate limits** on follow/unfollow and several mutating routes, **analytics double-counting** from two independent view-increment paths, and **universal hard-deletes with cascade** offering zero data recovery. Migration history has been manually repaired and carries drift risk. No API versioning exists.

---

## Findings

### F-01 — Followers/Following Endpoints: No Pagination or Row Cap
**Severity:** High  
**Evidence:** `src/app/api/users/[username]/followers/route.ts` and `following/route.ts` — `db.follow.findMany(...)` with no `take` limit.  
**Why it matters:** A user with 50,000 followers triggers a full table scan + full JSON serialization on every request. The second in-loop query (`findMany` for `myFollowing`) adds a second DB round-trip. Both calls are unauthenticated, making this a trivial DoS vector against popular accounts.  
**Recommendation:** Add `take: 50` (or paginate via `cursor`/`skip`) and a `limit` query param capped at 100. Move the `myFollowing` lookup to a single `WHERE followingId IN (...)` already done — keep it, just bound the outer set.

---

### F-02 — Follow/Unfollow: No Rate Limiting
**Severity:** High  
**Evidence:** `src/app/api/users/[username]/follow/route.ts` — POST and DELETE handlers call `getUser` but never call `rateLimit()`.  
**Why it matters:** An authenticated user can spam follow/unfollow thousands of times per second. Creates artificial churn in the `Follow` table and triggers repeated DB writes (upsert/deleteMany) with no throttle.  
**Recommendation:** Add `rateLimit(request, { limit: 30, windowMs: 60_000, prefix: 'follow' })` at the top of both handlers.

---

### F-03 — Analytics View Double-Counting
**Severity:** High  
**Evidence:** `src/app/api/displays/[id]/route.ts` increments `display.views` on every GET by a non-editor. `src/app/api/analytics/track/route.ts` also increments `display.views` when `eventType === 'view'`. If the public page client does both (loads page → GET fires → then POSTs to /analytics/track), each page view is counted twice.  
**Why it matters:** `views` is used to rank displays in explore (`sort=popular`). Double-counting pollutes rankings and makes analytics meaningless.  
**Recommendation:** Pick one canonical source of truth. Option A: remove the `views` increment from the GET route and rely entirely on the analytics/track POST. Option B: remove the `views` increment from analytics/track and keep only the GET route increment. The analytics event table can still be queried separately for rich stats.

---

### F-04 — analytics/track: Two Writes Outside a Transaction
**Severity:** Medium  
**Evidence:** `src/app/api/analytics/track/route.ts` lines ~77–86: `db.analyticsEvent.create(...)` then `db.display.update({ data: { views: { increment: 1 } } })` as sequential awaits.  
**Why it matters:** If the second update fails (e.g. transient DB error), the event is recorded but `views` is not incremented — or vice versa in a retry scenario. Over time this creates permanent drift between event count and views counter.  
**Recommendation:** Wrap both writes in `prisma.$transaction([...])` — or eliminate the redundancy per F-03.

---

### F-05 — Hard Deletes Everywhere, No Recovery Path
**Severity:** High  
**Evidence:** `prisma/schema.prisma` — every child model uses `onDelete: Cascade`. `displays/[id]/route.ts` DELETE is hard-delete with no guard.  
**Why it matters:** Deleting a Display permanently destroys all associated `AnalyticsEvent`, `FormResponse`, `Comment`, `TrackerEntry`, `JerseySignature`, and `ShareLink` records. Deleting a User cascades to everything. No soft-delete, no archive, no grace period. A user who accidentally deletes a Display (or an admin bulk-deleting spam accounts) has no recovery option.  
**Recommendation:** At minimum, add `deletedAt DateTime?` to `Display` and filter it out of queries rather than hard-deleting. For User deletion, consider a "scheduled deletion" flow that soft-deletes with a 30-day window. Not required to launch, but the window to add this closes once real data accumulates.

---

### F-06 — Missing Index: `Display.views` Used in Sort
**Severity:** Medium  
**Evidence:** `prisma/schema.prisma` — `Display` has `@@index([published])` and `@@index([category])` but no index on `views`. `explore/route.ts` uses `orderBy: { views: 'desc' }` when `sort=popular`.  
**Why it matters:** Sorting by an un-indexed column on a large table requires a full table scan + in-memory sort. With the `published: true, kind: { not: 'profile' }` filter applied first this is manageable at small scale, but degrades as displays grow. Also no index on `kind`.  
**Recommendation:** Add `@@index([published, views])` and `@@index([kind])` to `Display` in schema and generate a migration.

---

### F-07 — Missing Index: `Comment.approved` in Filtered Queries
**Severity:** Medium  
**Evidence:** `prisma/schema.prisma` — `Comment` has `@@index([displayId])` and `@@index([displayId, createdAt])` but no index on `approved`. `comments/route.ts` GET filters `where: { displayId, approved: true }`.  
**Why it matters:** With the compound index on `(displayId, createdAt)` PostgreSQL can filter by `displayId` first, but `approved: true` is a post-filter over all rows for that display. For a high-traffic display with many pending/rejected comments this is inefficient.  
**Recommendation:** Add `@@index([displayId, approved, createdAt])` to `Comment`.

---

### F-08 — Missing Index: `FormResponse.ipHash` and `JerseySignature.ipHash`
**Severity:** Medium  
**Evidence:** `prisma/schema.prisma` — `FormResponse` and `JerseySignature` both have `ipHash` fields used for spam/dedup lookups, but `ipHash` is not indexed. `signatures/route.ts` queries `where: { displayId, elementId, ipHash }` — the compound index `@@index([displayId, elementId])` exists but `ipHash` is not included, so the `ipHash` filter is a sequential scan within the matched rows.  
**Recommendation:** Add `@@index([displayId, elementId, ipHash])` to `JerseySignature`. `FormResponse` dedup is client-side (localStorage) so lower priority, but add `@@index([displayId, ipHash])` if server-side dedup is ever added.

---

### F-09 — `analytics/track`: `eventType` Not Validated
**Severity:** Medium  
**Evidence:** `src/app/api/analytics/track/route.ts` — `eventType` is extracted from body with default `'view'` but no enum check. Any string is written to `AnalyticsEvent.eventType`.  
**Why it matters:** Junk `eventType` values pollute the analytics table. The analytics dashboard could show garbage rows. Also `metadata` has no size limit — a single request could write a 1 MB JSON blob.  
**Recommendation:** Validate `eventType` against an allowlist (`['view', 'click', 'share', ...]`). Cap `metadata` at e.g. 4 KB before storage.

---

### F-10 — Comment `authorEmail` Not Validated; `authorName`/`content` Not Sanitized
**Severity:** Medium  
**Evidence:** `displays/[id]/comments/route.ts` POST — `authorEmail` stored without format check. `authorName` sliced to 30 chars but no sanitization. `content` trimmed but no HTML strip.  
**Why it matters:** If comment content is ever rendered as `dangerouslySetInnerHTML` (common mistake) XSS is trivial. Garbage email values inflate moderation UI noise. No rate limit on GET (100 comments per display, public, no auth) is acceptable but should be noted.  
**Recommendation:** Validate `authorEmail` with a simple regex. Pass `authorName` and `content` through the existing `src/lib/sanitize.ts` sanitizer before storage.

---

### F-11 — Multiple Mutating Routes Without Rate Limiting
**Severity:** Medium  
**Evidence:** No `rateLimit()` call found in:
- `src/app/api/displays/route.ts` POST (create display)
- `src/app/api/displays/[id]/route.ts` PATCH (update display)
- `src/app/api/profile/route.ts` PATCH
- `src/app/api/tracker-entries/route.ts` POST
- `src/app/api/displays/[id]/collaborators/route.ts` POST  

**Why it matters:** Authenticated users can hammer these endpoints in loops. Display create in particular writes to the DB and could be scripted to create thousands of displays.  
**Recommendation:** Add rate limits: display creation (10/min), profile update (20/min), tracker entry creation (60/min), collaborator invite (5/min).

---

### F-12 — Migration History: Manual Repair Leaves Drift Risk
**Severity:** Medium  
**Evidence:** `MEMORY.md` documents that `20260302000000_baseline` and `add_google_oauth` were manually marked applied via `prisma migrate resolve --applied` because they contained redundant DDL that would fail if run.  
**Why it matters:** The `_prisma_migrations` table shows these as applied, but the SQL they contain was never executed. If a new environment is provisioned using `prisma migrate deploy`, these migrations will run their DDL (which would fail on a fresh DB if their SQL is wrong) — or they'll be skipped if already marked applied in some other way. The migration history is not a reliable replay script.  
**Recommendation:** Audit both migration SQL files. If their DDL is wrong/redundant, replace them with corrected no-op stubs (just a comment) and document the change. Validate by running `prisma migrate deploy` against a clean test database before launch.

---

### F-13 — No API Versioning
**Severity:** Low  
**Evidence:** All routes live under `/api/[resource]` with no version prefix.  
**Why it matters:** Any breaking change to a public-facing API (display shape, auth cookie format, response schema) immediately breaks all existing clients (mobile, integrations). Today this is lower risk because there's only one client (the web app), but it's harder to add versioning retroactively.  
**Recommendation:** Not a launch blocker. Consider prefixing internal APIs as `/api/v1/` now so you can introduce `/api/v2/` without disruption later. At minimum, document the response shapes so breakages are caught.

---

### F-14 — `Display.kind` Used in Filter, Not Indexed
**Severity:** Low  
**Evidence:** `explore/route.ts` — `where: { kind: { not: 'profile' } }`. No `@@index([kind])` in schema.  
**Why it matters:** At small scale this is fine since `published` index narrows the result set significantly. At large scale, filtering `kind != 'profile'` without an index degrades.  
**Recommendation:** Add `@@index([kind])` or a composite `@@index([published, kind])` to `Display`.

---

### F-15 — `WaitlistEntry` Email Not Uniqueness-Constrained
**Severity:** Low  
**Evidence:** `prisma/schema.prisma` — `WaitlistEntry.email` has `@@index([email])` but no `@unique` constraint. Duplicate signups are possible.  
**Recommendation:** Add `@unique` to `WaitlistEntry.email` or de-duplicate at the API layer before inserting.

---

## Launch Blockers

| # | Severity | Finding |
|---|----------|---------|
| F-01 | **High** | Followers/following endpoints unbounded — DoS on large accounts |
| F-02 | **High** | Follow/unfollow: no rate limiting — spam/DB abuse vector |
| F-03 | **High** | Analytics view double-counting corrupts explore rankings |
| F-05 | **High** | Universal hard-delete cascade: no data recovery for users or admins |
| F-09 | **Medium** | `eventType` in analytics/track not validated — garbage written to DB |
| F-10 | **Medium** | Comment `content` not sanitized before storage — latent XSS risk |
| F-11 | **Medium** | Display create/update, profile, tracker-entries: no rate limits |

> F-05 (hard deletes) is flagged as a launch blocker because adding soft-delete after real user data accumulates is much harder. The others (F-01, F-02, F-03, F-09, F-10, F-11) are one-line to three-line fixes each.

---

## Severity Counts

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 3 (F-01, F-02, F-03) + F-05 (borderline High) |
| Medium | 7 (F-04, F-06, F-07, F-08, F-09, F-10, F-11, F-12) |
| Low | 3 (F-13, F-14, F-15) |

*Totals: 0 Critical / 4 High / 8 Medium / 3 Low*
