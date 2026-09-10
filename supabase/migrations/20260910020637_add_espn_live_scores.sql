create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.games
  add column espn_event_id text,
  add column live_period smallint check (live_period is null or live_period between 0 and 20),
  add column live_clock text check (live_clock is null or char_length(live_clock) <= 20),
  add column live_state text not null default 'scheduled'
    check (live_state in ('scheduled', 'live', 'halftime', 'final_pending', 'final', 'postponed', 'cancelled')),
  add column live_status_updated_at timestamptz,
  add column final_validation_state text not null default 'none'
    check (final_validation_state in ('none', 'pending', 'retry', 'reconciliation', 'validated')),
  add column final_detected_at timestamptz,
  add column final_validation_next_at timestamptz,
  add column final_validation_attempts smallint not null default 0
    check (final_validation_attempts between 0 and 20),
  add column final_validation_error text;

create unique index games_espn_event_id_idx
  on public.games (espn_event_id)
  where espn_event_id is not null;

create index games_final_validation_queue_idx
  on public.games (final_validation_next_at)
  where final_validation_state in ('pending', 'retry');

alter table public.score_ingestion_runs
  drop constraint score_ingestion_runs_mode_check,
  add constraint score_ingestion_runs_mode_check
    check (mode in ('live', 'validate', 'reconcile'));

create table public.live_status_ingestion_runs (
  id bigint generated always as identity primary key,
  week_id bigint references public.pool_weeks (id) on delete set null,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'partial', 'skipped', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  events_received integer not null default 0,
  games_updated integer not null default 0,
  skip_reason text,
  error_message text
);

create index live_status_runs_week_requested_idx
  on public.live_status_ingestion_runs (week_id, requested_at desc);

alter table public.live_status_ingestion_runs enable row level security;
revoke all on table public.live_status_ingestion_runs from anon, authenticated;
grant select on table public.live_status_ingestion_runs to authenticated;

create policy live_status_runs_select_for_commissioners
on public.live_status_ingestion_runs for select to authenticated
using (
  week_id is not null and exists (
    select 1
    from public.pool_weeks as week
    join public.seasons as season on season.id = week.season_id
    where week.id = live_status_ingestion_runs.week_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
);

-- Vault values are installed separately in each environment. Missing secrets make
-- these jobs safe no-ops rather than exposing credentials in migration history.
select cron.schedule(
  'hppp-espn-live-status',
  '*/2 * * * *',
  $job$
    select net.http_post(
      url := url_secret.decrypted_secret || '/api/cron/live-status',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || token_secret.decrypted_secret
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    )
    from vault.decrypted_secrets as url_secret
    cross join vault.decrypted_secrets as token_secret
    where url_secret.name = 'score_ingest_url'
      and token_secret.name = 'score_cron_secret';
  $job$
);

select cron.schedule(
  'hppp-final-score-validation',
  '1,16,31,46 * * * *',
  $job$
    select net.http_post(
      url := url_secret.decrypted_secret || '/api/cron/scores?mode=validate',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || token_secret.decrypted_secret
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    )
    from vault.decrypted_secrets as url_secret
    cross join vault.decrypted_secrets as token_secret
    where url_secret.name = 'score_ingest_url'
      and token_secret.name = 'score_cron_secret';
  $job$
);

select cron.schedule(
  'hppp-weekly-score-reconciliation',
  '17 11 * * 2',
  $job$
    select net.http_post(
      url := url_secret.decrypted_secret || '/api/cron/scores?mode=reconcile',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || token_secret.decrypted_secret
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    )
    from vault.decrypted_secrets as url_secret
    cross join vault.decrypted_secrets as token_secret
    where url_secret.name = 'score_ingest_url'
      and token_secret.name = 'score_cron_secret';
  $job$
);
