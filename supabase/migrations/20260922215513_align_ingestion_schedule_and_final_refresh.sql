-- Keep midnight reconciliation on Eastern time across DST. The unused UTC
-- slot does not enqueue an HTTP request. Rollback: restore '17 11 * * 2'.
select cron.schedule(
  'hppp-weekly-score-reconciliation', '0 4,5 * * 2',
  $job$
    select net.http_post(
      url := u.decrypted_secret || '/api/cron/scores?mode=reconcile',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'Authorization', 'Bearer ' || t.decrypted_secret),
      body := '{}'::jsonb, timeout_milliseconds := 60000
    )
    from vault.decrypted_secrets u cross join vault.decrypted_secrets t
    where u.name = 'score_ingest_url' and t.name = 'score_cron_secret'
      and extract(hour from now() at time zone 'America/New_York') = 0;
  $job$
);

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

-- Service-only, atomic final refresh + freeze. Earlier game-specific locks
-- remain enforced. A failed/missing consensus rolls the whole operation back.
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
    where g.week_id = target_week_id and g.line_lock_at = target_week.lines_freeze_at
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
  where g.week_id = target_week_id and g.line_lock_at = target_week.lines_freeze_at
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
revoke all on function public.finalize_week_odds(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_week_odds(bigint, jsonb) to service_role;

-- Explicit backend privileges; new tables may lack automatic service grants.
-- Keep finalization SECURITY INVOKER and do not expand entrant permissions.
grant select, update on public.pool_weeks to service_role;
grant select on public.games to service_role;
grant select, insert, update on public.pool_lines to service_role;
grant insert on public.line_audit_events to service_role;
grant usage on sequence public.pool_lines_id_seq, public.line_audit_events_id_seq to service_role;
