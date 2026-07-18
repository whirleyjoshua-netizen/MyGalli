# Action required from Joshua — Workspaces Sub-project E (AI filter)

Three things I can't do from here. **Items 1 and 3 both gate merge.**

---

## 3. Your local `ANTHROPIC_API_KEY` is dead — and it's the last unproven thing (blocks merge)

**Status:** the browser/API smoke passed on everything that touches the database. The filter queries were run against real Postgres and are proven: numeric comparison is genuinely numeric (`fee > 1200` correctly excludes the 900 record — a lexicographic bug would have included it), dates work, row order is right, the count is a true total, and malformed page params no longer 500.

**The one thing still unproven is the live Anthropic request.** When I called `filter-suggest` for real, it came back:

```
401 {"type":"error","error":{"type":"authentication_error","message":"API key is invalid."}}
```

The key in your local `.env` has a valid shape (`sk-ant-…`, 108 chars) but Anthropic rejects it — expired, rotated, or revoked. Your notes do say to rotate anything pasted into chat, so this is likely intentional.

**Why this matters.** The request failed at *authentication*, which happens **before** Anthropic validates the request body. So this tells us nothing about whether our `output_config` / `json_schema` payload is actually accepted. Every test mocks the SDK, so **no test can prove it either.** This is the single remaining "works in tests, might 400 in production" risk in E — and it's exactly the class of bug that made me change the schema from a type-array to `anyOf` earlier.

### Steps

Put a working key in the worktree's env so I can make one real call (one call, a few cents):

1. Get a valid key from the Anthropic Console, or copy the one already working in Vercel prod (`my-galli` → Settings → Environment Variables → `ANTHROPIC_API_KEY`).
2. Edit **`C:\Users\whirl\pages-mvp\.claude\worktrees\e-ai-filter\.env`** and set:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   (That file is gitignored — it will not be committed. Don't paste the key into chat; just save it to the file and tell me it's in.)
3. Tell me "key is in" and I'll run the live call and report exactly what Anthropic says.

**If you'd rather not**, say so and I'll note in the PR that the live request shape is unverified, with the specific failure mode to watch for on first production use (a 400 from Anthropic on the request body).

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
