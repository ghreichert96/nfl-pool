insert into public.pools (name, slug, timezone)
values ('HPPP NFL Pool', 'hppp', 'America/New_York')
on conflict (slug) do update
set name = excluded.name,
    timezone = excluded.timezone;

insert into public.seasons (pool_id, year, status)
select pool.id, 2026, 'setup'
from public.pools as pool
where pool.slug = 'hppp'
on conflict (pool_id, year) do nothing;

-- Local-only commissioner fixture for testing passwordless auth and invitations.
insert into auth.users (
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000010',
  'harr@example.test',
  now(),
  '{}'
)
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000010',
  '{"sub":"00000000-0000-0000-0000-000000000010","email":"harr@example.test","email_verified":true}'::jsonb,
  'email'
)
on conflict (provider_id, provider) do nothing;

insert into public.profiles (id, display_name)
values ('00000000-0000-0000-0000-000000000010', 'HARR')
on conflict (id) do nothing;

insert into public.pool_memberships (pool_id, user_id, role)
select pool.id, '00000000-0000-0000-0000-000000000010', 'commissioner'
from public.pools as pool
where pool.slug = 'hppp'
on conflict (pool_id, user_id) do nothing;
