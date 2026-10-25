-- Derive eligibility from latest picks and current finals, matching
-- calculateStandings, including missing picks and the whole-field reprieve.
create function private.sd_strikes_before_week(target_entry_id bigint, target_week_id bigint)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare
  target_season bigint;
  target_number integer;
  strikes jsonb;
  deltas jsonb;
  week_row record;
  entry_row record;
  all_would_exit boolean;
begin
  select w.season_id, w.week_number into target_season, target_number
  from public.pool_weeks w join public.pool_entries e on e.season_id=w.season_id
  where w.id=target_week_id and e.id=target_entry_id;
  if not found then raise exception 'Entry and week do not match'; end if;

  select jsonb_object_agg(e.id::text, 0) into strikes
  from public.pool_entries e where e.season_id=target_season;

  for week_row in
    select w.id from public.pool_weeks w
    where w.season_id=target_season and w.week_number<target_number
      and w.published_at is not null
      and exists (select 1 from public.games g where g.week_id=w.id)
      and not exists (select 1 from public.games g where g.week_id=w.id and g.status<>'final')
    order by w.week_number
  loop
    select jsonb_object_agg(e.id::text, case
      when p.id is null then 1
      when (p.team=g.away_team and g.away_score<g.home_score)
        or (p.team=g.home_team and g.home_score<g.away_score) then 1
      else 0 end)
    into deltas
    from public.pool_entries e
    left join public.picks p on p.submission_id=private.latest_submission_id(e.id,week_row.id)
      and p.kind='sudden_death'
    left join public.games g on g.id=p.game_id
    where e.season_id=target_season and (strikes->>e.id::text)::integer<2;

    select coalesce(bool_and((strikes->>d.key)::integer+d.value::integer>=2), false)
    into all_would_exit from jsonb_each_text(deltas) d;
    if not all_would_exit then
      for entry_row in select key,value from jsonb_each_text(deltas) loop
        strikes := jsonb_set(strikes,array[entry_row.key],
          to_jsonb((strikes->>entry_row.key)::integer+entry_row.value::integer));
      end loop;
    end if;
  end loop;
  return (strikes->>target_entry_id::text)::integer;
end;
$$;
revoke all on function private.sd_strikes_before_week(bigint,bigint) from public,anon,authenticated;

-- Authorization is checked inside the privileged private helper. Only the
-- caller's entry (or a commissioner in the same pool) can be inspected.
create function private.authorized_sd_strikes(target_entry_id bigint,target_week_id bigint)
returns integer language plpgsql stable security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.pool_entries e join public.seasons s on s.id=e.season_id
    where e.id=target_entry_id and
      (e.user_id=(select auth.uid()) or private.is_pool_commissioner(s.pool_id))
  ) then raise exception 'Entry is not available to this user'; end if;
  return private.sd_strikes_before_week(target_entry_id,target_week_id);
end;
$$;
revoke all on function private.authorized_sd_strikes(bigint,bigint) from public,anon,authenticated;
grant execute on function private.authorized_sd_strikes(bigint,bigint) to authenticated;

create function public.sudden_death_strikes_before_week(target_entry_id bigint,target_week_id bigint)
returns integer language sql stable security invoker set search_path='' as $$
  select private.authorized_sd_strikes(target_entry_id,target_week_id);
$$;
revoke all on function public.sudden_death_strikes_before_week(bigint,bigint) from public,anon,authenticated;
grant execute on function public.sudden_death_strikes_before_week(bigint,bigint) to authenticated;

create function private.prevent_eliminated_sd_pick()
returns trigger language plpgsql security definer set search_path='' as $$
declare entry_id bigint; week_id bigint;
begin
  if new.kind <> 'sudden_death' then return new; end if;
  select s.entry_id,s.week_id into entry_id,week_id
  from public.weekly_submissions s where s.id=new.submission_id;
  if private.sd_strikes_before_week(entry_id,week_id)>=2 then
    raise exception 'Sudden Death entry is eliminated';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_eliminated_sd_pick() from public,anon,authenticated;
create trigger picks_prevent_eliminated_sd before insert or update on public.picks
for each row execute function private.prevent_eliminated_sd_pick();

-- Preserve atomic submission and kickoff locking. Old, invalid locked SD picks
-- must not block an eliminated entrant from submitting Main and Underdog picks.
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
  sd_eliminated boolean;
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
  sd_eliminated := private.sd_strikes_before_week(target_entry_id,target_week_id)>=2;
  if sd_eliminated and exists (
    select 1 from jsonb_array_elements(new_picks) p where p->>'kind'='sudden_death'
  ) then raise exception 'Sudden Death entry is eliminated'; end if;

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
      and game.kickoff_at <= now()
      and (not sd_eliminated or pick.kind<>'sudden_death');
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
