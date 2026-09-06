create or replace function public.provision_invited_entry(
  target_user_id uuid,
  target_pool_id bigint,
  target_season_id bigint,
  target_entry_code text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_entry_id bigint;
begin
  if not exists (
    select 1
    from public.seasons as season
    where season.id = target_season_id
      and season.pool_id = target_pool_id
      and season.status in ('setup', 'open')
  ) then
    raise exception 'Enrollment is not open for this season';
  end if;

  if not exists (
    select 1
    from auth.users as user_account
    where user_account.id = target_user_id
  ) then
    raise exception 'Invited user does not exist';
  end if;

  insert into public.profiles (id, display_name)
  values (target_user_id, target_entry_code)
  on conflict (id) do nothing;

  insert into public.pool_memberships (pool_id, user_id, role)
  values (target_pool_id, target_user_id, 'member')
  on conflict (pool_id, user_id) do nothing;

  insert into public.pool_entries (season_id, user_id, entry_code)
  values (target_season_id, target_user_id, target_entry_code)
  on conflict (season_id, user_id) do nothing
  returning id into target_entry_id;

  if target_entry_id is null then
    select entry.id
    into target_entry_id
    from public.pool_entries as entry
    where entry.season_id = target_season_id
      and entry.user_id = target_user_id;
  end if;

  return target_entry_id;
end;
$$;

revoke all on function public.provision_invited_entry(uuid, bigint, bigint, text)
  from public, anon, authenticated;
grant execute on function public.provision_invited_entry(uuid, bigint, bigint, text)
  to service_role;
