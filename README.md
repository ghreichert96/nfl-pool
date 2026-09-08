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
