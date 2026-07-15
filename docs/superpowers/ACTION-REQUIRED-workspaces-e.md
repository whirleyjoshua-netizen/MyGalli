# Action required from Joshua — Workspaces Sub-project E (AI filter)

Two things I can't do from here. Neither blocks me writing the fixes — I'm proceeding — but **item 1 decides whether E is safe to merge at all.**

---

## 1. Is the rate limiter real in production? (blocks merge)

**Why this matters.** `POST /api/workspaces/[id]/filter-suggest` calls `claude-opus-4-8` on your `ANTHROPIC_API_KEY`. We agreed E ships **free and ungated**, so the rate limiter is the *only* thing between a signed-in user and your API bill.

`src/lib/rate-limit.ts` tries Upstash/KV first and **silently falls back to an in-memory `Map`** if it isn't configured. On Vercel that fallback is not a rate limit: it resets on every cold start, and every concurrent lambda instance gets its own fresh budget. Ten requests/minute becomes effectively unlimited.

Good news: the code already handles your non-canonical Vercel env naming — `src/lib/storage-env.ts` resolves **either** `UPSTASH_REDIS_REST_URL` **or** `KV_REST_API_URL`. So we only need to know whether **one of them exists** in prod.

### Steps

1. Go to the Vercel dashboard → team **kollabshare** → project **my-galli**
2. **Settings → Environment Variables**
3. Search for each of these and note whether it exists for the **Production** environment:
   - `UPSTASH_REDIS_REST_URL`
   - `KV_REST_API_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `KV_REST_API_TOKEN`

Note: these may appear under Vercel's "Sensitive" naming from a storage integration — that's fine, the code checks both names. You're only confirming presence.

### Then tell me one of:

- **"KV is set in prod"** → the limiter is real. I'll still re-key it from IP to `user.id` (a per-IP cap lets one account hammer it from several networks), and we're good to merge.
- **"KV is NOT set in prod"** → the limiter is a no-op in prod. **Do not merge E to a deployed main until we fix this.** Options, cheapest first:
  1. Add an Upstash Redis integration to the project (Marketplace → Upstash → connect; it injects the vars automatically). Nothing in the code changes.
  2. I gate `filter-suggest` behind `isPro()` so the blast radius is paid accounts only.
  3. I add a hard per-user daily cap persisted in Postgres (no new infra, but a schema change).

---

## 2. Design decision: what should "Add row" do on a filtered view? (not blocking)

**The situation.** On a view filtered to `Sport is Soccer · 4 matching`, clicking **+ Add row** creates a blank record. It has no sport, so the filter excludes it — but the UI optimistically shows it anyway and the chip flips to "5 matching". On reload the row vanishes. The record *is* in the database; it just isn't in this view. It reads like data loss.

This isn't really a bug — it's an unanswered product question. Pick one:

- **(a) Don't show it.** Add the row, tell the user "Added — it doesn't match this view's filter", don't render it. Honest, mildly annoying.
- **(b) Prefill from the filter.** A view filtered to `Sport is Soccer` creates the row with `sport: "Soccer"` prefilled, so it *does* match and stays visible. Feels magical; only works for `eq` conditions (not `>`, `contains`).
- **(c) Hide the button.** No adding rows on a filtered view; switch to an unfiltered view to add. Simplest, most restrictive.
- **(d) Ship as-is**, log it as a known follow-up.

I lean **(b) with an (a) fallback** — prefill what the filter pins via `eq`, and if the row still doesn't match, say so instead of showing a ghost row. But this is your product call, not mine.

---

## What I'm doing meanwhile

Fixing, without waiting on you:
- Row order regression (`createdAt: desc` in the per-view endpoint vs `asc` in the main GET — every existing grid silently flips)
- "N matching" showing the page length instead of the real total (wrong past 100 records)
- Date filters accepting `07/01/2026` and matching every row while the chip looks correct
- Wiring the filter's **remove** action (spec required it; the prop exists but was never passed)
- Unclamped `page`/`pageSize` on the newly-activated endpoint (`?pageSize=abc` → 500)
- Dropping the `as any` casts that disable the only type check on the Anthropic request

Deferring to follow-ups: case-sensitive `contains`, `neq` semantics for empty fields, a modal nit.

After that: the browser smoke, which is load-bearing — Prisma is mocked in every test, so **no filter query has ever actually touched Postgres**.
