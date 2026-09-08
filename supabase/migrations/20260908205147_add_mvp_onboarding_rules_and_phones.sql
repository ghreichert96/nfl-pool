alter table public.profiles
  add column phone_e164 text
  check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$');
grant update (phone_e164) on public.profiles to authenticated;

create table public.pool_invitations (
  id uuid primary key default gen_random_uuid(),
  pool_id bigint not null references public.pools (id) on delete cascade,
  season_id bigint not null references public.seasons (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  email text not null check (email = lower(btrim(email))),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references auth.users (id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, email),
  unique (season_id, target_user_id)
);

create index pool_invitations_pool_status_idx
  on public.pool_invitations (pool_id, status, created_at desc);

create table public.rule_sections (
  id bigint generated always as identity primary key,
  pool_id bigint not null references public.pools (id) on delete cascade,
  section_key text not null check (section_key ~ '^[a-z0-9_]+$'),
  position smallint not null check (position > 0),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  summary text not null check (char_length(btrim(summary)) between 1 and 600),
  detail text not null default '' check (char_length(detail) <= 600),
  revision integer not null default 1 check (revision > 0),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (pool_id, section_key),
  unique (pool_id, position)
);

create trigger pool_invitations_set_updated_at before update on public.pool_invitations
for each row execute function private.set_updated_at();
create trigger rule_sections_set_updated_at before update on public.rule_sections
for each row execute function private.set_updated_at();

alter table public.pool_invitations enable row level security;
alter table public.rule_sections enable row level security;

revoke all on table public.pool_invitations, public.rule_sections from anon, authenticated;
grant select, update on public.pool_invitations to authenticated;
grant select, update on public.rule_sections to authenticated;
grant usage, select on sequence public.rule_sections_id_seq to authenticated;

create policy invitations_select_own_or_commissioned
on public.pool_invitations for select to authenticated
using (
  target_user_id = (select auth.uid())
  or (select private.is_pool_commissioner(pool_id))
);

create policy invitations_update_for_commissioners
on public.pool_invitations for update to authenticated
using ((select private.is_pool_commissioner(pool_id)))
with check ((select private.is_pool_commissioner(pool_id)));

create policy rules_select_for_members
on public.rule_sections for select to authenticated
using ((select private.is_pool_member(pool_id)));

create policy rules_update_for_commissioners
on public.rule_sections for update to authenticated
using ((select private.is_pool_commissioner(pool_id)))
with check ((select private.is_pool_commissioner(pool_id)));

drop policy entries_update_own_while_open on public.pool_entries;
create policy entries_update_own
on public.pool_entries for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function public.accept_pool_invitation(
  invitation_id uuid,
  requested_entry_code text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.pool_invitations%rowtype;
  normalized_code text := upper(btrim(requested_entry_code));
  accepted_entry_id bigint;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if normalized_code !~ '^[A-Z]{3,4}$' then raise exception 'Invalid entry abbreviation'; end if;

  select * into invitation
  from public.pool_invitations
  where id = invitation_id
  for update;

  if invitation.id is null or invitation.target_user_id <> (select auth.uid()) then
    raise exception 'Invitation not found';
  end if;
  if invitation.status <> 'pending' or invitation.expires_at <= now() then
    if invitation.status = 'pending' and invitation.expires_at <= now() then
      update public.pool_invitations set status = 'expired' where id = invitation.id;
    end if;
    raise exception 'Invitation is no longer valid';
  end if;
  if not exists (
    select 1 from public.seasons season
    where season.id = invitation.season_id and season.pool_id = invitation.pool_id
      and season.status in ('setup', 'open')
      and (season.enrollment_closes_at is null or now() < season.enrollment_closes_at)
  ) then raise exception 'Enrollment is closed'; end if;

  insert into public.profiles (id, display_name, phone_e164)
  values ((select auth.uid()), normalized_code, invitation.phone_e164)
  on conflict (id) do update set phone_e164 = excluded.phone_e164;

  insert into public.pool_memberships (pool_id, user_id, role)
  values (invitation.pool_id, (select auth.uid()), 'member')
  on conflict (pool_id, user_id) do nothing;

  insert into public.pool_entries (season_id, user_id, entry_code)
  values (invitation.season_id, (select auth.uid()), normalized_code)
  on conflict (season_id, user_id) do update set entry_code = excluded.entry_code
  returning id into accepted_entry_id;

  update public.pool_invitations
  set status = 'accepted', accepted_at = now()
  where id = invitation.id;

  return accepted_entry_id;
end;
$$;

revoke all on function public.accept_pool_invitation(uuid, text) from public, anon;
grant execute on function public.accept_pool_invitation(uuid, text) to authenticated;

insert into public.rule_sections (pool_id, section_key, position, title, summary, detail)
select pool.id, seed.section_key, seed.position, seed.title, seed.summary, seed.detail
from public.pools pool
cross join (values
  ('weekly_card', 1, 'Weekly card', 'Choose six teams against the spread and three game totals. Mark one ATS selection as your Best Bet. Also choose one Sudden Death team and one underdog.', 'A missing standard selection is a loss. A missing Best Bet adds another loss.'),
  ('lines_deadlines', 2, 'Lines & deadlines', 'Everyone uses the same betting-line slate, frozen Thursday at 8:00 PM Eastern. Each selection remains editable until its game kicks off.', 'Special schedules can use a commissioner-set freeze time.'),
  ('visibility', 3, 'Visibility', 'Competitors’ selections are hidden until the associated game begins. The weekly grid reveals picks one game at a time at kickoff.', 'Later-game selections stay private.'),
  ('scoring', 4, 'Scoring', 'Standard ATS and total wins earn one win. A Best Bet is worth two decisions. Main-pool pushes are ties.', 'Season rank payouts are configured after enrollment closes.'),
  ('sudden_death', 5, 'Sudden Death', 'Pick one outright winner each week. A second loss eliminates you. A tied NFL game adds no strike.', 'A simultaneous final-strike wipeout is waived; Week 18 survivors split the pot.'),
  ('underdog', 6, 'Underdog', 'Choose one eligible underdog to win outright. An outright win earns the selected team’s frozen positive spread.', 'A tie, loss, or missing selection earns zero points.')
) seed(section_key, position, title, summary, detail)
where pool.slug = 'hppp'
on conflict (pool_id, section_key) do nothing;

update public.teams set logo_url = '/team-logos/' || lower(abbreviation) || '.png';
