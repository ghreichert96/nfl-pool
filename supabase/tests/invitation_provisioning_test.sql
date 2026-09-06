begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select has_function(
  'public',
  'provision_invited_entry',
  array['uuid', 'bigint', 'bigint', 'text'],
  'invitation provisioning helper exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.provision_invited_entry(uuid, bigint, bigint, text)',
    'EXECUTE'
  ),
  'members cannot call invitation provisioning directly'
);

insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000041', 'invited@example.test', '{}');

select is(
  public.provision_invited_entry(
    '00000000-0000-0000-0000-000000000041',
    (select id from public.pools where slug = 'hppp'),
    (
      select season.id
      from public.seasons as season
      join public.pools as pool on pool.id = season.pool_id
      where pool.slug = 'hppp' and season.year = 2026
    ),
    'HARR'
  ) > 0,
  true,
  'the helper creates an entry for the invited user'
);
select is(
  (
    select display_name
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000041'
  ),
  'HARR',
  'the entry code is the initial profile display name'
);
select is(
  (
    select role
    from public.pool_memberships as membership
    join public.pools as pool on pool.id = membership.pool_id
    where pool.slug = 'hppp'
      and membership.user_id = '00000000-0000-0000-0000-000000000041'
  ),
  'member',
  'the invited user becomes a pool member'
);
select is(
  (
    select entry_code
    from public.pool_entries as entry
    join public.seasons as season on season.id = entry.season_id
    join public.pools as pool on pool.id = season.pool_id
    where pool.slug = 'hppp'
      and season.year = 2026
      and entry.user_id = '00000000-0000-0000-0000-000000000041'
  ),
  'HARR',
  'the invited user receives the requested entry code'
);
select public.provision_invited_entry(
  '00000000-0000-0000-0000-000000000041',
  (select id from public.pools where slug = 'hppp'),
  (
    select season.id
    from public.seasons as season
    join public.pools as pool on pool.id = season.pool_id
    where pool.slug = 'hppp' and season.year = 2026
  ),
  'HARR'
);
select is(
  (
    select count(*)
    from public.pool_entries as entry
    where entry.user_id = '00000000-0000-0000-0000-000000000041'
  ),
  1::bigint,
  'the helper remains idempotent for a repeated provisioning call'
);

select * from finish();
rollback;
