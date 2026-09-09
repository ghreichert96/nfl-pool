alter table public.game_results
  add column provider_updated_at timestamptz;

alter table public.games
  add column score_provider_updated_at timestamptz;

create table public.score_ingestion_runs (
  id bigint generated always as identity primary key,
  week_id bigint references public.pool_weeks (id) on delete set null,
  mode text not null check (mode in ('live', 'reconcile')),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'partial', 'skipped', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  events_received integer not null default 0,
  games_updated integer not null default 0,
  games_finalized integer not null default 0,
  quota_used integer,
  quota_remaining integer,
  skip_reason text,
  error_message text
);

create index score_ingestion_runs_week_requested_idx
  on public.score_ingestion_runs (week_id, requested_at desc);

alter table public.score_ingestion_runs enable row level security;

revoke all on table public.score_ingestion_runs from anon, authenticated;
grant select on table public.score_ingestion_runs to authenticated;

create policy score_ingestion_runs_select_for_commissioners
on public.score_ingestion_runs for select to authenticated
using (
  week_id is not null and exists (
    select 1
    from public.pool_weeks as week
    join public.seasons as season on season.id = week.season_id
    where week.id = score_ingestion_runs.week_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
);
