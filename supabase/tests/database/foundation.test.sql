begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'pools', 'pools table exists');
select has_table('public', 'pool_memberships', 'pool memberships table exists');
select has_table('public', 'seasons', 'seasons table exists');
select has_table('public', 'pool_entries', 'pool entries table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.pools'::regclass),
  'pools has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.pool_memberships'::regclass),
  'pool memberships has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.seasons'::regclass),
  'seasons has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.pool_entries'::regclass),
  'pool entries has RLS enabled'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pool_entries'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%[A-Z]{3,4}%'
  ),
  'entry codes are constrained to three or four uppercase letters'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pool_entries'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (season_id, user_id)'
  ),
  'a person can have only one entry per season'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pool_entries'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (season_id, entry_code)'
  ),
  'entry codes are unique within a season'
);

select is(
  (select count(*) from public.pools where slug = 'hppp'),
  1::bigint,
  'HPPP is seeded once'
);
select is(
  (
    select count(*)
    from public.seasons as season
    join public.pools as pool on pool.id = season.pool_id
    where pool.slug = 'hppp' and season.year = 2026
  ),
  1::bigint,
  'the HPPP 2026 season is seeded once'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000001', 'commissioner@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000002', 'member@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000003', 'outsider@example.test', '{}');

insert into public.profiles (id, display_name)
values
  ('00000000-0000-0000-0000-000000000001', 'Commissioner'),
  ('00000000-0000-0000-0000-000000000002', 'Member'),
  ('00000000-0000-0000-0000-000000000003', 'Outsider');

insert into public.pool_memberships (pool_id, user_id, role)
select pool.id, seeded.user_id, seeded.role
from public.pools as pool
cross join (
  values
    ('00000000-0000-0000-0000-000000000001'::uuid, 'commissioner'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'member')
) as seeded(user_id, role)
where pool.slug = 'hppp';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.profiles),
  2::bigint,
  'a commissioner sees profiles for members of their pool'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.pools),
  1::bigint,
  'a member sees their pool'
);
select is(
  (select count(*) from public.profiles),
  1::bigint,
  'a member sees only their own profile'
);
update public.pools set name = 'Unauthorized';

select is(
  (select name from public.pools),
  'HPPP NFL Pool',
  'a member cannot update pool settings'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.pools),
  0::bigint,
  'an outsider cannot see the pool'
);

select * from finish();
rollback;
