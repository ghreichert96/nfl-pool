create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pools (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'America/New_York',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pools_created_by_idx
  on public.pools (created_by)
  where created_by is not null;

create table public.pool_memberships (
  pool_id bigint not null references public.pools (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'commissioner')),
  created_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);

create index pool_memberships_user_id_idx
  on public.pool_memberships (user_id);

create table public.seasons (
  id bigint generated always as identity primary key,
  pool_id bigint not null references public.pools (id) on delete cascade,
  year smallint not null check (year between 2020 and 2100),
  status text not null default 'setup' check (status in ('setup', 'open', 'active', 'complete')),
  enrollment_closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pool_id, year)
);

create table public.pool_entries (
  id bigint generated always as identity primary key,
  season_id bigint not null references public.seasons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_code text not null check (entry_code ~ '^[A-Z]{3,4}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, user_id),
  unique (season_id, entry_code)
);

create index pool_entries_user_id_idx
  on public.pool_entries (user_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger pools_set_updated_at
before update on public.pools
for each row execute function private.set_updated_at();

create trigger seasons_set_updated_at
before update on public.seasons
for each row execute function private.set_updated_at();

create trigger pool_entries_set_updated_at
before update on public.pool_entries
for each row execute function private.set_updated_at();

create or replace function private.is_pool_member(target_pool_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pool_memberships as membership
    where membership.pool_id = target_pool_id
      and membership.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_pool_commissioner(target_pool_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pool_memberships as membership
    where membership.pool_id = target_pool_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'commissioner'
  );
$$;

revoke all on function private.set_updated_at() from public;
revoke all on function private.is_pool_member(bigint) from public;
revoke all on function private.is_pool_commissioner(bigint) from public;

grant execute on function private.set_updated_at() to authenticated;
grant execute on function private.is_pool_member(bigint) to authenticated;
grant execute on function private.is_pool_commissioner(bigint) to authenticated;

alter table public.profiles enable row level security;
alter table public.pools enable row level security;
alter table public.pool_memberships enable row level security;
alter table public.seasons enable row level security;
alter table public.pool_entries enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.pools from anon, authenticated;
revoke all on table public.pool_memberships from anon, authenticated;
revoke all on table public.seasons from anon, authenticated;
revoke all on table public.pool_entries from anon, authenticated;

grant select on table public.profiles to authenticated;
grant insert (id, display_name), update (display_name) on table public.profiles to authenticated;

grant select on table public.pools to authenticated;
grant update (name, slug, timezone) on table public.pools to authenticated;

grant select, delete on table public.pool_memberships to authenticated;
grant insert (pool_id, user_id, role), update (role) on table public.pool_memberships to authenticated;

grant select, delete on table public.seasons to authenticated;
grant insert (pool_id, year, status, enrollment_closes_at),
  update (year, status, enrollment_closes_at) on table public.seasons to authenticated;

grant select, delete on table public.pool_entries to authenticated;
grant insert (season_id, user_id, entry_code), update (entry_code) on table public.pool_entries to authenticated;

grant usage, select on sequence public.seasons_id_seq to authenticated;
grant usage, select on sequence public.pool_entries_id_seq to authenticated;

create policy profiles_select_own_or_commissioned
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.pool_memberships as target_membership
    where target_membership.user_id = profiles.id
      and (select private.is_pool_commissioner(target_membership.pool_id))
  )
);

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy pools_select_for_members
on public.pools
for select
to authenticated
using ((select private.is_pool_member(id)));

create policy pools_update_for_commissioners
on public.pools
for update
to authenticated
using ((select private.is_pool_commissioner(id)))
with check ((select private.is_pool_commissioner(id)));

create policy memberships_select_own_or_commissioned
on public.pool_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_pool_commissioner(pool_id))
);

create policy memberships_insert_for_commissioners
on public.pool_memberships
for insert
to authenticated
with check ((select private.is_pool_commissioner(pool_id)));

create policy memberships_update_for_commissioners
on public.pool_memberships
for update
to authenticated
using ((select private.is_pool_commissioner(pool_id)))
with check ((select private.is_pool_commissioner(pool_id)));

create policy memberships_delete_for_commissioners
on public.pool_memberships
for delete
to authenticated
using ((select private.is_pool_commissioner(pool_id)));

create policy seasons_select_for_members
on public.seasons
for select
to authenticated
using ((select private.is_pool_member(pool_id)));

create policy seasons_insert_for_commissioners
on public.seasons
for insert
to authenticated
with check ((select private.is_pool_commissioner(pool_id)));

create policy seasons_update_for_commissioners
on public.seasons
for update
to authenticated
using ((select private.is_pool_commissioner(pool_id)))
with check ((select private.is_pool_commissioner(pool_id)));

create policy seasons_delete_for_commissioners
on public.seasons
for delete
to authenticated
using ((select private.is_pool_commissioner(pool_id)));

create policy entries_select_for_members
on public.pool_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.seasons as season
    where season.id = pool_entries.season_id
      and (select private.is_pool_member(season.pool_id))
  )
);

create policy entries_insert_own_while_open
on public.pool_entries
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.seasons as season
    where season.id = pool_entries.season_id
      and season.status in ('setup', 'open')
      and (season.enrollment_closes_at is null or now() < season.enrollment_closes_at)
      and (select private.is_pool_member(season.pool_id))
  )
);

create policy entries_insert_for_commissioners
on public.pool_entries
for insert
to authenticated
with check (
  exists (
    select 1
    from public.seasons as season
    where season.id = pool_entries.season_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
);

create policy entries_update_own_while_open
on public.pool_entries
for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.seasons as season
    where season.id = pool_entries.season_id
      and season.status in ('setup', 'open')
      and (season.enrollment_closes_at is null or now() < season.enrollment_closes_at)
  )
)
with check (user_id = (select auth.uid()));

create policy entries_update_for_commissioners
on public.pool_entries
for update
to authenticated
using (
  exists (
    select 1
    from public.seasons as season
    where season.id = pool_entries.season_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
)
with check (
  exists (
    select 1
    from public.seasons as season
    where season.id = pool_entries.season_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
);

create policy entries_delete_own_while_open
on public.pool_entries
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.seasons as season
    where season.id = pool_entries.season_id
      and season.status in ('setup', 'open')
      and (season.enrollment_closes_at is null or now() < season.enrollment_closes_at)
  )
);

create policy entries_delete_for_commissioners
on public.pool_entries
for delete
to authenticated
using (
  exists (
    select 1
    from public.seasons as season
    where season.id = pool_entries.season_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
);
