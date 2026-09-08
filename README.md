# Memento

A shared photo album for one wedding. Host creates the event, guests scan a QR code to
upload photos with no login, everyone sees the shared gallery. See
[specs/001-phase1-e2e-flow](specs/001-phase1-e2e-flow) for the full spec, plan, and tasks.

## Stack

Next.js (App Router) on Vercel, Postgres via `pg` (raw SQL, no ORM) hosted on Supabase,
Supabase Storage for photos (browser uploads directly via a presigned URL — the Next.js
server never receives photo bytes).

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values (never commit `.env.local`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres direct connection string, used by `pg` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, used only for Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key, used server-side to create signed upload URLs |
| `SUPABASE_STORAGE_BUCKET` | Name of the Storage bucket photos are uploaded into |
| `SESSION_SECRET` | Long random string used to sign the host PIN session cookie |

In production (Vercel), set these under Project Settings → Environment Variables — do not
hardcode them anywhere in the repo.

## Database setup

Run the migration in `db/migrations/001_init.sql` against your Supabase Postgres instance
(e.g., via the Supabase SQL editor or `psql "$DATABASE_URL" -f db/migrations/001_init.sql`)
before using the app. It creates the `events` and `photos` tables.

## Local development

```bash
npm install
npm run dev
```

## Deployment

Deployed on Vercel, connected to this repo's `main` branch, with auto-deploy on every push
(no separate staging environment — see the project constitution).
