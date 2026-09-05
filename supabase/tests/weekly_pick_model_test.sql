begin;
select plan(16);

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

select * from finish();
rollback;
