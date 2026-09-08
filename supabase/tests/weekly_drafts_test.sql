begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select has_table('public', 'weekly_drafts', 'weekly drafts table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.weekly_drafts'::regclass),
  'weekly drafts has RLS enabled'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000021', 'draft-owner@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000022', 'other-picker@example.test', '{}');

insert into public.profiles (id, display_name)
values
  ('00000000-0000-0000-0000-000000000021', 'Draft Owner'),
  ('00000000-0000-0000-0000-000000000022', 'Other Picker');

insert into public.pool_memberships (pool_id, user_id)
select pool.id, fixture.user_id
from public.pools as pool
cross join (
  values
    ('00000000-0000-0000-0000-000000000021'::uuid),
    ('00000000-0000-0000-0000-000000000022'::uuid)
) as fixture(user_id)
where pool.slug = 'hppp';

insert into public.pool_entries (id, season_id, user_id, entry_code)
overriding system value
select fixture.id, season.id, fixture.user_id, fixture.entry_code
from public.seasons as season
join public.pools as pool on pool.id = season.pool_id
cross join (
  values
    (9101::bigint, '00000000-0000-0000-0000-000000000021'::uuid, 'OWN'),
    (9102::bigint, '00000000-0000-0000-0000-000000000022'::uuid, 'OTH')
) as fixture(id, user_id, entry_code)
where pool.slug = 'hppp' and season.year = 2026;

insert into public.pool_weeks (
  id,
  season_id,
  week_number,
  label,
  lines_freeze_at
)
overriding system value
select 9101, season.id, 2, 'Week 2', now() + interval '1 day'
from public.seasons as season
join public.pools as pool on pool.id = season.pool_id
where pool.slug = 'hppp' and season.year = 2026;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000021","role":"authenticated"}',
  true
);

insert into public.weekly_drafts (entry_id, week_id, payload)
values (9101, 9101, '{"ats":[]}'::jsonb);

select is(
  (select count(*) from public.weekly_drafts),
  1::bigint,
  'the owner can create and read their draft'
);

update public.weekly_drafts
set payload = '{"ats":[{"gameId":"test","team":"AAA"}]}'::jsonb
where entry_id = 9101 and week_id = 9101;

select is(
  (select payload -> 'ats' -> 0 ->> 'team' from public.weekly_drafts),
  'AAA',
  'the owner can update their draft'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000022","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.weekly_drafts),
  0::bigint,
  'another entrant cannot read the private draft'
);

update public.weekly_drafts
set payload = '{}'::jsonb
where entry_id = 9101 and week_id = 9101;

reset role;

select is(
  (select payload -> 'ats' -> 0 ->> 'team'
   from public.weekly_drafts
   where entry_id = 9101 and week_id = 9101),
  'AAA',
  'another entrant cannot update the private draft'
);

select * from finish();
rollback;
