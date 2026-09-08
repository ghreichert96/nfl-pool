create table public.teams (
  abbreviation text primary key check (abbreviation ~ '^[A-Z]{2,3}$'),
  name text not null unique check (char_length(btrim(name)) between 2 and 80),
  logo_url text,
  active boolean not null default true
);

create table public.pool_weeks (
  id bigint generated always as identity primary key,
  season_id bigint not null references public.seasons (id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 22),
  label text not null,
  lines_freeze_at timestamptz not null,
  ats_pick_count smallint not null default 6 check (ats_pick_count between 0 and 16),
  total_pick_count smallint not null default 3 check (total_pick_count between 0 and 16),
  best_bet_enabled boolean not null default true,
  sudden_death_enabled boolean not null default true,
  underdog_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, week_number)
);

create table public.games (
  id bigint generated always as identity primary key,
  week_id bigint not null references public.pool_weeks (id) on delete cascade,
  provider_event_id text unique,
  away_team text not null references public.teams (abbreviation),
  home_team text not null references public.teams (abbreviation),
  kickoff_at timestamptz not null,
  venue text,
  game_type text not null default 'other',
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'final', 'postponed', 'cancelled')),
  away_score smallint check (away_score is null or away_score >= 0),
  home_score smallint check (home_score is null or home_score >= 0),
  status_detail text,
  updated_at timestamptz not null default now(),
  check (away_team <> home_team),
  check ((away_score is null) = (home_score is null))
);

create table public.pool_lines (
  id bigint generated always as identity primary key,
  game_id bigint not null unique references public.games (id) on delete cascade,
  away_spread numeric(4,1) not null,
  total numeric(4,1) not null check (total > 0),
  source text not null default 'consensus'
    check (source in ('consensus', 'commissioner')),
  consensus_away_spread numeric(4,1),
  consensus_total numeric(4,1),
  override_reason text,
  frozen_at timestamptz not null,
  frozen_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    source = 'consensus'
    or (source = 'commissioner' and nullif(btrim(override_reason), '') is not null)
  )
);

create table public.weekly_submissions (
  id bigint generated always as identity primary key,
  entry_id bigint not null references public.pool_entries (id) on delete cascade,
  week_id bigint not null references public.pool_weeks (id) on delete cascade,
  revision integer not null check (revision > 0),
  submitted_at timestamptz not null default now(),
  unique (entry_id, week_id, revision)
);

create table public.picks (
  id bigint generated always as identity primary key,
  submission_id bigint not null references public.weekly_submissions (id) on delete cascade,
  game_id bigint not null references public.games (id) on delete cascade,
  kind text not null check (kind in ('ats', 'total', 'sudden_death', 'underdog')),
  team text references public.teams (abbreviation),
  total_direction text check (total_direction in ('over', 'under')),
  is_best_bet boolean not null default false,
  created_at timestamptz not null default now(),
  unique (submission_id, game_id, kind),
  check (
    (kind = 'total' and team is null and total_direction is not null and not is_best_bet)
    or
    (kind <> 'total' and team is not null and total_direction is null)
  ),
  check (not is_best_bet or kind = 'ats')
);

create unique index picks_one_best_bet_per_submission_idx
  on public.picks (submission_id)
  where is_best_bet;

create index pool_weeks_season_id_idx on public.pool_weeks (season_id);
create index games_week_kickoff_idx on public.games (week_id, kickoff_at);
create index games_away_team_idx on public.games (away_team);
create index games_home_team_idx on public.games (home_team);
create index pool_lines_frozen_by_idx on public.pool_lines (frozen_by)
  where frozen_by is not null;
create index weekly_submissions_entry_week_submitted_idx
  on public.weekly_submissions (entry_id, week_id, submitted_at desc);
create index weekly_submissions_week_id_idx on public.weekly_submissions (week_id);
create index picks_game_id_idx on public.picks (game_id);

create trigger pool_weeks_set_updated_at
before update on public.pool_weeks
for each row execute function private.set_updated_at();

create trigger games_set_updated_at
before update on public.games
for each row execute function private.set_updated_at();

alter table public.teams enable row level security;
alter table public.pool_weeks enable row level security;
alter table public.games enable row level security;
alter table public.pool_lines enable row level security;
alter table public.weekly_submissions enable row level security;
alter table public.picks enable row level security;

revoke all on table public.teams from anon, authenticated;
revoke all on table public.pool_weeks from anon, authenticated;
revoke all on table public.games from anon, authenticated;
revoke all on table public.pool_lines from anon, authenticated;
revoke all on table public.weekly_submissions from anon, authenticated;
revoke all on table public.picks from anon, authenticated;

grant select on table public.teams to authenticated;
grant select on table public.pool_weeks to authenticated;
grant select on table public.games to authenticated;
grant select on table public.pool_lines to authenticated;
grant select on table public.weekly_submissions to authenticated;
grant select on table public.picks to authenticated;

create policy teams_select_for_authenticated
on public.teams for select to authenticated using (true);

create policy weeks_select_for_members
on public.pool_weeks for select to authenticated
using (
  exists (
    select 1
    from public.seasons as season
    where season.id = pool_weeks.season_id
      and (select private.is_pool_member(season.pool_id))
  )
);

create policy games_select_for_members
on public.games for select to authenticated
using (
  exists (
    select 1
    from public.pool_weeks as week
    join public.seasons as season on season.id = week.season_id
    where week.id = games.week_id
      and (select private.is_pool_member(season.pool_id))
  )
);

create policy lines_select_for_members
on public.pool_lines for select to authenticated
using (
  exists (
    select 1
    from public.games as game
    join public.pool_weeks as week on week.id = game.week_id
    join public.seasons as season on season.id = week.season_id
    where game.id = pool_lines.game_id
      and (select private.is_pool_member(season.pool_id))
  )
);

create policy submissions_select_own_started_or_commissioned
on public.weekly_submissions for select to authenticated
using (
  exists (
    select 1
    from public.pool_entries as entry
    join public.seasons as season on season.id = entry.season_id
    where entry.id = weekly_submissions.entry_id
      and (
        entry.user_id = (select auth.uid())
        or (select private.is_pool_commissioner(season.pool_id))
        or exists (
          select 1 from public.games as game
          where game.week_id = weekly_submissions.week_id
            and game.kickoff_at <= now()
        )
      )
  )
);

create policy picks_select_own_started_or_commissioned
on public.picks for select to authenticated
using (
  exists (
    select 1
    from public.weekly_submissions as submission
    join public.pool_entries as entry on entry.id = submission.entry_id
    join public.seasons as season on season.id = entry.season_id
    join public.games as game on game.id = picks.game_id
    where submission.id = picks.submission_id
      and (
        entry.user_id = (select auth.uid())
        or (select private.is_pool_commissioner(season.pool_id))
        or game.kickoff_at <= now()
      )
  )
);

create policy weeks_manage_for_commissioners
on public.pool_weeks for all to authenticated
using (
  exists (
    select 1 from public.seasons as season
    where season.id = pool_weeks.season_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
)
with check (
  exists (
    select 1 from public.seasons as season
    where season.id = pool_weeks.season_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
);

create policy games_manage_for_commissioners
on public.games for all to authenticated
using (
  exists (
    select 1
    from public.pool_weeks as week
    join public.seasons as season on season.id = week.season_id
    where week.id = games.week_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
)
with check (
  exists (
    select 1
    from public.pool_weeks as week
    join public.seasons as season on season.id = week.season_id
    where week.id = games.week_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
);

create policy lines_manage_for_commissioners
on public.pool_lines for all to authenticated
using (
  exists (
    select 1
    from public.games as game
    join public.pool_weeks as week on week.id = game.week_id
    join public.seasons as season on season.id = week.season_id
    where game.id = pool_lines.game_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
)
with check (
  exists (
    select 1
    from public.games as game
    join public.pool_weeks as week on week.id = game.week_id
    join public.seasons as season on season.id = week.season_id
    where game.id = pool_lines.game_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
);

grant insert, update, delete on table public.pool_weeks to authenticated;
grant insert, update, delete on table public.games to authenticated;
grant insert, update, delete on table public.pool_lines to authenticated;
grant usage, select on sequence public.pool_weeks_id_seq to authenticated;
grant usage, select on sequence public.games_id_seq to authenticated;
grant usage, select on sequence public.pool_lines_id_seq to authenticated;
