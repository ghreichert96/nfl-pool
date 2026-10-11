-- Hosted default privileges can be broader than local defaults.
-- The activity log is read-only and row-level security limits it to commissioners.
revoke all on public.odds_schedule_slots from anon, authenticated;
revoke all on sequence public.odds_schedule_slots_id_seq from anon, authenticated;
grant select on public.odds_schedule_slots to authenticated;
