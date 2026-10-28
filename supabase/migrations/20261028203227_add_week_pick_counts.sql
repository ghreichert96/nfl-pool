-- Reveal category occupancy only. Team, game, direction, and kickoff stay private.
create function private.authorized_week_pick_counts(target_week_id bigint)
returns table(entry_id bigint, ats_count integer, total_count integer,
  has_best_bet boolean, has_underdog boolean, has_sudden_death boolean)
language plpgsql stable security definer set search_path='' as $$
declare target_season bigint; target_pool bigint;
begin
  select w.season_id,s.pool_id into target_season,target_pool
  from public.pool_weeks w join public.seasons s on s.id=w.season_id
  where w.id=target_week_id and w.published_at is not null;
  if target_pool is null or (select auth.uid()) is null
    or not private.is_pool_member(target_pool) then
    raise exception 'Pool membership required';
  end if;
  return query
  select e.id, count(p.id) filter(where p.kind='ats')::integer,
    count(p.id) filter(where p.kind='total')::integer,
    coalesce(bool_or(p.kind='ats' and p.is_best_bet),false),
    coalesce(bool_or(p.kind='underdog'),false),
    coalesce(bool_or(p.kind='sudden_death'),false)
  from public.pool_entries e
  left join public.picks p on p.submission_id=private.latest_submission_id(e.id,target_week_id)
  where e.season_id=target_season
  group by e.id order by e.id;
end;
$$;
revoke all on function private.authorized_week_pick_counts(bigint) from public,anon,authenticated;
grant execute on function private.authorized_week_pick_counts(bigint) to authenticated;
create function public.week_pick_counts(target_week_id bigint)
returns table(entry_id bigint, ats_count integer, total_count integer,
  has_best_bet boolean, has_underdog boolean, has_sudden_death boolean)
language sql stable security invoker set search_path='' as $$
  select * from private.authorized_week_pick_counts(target_week_id);
$$;
revoke all on function public.week_pick_counts(bigint) from public,anon,authenticated;
grant execute on function public.week_pick_counts(bigint) to authenticated;
