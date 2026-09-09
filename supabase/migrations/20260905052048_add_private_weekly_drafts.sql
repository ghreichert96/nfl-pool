create table public.weekly_drafts (
  entry_id bigint not null references public.pool_entries (id) on delete cascade,
  week_id bigint not null references public.pool_weeks (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  schema_version smallint not null default 1 check (schema_version > 0),
  updated_at timestamptz not null default now(),
  primary key (entry_id, week_id)
);

create index weekly_drafts_week_id_idx on public.weekly_drafts (week_id);

create trigger weekly_drafts_set_updated_at
before update on public.weekly_drafts
for each row execute function private.set_updated_at();

alter table public.weekly_drafts enable row level security;

revoke all on table public.weekly_drafts from anon, authenticated;
grant select, insert, update, delete on table public.weekly_drafts to authenticated;

create policy drafts_select_own
on public.weekly_drafts
for select
to authenticated
using (
  exists (
    select 1
    from public.pool_entries as entry
    where entry.id = weekly_drafts.entry_id
      and entry.user_id = (select auth.uid())
  )
);

create policy drafts_insert_own
on public.weekly_drafts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.pool_entries as entry
    where entry.id = weekly_drafts.entry_id
      and entry.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.pool_entries as entry
    where entry.id = weekly_drafts.entry_id
      and entry.season_id = (
        select week.season_id
        from public.pool_weeks as week
        where week.id = weekly_drafts.week_id
      )
  )
);

create policy drafts_update_own
on public.weekly_drafts
for update
to authenticated
using (
  exists (
    select 1
    from public.pool_entries as entry
    where entry.id = weekly_drafts.entry_id
      and entry.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.pool_entries as entry
    where entry.id = weekly_drafts.entry_id
      and entry.user_id = (select auth.uid())
      and entry.season_id = (
        select week.season_id
        from public.pool_weeks as week
        where week.id = weekly_drafts.week_id
      )
  )
);

create policy drafts_delete_own
on public.weekly_drafts
for delete
to authenticated
using (
  exists (
    select 1
    from public.pool_entries as entry
    where entry.id = weekly_drafts.entry_id
      and entry.user_id = (select auth.uid())
  )
);
