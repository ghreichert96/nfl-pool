create or replace function private.enroll_public_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code text := upper(btrim(new.raw_user_meta_data ->> 'entry_code'));
  signup_phone text := btrim(new.raw_user_meta_data ->> 'phone_e164');
  target_pool_id bigint;
  target_season_id bigint;
  public_signup boolean := coalesce(new.raw_user_meta_data ->> 'hppp_public_signup', '') = 'true';
begin
  if not public_signup then return new; end if;
  if normalized_code !~ '^[A-Z]{3,4}$' then raise exception 'Invalid entry name'; end if;
  if signup_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Invalid phone number'; end if;

  select pool.id, season.id
  into target_pool_id, target_season_id
  from public.pools pool
  join public.seasons season on season.pool_id = pool.id
  where pool.slug = 'hppp'
    and season.status in ('setup', 'open')
    and (season.enrollment_closes_at is null or now() < season.enrollment_closes_at)
  order by season.year desc
  limit 1;

  if target_season_id is null then raise exception 'Enrollment is closed'; end if;

  insert into public.profiles (id, display_name, phone_e164)
  values (new.id, normalized_code, signup_phone)
  on conflict (id) do update
  set display_name = excluded.display_name, phone_e164 = excluded.phone_e164;

  insert into public.pool_memberships (pool_id, user_id, role)
  values (target_pool_id, new.id, 'member')
  on conflict (pool_id, user_id) do nothing;

  insert into public.pool_entries (season_id, user_id, entry_code)
  values (target_season_id, new.id, normalized_code);

  insert into public.commissioner_audit_events
    (pool_id, actor_id, action, entity_type, entity_id, details)
  values
    (target_pool_id, new.id, 'entrant_self_enrolled', 'pool_entry', new.id::text,
      jsonb_build_object('entry_code', normalized_code));

  return new;
end;
$$;

revoke all on function private.enroll_public_signup() from public, anon, authenticated;

create trigger enroll_public_signup_after_auth_user
after insert on auth.users
for each row execute function private.enroll_public_signup();

create or replace function public.update_own_entry_settings(
  requested_entry_code text,
  requested_phone text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code text := upper(btrim(requested_entry_code));
  normalized_phone text := nullif(btrim(requested_phone), '');
  target_entry_id bigint;
  prior_entry_code text;
  target_pool_id bigint;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if normalized_code !~ '^[A-Z]{3,4}$' then raise exception 'Invalid entry name'; end if;
  if normalized_phone is not null and normalized_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Invalid phone number';
  end if;

  select entry.id, entry.entry_code, season.pool_id
  into target_entry_id, prior_entry_code, target_pool_id
  from public.pool_entries entry
  join public.seasons season on season.id = entry.season_id
  where entry.user_id = (select auth.uid())
  order by season.year desc
  limit 1
  for update of entry;

  if target_entry_id is null then raise exception 'Entry not found'; end if;

  update public.pool_entries
  set entry_code = normalized_code
  where id = target_entry_id;

  update public.profiles
  set display_name = normalized_code,
      phone_e164 = coalesce(normalized_phone, phone_e164)
  where id = (select auth.uid());

  insert into public.commissioner_audit_events
    (pool_id, actor_id, action, entity_type, entity_id, details)
  values
    (target_pool_id, (select auth.uid()), 'entrant_settings_changed',
      'pool_entry', target_entry_id::text,
      jsonb_build_object('from', prior_entry_code, 'to', normalized_code));
end;
$$;

revoke all on function public.update_own_entry_settings(text, text) from public, anon;
grant execute on function public.update_own_entry_settings(text, text) to authenticated;
