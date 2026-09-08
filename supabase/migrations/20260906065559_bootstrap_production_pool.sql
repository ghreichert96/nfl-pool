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

do $$
begin
  if to_regclass('legacy.users') is not null then
    insert into public.profiles (id, display_name)
    select
      legacy_user.id,
      coalesce(nullif(btrim(legacy_user.name), ''), 'Commissioner')
    from legacy.users as legacy_user
    where legacy_user.is_admin is true
      and exists (
        select 1 from auth.users as auth_user
        where auth_user.id = legacy_user.id
      )
    on conflict (id) do nothing;

    insert into public.pool_memberships (pool_id, user_id, role)
    select pool.id, legacy_user.id, 'commissioner'
    from public.pools as pool
    cross join legacy.users as legacy_user
    where pool.slug = 'hppp'
      and legacy_user.is_admin is true
      and exists (
        select 1 from auth.users as auth_user
        where auth_user.id = legacy_user.id
      )
    on conflict (pool_id, user_id) do update set role = excluded.role;

    update public.pools as pool
    set created_by = (
      select legacy_user.id
      from legacy.users as legacy_user
      where legacy_user.is_admin is true
        and exists (
          select 1 from auth.users as auth_user
          where auth_user.id = legacy_user.id
        )
      order by legacy_user.id
      limit 1
    )
    where pool.slug = 'hppp'
      and pool.created_by is null;
  end if;
end;
$$;
