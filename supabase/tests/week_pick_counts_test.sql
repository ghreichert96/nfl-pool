begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000009901','sd-one@example.test','{}'),
 ('00000000-0000-0000-0000-000000009902','sd-two@example.test','{}');
insert into public.profiles(id,display_name) values
 ('00000000-0000-0000-0000-000000009901','SD One'),
 ('00000000-0000-0000-0000-000000009902','SD Two');
insert into public.seasons(id,pool_id,year,status) overriding system value
select 990001,id,2097,'setup' from public.pools limit 1;
insert into public.pool_memberships(pool_id,user_id)
select pool_id,u from public.seasons cross join unnest(array[
 '00000000-0000-0000-0000-000000009901'::uuid,
 '00000000-0000-0000-0000-000000009902'::uuid]) u where id=990001;
insert into public.pool_entries(id,season_id,user_id,entry_code) overriding system value values
 (990001,990001,'00000000-0000-0000-0000-000000009901','SDO'),
 (990002,990001,'00000000-0000-0000-0000-000000009902','SDT');
insert into public.pool_weeks(id,season_id,week_number,label,lines_freeze_at,published_at) overriding system value values
 (990001,990001,1,'SD week 1',now()-interval '20 days',now()),
 (990002,990001,2,'SD week 2',now()-interval '10 days',now()),
 (990003,990001,3,'SD week 3',now()+interval '1 day',now());
insert into public.games(id,week_id,away_team,home_team,kickoff_at,status,away_score,home_score) overriding system value values
 (990001,990001,'BUF','MIA',now()-interval '19 days','scheduled',10,20),
 (990002,990002,'KC','DEN',now()-interval '9 days','scheduled',10,20),
 (990003,990003,'BAL','PIT',now()+interval '2 days','scheduled',null,null);
insert into public.weekly_submissions(id,entry_id,week_id,revision) overriding system value values
 (990001,990001,990001,1),(990002,990002,990001,1),
 (990003,990001,990002,1),(990004,990002,990002,1),
 (990005,990001,990003,1);
insert into public.picks(submission_id,game_id,kind,team) values
 (990001,990001,'sudden_death','BUF'),(990002,990001,'sudden_death','MIA'),
 (990003,990002,'sudden_death','KC'),(990004,990002,'sudden_death','DEN'),
 (990005,990003,'sudden_death','BAL');

insert into public.weekly_submissions(id,entry_id,week_id,revision) overriding system value values (990007,990002,990003,1);
insert into public.picks(submission_id,game_id,kind,team,total_direction,is_best_bet) values
 (990007,990003,'ats','BAL',null,true),
 (990007,990003,'total',null,'over',false),
 (990007,990003,'sudden_death','PIT',null,false);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000009901","role":"authenticated"}',true);
select is((select count(*) from public.picks where submission_id=990007),0::bigint,'opponent future selections remain private');
select is((select count(*) from public.week_pick_counts(990003)),2::bigint,'counts are limited to the target season');
select is((select ats_count from public.week_pick_counts(990003) where entry_id=990002),1,'unrevealed ATS occupancy is correct');
select is((select total_count from public.week_pick_counts(990003) where entry_id=990002),1,'unrevealed total occupancy is correct');
select ok((select has_best_bet and has_sudden_death and not has_underdog from public.week_pick_counts(990003) where entry_id=990002),'only submitted side categories and BB are present');
select is((select array_agg(key order by key) from jsonb_object_keys((select to_jsonb(c) from public.week_pick_counts(990003) c where entry_id=990002)) key),
 array['ats_count','entry_id','has_best_bet','has_sudden_death','has_underdog','total_count']::text[], 'no game IDs, teams, directions or kickoff are exposed');
select ok(not has_function_privilege('anon','public.week_pick_counts(bigint)','execute'),'anonymous execution is denied');
reset role;
insert into public.weekly_submissions(id,entry_id,week_id,revision) overriding system value values(990008,990002,990003,2);
set local role authenticated;
select is((select ats_count+total_count from public.week_pick_counts(990003) where entry_id=990002),0,'latest empty revision removes placeholders');
select ok((select not has_best_bet and not has_sudden_death and not has_underdog from public.week_pick_counts(990003) where entry_id=990002),'empty revision is distinct from a full hidden row');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000009999","role":"authenticated"}',true);
select throws_ok('select public.week_pick_counts(990003)','P0001','Pool membership required','nonmember cannot inspect occupancy');
reset role;
update public.pool_weeks set published_at=null where id=990003;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000009901","role":"authenticated"}',true);
select throws_ok('select public.week_pick_counts(990003)','P0001','Pool membership required','unpublished weeks remain private');
reset role;
select * from finish();
rollback;
