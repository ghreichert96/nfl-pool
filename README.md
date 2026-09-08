# HPPP NFL Pool

Rebuild of the pool application for the 2026 NFL season. The foundation is Next.js, TypeScript, Tailwind CSS, Vercel, and Supabase.

The product and migration plan is in [`docs/revamp-plan.md`](docs/revamp-plan.md).

## Local setup

Requirements:

- Node.js 24+
- pnpm 11+
- Docker-compatible local runtime for the Supabase stack

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Run all foundation checks with `pnpm check`.

Start and verify the local database:

```bash
pnpm db:start
pnpm db:migrate
pnpm db:test
pnpm db:lint
```

`pnpm db:reset` is destructive: it recreates the local database and reapplies seed data. Use it only when you intentionally want a clean local fixture. For normal work, use `pnpm db:migrate`; use `pnpm db:restart` when Supabase configuration changes need a service restart.

The first migration creates five application tables: profiles, pools, pool memberships, seasons, and pool entries. Local seed data creates HPPP, its 2026 season, and a commissioner fixture for local authentication.

## Development policy

- Database changes use versioned migrations.
- The live Supabase project remains untouched until migrations, row-level security, and rollback procedures are verified locally.
- Secrets belong in local or deployment environment variables and must never be committed.

## Week simulator

Commissioners can open `/admin/test-lab` during local development to generate 12
dummy entries and an eight-game slate. The stage controls move games through
pre-freeze, Thursday, Sunday, and final states using the real visibility and
scoring behavior. Reset or delete the fixture from the same page. Production
access requires the explicit `ENABLE_TEST_LAB=true` environment variable.

## Odds intake

Set `ODDS_API_KEY` in `.env.local` and in the Vercel project environment. The
Admin pane can refresh the active week's NFL spreads and totals before its lines
are frozen. Each refresh retains bookmaker snapshots, consensus lines, quota
information, and an audit record.

Scheduled refreshes use `.github/workflows/odds-ingestion.yml`. Configure these
GitHub Actions secrets:

- `ODDS_INGEST_URL`: the deployed Vercel origin, without a trailing slash
- `CRON_SECRET`: a random bearer token

Set the same `CRON_SECRET` in Vercel. The Odds API key remains only in Vercel;
the scheduled request never sends it through GitHub Actions.

## Entrant onboarding

Commissioners invite entrants with an email address and E.164 phone number from
`/admin`. Invitations remain pending for seven days and can be resent or revoked
from `/admin/entrants`. Entrants choose their entry abbreviation and password
after following the email invitation. Login accepts either email or the active
entry abbreviation. SMS login is intentionally deferred; phone numbers remain
private to the entrant and commissioner.

Commissioners can edit public rule-section copy at `/admin/manage`. Scoring
tables and scoring behavior remain code-controlled.
