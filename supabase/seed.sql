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
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  aud,
  role,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  reauthentication_token,
  phone
)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000000',
  'harr@example.test',
  '',
  now(),
  'authenticated',
  'authenticated',
  '{"provider":"email","providers":["email"]}',
  '{"email_verified":true}',
  now(),
  now(),
  '',
  '',
  '',
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000010',
  '{"sub":"00000000-0000-0000-0000-000000000010","email":"harr@example.test","email_verified":true}'::jsonb,
  'email',
  now(),
  now()
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
