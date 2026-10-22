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
update public.games set status='final' where id in (990001,990002);
select is(private.sd_strikes_before_week(990001,990003),2,'two losing weeks eliminate the entrant');
select is(private.sd_strikes_before_week(990002,990003),0,'winning entrant remains eligible');
select is(private.sd_strikes_before_week(990001,990002),1,'historical eligibility excludes target week');
select throws_ok($$insert into public.picks(submission_id,game_id,kind,team)
 values(990005,990003,'sudden_death','PIT')$$,'P0001','Sudden Death entry is eliminated','direct insert cannot bypass elimination');
select throws_ok($$update public.picks set team='PIT' where submission_id=990005$$,
 'P0001','Sudden Death entry is eliminated','direct update cannot bypass elimination');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000009901","role":"authenticated"}',true);
select is(public.sudden_death_strikes_before_week(990001,990003),2,'owner can read eligibility');
select throws_ok('select public.sudden_death_strikes_before_week(990002,990003)',
 'P0001','Entry is not available to this user','another entrant cannot inspect private eligibility');
select ok(not has_function_privilege('authenticated','private.sd_strikes_before_week(bigint,bigint)','execute'),'raw helper is private');
select ok(not has_function_privilege('anon','public.sudden_death_strikes_before_week(bigint,bigint)','execute'),'anonymous cannot call eligibility RPC');
select throws_ok($$select public.submit_weekly_picks(990001,990003,
 '[{"game_id":990003,"kind":"sudden_death","team":"BAL"}]')$$,
 'P0001','Sudden Death entry is eliminated','atomic RPC rejects eliminated SD pick');
reset role;
select is((select count(*) from public.weekly_submissions where entry_id=990001 and week_id=990003),1::bigint,'failed submission leaves no empty latest revision');
-- Simulate a previously accepted invalid SD pick that has since locked.
update public.games set kickoff_at=now()-interval '1 hour' where id=990003;
set local role authenticated;
select lives_ok($$select public.submit_weekly_picks(990001,990003,'[]')$$,'invalid locked SD does not block Main resubmission');
reset role;
select is((select count(*) from public.picks where submission_id=private.latest_submission_id(990001,990003)),0::bigint,'invalid SD is not copied into the new revision');
update public.games set kickoff_at=now()+interval '2 days' where id=990003;
set local role authenticated;
select lives_ok($$select public.submit_weekly_picks(990001,990003,
 '[{"game_id":990003,"kind":"ats","team":"BAL","is_best_bet":true},
 {"game_id":990003,"kind":"underdog","team":"PIT"}]')$$,'eliminated entrant can submit Main and Underdog');
reset role;
select is((select count(*) from public.picks where submission_id=private.latest_submission_id(990001,990003)),2::bigint,'Main and Underdog picks saved');

-- Corrections, ties, missing picks, latest revisions, and whole-field reprieves.
update public.games set away_score=20,home_score=20 where id=990002;
select is(private.sd_strikes_before_week(990001,990003),1,'corrected outright tie removes the second strike');
update public.games set away_score=30,home_score=20 where id=990002;
select is(private.sd_strikes_before_week(990001,990003),1,'corrected win restores eligibility');
update public.games set status='live',away_score=10,home_score=20 where id=990002;
select is(private.sd_strikes_before_week(990001,990003),1,'incomplete week adds no strike');
update public.games set status='final' where id=990002;
insert into public.weekly_submissions(id,entry_id,week_id,revision) overriding system value
 values(990006,990001,990002,2);
select is(private.sd_strikes_before_week(990001,990003),2,'latest revision missing SD incurs a strike');
insert into public.picks(submission_id,game_id,kind,team) values(990006,990002,'sudden_death','DEN');
select is(private.sd_strikes_before_week(990001,990003),1,'latest revision replaces losing SD');
delete from public.picks where kind='sudden_death' and submission_id in (990001,990002,990003,990004,990006);
select is(private.sd_strikes_before_week(990001,990003),1,'all missing in week two invokes field reprieve');
select is(private.sd_strikes_before_week(990002,990003),1,'field reprieve preserves every active entry');
select * from finish();
rollback;
