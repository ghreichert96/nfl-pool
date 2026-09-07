alter table public.pool_weeks
  add column lines_frozen_at timestamptz,
  add column lines_frozen_by uuid references auth.users (id) on delete set null;

alter table public.pool_lines
  add column updated_at timestamptz not null default now();

create trigger pool_lines_set_updated_at
before update on public.pool_lines
for each row execute function private.set_updated_at();

create table public.odds_ingestion_runs (
  id bigint generated always as identity primary key,
  week_id bigint references public.pool_weeks (id) on delete set null,
  trigger_source text not null check (trigger_source in ('scheduled', 'commissioner')),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  requested_by uuid references auth.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  events_received integer,
  snapshots_written integer,
  quota_remaining integer,
  error_message text
);

create table public.odds_snapshots (
  id bigint generated always as identity primary key,
  run_id bigint not null references public.odds_ingestion_runs (id) on delete cascade,
  game_id bigint not null references public.games (id) on delete cascade,
  provider_event_id text not null,
  bookmaker_key text not null,
  bookmaker_name text not null,
  market text not null check (market in ('spreads', 'totals')),
  outcome_name text not null,
  point numeric(5,1) not null,
  price integer,
  provider_updated_at timestamptz,
  observed_at timestamptz not null default now(),
  unique (run_id, game_id, bookmaker_key, market, outcome_name)
);

create index odds_snapshots_game_observed_idx
  on public.odds_snapshots (game_id, observed_at desc);

create table public.line_audit_events (
  id bigint generated always as identity primary key,
  week_id bigint not null references public.pool_weeks (id) on delete cascade,
  game_id bigint references public.games (id) on delete cascade,
  event_type text not null
    check (event_type in ('line_changed', 'freeze', 'unfreeze', 'refresh')),
  source text not null check (source in ('consensus', 'commissioner', 'system')),
  previous_away_spread numeric(4,1),
  new_away_spread numeric(4,1),
  previous_total numeric(4,1),
  new_total numeric(4,1),
  was_frozen boolean not null default false,
  actor_id uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index line_audit_week_created_idx
  on public.line_audit_events (week_id, created_at desc);

alter table public.odds_ingestion_runs enable row level security;
alter table public.odds_snapshots enable row level security;
alter table public.line_audit_events enable row level security;

revoke all on table public.odds_ingestion_runs from anon, authenticated;
revoke all on table public.odds_snapshots from anon, authenticated;
revoke all on table public.line_audit_events from anon, authenticated;

grant select on table public.odds_ingestion_runs to authenticated;
grant select on table public.odds_snapshots to authenticated;
grant select (
  id, week_id, game_id, event_type, source,
  previous_away_spread, new_away_spread,
  previous_total, new_total, was_frozen, note, created_at
) on table public.line_audit_events to authenticated;

create policy ingestion_runs_select_for_commissioners
on public.odds_ingestion_runs for select to authenticated
using (
  week_id is not null and exists (
    select 1
    from public.pool_weeks as week
    join public.seasons as season on season.id = week.season_id
    where week.id = odds_ingestion_runs.week_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
);

create policy odds_snapshots_select_for_commissioners
on public.odds_snapshots for select to authenticated
using (
  exists (
    select 1
    from public.games as game
    join public.pool_weeks as week on week.id = game.week_id
    join public.seasons as season on season.id = week.season_id
    where game.id = odds_snapshots.game_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
);

create policy line_audit_select_for_members
on public.line_audit_events for select to authenticated
using (
  exists (
    select 1
    from public.pool_weeks as week
    join public.seasons as season on season.id = week.season_id
    where week.id = line_audit_events.week_id
      and (select private.is_pool_member(season.pool_id))
  )
);

create or replace function private.audit_pool_line_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_week_id bigint;
  frozen boolean;
begin
  select game.week_id, week.lines_frozen_at is not null
  into target_week_id, frozen
  from public.games as game
  join public.pool_weeks as week on week.id = game.week_id
  where game.id = new.game_id;

  if tg_op = 'INSERT'
    or old.away_spread is distinct from new.away_spread
    or old.total is distinct from new.total
  then
    insert into public.line_audit_events (
      week_id, game_id, event_type, source,
      previous_away_spread, new_away_spread,
      previous_total, new_total, was_frozen, actor_id, note
    ) values (
      target_week_id, new.game_id, 'line_changed', new.source,
      case when tg_op = 'UPDATE' then old.away_spread end, new.away_spread,
      case when tg_op = 'UPDATE' then old.total end, new.total,
      frozen, (select auth.uid()), new.override_reason
    );
  end if;
  return new;
end;
$$;

revoke all on function private.audit_pool_line_change() from public;

create trigger pool_lines_audit_change
after insert or update on public.pool_lines
for each row execute function private.audit_pool_line_change();

create or replace function public.set_week_lines_frozen(
  target_week_id bigint,
  should_freeze boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_pool_id bigint;
  currently_frozen boolean;
begin
  select season.pool_id, week.lines_frozen_at is not null
  into target_pool_id, currently_frozen
  from public.pool_weeks as week
  join public.seasons as season on season.id = week.season_id
  where week.id = target_week_id;

  if target_pool_id is null
    or not (select private.is_pool_commissioner(target_pool_id))
  then
    raise exception 'Commissioner access required';
  end if;
  if currently_frozen = should_freeze then return; end if;

  update public.pool_weeks
  set lines_frozen_at = case when should_freeze then now() else null end,
      lines_frozen_by = case when should_freeze then (select auth.uid()) else null end
  where id = target_week_id;

  insert into public.line_audit_events (
    week_id, event_type, source, was_frozen, actor_id
  ) values (
    target_week_id,
    case when should_freeze then 'freeze' else 'unfreeze' end,
    'commissioner',
    currently_frozen,
    (select auth.uid())
  );
end;
$$;

revoke all on function public.set_week_lines_frozen(bigint, boolean)
  from public, anon;
grant execute on function public.set_week_lines_frozen(bigint, boolean)
  to authenticated;
