create table public.weekly_comments (
  entry_id bigint not null references public.pool_entries (id) on delete cascade,
  week_id bigint not null references public.pool_weeks (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (entry_id, week_id)
);

create table public.game_results (
  game_id bigint primary key references public.games (id) on delete cascade,
  away_score smallint not null check (away_score >= 0),
  home_score smallint not null check (home_score >= 0),
  ats_winner text references public.teams (abbreviation),
  total_winner text check (total_winner in ('over', 'under')),
  outright_winner text references public.teams (abbreviation),
  source text not null default 'commissioner' check (source in ('commissioner', 'provider')),
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_at timestamptz not null default now(),
  corrected_at timestamptz
);

create table public.score_events (
  id bigint generated always as identity primary key,
  entry_id bigint not null references public.pool_entries (id) on delete cascade,
  week_id bigint not null references public.pool_weeks (id) on delete cascade,
  game_id bigint references public.games (id) on delete cascade,
  pick_id bigint references public.picks (id) on delete cascade,
  kind text not null check (kind in ('ats', 'total', 'best_bet', 'sudden_death', 'underdog', 'missing')),
  outcome text not null check (outcome in ('win', 'loss', 'tie', 'pending')),
  decision_value numeric(6,2) not null default 0,
  strike_delta smallint not null default 0,
  scoring_revision integer not null default 1 check (scoring_revision > 0),
  created_at timestamptz not null default now(),
  unique nulls not distinct (entry_id, week_id, game_id, pick_id, kind, scoring_revision)
);

create table public.payout_schedules (
  season_id bigint not null references public.seasons (id) on delete cascade,
  rank smallint not null check (rank > 0),
  amount numeric(9,2) not null,
  locked_at timestamptz,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (season_id, rank)
);

create table public.commissioner_audit_events (
  id bigint generated always as identity primary key,
  pool_id bigint not null references public.pools (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index score_events_entry_week_idx on public.score_events (entry_id, week_id);
create index audit_events_pool_created_idx on public.commissioner_audit_events (pool_id, created_at desc);

create trigger weekly_comments_set_updated_at before update on public.weekly_comments
for each row execute function private.set_updated_at();
create trigger payout_schedules_set_updated_at before update on public.payout_schedules
for each row execute function private.set_updated_at();

create or replace function private.comment_is_editable(target_entry_id bigint, target_week_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pool_entries entry
    join public.pool_weeks week on week.season_id = entry.season_id
    where entry.id = target_entry_id and week.id = target_week_id
      and entry.user_id = (select auth.uid())
      and exists (select 1 from public.games game where game.week_id = week.id and game.kickoff_at > now())
  );
$$;

create or replace function private.prevent_sd_team_reuse()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_entry bigint; target_week_number smallint; target_season bigint;
begin
  if new.kind <> 'sudden_death' then return new; end if;
  select submission.entry_id, week.week_number, week.season_id
    into target_entry, target_week_number, target_season
  from public.weekly_submissions submission
  join public.pool_weeks week on week.id = submission.week_id
  where submission.id = new.submission_id;
  if exists (
    select 1 from public.picks old_pick
    join public.weekly_submissions old_submission on old_submission.id = old_pick.submission_id
    join public.pool_weeks old_week on old_week.id = old_submission.week_id
    join public.games old_game on old_game.id = old_pick.game_id
    where old_submission.entry_id = target_entry and old_week.season_id = target_season
      and old_week.week_number < target_week_number and old_pick.kind = 'sudden_death'
      and old_pick.team = new.team and old_game.kickoff_at <= now()
      and old_submission.id = (select private.latest_submission_id(target_entry, old_week.id))
  ) then raise exception 'Sudden Death team has already been used'; end if;
  return new;
end;
$$;

create trigger picks_prevent_sd_team_reuse before insert on public.picks
for each row execute function private.prevent_sd_team_reuse();

alter table public.weekly_comments enable row level security;
alter table public.game_results enable row level security;
alter table public.score_events enable row level security;
alter table public.payout_schedules enable row level security;
alter table public.commissioner_audit_events enable row level security;

revoke all on table public.weekly_comments, public.game_results, public.score_events,
  public.payout_schedules, public.commissioner_audit_events from anon, authenticated;
grant select, insert, update, delete on public.weekly_comments to authenticated;
grant select on public.game_results, public.score_events, public.payout_schedules to authenticated;
grant insert, update, delete on public.game_results, public.score_events, public.payout_schedules to authenticated;
grant select, insert on public.commissioner_audit_events to authenticated;
grant usage, select on sequence public.score_events_id_seq, public.commissioner_audit_events_id_seq to authenticated;

create policy comments_select_for_members on public.weekly_comments for select to authenticated using (
  exists (select 1 from public.pool_entries entry join public.seasons season on season.id = entry.season_id
    where entry.id = weekly_comments.entry_id and (select private.is_pool_member(season.pool_id)))
);
create policy comments_insert_own_editable on public.weekly_comments for insert to authenticated
with check ((select private.comment_is_editable(entry_id, week_id)));
create policy comments_update_own_editable on public.weekly_comments for update to authenticated
using ((select private.comment_is_editable(entry_id, week_id))) with check ((select private.comment_is_editable(entry_id, week_id)));
create policy comments_delete_own_editable on public.weekly_comments for delete to authenticated
using ((select private.comment_is_editable(entry_id, week_id)));

create policy results_select_for_members on public.game_results for select to authenticated using (
  exists (select 1 from public.games game join public.pool_weeks week on week.id = game.week_id
    join public.seasons season on season.id = week.season_id where game.id = game_results.game_id
      and (select private.is_pool_member(season.pool_id)))
);
create policy results_manage_for_commissioners on public.game_results for all to authenticated using (
  exists (select 1 from public.games game join public.pool_weeks week on week.id = game.week_id
    join public.seasons season on season.id = week.season_id where game.id = game_results.game_id
      and (select private.is_pool_commissioner(season.pool_id)))
) with check (
  exists (select 1 from public.games game join public.pool_weeks week on week.id = game.week_id
    join public.seasons season on season.id = week.season_id where game.id = game_results.game_id
      and (select private.is_pool_commissioner(season.pool_id)))
);

create policy score_events_select_for_members on public.score_events for select to authenticated using (
  exists (select 1 from public.pool_entries entry join public.seasons season on season.id = entry.season_id
    where entry.id = score_events.entry_id and (select private.is_pool_member(season.pool_id)))
);
create policy score_events_manage_for_commissioners on public.score_events for all to authenticated using (
  exists (select 1 from public.pool_entries entry join public.seasons season on season.id = entry.season_id
    where entry.id = score_events.entry_id and (select private.is_pool_commissioner(season.pool_id)))
) with check (
  exists (select 1 from public.pool_entries entry join public.seasons season on season.id = entry.season_id
    where entry.id = score_events.entry_id and (select private.is_pool_commissioner(season.pool_id)))
);

create policy payouts_select_for_members on public.payout_schedules for select to authenticated using (
  exists (select 1 from public.seasons season where season.id = payout_schedules.season_id
    and (select private.is_pool_member(season.pool_id)))
);
create policy payouts_manage_for_commissioners on public.payout_schedules for all to authenticated using (
  exists (select 1 from public.seasons season where season.id = payout_schedules.season_id
    and (select private.is_pool_commissioner(season.pool_id)) and payout_schedules.locked_at is null)
) with check (
  exists (select 1 from public.seasons season where season.id = payout_schedules.season_id
    and (select private.is_pool_commissioner(season.pool_id)))
);

create policy audit_select_for_commissioners on public.commissioner_audit_events for select to authenticated
using ((select private.is_pool_commissioner(pool_id)));
create policy audit_insert_for_commissioners on public.commissioner_audit_events for insert to authenticated
with check (actor_id = (select auth.uid()) and (select private.is_pool_commissioner(pool_id)));

revoke all on function private.comment_is_editable(bigint, bigint), private.prevent_sd_team_reuse() from public;
grant execute on function private.comment_is_editable(bigint, bigint) to authenticated;

-- Historical 13-entry default. Commissioners can replace it before locking.
insert into public.payout_schedules (season_id, rank, amount)
select season.id, payout.rank, payout.amount
from public.seasons season
join public.pools pool on pool.id = season.pool_id
cross join (values (1,300),(2,250),(3,200),(4,150),(5,100),(6,50),(7,0),(8,-50),(9,-100),(10,-150),(11,-200),(12,-250),(13,-300)) payout(rank, amount)
where pool.slug = 'hppp' and season.year = 2026
on conflict (season_id, rank) do nothing;
