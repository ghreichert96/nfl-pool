drop policy if exists payouts_manage_for_commissioners on public.payout_schedules;
create policy payouts_manage_for_commissioners
on public.payout_schedules for all to authenticated
using (
  exists (
    select 1 from public.seasons season
    where season.id = payout_schedules.season_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
)
with check (
  exists (
    select 1 from public.seasons season
    where season.id = payout_schedules.season_id
      and (select private.is_pool_commissioner(season.pool_id))
  )
);

update public.payout_schedules
set locked_at = null
where season_id in (
  select season.id
  from public.seasons season
  join public.pools pool on pool.id = season.pool_id
  where pool.slug = 'hppp' and season.year = 2026
);

delete from public.payout_schedules
where season_id in (
  select season.id
  from public.seasons season
  join public.pools pool on pool.id = season.pool_id
  where pool.slug = 'hppp' and season.year = 2026
);

insert into public.payout_schedules (season_id, rank, amount)
select season.id, scale.rank, scale.amount
from public.seasons season
join public.pools pool on pool.id = season.pool_id
cross join (values
  (1, 350), (2, 300), (3, 250), (4, 200),
  (5, 150), (6, 100), (7, 50), (8, 0),
  (9, 0), (10, -50), (11, -100), (12, -150),
  (13, -200), (14, -250), (15, -300), (16, -350)
) as scale(rank, amount)
where pool.slug = 'hppp' and season.year = 2026;
