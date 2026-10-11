alter table public.seasons add column sd_pot numeric(10,2) not null default 225 check(sd_pot>=0), add column ud_pot numeric(10,2) not null default 225 check(ud_pot>=0);
update public.seasons set sd_pot=200,ud_pot=200 where year<2026;
alter table public.games add column game_type_override boolean not null default false, add column odds_refresh_error text;
alter table public.pool_lines
 add column spread_override boolean not null default false,
 add column total_override boolean not null default false,
 add column spread_book text, add column total_book text,
 add column spread_observed_at timestamptz, add column total_observed_at timestamptz,
 add column spread_fallback text, add column total_fallback text;
update public.pool_lines set spread_override=true,total_override=true where source='commissioner';
alter table public.odds_ingestion_runs drop constraint odds_ingestion_runs_status_check;
alter table public.odds_ingestion_runs add constraint odds_ingestion_runs_status_check check(status in ('running','succeeded','partial','failed'));
alter table public.odds_ingestion_runs add column quota_used integer, add column applied integer not null default 0, add column unchanged integer not null default 0, add column skipped integer not null default 0, add column failed integer not null default 0;

-- Each ingestion owns a short lease; crashed workers can be recovered safely.
create table private.odds_leases(week_id bigint primary key references public.pool_weeks(id) on delete cascade, token uuid not null, expires_at timestamptz not null);
create function public.claim_odds_lease(target_week_id bigint, lease_token uuid) returns boolean language sql security definer set search_path='' as $$
 with claimed as (
 insert into private.odds_leases values(target_week_id,lease_token,now()+interval '90 seconds')
 on conflict(week_id) do update set token=excluded.token,expires_at=excluded.expires_at where private.odds_leases.expires_at<now() returning 1
 ) select exists(select 1 from claimed);
$$;
create function public.release_odds_lease(target_week_id bigint, lease_token uuid) returns void language sql security definer set search_path='' as $$ delete from private.odds_leases where week_id=target_week_id and token=lease_token; $$;
revoke all on function public.claim_odds_lease(bigint,uuid), public.release_odds_lease(bigint,uuid) from public,anon,authenticated;
grant execute on function public.claim_odds_lease(bigint,uuid), public.release_odds_lease(bigint,uuid) to service_role;

-- All automated line writes serialize with commissioner batch edits.
create function public.apply_odds_lines(target_week_id bigint, observations jsonb, final_pull boolean default false)
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
  update public.games set odds_refresh_error='Final refresh unavailable; last saved lines locked. Review or correct manually.' where week_id=w.id and line_lock_at=w.lines_freeze_at and kickoff_at-interval '1 hour'>now() and not exists(select 1 from jsonb_array_elements(observations) as seen(value) where (seen.value->>'game_id')::bigint=games.id);
  update public.pool_weeks set lines_frozen_at=now(),lines_frozen_by=null where id=w.id;
  insert into public.line_audit_events(week_id,event_type,source,was_frozen,note) values(w.id,'freeze','system',false,'Final deadline: last saved lines retained where refresh unavailable');
 end if;
 return jsonb_build_object('applied',n,'unchanged',u,'skipped',s);
end; $$;
revoke all on function public.apply_odds_lines(bigint,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.apply_odds_lines(bigint,jsonb,boolean) to service_role;

create function public.save_line_batch(target_week_id bigint, edits jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare p bigint; e jsonb; l public.pool_lines; g public.games;
begin
 select season.pool_id into p from public.pool_weeks w join public.seasons season on season.id=w.season_id where w.id=target_week_id for update of w;
 if auth.uid() is null or not private.is_pool_commissioner(p) then raise exception 'Commissioner access required'; end if;
 perform set_config('app.explicit_line_overrides','on',true);
 if jsonb_typeof(edits)<>'array' or jsonb_array_length(edits)>32 then raise exception 'Too many edits'; end if;
 for e in select * from jsonb_array_elements(edits) loop
  select * into strict g from public.games where id=(e->>'game_id')::bigint and week_id=target_week_id for update;
  select * into l from public.pool_lines where game_id=g.id for update;
  if l.updated_at is distinct from (e->>'updated_at')::timestamptz then raise exception 'Game % changed. Reload before saving.',g.id; end if;
  if e->>'away_spread' is null or e->>'total' is null or e->>'spread_override' is null or e->>'total_override' is null or (e->>'away_spread')::numeric not between -99 and 99 or (e->>'total')::numeric not between 0.5 and 999 or mod((e->>'away_spread')::numeric*2,1)<>0 or mod((e->>'total')::numeric*2,1)<>0 then raise exception 'Invalid line for game %',g.id; end if;
  if e->>'game_type' is null or e->>'game_type' not in ('tnf','sunday','snf','mnf','special','international') then raise exception 'Invalid game type'; end if;
  if l.id is null then
   insert into public.pool_lines(game_id,away_spread,total,spread_override,total_override,source,override_reason,frozen_at) values(g.id,(e->>'away_spread')::numeric,(e->>'total')::numeric,(e->>'spread_override')::boolean,(e->>'total_override')::boolean,'commissioner','Commissioner supplied missing line',now());
  else
  update public.pool_lines set away_spread=(e->>'away_spread')::numeric,total=(e->>'total')::numeric,
    spread_override=(e->>'spread_override')::boolean,total_override=(e->>'total_override')::boolean,
    source='commissioner',override_reason='Commissioner batch edit',frozen_at=now() where id=l.id;
  end if;
  update public.games set game_type=e->>'game_type',game_type_override=game_type_override or game_type is distinct from e->>'game_type' where id=g.id;
 end loop;
end; $$;
revoke all on function public.save_line_batch(bigint,jsonb) from public,anon;
grant execute on function public.save_line_batch(bigint,jsonb) to authenticated;

-- Scheduler is staged disabled. Activate only after the new application is deployed.
create table private.ingestion_settings(id boolean primary key default true check(id),odds_enabled boolean not null default false);
insert into private.ingestion_settings default values;
create table public.odds_schedule_slots(id bigint generated always as identity primary key,expected_at timestamptz not null unique,mode text not null check(mode in ('initialize','refresh','finalize')),attempts integer not null default 0,claimed_attempt integer not null default 0,last_attempt_at timestamptz,completed_at timestamptz,error_message text);
alter table public.odds_schedule_slots enable row level security;
grant select on public.odds_schedule_slots to authenticated;
grant select,insert,update on public.odds_schedule_slots to service_role;
grant usage on sequence public.odds_schedule_slots_id_seq to service_role;
create policy schedule_commissioner_read on public.odds_schedule_slots for select to authenticated using(exists(select 1 from public.pool_memberships where user_id=(select auth.uid()) and role='commissioner'));
create function private.odds_job_mode(at_time timestamptz) returns text language sql immutable set search_path='' as $$
 select case when extract(dow from at_time at time zone 'America/New_York')=0 and extract(hour from at_time at time zone 'America/New_York')=12 then 'initialize'
 when extract(dow from at_time at time zone 'America/New_York')=4 and extract(hour from at_time at time zone 'America/New_York')=20 then 'finalize'
 when (extract(dow from at_time at time zone 'America/New_York')=0 and extract(hour from at_time at time zone 'America/New_York')=20) or (extract(dow from at_time at time zone 'America/New_York') between 1 and 4 and extract(hour from at_time at time zone 'America/New_York') in (2,12,20)) then 'refresh' else null end;
$$;
revoke all on function private.odds_job_mode(timestamptz) from public,anon,authenticated;
create function private.enqueue_odds() returns void language plpgsql security definer set search_path='' as $$
declare due_mode text:=private.odds_job_mode(now()); slot public.odds_schedule_slots; endpoint text; token text;
begin
 if not (select odds_enabled from private.ingestion_settings) then return; end if;
 if due_mode is not null then
  insert into public.odds_schedule_slots(expected_at,mode) values(date_trunc('hour',now()),due_mode) on conflict do nothing;
 end if;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='score_ingest_url';
 select decrypted_secret into token from vault.decrypted_secrets where name='score_cron_secret';
 if endpoint is null or token is null then update public.odds_schedule_slots set error_message='Scheduler configuration missing: score_ingest_url or score_cron_secret' where completed_at is null; return; end if;
 for slot in select * from public.odds_schedule_slots where completed_at is null and attempts<3 and expected_at>now()-interval '2 hours' and (last_attempt_at is null or last_attempt_at<now()-interval '5 minutes') for update skip locked loop
  perform net.http_post(url:=endpoint||'/api/cron/odds?slot='||slot.id,headers:=jsonb_build_object('Authorization','Bearer '||token,'Content-Type','application/json'),body:='{}'::jsonb,timeout_milliseconds:=60000);
  update public.odds_schedule_slots set attempts=attempts+1,last_attempt_at=now() where id=slot.id;
 end loop;
end; $$;
revoke all on function private.enqueue_odds() from public,anon,authenticated;
select cron.schedule('hppp-odds-scheduler','* * * * *','select private.enqueue_odds()');
create function public.activate_espn_odds_automation() returns void language plpgsql security definer set search_path='' as $$
begin
 update private.ingestion_settings set odds_enabled=true;
 perform cron.unschedule(jobid) from cron.job where jobname in ('hppp-final-score-validation','hppp-weekly-score-reconciliation');
end; $$;
revoke all on function public.activate_espn_odds_automation() from public,anon,authenticated;
grant execute on function public.activate_espn_odds_automation() to service_role;

create function public.save_side_pots(target_season_id bigint,sd_amount numeric,ud_amount numeric) returns void language plpgsql security invoker set search_path='' as $$
declare p bigint;
begin
 select pool_id into strict p from public.seasons where id=target_season_id for update;
 if auth.uid() is null or not private.is_pool_commissioner(p) then raise exception 'Commissioner access required'; end if;
 if sd_amount is null or ud_amount is null or sd_amount<0 or ud_amount<0 or sd_amount>100000 or ud_amount>100000 or round(sd_amount,2)<>sd_amount or round(ud_amount,2)<>ud_amount then raise exception 'Invalid payout'; end if;
 update public.seasons set sd_pot=sd_amount,ud_pot=ud_amount where id=target_season_id;
 insert into public.commissioner_audit_events(pool_id,actor_id,action,entity_type,entity_id,details) values(p,auth.uid(),'side_pots_updated','season',target_season_id::text,jsonb_build_object('sd',sd_amount,'ud',ud_amount));
end; $$;
revoke all on function public.save_side_pots(bigint,numeric,numeric) from public,anon;
grant execute on function public.save_side_pots(bigint,numeric,numeric) to authenticated;

-- Repair the reported international fixtures without touching selections or lines.
update public.games g set game_type='international'
from public.pool_weeks w join public.seasons s on s.id=w.season_id
where g.week_id=w.id and s.year=2026 and not g.game_type_override
and ((w.week_number=4 and g.away_team='IND' and g.home_team='WAS') or (w.week_number=5 and g.away_team='PHI' and g.home_team='JAX'));

-- Final result, derived score events and game status commit together.
create function public.save_final_game_result(target_game_id bigint,away_points integer,home_points integer,result_source text,provider_time timestamptz,correction boolean,score_rows jsonb,actor uuid default null)
returns integer language plpgsql security invoker set search_path='' as $$
declare g public.games; l public.pool_lines; prior public.game_results; p bigint; n integer;
begin
 select * into strict g from public.games where id=target_game_id for update;
 select s.pool_id into p from public.pool_weeks w join public.seasons s on s.id=w.season_id where w.id=g.week_id;
 if result_source='provider' then
  if current_user<>'service_role' then raise exception 'Provider access required'; end if;
 elsif result_source='commissioner' then
  if auth.uid() is null or not private.is_pool_commissioner(p) then raise exception 'Commissioner access required'; end if;
  actor:=auth.uid();
 else raise exception 'Invalid result source'; end if;
 if away_points is null or home_points is null or away_points not between 0 and 255 or home_points not between 0 and 255 then raise exception 'Invalid score'; end if;
 select * into prior from public.game_results where game_id=g.id;
 if result_source='provider' and prior.source='commissioner' then return 0; end if;
 if result_source='provider' and g.status='final' and prior.away_score=away_points and prior.home_score=home_points then update public.games set final_validation_state='validated',final_validation_next_at=null,final_validation_error=null where id=g.id; return 0; end if;
 select * into strict l from public.pool_lines where game_id=g.id;
 insert into public.game_results(game_id,away_score,home_score,ats_winner,total_winner,outright_winner,source,recorded_by,provider_updated_at,corrected_at)
 values(g.id,away_points,home_points,case when away_points+l.away_spread>home_points then g.away_team when away_points+l.away_spread<home_points then g.home_team else null end,case when away_points+home_points>l.total then 'over' when away_points+home_points<l.total then 'under' else null end,case when away_points>home_points then g.away_team when away_points<home_points then g.home_team else null end,result_source,actor,provider_time,case when correction then now() else null end)
 on conflict(game_id) do update set away_score=excluded.away_score,home_score=excluded.home_score,ats_winner=excluded.ats_winner,total_winner=excluded.total_winner,outright_winner=excluded.outright_winner,source=excluded.source,recorded_by=excluded.recorded_by,provider_updated_at=excluded.provider_updated_at,corrected_at=excluded.corrected_at;
 if exists(select 1 from jsonb_array_elements(score_rows) e where (e->>'game_id')::bigint<>g.id or (e->>'week_id')::bigint<>g.week_id) then raise exception 'Score event outside game'; end if;
 delete from public.score_events where game_id=g.id;
 insert into public.score_events(entry_id,week_id,game_id,pick_id,outcome,scoring_revision,kind,decision_value,strike_delta)
 select e.entry_id,e.week_id,e.game_id,e.pick_id,e.outcome,e.scoring_revision,e.kind,e.decision_value,e.strike_delta from jsonb_populate_recordset(null::public.score_events,score_rows) e;
 get diagnostics n=row_count;
 update public.games set away_score=away_points,home_score=home_points,status='final',status_detail='Final',live_state='final',final_validation_state='validated',final_validation_next_at=null,final_validation_error=null,score_provider_updated_at=provider_time where id=g.id;
 return n;
end; $$;
revoke all on function public.save_final_game_result(bigint,integer,integer,text,timestamptz,boolean,jsonb,uuid) from public,anon;
grant execute on function public.save_final_game_result(bigint,integer,integer,text,timestamptz,boolean,jsonb,uuid) to authenticated,service_role;

create function public.claim_odds_slot(target_slot_id bigint) returns setof public.odds_schedule_slots language sql security invoker set search_path='' as $$
 update public.odds_schedule_slots set claimed_attempt=attempts where id=target_slot_id and completed_at is null and claimed_attempt<attempts returning *;
$$;
revoke all on function public.claim_odds_slot(bigint) from public,anon,authenticated;
grant execute on function public.claim_odds_slot(bigint) to service_role;

-- Explicit runtime grants also make fresh local databases match hosted deployments.
grant update(sd_pot,ud_pot) on public.seasons to authenticated;
grant select on public.seasons,public.pools,public.pool_entries,public.weekly_submissions,public.picks,public.teams to service_role;
grant select,insert,update on public.games,public.game_results,public.odds_ingestion_runs,public.odds_snapshots,public.live_status_ingestion_runs,public.score_ingestion_runs to service_role;
grant select,insert,update,delete on public.score_events to service_role;
grant insert on public.pool_weeks to service_role;
grant usage on sequence public.games_id_seq,public.odds_ingestion_runs_id_seq,public.odds_snapshots_id_seq,public.live_status_ingestion_runs_id_seq,public.score_ingestion_runs_id_seq,public.score_events_id_seq,public.pool_weeks_id_seq to service_role;

create function public.release_score_override(target_game_id bigint) returns void language plpgsql security invoker set search_path='' as $$
declare p bigint;
begin
 select s.pool_id into strict p from public.games g join public.pool_weeks w on w.id=g.week_id join public.seasons s on s.id=w.season_id where g.id=target_game_id for update of g;
 if auth.uid() is null or not private.is_pool_commissioner(p) then raise exception 'Commissioner access required'; end if;
 update public.game_results set source='provider',recorded_by=null where game_id=target_game_id;
 update public.games set final_validation_state='pending',final_validation_next_at=now(),final_validation_error=null where id=target_game_id;
end; $$;
revoke all on function public.release_score_override(bigint) from public,anon;
grant execute on function public.release_score_override(bigint) to authenticated;

-- Preserve manual adjustments made by the old deployment while this migration is staged.
create function private.capture_legacy_line_override() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.source='commissioner' and coalesce(current_setting('app.explicit_line_overrides',true),'')<>'on' then
  if tg_op='INSERT' then new.spread_override:=true;new.total_override:=true;
  else
   if new.away_spread is distinct from old.away_spread then new.spread_override:=true;end if;
   if new.total is distinct from old.total then new.total_override:=true;end if;
  end if;
 end if;
 return new;
end; $$;
revoke all on function private.capture_legacy_line_override() from public,anon,authenticated;
create trigger pool_lines_capture_override before insert or update on public.pool_lines for each row execute function private.capture_legacy_line_override();
