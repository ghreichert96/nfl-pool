begin;
create extension if not exists pgtap with schema extensions;
select plan(10);
create temp table final_fixture (week_id bigint, open_game bigint, early_game bigint);
do $$
declare s bigint; w bigint; g1 bigint; g2 bigint;
begin
  insert into public.seasons(pool_id,year,status) select id,2099,'setup' from public.pools limit 1 returning id into s;
  insert into public.pool_weeks(season_id,week_number,label,lines_freeze_at)
    values(s,1,'Final refresh test',now()+interval '3 days') returning id into w;
  insert into public.games(week_id,away_team,home_team,kickoff_at)
    values(w,'BUF','MIA',now()+interval '5 days') returning id into g1;
  insert into public.games(week_id,away_team,home_team,kickoff_at)
    values(w,'KC','DEN',now()+interval '2 hours') returning id into g2;
  insert into public.pool_lines(game_id,away_spread,total,source,frozen_at)
    values(g1,-3,44,'consensus',now()),(g2,-4,45,'consensus',now());
  update public.games set kickoff_at=now()+interval '30 minutes' where id=g2;
  update public.pool_weeks set lines_freeze_at=now()-interval '5 minutes' where id=w;
  insert into final_fixture values(w,g1,g2);
end;
$$;
select ok(not has_function_privilege('authenticated','public.finalize_week_odds(bigint,jsonb)','execute'), 'entrants cannot finalize odds');
select ok(not has_function_privilege('anon','public.finalize_week_odds(bigint,jsonb)','execute'), 'anonymous callers cannot finalize odds');
select ok(has_function_privilege('service_role','public.finalize_week_odds(bigint,jsonb)','execute'), 'service can finalize odds');
grant select on final_fixture to service_role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok(format('update public.pool_lines set away_spread=-6 where game_id=%s',(select open_game from final_fixture)), 'P0001','Lines for this game are frozen','normal ingestion still respects the deadline');
select throws_ok(format('select public.finalize_week_odds(%s, ''[]''::jsonb)',(select week_id from final_fixture)), 'P0001','Final refresh is missing eligible game lines','missing consensus prevents finalization');
select ok((select lines_frozen_at is null from public.pool_weeks where id=(select week_id from final_fixture)), 'failed final refresh leaves board unlocked');
select is(public.finalize_week_odds((select week_id from final_fixture),
  (select jsonb_build_array(jsonb_build_object('game_id',open_game,'away_spread',-6,'total',46),jsonb_build_object('game_id',early_game,'away_spread',-7,'total',47)) from final_fixture)),1,'delayed final refresh updates only the eligible game');
select is((select away_spread from public.pool_lines where game_id=(select early_game from final_fixture)), -4.0::numeric,'earlier game-specific lock is preserved');
select ok((select lines_frozen_at is not null from public.pool_weeks where id=(select week_id from final_fixture)), 'successful final refresh locks board');
select is(public.finalize_week_odds((select week_id from final_fixture),'[]'::jsonb),0,'repeat finalization is a no-op');
select * from finish();
rollback;
