# NFL Pool Revamp: Current State and Plan

Prepared September 1, 2026 for `ghreichert96/nfl-pool` and Supabase project `hxxlievverolpsgkhxsi`.

## Executive decision

Rebuild the application as **Next.js + TypeScript on Vercel**, backed by **Supabase Postgres and Supabase Auth**. Preserve the useful identity and reference data. Replace the unfinished transactional schema rather than adapting it.

The existing Streamlit application was a prototype. The production pool ultimately ran in Google Sheets, so the empty picks, results, and standings tables carry no migration value. This substantially reduces risk.

## Confirmed 2026 product rules

- One person may own exactly one entry.
- New participants will receive fresh invitations; existing mock accounts are not production participants.
- Invitation and passwordless sign-in links are single-use and expire after 24 hours.
- Thursday at 8:00 PM `America/New_York` freezes a common betting-line slate for everyone.
- The line freeze does not lock picks. Each pick remains editable until its associated game starts.
- Picks become visible to competitors game-by-game at kickoff. Picks attached to later games remain hidden.
- A missing standard pick counts as a loss.
- A missing Best Bet counts as two losses because that selection occupies two of the ten weekly main-pool decisions.
- Main-pool pushes count as ties.
- The regular-season pool retains Main, Sudden Death, and Underdog formats.
- Sudden Death and Underdog each pay $200, split among tied winners where applicable.
- Sudden Death ends with the regular season and does not extend into playoff picks. Multiple survivors after Week 18 split the $200 pool.
- If every remaining Sudden Death player receives a second strike in the same week, those simultaneous eliminations are waived and the tied players continue the following week. If this occurs in Week 18, they split the $200 pool.
- The playoff pool initially follows the spreadsheet's 25/25/20/30 round-point format and listed ATS, O/U, bonus-chip, and Super Bowl prop weights.
- International, Thanksgiving, Christmas, and other nonstandard weeks require explicit week-level exceptions rather than hard-coded calendar branches.
- Weekly pool lines use a consensus across available sportsbooks, with an auditable commissioner override.
- Consensus includes all US-region sportsbooks returned by The Odds API by default. The commissioner may exclude a book if a concrete issue arises.
- When consensus is split, the selection process prefers an observed half-point line over a whole-number line to reduce pushes; the commissioner retains final override authority.
- The Admin pane exposes configurable weekly freeze time, eligible games, required ATS/O-U counts, and side-pool availability.
- Playoff bonus chips modify the value of a selected pick, similar to a Best Bet. They are optional; if omitted, the underlying picks score normally and no chip bonus is earned.
- Main-pool payout schedules are configurable per season in the Admin pane. Maximum win/loss values and rank payouts are data, not constants; ties average the payouts for occupied ranks.
- After enrollment closes, the system generates a symmetric payout table from participant count and the commissioner-selected maximum gain/loss. The commissioner may edit individual ranks before locking the schedule.

## Confirmed current state

### GitHub application

The repository is a small Python/Streamlit prototype with Supabase and The Odds API integrations. It has no README, committed database migrations, tests, releases, issues, or pull requests. Its last push was September 11, 2025.

The code contains incompatible assumptions about table names and columns, hard-coded 2025 dates, incomplete ATS scoring, unsafe pick-toggle behavior, incorrect admin/odds function calls, and inconsistent pick-type names. It should be treated as a behavioral reference rather than a codebase to extend.

### Live Supabase project

| Object             |  Rows | Disposition                                      |
| ------------------ | ----: | ------------------------------------------------ |
| `auth.users`       |     9 | Preserve                                         |
| `public.users`     |     8 | Migrate into profiles                            |
| `public.entries`   |     8 | Preserve identity/entry mapping only             |
| `public.nfl_teams` |    32 | Preserve after validation                        |
| `public.games`     | 1,587 | Archive as raw integration history               |
| `public.nfl_games` |   241 | Candidate historical game source                 |
| `public.spreads`   |   109 | Partial line history; archive/import selectively |
| `pick_submissions` |     0 | Replace                                          |
| `picks`            |     0 | Replace                                          |
| `results`          |     0 | Replace                                          |
| `standings`        |     0 | Replace                                          |
| `weekly_entries`   |     0 | Replace                                          |

Eight public user IDs match Supabase Auth directly. One Auth user has no public profile. All eight legacy entries map to public users through the older text `user_id` field.

### Security condition

This is the immediate risk:

- All 11 public tables have RLS disabled.
- There are no RLS policies.
- `anon` and `authenticated` have full table privileges, including `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE`.
- `public.users` contains email and phone fields.
- One empty Storage bucket exists and is public.

Enabling RLS alone is insufficient because RLS does not protect `TRUNCATE`. Broad grants must be revoked and replaced with explicit minimum privileges.

### Sports-data findings

`public.games` served as an integration dump from The Odds API, which explains its shape:

- 1,587 rows represent 523 distinct matchup keys.
- 1,064 rows are repeated versions.
- A matchup has as many as six stored versions.
- Records are split between `year = 2025` and `year = 2026`, even though January 2026 games belong to the 2025 NFL season.

This is useful raw ingestion history, but it is not a canonical games table.

`public.nfl_games` is cleaner:

- 241 unique game IDs
- no duplicate matchup keys
- 17 weeks of the 2025 season
- score/result columns exist but were not used by the pool

`public.spreads` contains 109 unique game IDs across eight late-season weeks. It can inform a line-snapshot migration but is incomplete.

The Odds API currently returns live/upcoming games with commence times, teams, bookmakers, and markets such as moneyline, spreads, and totals. Its event `id` should identify an external event; bookmaker/market updates should become timestamped snapshots rather than duplicate games.

Source: [The Odds API NFL documentation](https://the-odds-api.com/sports-odds-data/nfl-odds.html)

## Target architecture

### Application

- Next.js App Router
- TypeScript
- Vercel hosting
- Tailwind CSS; shadcn/ui if useful
- Zod for boundary/form validation
- Supabase Auth with server-side session handling
- Supabase-generated TypeScript database types
- Vitest for domain/scoring tests
- Playwright for login, picks, locking, and commissioner workflows
- GitHub Actions for CI
- Sentry for runtime error monitoring

### Database workflow

- Supabase CLI initialized in the repository
- Local Supabase stack for development
- Every schema change committed as a migration
- Deterministic seed data for teams, a sample season, games, and test entries
- Explicit grants and RLS policies in migrations
- A separate development environment before production cutover
- Production backup before any destructive cleanup

## Stack and tooling decision record

These are the working defaults for the rebuild. Versions should be selected from current stable releases during scaffolding, pinned exactly, and committed in the lockfile. Changing a decision later should require a concrete limitation rather than preference churn.

### Locked decisions

| Concern            | Decision                                                                                                         | Reason                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Language           | TypeScript in strict mode                                                                                        | Shared types across UI, server code, validation, and generated database definitions                                      |
| Web framework      | Next.js App Router                                                                                               | Strong fit for authenticated forms, server-rendered pages, server actions/routes, and Vercel                             |
| Runtime            | Current active Node.js LTS                                                                                       | Stable deployment and package compatibility                                                                              |
| Package manager    | pnpm                                                                                                             | Fast, deterministic installs with a committed `pnpm-lock.yaml`                                                           |
| Hosting            | Vercel                                                                                                           | Native Next.js deployment, preview environments, environment variables, and straightforward rollbacks                    |
| Database           | Supabase-managed Postgres                                                                                        | More than sufficient capacity; relational constraints and transactions suit pool rules                                   |
| Authentication     | Supabase Auth                                                                                                    | Fresh invitations with profiles referencing `auth.users.id`; the commissioner account is the initial tester              |
| Database client    | `@supabase/supabase-js` plus the current official server/SSR package                                             | Supported Auth/session and Data API path; generated database types                                                       |
| Schema management  | Supabase CLI migrations                                                                                          | Reproducible local, development, and production databases                                                                |
| Database access    | Supabase Data API for normal application access; narrowly scoped database functions for atomic domain operations | Keeps RLS authoritative while allowing transactional submission/scoring workflows                                        |
| ORM                | None initially                                                                                                   | Supabase already provides a typed client; an ORM would duplicate schema/type machinery without solving a current problem |
| Validation         | Zod                                                                                                              | One boundary schema can validate environment variables, forms, route payloads, and provider responses                    |
| Forms              | React Hook Form with Zod integration                                                                             | Explicit draft state, field errors, and reliable pick validation                                                         |
| Styling            | Tailwind CSS                                                                                                     | Fast responsive implementation with low runtime overhead                                                                 |
| Components         | shadcn/ui selectively                                                                                            | Accessible primitives that remain application-owned; avoid importing a large generic design system                       |
| Icons              | Lucide                                                                                                           | Consistent, small, and framework-friendly                                                                                |
| Dates/timezones    | `date-fns` with timezone support; store database timestamps as `timestamptz`                                     | Explicit `America/New_York` handling without hand-written date arithmetic                                                |
| Unit tests         | Vitest                                                                                                           | Fast TypeScript tests for scoring and validation                                                                         |
| Component tests    | Testing Library                                                                                                  | Tests user-visible behavior rather than component internals                                                              |
| End-to-end tests   | Playwright                                                                                                       | Covers Auth, draft/submission, lock deadlines, RLS-facing behavior, and commissioner workflows                           |
| Linting            | ESLint with Next.js and TypeScript rules                                                                         | Framework-aware correctness checks                                                                                       |
| Formatting         | Prettier                                                                                                         | Stable low-debate formatting                                                                                             |
| CI                 | GitHub Actions                                                                                                   | Existing repository integration; run install, types, lint, tests, build, and migration verification                      |
| Error monitoring   | Sentry                                                                                                           | Frontend/server errors with release and source-map context                                                               |
| Dependency updates | Dependabot or Renovate, one configured service                                                                   | Controlled update PRs rather than ambient upgrades                                                                       |

### Application boundaries

- Browser code uses the publishable Supabase key and operates under RLS.
- Server code verifies the current user; it does not treat a client-supplied user ID as authority.
- The Supabase secret/service-role key is limited to trusted ingestion and commissioner infrastructure where bypassing RLS is genuinely required.
- Sensitive multi-row writes such as weekly submission use one atomic database operation.
- Scoring logic lives in a pure TypeScript domain module with exhaustive fixtures. Database orchestration calls that module or implements a separately verified SQL equivalent; scoring rules are not scattered through React components.
- Provider payloads are retained only where useful for debugging. Canonical game and line records remain provider-independent.
- Server Components handle reads by default. Client Components are limited to interactive forms and live UI.

### State and data fetching

- Use URL parameters for shareable filters such as season and week.
- Use React Hook Form for unsaved pick state.
- Treat submitted database rows as authoritative server state.
- Avoid a global client-state library initially.
- Add TanStack Query only if measured client-side polling/realtime workflows justify it.
- Add Supabase Realtime only for a specific feature such as a live standings board; it is not part of the foundation.

### Odds integration

- Implement ingestion as a standalone TypeScript module that can run from the command line and CI.
- Schedule it with GitHub Actions initially because the repository already has scheduled-job history, manual dispatch is useful, and execution is independent of Vercel plan-specific cron frequency.
- Store `ODDS_API_KEY` and the trusted Supabase key as GitHub environment secrets.
- Use concurrency protection so two ingestion jobs cannot process the same window simultaneously.
- Persist the provider event ID, request timestamp, bookmaker, market, outcome, price, point, and provider update timestamp.
- Upsert canonical games; append odds snapshots; create frozen pool lines through a separate commissioner/freeze operation.
- Reevaluate Vercel Cron later if moving all scheduled work into the deployed application materially simplifies operations.

### Environments

| Environment                  | Purpose                                       | Data policy                                         |
| ---------------------------- | --------------------------------------------- | --------------------------------------------------- |
| Local Supabase               | Migration, RLS, and scoring development       | Synthetic seed data only                            |
| Supabase development project | Shared integration and Vercel preview testing | Synthetic or sanitized data                         |
| Existing production project  | Auth continuity and eventual live season      | Backed up before writes; no experimental migrations |

Vercel preview deployments should use the development Supabase project. Pull requests must never point at production by default.

### Repository layout

```text
app/                    Next.js routes and layouts
components/             Reusable application UI
features/               Pool, picks, standings, and commissioner modules
lib/auth/               Supabase session and authorization helpers
lib/db/                 Generated types and database clients
lib/domain/             Pure rules, validation, locking, and scoring
lib/odds/               The Odds API client and normalization
scripts/                Ingestion and controlled maintenance commands
supabase/config.toml     Local Supabase configuration
supabase/migrations/     Reviewed SQL migration chain
supabase/seed.sql        Deterministic development fixtures
tests/                   Shared fixtures and integration tests
e2e/                     Playwright tests
docs/                    Architecture, runbooks, and rule decisions
```

### Explicitly deferred

- Realtime standings
- Push/SMS/email reminders
- Native mobile application
- Payments or automated settlement
- Multiple odds providers
- An ORM
- Redis or another cache
- Microservices
- Event queues
- Historical analytics beyond the pool's operational needs

The architecture leaves room for these without making them launch dependencies.

### Pre-commit and CI gates

Every pull request should pass:

1. frozen-lockfile install;
2. TypeScript typecheck;
3. ESLint;
4. formatting check;
5. unit/component tests;
6. local Supabase migration reset from zero;
7. generated database-type drift check;
8. RLS/integration tests;
9. production Next.js build;
10. Playwright smoke tests for release candidates.

### Proposed domain model

The exact names can change during design, but the responsibilities should remain distinct.

| Table                         | Responsibility                                                 |
| ----------------------------- | -------------------------------------------------------------- |
| `profiles`                    | One protected profile per Auth user                            |
| `roles` or `pool_memberships` | Commissioner/admin/member authorization                        |
| `pools`                       | Pool configuration and timezone                                |
| `seasons`                     | NFL season identity and scheduling boundaries                  |
| `pool_entries`                | A user's named entry in one pool/season                        |
| `teams`                       | Stable NFL team reference data                                 |
| `games`                       | One canonical row per NFL event                                |
| `odds_snapshots`              | Timestamped bookmaker/market observations                      |
| `pool_lines`                  | The exact commissioner-selected/frozen spread and total        |
| `weekly_submissions`          | Draft/submitted/locked state for an entry and week             |
| `picks`                       | One normalized pick per game/market/type                       |
| `game_results`                | Final scores and derived market outcomes                       |
| `score_events`                | Deterministic scoring output/audit trail                       |
| `payout_schedules`            | Commissioner-configured seasonal rank payouts and tie behavior |

Standings should initially be derived from score events through security-invoker views or queries. Persisted standings are only justified later if measured performance requires them.

## Important modeling rules

- Use an explicit NFL `season_year`; January playoff/Week 18 dates must not redefine the season.
- Store all game times as `timestamptz`; render and enforce pool rules in `America/New_York`.
- A game exists once. Odds observations are immutable snapshots attached to it.
- Store both sides of a spread or use a consistent signed convention with the favored team explicit.
- A frozen pool line is separate from live bookmaker data and never changes retroactively.
- Picks reference the frozen line used for scoring.
- Submission deadlines and ownership must be enforced server-side and in Postgres, not only in React.
- Database constraints must enforce one weekly submission, valid pick types, pick limits, one Best Bet, and relevant uniqueness.
- Scoring must be deterministic and safe to rerun.
- Commissioner actions need an audit trail.

## Security model

- `profiles.id` references `auth.users.id`.
- Users can read/update only permitted profile fields.
- Members can edit only their own unlocked submissions and picks.
- Pool visibility is governed through membership.
- Commissioner operations are verified server-side against protected role data.
- Authorization must not depend on user-editable metadata.
- Service-role/secret keys stay server-side.
- Every table exposed through the Data API has RLS enabled.
- Views exposed to clients use `security_invoker = true`.
- `anon` receives only intentionally public read access, if any.
- `TRUNCATE`, `TRIGGER`, and broad schema privileges are revoked from client roles.

## Odds ingestion strategy

1. Fetch `americanfootball_nfl` events with the required `spreads`, `totals`, and possibly `h2h` markets.
2. Upsert one canonical game by provider plus external event ID.
3. Append bookmaker market observations to `odds_snapshots`; never create another game row for an odds update.
4. Run a deterministic consensus-line calculation across all available US-region sportsbooks for the commissioner board, preferring an observed half-point when an otherwise tied consensus would select a whole number.
5. Permit the commissioner to override every proposed line before freezing it; record the proposed value, final value, actor, time, and reason.
6. At the weekly freeze time, create immutable `pool_lines` records.
   - If no current line is available, use the most recent valid consensus and visibly flag the line for commissioner review.
7. Continue updating live odds separately without altering frozen lines.
8. Record API request metadata and quota headers for monitoring.

The scheduler can be Vercel Cron or GitHub Actions. The job should run in UTC while application logic decides the relevant New York time, avoiding daylight-saving drift.

## Migration approach

### Preserve before changing anything

1. Export a full database backup.
2. Export Auth/user linkage metadata without placing personal data in Git.
3. Export the 32 teams and validate abbreviations.
4. Export `nfl_games`, `spreads`, and the raw `games` dump to a private archive.
5. Record current grants, constraints, and schema definitions.

### Contain the legacy schema

Create a reviewed security migration that revokes broad client grants and enables RLS. Because this could break the abandoned Streamlit app, treat the app as intentionally offline after containment.

### Build cleanly

Prefer creating the new schema locally and in a separate Supabase development project. After verification, choose between:

- deploying the new schema into the existing project to retain Auth users; or
- creating a clean production project and inviting/migrating the small user group.

Keeping the existing production project is reasonable because eight Auth relationships are intact, but only after its current exposure is contained.

## Tomorrow: first working session

### Objective

End the session with a safe branch, reproducible local stack, preserved legacy inventory, and an approved v2 schema draft. Avoid UI implementation until those foundations exist.

### Checklist

1. Create branch `revamp/2026-foundation` from `main`.
2. Add this plan to the repository as `README.md` or `docs/revamp-plan.md`.
3. Scaffold the Next.js TypeScript application and commit a lockfile.
4. Initialize the Supabase CLI and inspect its current command help/version.
5. Create or select a separate Supabase development project.
6. Take/export the production backup before any write.
7. Draft the containment migration for the legacy project; review before applying.
8. Draft the initial v2 schema and RLS policies locally.
9. Add seed data for teams, one sample week, and multiple test users/roles.
10. Add schema-reset, generated-types, unit-test, and lint commands.
11. Verify a full local `db reset` from migrations and seed data.
12. Decide the exact 2026 rules and freeze policy before implementing scoring.

### Decisions needed from the commissioner

- Confirm whether playoff bonus chips are mandatory or optional and how a missed chip is scored.
- Confirm the approved Super Bowl prop source and how eligible `-110 or better` props are selected and frozen.
- Choose the initial 2026 main-pool payout curve/max after participant count is known.
- Should prior-season standings remain visible, even though 2025 picks were kept in Google Sheets?

## Definition of season-ready

The application is ready when:

- a user can register/sign in and has exactly the authorized pool access;
- the commissioner can ingest games and freeze auditable lines;
- a member can save, validate, submit, and revise allowed picks;
- locks are enforced server-side at the correct time;
- every scoring rule has passing unit tests, including pushes and edge cases;
- game results can be entered/imported and scoring safely rerun;
- weekly and season standings reconcile with the scoring audit trail;
- RLS tests prove one user cannot read or alter another user's protected data;
- migrations can recreate the database from zero;
- CI, monitoring, secrets, backup, and recovery procedures are documented.

## Recommended immediate next move

Tomorrow, create `revamp/2026-foundation`, preserve this document in the repository, and build the local Supabase migration baseline. The first production write should be the separately reviewed containment migration—not schema cleanup performed manually in the dashboard.
