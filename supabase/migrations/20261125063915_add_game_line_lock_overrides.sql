-- NULL uses the normal week and game deadlines. FALSE reopens commissioner
-- editing before kickoff while leaving the automatic odds schedule intact.
alter table public.games add column line_lock_override boolean;

create or replace function private.guard_pool_line_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lock_at timestamptz;
  manually_locked boolean;
  target_pool_id bigint;
begin
  select game.line_lock_at, season.pool_id, game.line_lock_override is true
  into lock_at, target_pool_id, manually_locked
  from public.games as game
  join public.pool_weeks as week on week.id = game.week_id
  join public.seasons as season on season.id = week.season_id
  where game.id = new.game_id;

  if (manually_locked or lock_at <= now())
    and not (
      not manually_locked
      and
      coalesce(current_setting('app.final_odds_refresh', true), '') = 'on'
      and coalesce((select auth.jwt()->>'role'), '') = 'service_role'
      and exists (
        select 1 from public.games g join public.pool_weeks w on w.id = g.week_id
        where g.id = new.game_id and w.lines_frozen_at is null
          and g.line_lock_at = w.lines_freeze_at
          and g.kickoff_at - interval '1 hour' > now()
      )
    )
    and not (
      new.source = 'commissioner'
      and nullif(btrim(new.override_reason), '') is not null
      and (select private.is_pool_commissioner(target_pool_id))
    )
  then
    raise exception 'Lines for this game are frozen';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_pool_line_deadline() from public;

create or replace function public.apply_odds_lines(target_week_id bigint, observations jsonb, final_pull boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.pool_weeks; g public.games; l public.pool_lines; o jsonb; sp numeric; tot numeric; sb text; tb text; st timestamptz; tt timestamptz; sf text; tf text; n integer:=0; u integer:=0; s integer:=0;
begin
 select * into strict w from public.pool_weeks where id=target_week_id for update;
 if w.lines_frozen_at is not null then return jsonb_build_object('applied',0,'unchanged',0,'skipped',jsonb_array_length(observations)); end if;
 if final_pull and w.lines_freeze_at>now() then raise exception 'Final lock is not due'; end if;
 perform set_config('app.explicit_line_overrides','on',true);
 perform set_config('app.final_odds_refresh',case when final_pull then 'on' else 'off' end,true);
 for o in select * from jsonb_array_elements(observations) loop
  select * into g from public.games where id=(o->>'game_id')::bigint and week_id=target_week_id;
  if not found then raise exception 'Game outside requested week'; end if;
  if g.line_lock_override is true then s:=s+1; continue; end if;
  if g.line_lock_at<=now() and not(final_pull and g.line_lock_at=w.lines_freeze_at and g.kickoff_at-interval '1 hour'>now()) then s:=s+1; continue; end if;
  update public.games set odds_refresh_error=o->>'warning' where id=g.id;
  select * into l from public.pool_lines where game_id=g.id for update;
  sp:=l.away_spread; tot:=l.total; sb:=l.spread_book; tb:=l.total_book; st:=l.spread_observed_at; tt:=l.total_observed_at; sf:=l.spread_fallback; tf:=l.total_fallback;
  if not coalesce(l.spread_override,false) and o->>'away_spread' is not null and (st is null or (o->>'spread_observed_at')::timestamptz>=st) then
   sp:=(o->>'away_spread')::numeric; sb:=o->>'spread_book'; st:=(o->>'spread_observed_at')::timestamptz; sf:=o->>'spread_fallback';
  end if;
  if not coalesce(l.total_override,false) and o->>'total' is not null and (tt is null or (o->>'total_observed_at')::timestamptz>=tt) then
   tot:=(o->>'total')::numeric; tb:=o->>'total_book'; tt:=(o->>'total_observed_at')::timestamptz; tf:=o->>'total_fallback';
  end if;
  if sp is null or tot is null then s:=s+1; continue; end if;
  if sp is not distinct from l.away_spread and tot is not distinct from l.total then u:=u+1; else n:=n+1; end if;
  insert into public.pool_lines(game_id,away_spread,total,source,override_reason,frozen_at,spread_override,total_override,spread_book,total_book,spread_observed_at,total_observed_at,spread_fallback,total_fallback)
  values(g.id,sp,tot,case when coalesce(l.spread_override,false) or coalesce(l.total_override,false) then 'commissioner' else 'consensus' end,case when coalesce(l.spread_override,false) or coalesce(l.total_override,false) then 'Retained commissioner override' else null end,now(),coalesce(l.spread_override,false),coalesce(l.total_override,false),sb,tb,st,tt,sf,tf)
  on conflict(game_id) do update set away_spread=excluded.away_spread,total=excluded.total,source=excluded.source,override_reason=excluded.override_reason,spread_book=excluded.spread_book,total_book=excluded.total_book,spread_observed_at=excluded.spread_observed_at,total_observed_at=excluded.total_observed_at,spread_fallback=excluded.spread_fallback,total_fallback=excluded.total_fallback;
 end loop;
 perform set_config('app.final_odds_refresh','off',true);
 if final_pull then
  update public.games set odds_refresh_error='Final refresh unavailable; last saved lines locked. Review or correct manually.' where week_id=w.id and line_lock_override is not true and line_lock_at=w.lines_freeze_at and kickoff_at-interval '1 hour'>now() and not exists(select 1 from jsonb_array_elements(observations) as seen(value) where (seen.value->>'game_id')::bigint=games.id);
  update public.pool_weeks set lines_frozen_at=now(),lines_frozen_by=null where id=w.id;
  insert into public.line_audit_events(week_id,event_type,source,was_frozen,note) values(w.id,'freeze','system',false,'Final deadline: last saved lines retained where refresh unavailable');
 end if;
 return jsonb_build_object('applied',n,'unchanged',u,'skipped',s);
end; $$;

create or replace function public.finalize_week_odds(target_week_id bigint, consensus_lines jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_week public.pool_weeks;
  changed integer;
begin
  select * into strict target_week from public.pool_weeks where id = target_week_id for update;
  if target_week.lines_frozen_at is not null then return 0; end if;
  if target_week.lines_freeze_at > now() then raise exception 'Final refresh is not due'; end if;
  if exists (
    select 1 from public.games g
    where g.week_id = target_week_id and g.line_lock_at = target_week.lines_freeze_at and g.line_lock_override is not true
      and g.kickoff_at - interval '1 hour' > now()
      and not exists (
        select 1 from jsonb_to_recordset(consensus_lines) as l(game_id bigint, away_spread numeric, total numeric)
        where l.game_id = g.id and l.away_spread is not null and l.total is not null
      )
  ) then raise exception 'Final refresh is missing eligible game lines'; end if;
  perform set_config('app.final_odds_refresh', 'on', true);
  insert into public.pool_lines (game_id, away_spread, total, source,
    consensus_away_spread, consensus_total, override_reason, frozen_at)
  select g.id, l.away_spread, l.total, 'consensus', l.away_spread, l.total, null, now()
  from jsonb_to_recordset(consensus_lines) as l(game_id bigint, away_spread numeric, total numeric)
  join public.games g on g.id = l.game_id
  where g.week_id = target_week_id and g.line_lock_at = target_week.lines_freeze_at and g.line_lock_override is not true
    and g.kickoff_at - interval '1 hour' > now()
  on conflict (game_id) do update set away_spread = excluded.away_spread,
    total = excluded.total, source = excluded.source,
    consensus_away_spread = excluded.consensus_away_spread,
    consensus_total = excluded.consensus_total, override_reason = null, frozen_at = now();
  get diagnostics changed = row_count;
  perform set_config('app.final_odds_refresh', 'off', true);
  update public.pool_weeks set lines_frozen_at = now(), lines_frozen_by = null where id = target_week_id;
  insert into public.line_audit_events (week_id, event_type, source, was_frozen, note)
    values (target_week_id, 'freeze', 'system', false, 'Automatic final odds refresh and lock');
  return changed;
end;
$$;

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
  select game.week_id,
         game.kickoff_at <= now() or coalesce(
           game.line_lock_override,
           week.lines_frozen_at is not null or game.line_lock_at <= now()
         )
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

-- Use the same week -> game -> line lock ordering as the odds and batch editors.
create function private.edit_pregame_line(
  target_game_id bigint,
  should_lock boolean,
  new_spread numeric,
  new_total numeric,
  expected_updated_at timestamptz
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  w public.pool_weeks;
  g public.games;
  l public.pool_lines;
  currently_locked boolean;
begin
  if auth.uid() is null then raise exception 'Commissioner access required'; end if;

  select week.* into w
  from public.pool_weeks week
  join public.games game on game.week_id = week.id
  join public.seasons s on s.id = week.season_id
  where game.id = target_game_id and private.is_pool_commissioner(s.pool_id)
  for update of week;
  if not found then raise exception 'Commissioner access required'; end if;

  select * into strict g from public.games
  where id = target_game_id and week_id = w.id for update;

  select * into strict l from public.pool_lines
  where game_id = g.id for update;

  if w.published_at is null or g.status <> 'scheduled'
    or g.kickoff_at <= clock_timestamp() then
    raise exception 'Line edits close at kickoff';
  end if;

  currently_locked := coalesce(
    g.line_lock_override,
    w.lines_frozen_at is not null or g.line_lock_at <= clock_timestamp()
  );

  if should_lock is not null then
    if should_lock = currently_locked then return; end if;
    update public.games set line_lock_override = should_lock where id = g.id;
    insert into public.line_audit_events (
      week_id, game_id, event_type, source, was_frozen, actor_id, note
    ) values (
      w.id, g.id, case when should_lock then 'freeze' else 'unfreeze' end,
      'commissioner', currently_locked, auth.uid(), 'Picks card line lock'
    );
    return;
  end if;

  if currently_locked then raise exception 'Unlock the line before editing'; end if;
  if l.updated_at is distinct from expected_updated_at then
    raise exception 'Line changed. Reload before saving.';
  end if;
  if new_spread is null or new_total is null
    or new_spread not between -99 and 99 or new_total not between 0.5 and 999
    or mod(new_spread * 2, 1) <> 0 or mod(new_total * 2, 1) <> 0 then
    raise exception 'Enter a valid spread and total in half-point increments';
  end if;
  if (l.away_spread, l.total) is not distinct from (new_spread, new_total) then return; end if;

  update public.pool_lines
  set away_spread = new_spread,
      total = new_total,
      source = 'commissioner',
      override_reason = 'Picks card line edit',
      frozen_at = now()
  where id = l.id;
end;
$$;

create function public.edit_pregame_line(
  target_game_id bigint,
  should_lock boolean default null,
  new_spread numeric default null,
  new_total numeric default null,
  expected_updated_at timestamptz default null
) returns void
language sql security invoker set search_path = '' as $$
  select private.edit_pregame_line(target_game_id, should_lock, new_spread, new_total, expected_updated_at);
$$;

revoke all on function private.edit_pregame_line(bigint, boolean, numeric, numeric, timestamptz) from public, anon;
revoke all on function public.edit_pregame_line(bigint, boolean, numeric, numeric, timestamptz) from public, anon;
grant execute on function private.edit_pregame_line(bigint, boolean, numeric, numeric, timestamptz) to authenticated;
grant execute on function public.edit_pregame_line(bigint, boolean, numeric, numeric, timestamptz) to authenticated;
