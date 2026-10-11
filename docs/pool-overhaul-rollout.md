# Pool overhaul rollout

## Order

1. Apply `20261011033524_pool_experience_reliability.sql` and `20261011042704_restrict_odds_schedule_permissions.sql` before deploying this PR. It adds compatible columns and RPCs, preserves existing commissioner overrides, repairs the two reported 2026 international tags, and stages the odds cron **disabled**. Existing score cron jobs remain installed during staging. No picks or saved line values are rewritten.
2. Deploy this PR. ESPN finalization now commits the final score, score events and game status together. Existing pending/retry/reconciliation records are eligible for ESPN recovery, including older games. The retired automatic Odds API score endpoint returns 410; manual checks remain in Admin → Scores.
3. Confirm the deployed commit, then run `select public.activate_espn_odds_automation();` as the database owner/service role. This enables the Supabase odds scheduler and removes the old automatic validation/reconciliation cron jobs. The GitHub odds workflow in this PR supports manual dispatch only. Do not restore its automatic schedule while Supabase odds cron is enabled.
4. Run one commissioner refresh for an **unlocked** upcoming week. Verify Activity Log shows nonzero fetched/snapshot counts, either applied or unchanged lines, selected book timestamps, quota and no unresolved errors. A no-change run is valid; a failed write is never reported as success. Review any per-game warning in Lines. Do not unlock a frozen competitive week just to test ingestion.
5. Observe the next scheduled slot and ESPN final. Check expected/attempt/completion timestamps, deduplicated execution, finals and standings. Production verification requires the new deployment and cannot be substituted by local tests.

## Entrant schedule (Eastern)

- Upcoming week opens Sunday at noon.
- Lines refresh Sunday at 8 PM, then Monday–Thursday at 2 AM, noon and 8 PM.
- Thursday 8 PM is the final refresh and line lock. If the provider fails, the last saved values lock and the commissioner sees a warning. Missing lines remain missing.
- Early/irregular games keep their earlier line deadline, one hour before kickoff. Picks lock at kickoff.
- The default week changes Tuesday at 2 AM.
- ESPN scores poll every two minutes while a game needs updates; finals rescore immediately. There are no automatic Odds API score checks.

## Operations and rollback

- Lines: edits are one atomic save. Concurrent line changes reject the entire batch and retain the draft. Spread and total each have an explicit return-to-automatic control; refresh/final lock never removes an override. Missing lines can be supplied manually.
- Rules: Main scale plus independent SD/UD combined pots. Both current-season side pots are $225. Published rules render these amounts dynamically.
- Personal navigation preview, larger text and theme are device-local and can be switched back immediately.
- To pause automated odds without losing history: `update private.ingestion_settings set odds_enabled=false;`. Manual GitHub dispatch and commissioner refresh remain available.
- If application rollback is required, pause the new odds scheduler first. Keep the additive schema/RPCs. Existing automatic score cron definitions can be restored from migrations `20260910020637_add_espn_live_scores.sql` and `20260922215513_align_ingestion_schedule_and_final_refresh.sql` after the old scoring code is deployed. Never enable both odds schedulers together.

## Validation evidence

Regression coverage includes the old generated-identity write failure, game/snapshot/line write failures, no-change runs, preferred-book fallback and stale data, retained manual overrides, earlier locks, failed final fetch, atomic batch rollback, authorization, ESPN repeated finals and commissioner protection, tied ranks, both chart modes, and zero-net all-tied payouts. Browser QA uses local-only sample entrants and games. No provider secrets or real entrant data are used in UI fixtures.
