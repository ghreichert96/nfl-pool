insert into public.pool_entries (season_id, user_id, entry_code)
select season.id, membership.user_id, 'HARR'
from public.seasons as season
join public.pools as pool on pool.id = season.pool_id
join public.pool_memberships as membership
  on membership.pool_id = pool.id and membership.role = 'commissioner'
join auth.users as auth_user on auth_user.id = membership.user_id
where pool.slug = 'hppp'
  and season.year = 2026
  and auth_user.email not like '%.test'
order by membership.created_at
limit 1
on conflict (season_id, user_id) do nothing;
