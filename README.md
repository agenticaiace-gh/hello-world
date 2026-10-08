# hello-world (CRUD)

A small CRUD Hello World on Cloudflare Workers + Supabase.

- Live: https://hello-world.agenticaiace.workers.dev
- Worker: `src/index.js` (serves the page and `/api/messages`)
- Page: `src/index.html` (imported as a text module)
- Database: Supabase project `hello-world-crud`, table `public.messages`
- Migration: `supabase/migrations/20261008000000_create_messages.sql`

## API

| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/api/messages` | — | Newest first |
| POST | `/api/messages` | `{ "content": "…" }` | 1–40 characters |
| PUT | `/api/messages/:id` | `{ "content": "…" }` | Update |
| DELETE | `/api/messages/:id` | — | Delete |

The browser only talks to the Worker. The Worker talks to Supabase with secrets
`SUPABASE_URL` and `SUPABASE_KEY` (publishable/anon key). RLS is on; policies
allow demo-level read/write on this one table.

## Secrets

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
```

## Deploys

GitHub Actions (`.github/workflows/deploy.yml`) runs `wrangler deploy` on every
push/merge to `main` (and on manual "Run workflow"). It needs two repo secrets:

- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with Workers Scripts edit access
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID

If the token secret is missing, the workflow skips the deploy with a warning.
`wrangler deploy` keeps the Worker secrets already set on Cloudflare.

Local: `npx wrangler dev` (put the same secrets in `.dev.vars`). Wrangler 4 needs Node 22+.

## Deploys

Every merge to `main` deploys automatically to https://hello-world.agenticaiace.workers.dev through GitHub Actions.
