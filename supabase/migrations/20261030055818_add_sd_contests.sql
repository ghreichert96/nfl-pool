-- Independent SD contests. Existing RPC callers remain compatible by week.
create table public.sd_contests (
  id bigint generated always as identity primary key,
  season_id bigint not null references public.seasons(id),
  number smallint not null check(number in (1,2)),
  start_week smallint not null check(start_week between 1 and 18),
  end_week smallint not null check(end_week between start_week and 18),
  strike_limit smallint not null default 2 check(strike_limit in (1,2)),
  pot numeric(10,2) not null check(pot>=0),
  completed_week smallint check(completed_week between start_week and end_week),
  unique(season_id,number)
);
create table public.sd_participants (
  contest_id bigint not null references public.sd_contests(id),
  entry_id bigint not null references public.pool_entries(id),
  primary key(contest_id,entry_id)
);
create index sd_participants_entry_idx on public.sd_participants(entry_id);
alter table public.sd_contests enable row level security;
alter table public.sd_participants enable row level security;
revoke all on public.sd_contests,public.sd_participants from anon,authenticated;
grant select on public.sd_contests,public.sd_participants to authenticated;
create policy sd_contests_member_read on public.sd_contests for select to authenticated
using (exists(select 1 from public.seasons s where s.id=season_id and private.is_pool_member(s.pool_id)));
create policy sd_participants_member_read on public.sd_participants for select to authenticated
using (exists(select 1 from public.sd_contests c where c.id=contest_id));

create function private.validate_sd_contest() returns trigger language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(new.season_id);
  if exists(select 1 from public.sd_contests c where c.season_id=new.season_id and c.id<>new.id
    and int4range(c.start_week,c.end_week+1) && int4range(new.start_week,new.end_week+1)) then
    raise exception 'SD contest weeks overlap';
  end if;
  if tg_op='UPDATE' and (new.start_week,new.end_week,new.strike_limit,new.pot,new.season_id,new.number)
    is distinct from (old.start_week,old.end_week,old.strike_limit,old.pot,old.season_id,old.number)
    and exists(select 1 from public.games g join public.pool_weeks w on w.id=g.week_id
      where w.season_id=old.season_id and w.week_number between old.start_week and old.end_week and g.kickoff_at<=now()) then
    raise exception 'SD contest settings are locked after kickoff';
  end if;
  return new;
end $$;
create trigger sd_contests_validate before insert or update on public.sd_contests for each row execute function private.validate_sd_contest();
create function private.validate_sd_participant() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.sd_contests c join public.pool_entries e on e.season_id=c.season_id where c.id=new.contest_id and e.id=new.entry_id) then
    raise exception 'SD participant season mismatch';
  end if;
  return new;
end $$;
create trigger sd_participants_validate before insert or update on public.sd_participants for each row execute function private.validate_sd_participant();
revoke all on function private.validate_sd_contest(),private.validate_sd_participant() from public,anon,authenticated;

-- No current selections may be silently reassigned to the new contest.
do $$ begin
  if exists(select 1 from public.picks p join public.weekly_submissions sub on sub.id=p.submission_id
    join public.pool_weeks w on w.id=sub.week_id join public.seasons s on s.id=w.season_id
    join public.pools pool on pool.id=s.pool_id
    where pool.slug='hppp' and s.year=2026 and w.week_number>=8 and p.kind='sudden_death') then
    raise exception 'Review existing Week 8+ SD picks before activating SD2';
  end if;
end $$;
insert into public.sd_contests(season_id,number,start_week,end_week,strike_limit,pot,completed_week)
select s.id,1,1,7,2,s.sd_pot,7 from public.seasons s join public.pools p on p.id=s.pool_id where p.slug='hppp' and s.year=2026;
insert into public.sd_contests(season_id,number,start_week,end_week,strike_limit,pot)
select s.id,2,8,18,2,225 from public.seasons s join public.pools p on p.id=s.pool_id where p.slug='hppp' and s.year=2026;
insert into public.sd_participants(contest_id,entry_id)
select c.id,e.id from public.sd_contests c join public.pool_entries e on e.season_id=c.season_id;
alter table public.picks add column sd_contest_id bigint references public.sd_contests(id);
create index picks_sd_contest_idx on public.picks(sd_contest_id) where sd_contest_id is not null;
alter table public.picks disable trigger picks_prevent_eliminated_sd;
update public.picks p set sd_contest_id=c.id from public.weekly_submissions sub,public.pool_weeks w,public.sd_contests c
where sub.id=p.submission_id and w.id=sub.week_id and c.season_id=w.season_id
and w.week_number between c.start_week and c.end_week and p.kind='sudden_death';
alter table public.picks enable trigger picks_prevent_eliminated_sd;
alter table public.picks add constraint picks_sd_contest_kind check(sd_contest_id is null or kind='sudden_death');

-- Recompute from latest revisions and final scores; completion is derived so
-- audited score corrections do not leave stale winners or eligibility caches.
create function private.sd_contest_state(contest bigint,before_week integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.sd_contests%rowtype; strikes jsonb; deltas jsonb; w record; d record;
  all_exit boolean; active_count integer; closed_at integer;
begin
  select * into strict c from public.sd_contests where id=contest;
  select coalesce(jsonb_object_agg(entry_id::text,0),'{}'::jsonb) into strikes from public.sd_participants where contest_id=contest;
  for w in select pw.id,pw.week_number from public.pool_weeks pw
    where pw.season_id=c.season_id and pw.week_number>=c.start_week
      and pw.week_number<=least(c.end_week,coalesce(c.completed_week,c.end_week)) and pw.week_number<before_week
      and pw.published_at is not null
      and exists(select 1 from public.games g where g.week_id=pw.id)
      and not exists(select 1 from public.games g where g.week_id=pw.id and g.status<>'final')
    order by pw.week_number
  loop
    select jsonb_object_agg(sp.entry_id::text,case when p.id is null then 1
      when (p.team=g.away_team and g.away_score<g.home_score) or (p.team=g.home_team and g.home_score<g.away_score) then 1 else 0 end)
    into deltas from public.sd_participants sp
    left join public.picks p on p.submission_id=private.latest_submission_id(sp.entry_id,w.id) and p.kind='sudden_death' and p.sd_contest_id=contest
    left join public.games g on g.id=p.game_id
    where sp.contest_id=contest and (strikes->>sp.entry_id::text)::integer<c.strike_limit;
    select coalesce(bool_and((strikes->>key)::integer+value::integer>=c.strike_limit),false) into all_exit from jsonb_each_text(deltas);
    if not all_exit then
      for d in select * from jsonb_each_text(deltas) loop
        strikes:=jsonb_set(strikes,array[d.key],to_jsonb((strikes->>d.key)::integer+d.value::integer));
      end loop;
    end if;
    select count(*) into active_count from jsonb_each_text(strikes) where value::integer<c.strike_limit;
    if active_count=1 or w.week_number=coalesce(c.completed_week,c.end_week) then closed_at:=w.week_number; exit; end if;
  end loop;
  return jsonb_build_object('strikes',strikes,'completedWeek',closed_at);
end $$;
revoke all on function private.sd_contest_state(bigint,integer) from public,anon,authenticated;

alter function private.sd_strikes_before_week(bigint,bigint) rename to legacy_sd_strikes_before_week;
create function private.sd_eligibility(target_entry_id bigint,target_week_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.sd_contests%rowtype; w public.pool_weeks%rowtype; state jsonb; strikes integer;
  unavailable boolean; used jsonb;
begin
  select pw.* into w from public.pool_weeks pw join public.pool_entries e on e.season_id=pw.season_id where pw.id=target_week_id and e.id=target_entry_id;
  if not found then raise exception 'Entry and week do not match'; end if;
  select * into c from public.sd_contests where season_id=w.season_id and w.week_number between start_week and end_week;
  if not found then
    if exists(select 1 from public.sd_contests where season_id=w.season_id) then
      return jsonb_build_object('contestId',null,'label','SD','unavailable',true,'strikes',0,'strikeLimit',2,'usedTeams','[]'::jsonb);
    end if;
    strikes:=private.legacy_sd_strikes_before_week(target_entry_id,target_week_id);
    return jsonb_build_object('contestId',null,'label','SD1','unavailable',strikes>=2,'strikes',strikes,'strikeLimit',2,'usedTeams','[]'::jsonb);
  end if;
  state:=private.sd_contest_state(c.id,w.week_number);
  strikes:=(state->'strikes'->>target_entry_id::text)::integer;
  unavailable:=strikes is null or strikes>=c.strike_limit or state->>'completedWeek' is not null or w.week_number>coalesce(c.completed_week,c.end_week);
  select coalesce(jsonb_agg(p.team),'[]'::jsonb) into used
    from public.pool_weeks pw join public.picks p on p.submission_id=private.latest_submission_id(target_entry_id,pw.id)
    join public.games g on g.id=p.game_id
    where pw.season_id=c.season_id and pw.week_number<w.week_number and p.sd_contest_id=c.id and p.kind='sudden_death' and g.kickoff_at<=now();
  return jsonb_build_object('contestId',c.id,'label','SD'||c.number,'unavailable',unavailable,'strikes',coalesce(strikes,0),'strikeLimit',c.strike_limit,'usedTeams',used);
end $$;
revoke all on function private.sd_eligibility(bigint,bigint) from public,anon,authenticated;
create function private.sd_strikes_before_week(target_entry_id bigint,target_week_id bigint)
returns integer language sql stable security definer set search_path='' as $$
  select case when (s->>'unavailable')::boolean then 2 else (s->>'strikes')::integer end from (select private.sd_eligibility(target_entry_id,target_week_id) s) t;
$$;
revoke all on function private.sd_strikes_before_week(bigint,bigint) from public,anon,authenticated;
-- Rebind the legacy authorization wrapper to the new function OID.
create or replace function private.authorized_sd_strikes(target_entry_id bigint,target_week_id bigint)
returns integer language plpgsql stable security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not exists(select 1 from public.pool_entries e join public.seasons s on s.id=e.season_id where e.id=target_entry_id and (e.user_id=(select auth.uid()) or private.is_pool_commissioner(s.pool_id))) then raise exception 'Entry is not available to this user'; end if;
  return private.sd_strikes_before_week(target_entry_id,target_week_id);
end $$;
create function private.authorized_sd_eligibility(target_entry_id bigint,target_week_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform private.authorized_sd_strikes(target_entry_id,target_week_id);
  return private.sd_eligibility(target_entry_id,target_week_id);
end $$;
revoke all on function private.authorized_sd_eligibility(bigint,bigint) from public,anon,authenticated;
grant execute on function private.authorized_sd_eligibility(bigint,bigint) to authenticated;
create function public.sd_eligibility(target_entry_id bigint,target_week_id bigint)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.authorized_sd_eligibility(target_entry_id,target_week_id); $$;
revoke all on function public.sd_eligibility(bigint,bigint) from public,anon,authenticated;
grant execute on function public.sd_eligibility(bigint,bigint) to authenticated;

create or replace function private.prevent_eliminated_sd_pick()
returns trigger language plpgsql security definer set search_path='' as $$
declare entry_id bigint; pick_week_id bigint; eligibility jsonb; expected bigint;
begin
  if new.kind<>'sudden_death' then
    if new.sd_contest_id is not null then raise exception 'Only SD picks have a contest'; end if;
    return new;
  end if;
  select s.entry_id,s.week_id into entry_id,pick_week_id from public.weekly_submissions s where s.id=new.submission_id;
  eligibility:=private.sd_eligibility(entry_id,pick_week_id);
  if (eligibility->>'unavailable')::boolean then raise exception 'Sudden Death entry is eliminated'; end if;
  expected:=(eligibility->>'contestId')::bigint;
  if new.sd_contest_id is not null and new.sd_contest_id is distinct from expected then raise exception 'SD contest does not match this week'; end if;
  new.sd_contest_id:=expected;
  if not exists(select 1 from public.games g where g.id=new.game_id and g.week_id=pick_week_id and new.team in (g.away_team,g.home_team)) then raise exception 'SD game does not match this week'; end if;
  if eligibility->'usedTeams' ? new.team then raise exception 'SD team has already been used in this contest'; end if;
  return new;
end $$;
-- Legacy reuse guard is retained only for seasons without contest configuration.
alter function private.prevent_sd_team_reuse() rename to legacy_prevent_sd_team_reuse;
drop trigger picks_prevent_sd_team_reuse on public.picks;
create function private.prevent_sd_team_reuse() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.kind='sudden_death' and new.sd_contest_id is null and exists(
    select 1 from public.weekly_submissions sub join public.pool_weeks w on w.id=sub.week_id
    join public.pool_weeks oldw on oldw.season_id=w.season_id and oldw.week_number<w.week_number
    join public.picks p on p.submission_id=private.latest_submission_id(sub.entry_id,oldw.id)
    join public.games g on g.id=p.game_id where sub.id=new.submission_id and p.kind='sudden_death' and p.team=new.team and g.kickoff_at<=now()
  ) then raise exception 'Sudden Death team has already been used'; end if;
  return new;
end $$;
revoke all on function private.prevent_sd_team_reuse() from public,anon,authenticated;
create trigger picks_prevent_sd_team_reuse before insert or update on public.picks for each row execute function private.prevent_sd_team_reuse();

-- SD1 can never accrue Week 8+ strikes; SD2 starts at zero for every participant.

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
  if exists(select 1 from jsonb_array_elements(new_picks) p where p->>'kind'='sudden_death'
    and p ? 'sd_contest_id' and (p->>'sd_contest_id')::bigint is distinct from (private.sd_eligibility(target_entry_id,target_week_id)->>'contestId')::bigint) then
    raise exception 'SD contest changed. Reload your picks.';
  end if;
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

create function private.configure_sd_contest(target_contest_id bigint, new_strike_limit integer, new_pot numeric)
returns void language plpgsql security definer set search_path='' as $$
declare pool bigint;
begin
  select s.pool_id into strict pool from public.sd_contests c join public.seasons s on s.id=c.season_id where c.id=target_contest_id;
  if (select auth.uid()) is null or not private.is_pool_commissioner(pool) then raise exception 'Commissioner access required'; end if;
  if new_strike_limit is null or new_strike_limit not in (1,2) or new_pot is null or new_pot<0 or new_pot>100000 or round(new_pot,2)<>new_pot then raise exception 'Invalid SD settings'; end if;
  update public.sd_contests set strike_limit=new_strike_limit,pot=new_pot where id=target_contest_id;
  insert into public.commissioner_audit_events(pool_id,actor_id,action,entity_type,entity_id,details)
  values(pool,auth.uid(),'sd_contest_updated','sd_contest',target_contest_id::text,jsonb_build_object('strike_limit',new_strike_limit,'pot',new_pot));
end $$;
revoke all on function private.configure_sd_contest(bigint,integer,numeric) from public,anon,authenticated;
grant execute on function private.configure_sd_contest(bigint,integer,numeric) to authenticated;
create function public.configure_sd_contest(target_contest_id bigint,new_strike_limit integer,new_pot numeric)
returns void language sql security invoker set search_path='' as $$ select private.configure_sd_contest(target_contest_id,new_strike_limit,new_pot); $$;
revoke all on function public.configure_sd_contest(bigint,integer,numeric) from public,anon,authenticated;
grant execute on function public.configure_sd_contest(bigint,integer,numeric) to authenticated;

-- Legacy payout clients cannot change the archived SD1 result.
create function private.protect_sd1_pot() returns trigger language plpgsql set search_path='' as $$
begin
  if new.sd_pot is distinct from old.sd_pot and exists(select 1 from public.sd_contests where season_id=new.id) then
    raise exception 'Use contest settings to change an SD payout';
  end if;
  return new;
end $$;
revoke all on function private.protect_sd1_pot() from public,anon,authenticated;
create trigger seasons_protect_sd1_pot before update on public.seasons for each row execute function private.protect_sd1_pot();
