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
 (990003,990001,8,'SD week 8',now()+interval '1 day',now());
insert into public.games(id,week_id,away_team,home_team,kickoff_at,status,away_score,home_score) overriding system value values
 (990001,990001,'BUF','MIA',now()-interval '19 days','scheduled',10,20),
 (990002,990002,'KC','DEN',now()-interval '9 days','scheduled',10,20),
 (990003,990003,'BUF','MIA',now()+interval '2 days','scheduled',null,null);
insert into public.weekly_submissions(id,entry_id,week_id,revision) overriding system value values
 (990001,990001,990001,1),(990002,990002,990001,1),
 (990003,990001,990002,1),(990004,990002,990002,1),
 (990005,990001,990003,1);

insert into public.sd_contests(id,season_id,number,start_week,end_week,strike_limit,pot,completed_week) overriding system value values
 (990001,990001,1,1,2,2,225,2),(990002,990001,2,8,18,2,225,null);
insert into public.sd_participants(contest_id,entry_id) values (990001,990001),(990001,990002),(990002,990001),(990002,990002);
insert into public.picks(submission_id,game_id,kind,team) values
 (990001,990001,'sudden_death','BUF'),(990002,990001,'sudden_death','MIA'),
 (990003,990002,'sudden_death','KC'),(990004,990002,'sudden_death','DEN');
update public.games set status='final' where id in(990001,990002);
select is((private.sd_contest_state(990001,8)->'strikes'->>'990001')::integer,2,'SD1 entrant is eliminated');
select is((private.sd_eligibility(990001,990003)->>'strikes')::integer,0,'SD2 starts fresh');
select is((private.sd_eligibility(990001,990003)->>'unavailable')::boolean,false,'SD1 elimination does not block SD2');
select is(private.sd_eligibility(990001,990003)->'usedTeams','[]'::jsonb,'SD1 teams reset');
select ok(not has_function_privilege('anon','public.sd_eligibility(bigint,bigint)','execute'),'anonymous denied');
select ok(not has_function_privilege('anon','public.configure_sd_contest(bigint,integer,numeric)','execute'),'anonymous cannot configure contests');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000009901","role":"authenticated"}',true);
select lives_ok($$select public.submit_weekly_picks(990001,990003,'[{"game_id":990003,"kind":"sudden_death","team":"BUF","sd_contest_id":990002},{"game_id":990003,"kind":"ats","team":"BUF","is_best_bet":true}]')$$,'owner can reuse SD1 team in SD2');
select throws_ok($$select public.submit_weekly_picks(990001,990003,'[{"game_id":990003,"kind":"sudden_death","team":"BUF","sd_contest_id":990001}]')$$,'P0001','SD contest changed. Reload your picks.','stale contest context is rejected atomically');
select throws_ok($$select public.configure_sd_contest(990002,1,225)$$,'P0001','Commissioner access required','entry owner cannot change contest rules');
select throws_ok('select public.sd_eligibility(990002,990003)','P0001','Entry is not available to this user','owner cannot inspect someone else');
reset role;
select is((select sd_contest_id from public.picks where submission_id=private.latest_submission_id(990001,990003) and kind='sudden_death'),990002::bigint,'trigger records the correct contest');
insert into public.weekly_submissions(id,entry_id,week_id,revision) overriding system value values(990006,990002,990003,1);
insert into public.picks(submission_id,game_id,kind,team) values(990006,990003,'sudden_death','MIA');
insert into public.pool_weeks(id,season_id,week_number,label,lines_freeze_at,published_at) overriding system value values
 (990004,990001,9,'SD2 week 9',now()+interval '8 days',now()),(990005,990001,10,'SD2 week 10',now()+interval '15 days',now());
insert into public.games(id,week_id,away_team,home_team,kickoff_at,status,away_score,home_score) overriding system value values
 (990004,990004,'BUF','KC',now()+interval '9 days','scheduled',10,20),(990005,990005,'SEA','DEN',now()+interval '16 days','scheduled',null,null);
insert into public.weekly_submissions(id,entry_id,week_id,revision) overriding system value values
 (990007,990001,990004,1),(990008,990002,990004,1),(990009,990001,990005,1);
update public.games set kickoff_at=now()-interval '1 hour',away_score=30,home_score=10 where id=990003;
select throws_ok($$insert into public.picks(submission_id,game_id,kind,team) values(990007,990004,'sudden_death','BUF')$$,'P0001','SD team has already been used in this contest','SD2 reuse is blocked');
select throws_ok($$insert into public.picks(submission_id,game_id,kind,team,sd_contest_id) values(990007,990004,'sudden_death','KC',990001)$$,'P0001','SD contest does not match this week','direct wrong-contest insert blocked');
select throws_ok($$update public.sd_contests set strike_limit=1 where id=990002$$,'P0001','SD contest settings are locked after kickoff','strike limit locks at kickoff');
update public.games set status='final' where id=990003;
select is((private.sd_eligibility(990002,990004)->>'strikes')::integer,1,'first SD2 loss is one strike');
insert into public.picks(submission_id,game_id,kind,team) values(990007,990004,'sudden_death','KC'),(990008,990004,'sudden_death','BUF');
select throws_ok($$update public.picks set team='BUF' where submission_id=990007$$,'P0001','SD team has already been used in this contest','direct update cannot reuse a team');
update public.games set status='final' where id=990004;
select is((private.sd_contest_state(990002,10)->>'completedWeek')::integer,9,'sole survivor closes SD2');
select is((private.sd_eligibility(990001,990005)->>'strikes')::integer,0,'winner stops accruing missing strikes');
select is((private.sd_eligibility(990001,990005)->>'unavailable')::boolean,true,'closed contest stops picks even for winner');
select throws_ok($$insert into public.picks(submission_id,game_id,kind,team) values(990009,990005,'sudden_death','SEA')$$,'P0001','Sudden Death entry is eliminated','closed contest direct writes blocked');
select is((private.sd_contest_state(990001,19)->'strikes'->>'990001')::integer,2,'SD2 cannot change SD1');
set local role authenticated;
select lives_ok($$select public.submit_weekly_picks(990001,990005,'[{"game_id":990005,"kind":"ats","team":"SEA","is_best_bet":true}]')$$,'closed SD does not prevent Main submission');
reset role;
-- Corrected scores recompute SD2 independently.
update public.games set away_score=20,home_score=20 where id=990004;
select is((private.sd_eligibility(990002,990005)->>'strikes')::integer,1,'corrected tie removes the second strike');
select is((private.sd_eligibility(990001,990005)->>'unavailable')::boolean,false,'corrected contest reopens eligibility');
select * from finish();
rollback;
