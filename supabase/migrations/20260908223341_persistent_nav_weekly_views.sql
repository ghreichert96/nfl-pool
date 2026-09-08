alter table public.pool_weeks
  add column published_at timestamptz;

update public.pool_weeks as week
set published_at = week.created_at
where exists (select 1 from public.games as game where game.week_id = week.id);

alter table public.games
  add column line_lock_at timestamptz;

update public.games as game
set line_lock_at = least(
  (select week.lines_freeze_at from public.pool_weeks as week where week.id = game.week_id),
  game.kickoff_at - interval '1 hour'
);

alter table public.games alter column line_lock_at set not null;

create or replace function private.set_game_line_lock_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.line_lock_at <= now() then
    new.line_lock_at := old.line_lock_at;
    return new;
  end if;
  select least(week.lines_freeze_at, new.kickoff_at - interval '1 hour')
  into new.line_lock_at
  from public.pool_weeks as week
  where week.id = new.week_id;
  return new;
end;
$$;

revoke all on function private.set_game_line_lock_at() from public;
create trigger games_set_line_lock_at
before insert or update of kickoff_at, week_id on public.games
for each row execute function private.set_game_line_lock_at();

create or replace function private.refresh_week_game_line_locks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.lines_freeze_at is distinct from new.lines_freeze_at then
    update public.games
    set line_lock_at = least(new.lines_freeze_at, kickoff_at - interval '1 hour')
    where week_id = new.id and line_lock_at > now();
  end if;
  return new;
end;
$$;

revoke all on function private.refresh_week_game_line_locks() from public;
create trigger pool_weeks_refresh_game_line_locks
after update of lines_freeze_at on public.pool_weeks
for each row execute function private.refresh_week_game_line_locks();

create or replace function private.guard_pool_line_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lock_at timestamptz;
  target_pool_id bigint;
begin
  select game.line_lock_at, season.pool_id
  into lock_at, target_pool_id
  from public.games as game
  join public.pool_weeks as week on week.id = game.week_id
  join public.seasons as season on season.id = week.season_id
  where game.id = new.game_id;

  if lock_at <= now()
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
create trigger pool_lines_guard_deadline
before insert or update of away_spread, total on public.pool_lines
for each row execute function private.guard_pool_line_deadline();

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
         week.lines_frozen_at is not null or game.line_lock_at <= now()
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

drop policy picks_select_own_started_or_commissioned on public.picks;
create policy picks_select_own_or_started
on public.picks for select to authenticated
using (
  exists (
    select 1
    from public.weekly_submissions as submission
    join public.pool_entries as entry on entry.id = submission.entry_id
    join public.games as game on game.id = picks.game_id
    where submission.id = picks.submission_id
      and (
        entry.user_id = (select auth.uid())
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

create or replace function public.week_submission_presence(target_week_id bigint)
returns table (entry_id bigint, has_submission boolean)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  target_pool_id bigint;
begin
  select season.pool_id into target_pool_id
  from public.pool_weeks as week
  join public.seasons as season on season.id = week.season_id
  where week.id = target_week_id;

  if target_pool_id is null
    or not (select private.is_pool_member(target_pool_id))
  then
    raise exception 'Pool membership required';
  end if;

  return query
  select entry.id, exists (
    select 1 from public.weekly_submissions as submission
    where submission.entry_id = entry.id
      and submission.week_id = target_week_id
  )
  from public.pool_entries as entry
  join public.seasons as season on season.id = entry.season_id
  where season.pool_id = target_pool_id;
end;
$$;

revoke all on function public.week_submission_presence(bigint) from public, anon;
grant execute on function public.week_submission_presence(bigint) to authenticated;
