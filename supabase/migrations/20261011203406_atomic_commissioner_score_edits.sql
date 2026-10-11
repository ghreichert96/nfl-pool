-- Save the Scores table together; reuse the existing final/result scoring pipeline.
create function public.save_score_batch(target_week_id bigint, edits jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare pool bigint; item jsonb; game public.games;
begin
 select s.pool_id into strict pool from public.pool_weeks w join public.seasons s on s.id=w.season_id where w.id=target_week_id;
 if auth.uid() is null or not private.is_pool_commissioner(pool) then raise exception 'Commissioner access required'; end if;
 if jsonb_typeof(edits) is distinct from 'array' or jsonb_array_length(edits)>32 then raise exception 'Invalid edits'; end if;
 for item in select value from jsonb_array_elements(edits) order by (value->>'game_id')::bigint loop
  select * into strict game from public.games where id=(item->>'game_id')::bigint and week_id=target_week_id for update;
  if game.updated_at is distinct from (item->>'updated_at')::timestamptz then raise exception 'Scores changed. Refresh before saving.'; end if;
  perform public.save_final_game_result(game.id,(item->>'away_score')::integer,(item->>'home_score')::integer,'commissioner',null,true,item->'score_rows',auth.uid());
  insert into public.commissioner_audit_events(pool_id,actor_id,action,entity_type,entity_id,details)
  values(pool,auth.uid(),'game_result_recorded','game',game.id::text,jsonb_build_object('away_score',item->'away_score','home_score',item->'home_score'));
 end loop;
end; $$;
revoke all on function public.save_score_batch(bigint,jsonb) from public,anon;
grant execute on function public.save_score_batch(bigint,jsonb) to authenticated;
