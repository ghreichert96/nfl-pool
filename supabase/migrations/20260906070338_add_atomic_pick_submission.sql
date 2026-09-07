create or replace function public.submit_weekly_picks(
  target_entry_id bigint,
  target_week_id bigint,
  new_picks jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  latest_submission_id bigint;
  new_submission_id bigint;
  next_revision integer;
  week_config public.pool_weeks%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select week.* into week_config
  from public.pool_weeks as week
  join public.pool_entries as entry on entry.season_id = week.season_id
  where week.id = target_week_id
    and entry.id = target_entry_id
    and entry.user_id = (select auth.uid());

  if not found then
    raise exception 'Entry and week are not available to this user';
  end if;
  if jsonb_typeof(new_picks) <> 'array' or jsonb_array_length(new_picks) > 11 then
    raise exception 'Invalid pick payload';
  end if;

  perform pg_advisory_xact_lock(target_entry_id);

  if exists (
    select 1
    from jsonb_to_recordset(new_picks) as pick(
      game_id bigint,
      kind text,
      team text,
      total_direction text,
      is_best_bet boolean
    )
    left join public.games as game
      on game.id = pick.game_id and game.week_id = target_week_id
    where game.id is null
      or pick.kind not in ('ats', 'total', 'sudden_death', 'underdog')
      or (pick.kind = 'total' and (
        pick.team is not null
        or pick.total_direction not in ('over', 'under')
        or coalesce(pick.is_best_bet, false)
      ))
      or (pick.kind <> 'total' and (
        pick.team not in (game.away_team, game.home_team)
        or pick.total_direction is not null
      ))
      or (coalesce(pick.is_best_bet, false) and pick.kind <> 'ats')
  ) then
    raise exception 'One or more picks are invalid';
  end if;

  if (
    select count(*) <> count(distinct (pick.game_id, pick.kind))
    from jsonb_to_recordset(new_picks) as pick(game_id bigint, kind text)
  ) then
    raise exception 'Duplicate picks are not allowed';
  end if;

  select submission.id into latest_submission_id
  from public.weekly_submissions as submission
  where submission.entry_id = target_entry_id
    and submission.week_id = target_week_id
  order by submission.revision desc
  limit 1;

  select coalesce(max(submission.revision), 0) + 1 into next_revision
  from public.weekly_submissions as submission
  where submission.entry_id = target_entry_id
    and submission.week_id = target_week_id;

  insert into public.weekly_submissions (entry_id, week_id, revision)
  values (target_entry_id, target_week_id, next_revision)
  returning id into new_submission_id;

  if latest_submission_id is not null then
    insert into public.picks (
      submission_id, game_id, kind, team, total_direction, is_best_bet
    )
    select
      new_submission_id, pick.game_id, pick.kind, pick.team,
      pick.total_direction, pick.is_best_bet
    from public.picks as pick
    join public.games as game on game.id = pick.game_id
    where pick.submission_id = latest_submission_id
      and game.kickoff_at <= now();
  end if;

  insert into public.picks (
    submission_id, game_id, kind, team, total_direction, is_best_bet
  )
  select
    new_submission_id, pick.game_id, pick.kind, pick.team,
    pick.total_direction, coalesce(pick.is_best_bet, false)
  from jsonb_to_recordset(new_picks) as pick(
    game_id bigint,
    kind text,
    team text,
    total_direction text,
    is_best_bet boolean
  )
  join public.games as game
    on game.id = pick.game_id and game.week_id = target_week_id
  where game.kickoff_at > now();

  if (select count(*) from public.picks where submission_id = new_submission_id and kind = 'ats') > week_config.ats_pick_count
    or (select count(*) from public.picks where submission_id = new_submission_id and kind = 'total') > week_config.total_pick_count
    or (select count(*) from public.picks where submission_id = new_submission_id and kind = 'sudden_death') > 1
    or (select count(*) from public.picks where submission_id = new_submission_id and kind = 'underdog') > 1
    or (not week_config.best_bet_enabled and exists (select 1 from public.picks where submission_id = new_submission_id and is_best_bet))
    or (not week_config.sudden_death_enabled and exists (select 1 from public.picks where submission_id = new_submission_id and kind = 'sudden_death'))
    or (not week_config.underdog_enabled and exists (select 1 from public.picks where submission_id = new_submission_id and kind = 'underdog'))
  then
    raise exception 'Pick limits exceeded';
  end if;

  return next_revision;
end;
$$;

revoke all on function public.submit_weekly_picks(bigint, bigint, jsonb)
  from public, anon;
grant execute on function public.submit_weekly_picks(bigint, bigint, jsonb)
  to authenticated;

create or replace function private.latest_submission_id(
  target_entry_id bigint,
  target_week_id bigint
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select submission.id
  from public.weekly_submissions as submission
  where submission.entry_id = target_entry_id
    and submission.week_id = target_week_id
  order by submission.revision desc
  limit 1;
$$;

revoke all on function private.latest_submission_id(bigint, bigint) from public;
grant execute on function private.latest_submission_id(bigint, bigint)
  to authenticated;

drop policy submissions_select_own_started_or_commissioned
  on public.weekly_submissions;
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
        or (
          weekly_submissions.id = (select private.latest_submission_id(
            weekly_submissions.entry_id,
            weekly_submissions.week_id
          ))
          and exists (
            select 1 from public.games as game
            where game.week_id = weekly_submissions.week_id
              and game.kickoff_at <= now()
          )
        )
      )
  )
);

drop policy picks_select_own_started_or_commissioned on public.picks;
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
        or (
          game.kickoff_at <= now()
          and submission.id = (select private.latest_submission_id(
            submission.entry_id,
            submission.week_id
          ))
        )
      )
  )
);
