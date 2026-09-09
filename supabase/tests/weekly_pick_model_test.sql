begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

select has_table('public', 'teams', 'teams table exists');
select has_table('public', 'pool_weeks', 'pool weeks table exists');
select has_table('public', 'games', 'games table exists');
select has_table('public', 'pool_lines', 'frozen pool lines table exists');
select has_table('public', 'weekly_submissions', 'submission revisions table exists');
select has_table('public', 'picks', 'normalized picks table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.teams'::regclass),
  'teams has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.pool_weeks'::regclass),
  'pool weeks has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.games'::regclass),
  'games has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.pool_lines'::regclass),
  'pool lines has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.weekly_submissions'::regclass),
  'weekly submissions has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.picks'::regclass),
  'picks has RLS enabled'
);

select has_index(
  'public',
  'picks',
  'picks_one_best_bet_per_submission_idx',
  'one Best Bet is enforced per revision'
);
select col_type_is(
  'public',
  'games',
  'kickoff_at',
  'timestamp with time zone',
  'kickoff is timezone-aware'
);
select has_column('public', 'pool_weeks', 'published_at', 'weeks have an explicit publication timestamp');
select has_column('public', 'games', 'line_lock_at', 'games have an effective line deadline');
select col_type_is(
  'public',
  'pool_lines',
  'away_spread',
  'numeric(4,1)',
  'spread uses exact half-point-compatible arithmetic'
);
select col_type_is(
  'public',
  'weekly_submissions',
  'revision',
  'integer',
  'submission revisions are explicit'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000011', 'picker-one@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000012', 'picker-two@example.test', '{}');

insert into public.profiles (id, display_name)
values
  ('00000000-0000-0000-0000-000000000011', 'Picker One'),
  ('00000000-0000-0000-0000-000000000012', 'Picker Two');

insert into public.pool_memberships (pool_id, user_id)
select pool.id, fixture.user_id
from public.pools as pool
cross join (
  values
    ('00000000-0000-0000-0000-000000000011'::uuid),
    ('00000000-0000-0000-0000-000000000012'::uuid)
) as fixture(user_id)
where pool.slug = 'hppp';

insert into public.pool_entries (id, season_id, user_id, entry_code)
overriding system value
select fixture.id, season.id, fixture.user_id, fixture.entry_code
from public.seasons as season
join public.pools as pool on pool.id = season.pool_id
cross join (
  values
    (9001::bigint, '00000000-0000-0000-0000-000000000011'::uuid, 'ONE'),
    (9002::bigint, '00000000-0000-0000-0000-000000000012'::uuid, 'TWO')
) as fixture(id, user_id, entry_code)
where pool.slug = 'hppp' and season.year = 2026;

insert into public.teams (abbreviation, name)
values ('AAA', 'Away Testers'), ('HHH', 'Home Testers');

insert into public.pool_weeks (
  id,
  season_id,
  week_number,
  label,
  lines_freeze_at
)
overriding system value
select 9001, season.id, 1, 'Week 1', now() - interval '1 day'
from public.seasons as season
join public.pools as pool on pool.id = season.pool_id
where pool.slug = 'hppp' and season.year = 2026;

insert into public.games (
  id,
  week_id,
  provider_event_id,
  away_team,
  home_team,
  kickoff_at
)
overriding system value
values
  (9001, 9001, 'future-game', 'AAA', 'HHH', now() + interval '1 day'),
  (9002, 9001, 'started-game', 'AAA', 'HHH', now() - interval '1 minute');

insert into public.pool_weeks (id, season_id, week_number, label, lines_freeze_at)
overriding system value
select 9002, season.id, 2, 'Week 2', now() + interval '3 days'
from public.seasons as season
join public.pools as pool on pool.id = season.pool_id
where pool.slug = 'hppp' and season.year = 2026;

insert into public.games (id, week_id, provider_event_id, away_team, home_team, kickoff_at)
overriding system value
values (9003, 9002, 'early-game', 'AAA', 'HHH', now() + interval '2 hours');

select is(
  (select line_lock_at from public.games where id = 9003),
  (select kickoff_at - interval '1 hour' from public.games where id = 9003),
  'a non-standard early game freezes one hour before kickoff'
);

insert into public.weekly_submissions (id, entry_id, week_id, revision)
overriding system value
values (9001, 9001, 9001, 1);

insert into public.picks (submission_id, game_id, kind, team)
values
  (9001, 9001, 'ats', 'AAA'),
  (9001, 9002, 'ats', 'HHH');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.picks),
  2::bigint,
  'an entrant sees all of their own submitted picks'
);

select is(
  (select count(*) from public.week_submission_presence(9001) where has_submission),
  1::bigint,
  'members can see submission presence without receiving hidden picks'
);

reset role;
update public.pool_memberships
set role = 'commissioner'
where user_id = '00000000-0000-0000-0000-000000000012';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000012","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.picks),
  1::bigint,
  'commissioner Grid reads remain kickoff-gated'
);

select is(
  (select line_lock_at from public.games where id = 9001),
  (select lines_freeze_at from public.pool_weeks where id = 9001),
  'a game line locks at the earlier weekly deadline'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.submit_weekly_picks(
    9001,
    9001,
    '[{"game_id":9001,"kind":"ats","team":"HHH","total_direction":null,"is_best_bet":true}]'::jsonb
  )$$,
  'an entrant can submit a new revision'
);
select is(
  (select max(revision) from public.weekly_submissions where entry_id = 9001),
  2,
  'submission creates the next revision'
);
select is(
  (
    select pick.team
    from public.picks as pick
    join public.weekly_submissions as submission on submission.id = pick.submission_id
    where submission.entry_id = 9001 and submission.revision = 2
      and pick.game_id = 9002 and pick.kind = 'ats'
  ),
  'HHH',
  'submission preserves a pick after its game locks'
);
select is(
  (
    select pick.team
    from public.picks as pick
    join public.weekly_submissions as submission on submission.id = pick.submission_id
    where submission.entry_id = 9001 and submission.revision = 2
      and pick.game_id = 9001 and pick.kind = 'ats'
  ),
  'HHH',
  'submission replaces an unlocked pick'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000012","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.picks),
  1::bigint,
  'an opponent sees only picks for games that have kicked off'
);

select * from finish();
rollback;
