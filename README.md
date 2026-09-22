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

### Ingestion schedule (Eastern time)

| Job                               | Schedule                                                           | Scheduler         |
| --------------------------------- | ------------------------------------------------------------------ | ----------------- |
| Initialize upcoming week          | Sunday noon, before that week's games                              | GitHub Actions    |
| Refresh open odds                 | Monday 2 a.m.; Tuesday and Wednesday 8 p.m.                        | GitHub Actions    |
| Default week rollover             | Tuesday 2 a.m.                                                     | Application clock |
| Final odds refresh and board lock | Thursday 8 p.m.                                                    | GitHub Actions    |
| ESPN live scores/status           | Every 2 minutes while games are eligible                           | Supabase Cron     |
| Final-score validation            | After each slate; eligibility checked hourly at :01, :16, :31, :46 | Supabase Cron     |
| Unresolved-score reconciliation   | Midnight Monday night / Tuesday morning                            | Supabase Cron     |

GitHub odds schedules use `America/New_York` to follow daylight saving time.
The triggering cron expression selects initialize, refresh, or finalize even when
GitHub starts a run late. GitHub schedules are best effort, not exact-time guarantees.
The final refresh applies eligible consensus lines and locks the board in one
transaction. Earlier game-specific locks remain in force; missing consensus
prevents the lock and reports a failure. Deploy the database migration before
activating the `finalize` workflow mode.

The week switches by request time, independently of ingestion, at Tuesday 2 a.m.
Entrants may explicitly select the newly published week before the rollover.
The GitHub score workflow is manual-only; automated scores use Supabase Cron.
Midnight reconciliation uses paired UTC slots with an Eastern-time gate in SQL,
so only one request is queued in either EDT or EST.

ESPN skips provider calls when no eligible games are active. Validation becomes
eligible 10 minutes after ESPN detects a final, waits for games in the same
kickoff slate (up to 45 minutes to tolerate a stalled feed), and backs off failed
provider checks. Reconciliation requests three days of results to include Sunday.
A Monday game still running at midnight is handled by subsequent slate validation.
Cron success records queueing; HTTP and ingestion results indicate application success.

Commissioners can initialize a week, refresh odds, run a final refresh and lock,
freeze/unfreeze, and edit individual lines in `/admin/lines`. `/admin` provides
ESPN refresh, final validation, reconciliation, score corrections, and release of
manual score overrides back to provider control. Automation preserves commissioner
score overrides. No provider request is required just to switch the default week.
