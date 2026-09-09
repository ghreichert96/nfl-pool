alter table public.pool_entries
  add column is_test boolean not null default false;

create index pool_entries_test_idx on public.pool_entries (season_id)
  where is_test;

create table public.test_lab_states (
  pool_id bigint primary key references public.pools (id) on delete cascade,
  season_id bigint not null references public.seasons (id) on delete cascade,
  week_id bigint not null references public.pool_weeks (id) on delete cascade,
  stage text not null default 'pre_freeze' check (stage in (
    'pre_freeze', 'lines_frozen', 'thursday_live', 'thursday_final',
    'sunday_early', 'sunday_late', 'sunday_complete', 'week_final'
  )),
  dummy_user_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create trigger test_lab_states_set_updated_at
before update on public.test_lab_states
for each row execute function private.set_updated_at();

alter table public.test_lab_states enable row level security;
revoke all on table public.test_lab_states from anon, authenticated;
grant select on table public.test_lab_states to authenticated;

create policy test_lab_states_select_for_commissioners
on public.test_lab_states for select to authenticated
using ((select private.is_pool_commissioner(pool_id)));
