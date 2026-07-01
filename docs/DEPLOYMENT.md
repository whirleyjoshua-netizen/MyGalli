# My Galli — Production Deployment

**Live:** https://mygalli.com — Vercel project `my-galli` (team `kollabshare` / CAC),
git-connected to `github.com/whirleyjoshua-netizen/MyGalli` (auto-deploys `main`).

Build: `prisma migrate deploy && next build` (see `vercel.json`). Migrations run on
Neon via `directUrl` (`DATABASE_URL_UNPOOLED`), since the pooled `DATABASE_URL`
(pgbouncer) can't run migrations.

## Status (2026-07-01)

Fully live and verified: DB up (`/api/health`), security headers active (CSP, HSTS,
nosniff, Referrer-Policy, Permissions-Policy), sitemap/robots/OG image serving,
uploads (Vercel Blob) and Redis rate-limiting wired. See "Pending" for optional adds.

## Environment variables

Set in Vercel → Project `my-galli` → Settings → Environment Variables (Production + Preview).

### Required — all set ✅
| Var | Notes |
|-----|-------|
| `DATABASE_URL` | Neon pooled (app queries) |
| `DATABASE_URL_UNPOOLED` | Neon direct (Prisma migrations, `directUrl`) |
| `JWT_SECRET` | long random; app rejects the placeholder |
| `NEXT_PUBLIC_APP_URL` | `https://mygalli.com` (canonical URLs, sitemap, share links) |
| Vercel Blob | injected as `BLOB1_READ_WRITE_TOKEN` (prefix collision) — auto-detected, see below |
| Vercel KV/Redis | injected as `KV_REST_API_URL` / `KV_REST_API_TOKEN` — auto-detected, see below |

`NODE_ENV` is set by Vercel automatically.

### Storage / rate-limit var-name resolution
Vercel's Blob and KV integrations inject credentials under names that differ from the
app's canonical ones, and they're marked **Sensitive** (values can't be pulled to
re-alias). `src/lib/storage-env.ts` resolves both:
- **Redis:** `UPSTASH_REDIS_REST_URL/TOKEN` → falls back to `KV_REST_API_URL/TOKEN`.
- **Blob:** `BLOB_READ_WRITE_TOKEN` → else any `*_READ_WRITE_TOKEN` whose value starts
  with `vercel_blob_rw_` (handles the `BLOB1_` prefix). `upload/route.ts` passes the
  token explicitly to `put()`.

### Optional — to add next (any new var requires a redeploy to take effect)
| Var | Enables | How |
|-----|---------|-----|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google sign-in (button + server verify). **No client secret needed** — ID-token flow checks `aud`. | Google Cloud Console → OAuth Web client. Add `https://mygalli.com` to **Authorized JavaScript origins**. It's a `NEXT_PUBLIC_` var → **must redeploy** after setting. |
| `RESEND_API_KEY` + `EMAIL_FROM` | Real verification/reset emails (else they log to server console) | resend.com API key; verify a sending domain (default `onboarding@resend.dev` only delivers to the Resend account owner). `EMAIL_FROM` e.g. `My Galli <noreply@mygalli.com>`. |
| `ANTHROPIC_API_KEY` | AI page generation (`/api/generate`) | optional feature only |

## Post-launch verification checklist (browser)
- [ ] Sign up, then **upload a cover image** → confirms Blob works end-to-end.
- [ ] Open a page with an **embed / iframe card** → confirms CSP `frame-src`/`img-src`.
- [ ] DevTools console clean (no `Refused to…`). If blocked, patch CSP in `next.config.js`.
- [ ] (After adding Google client ID + redeploy) Google sign-in round-trips.

## Redeploy
Any push to `main` auto-deploys. Manual: `vercel --prod` (or redeploy latest in the
dashboard). Adding/changing env vars needs a redeploy to take effect.
