begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select has_table('public', 'pool_invitations', 'pending invitations exist');
select has_table('public', 'rule_sections', 'editable rules exist');
select is((select count(*) from public.rule_sections)::integer, 4, 'four canonical rule sections are seeded');

insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000081', 'joiner@example.test', '{}');
insert into public.pool_invitations (id, pool_id, season_id, target_user_id, email, phone_e164, invited_by)
select '00000000-0000-0000-0000-000000000082', pool.id, season.id,
  '00000000-0000-0000-0000-000000000081', 'joiner@example.test', '+12125551212', '00000000-0000-0000-0000-000000000010'
from public.pools pool join public.seasons season on season.pool_id = pool.id
where pool.slug = 'hppp' and season.year = 2026;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000081', true);
select ok(public.accept_pool_invitation('00000000-0000-0000-0000-000000000082', 'DAD') > 0, 'entrant accepts invitation');
select is((select entry_code from public.pool_entries where user_id = auth.uid()), 'DAD', 'entrant claims abbreviation');
select is((select phone_e164 from public.profiles where id = auth.uid()), '+12125551212', 'phone is copied privately');
select is((select status from public.pool_invitations where id = '00000000-0000-0000-0000-000000000082'), 'accepted', 'invitation is consumed');

reset role;
select * from finish();
rollback;
