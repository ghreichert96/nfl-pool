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
