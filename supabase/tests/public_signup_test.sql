begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_trigger(
  'auth',
  'users',
  'enroll_public_signup_after_auth_user',
  'public signup enrollment trigger exists'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000091',
  'self-signup@example.test',
  '{"hppp_public_signup":true,"entry_code":"TST","phone_e164":"+12125550191"}'
);

select is(
  (select entry_code from public.pool_entries where user_id = '00000000-0000-0000-0000-000000000091'),
  'TST',
  'public signup creates the entry'
);
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000091'),
  'TST',
  'entry name is the profile label'
);
select is(
  (select phone_e164 from public.profiles where id = '00000000-0000-0000-0000-000000000091'),
  '+12125550191',
  'public signup stores the phone privately'
);
select is(
  (select role from public.pool_memberships where user_id = '00000000-0000-0000-0000-000000000091'),
  'member',
  'public signup creates a member role'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000091', true);
select lives_ok(
  $$select public.update_own_entry_settings('NEW', '+12125550192')$$,
  'entrant can update entry name and phone atomically'
);
select is(
  (select entry_code from public.pool_entries where user_id = auth.uid()),
  'NEW',
  'entry name updates immediately'
);
select is(
  (select phone_e164 from public.profiles where id = auth.uid()),
  '+12125550192',
  'phone updates without a profile save error'
);

reset role;
select * from finish();
rollback;
