# Standings and Sudden Death hypercare — October 22, 2026

## Findings from read-only production inspection

The season has 16 entries, 438 submission revisions, 1,043 latest-revision picks
through Week 6, and 1,095 including Week 7. The competition loader requested
all picks in one unpaginated query. The API caps responses at 1,000 rows.
Missing picks then became omission losses, corrupting records, ranks, and
projected payouts. Submission revisions had the same eventual cap risk.

Replaying the first 1,000 picks in ID order reproduces these differences:

| Entry | Capped record | Complete record through Week 6 | Week 6 |
| ----- | ------------- | ------------------------------ | ------ |
| NADE  | 27–32–1       | 36–23–1                        | 9–1–0  |
| KIER  | 21–39–0       | 25–35–0                        | 4–6–0  |
| CHUK  | 26–32–2       | 31–27–2                        | 5–5–0  |
| HUNT  | 24–34–2       | 30–28–2                        | 6–4–0  |

The old query had no explicit pick ordering; the capped records above are the
reproduction, not a captured browser observation. Complete records use latest
saved submissions, frozen lines, current final scores, and doubled Best Bets.

AWIL lost SD with LAC in Week 1 and DAL in Week 5. He was eliminated after
Week 5 but could still submit IND in Week 6 and NYJ in Week 7. Eligibility was
absent from both the pick form and database; only team reuse was enforced.
KIER was also eliminated after Week 5; NADE after Week 6.

All completed games in Weeks 1–6 have scores and matching `game_results` rows.
Every game has a pool line. This checks internal consistency, not an independent
validation against a sports provider.

## Changes

- Paginate competition inputs with deterministic ordering; abort on query errors.
- Calculate SD eligibility from prior completed weeks, all season entries, and
  latest revisions. Preserve ties, missing-pick strikes, and the field reprieve.
- Authorize the eligibility RPC for the entry owner or their pool commissioner.
- Block eliminated SD inserts and updates in the database, including direct writes.
- Keep atomic submissions and kickoff locking. Exclude an old invalid locked SD
  pick when copying a revision, so Main and Underdog submissions still work.
- Disable SD in entrant and commissioner forms; remove stale SD selections from
  submitted drafts and exclude SD from completeness requirements after elimination.
- Show `OUT` for SD weeks after elimination. Retain old submitted rows for audit;
  they never revive an eliminated entrant or earn an SD payout.

## Verification

The new database calculation was run against a local replay of the production
snapshot and matched the application's SD strikes for all 16 entries. That replay
ran inside a transaction and was rolled back. Production inspection was read-only.

Regression tests cover more than 1,000 picks and submission revisions, pagination
failure, selected-week bounds, disabled controls, stale drafts, historical
eligibility, direct-write rejection, RPC authorization, atomic failure, invalid
locked picks, Main/Underdog submission, corrected scores, ties, missing picks,
latest revisions, and simultaneous field elimination.

The local database contains prior development fixtures. Three pre-existing tests
collide with an existing HARR entry or weeks, and one assumes no other visible
picks. The full database suite is also run from temporary copies that clear those
collisions **inside each test's rollback transaction**. No existing local data is
permanently removed and tracked legacy tests remain unchanged.

Final checks: 142 application tests passed; 180 database assertions passed with
the rollback-only fixture isolation above, including 22 new SD assertions.
ESLint, TypeScript, production build, database lint, and security advisors passed.

## Release order for tonight

1. Review the draft PR. Apply only the pending
   `20261022214611_standings_and_sd_eligibility.sql` migration to production.
   Check the migration list first; production's latest migration at inspection
   was `20261011203406`.
2. Merge/deploy the application. The new form requires the eligibility RPC, so
   the migration must precede the application deployment.
3. Verify the four complete Week 6 records above, and check overall rank/payout
   recalculation. Week 7 results may change cumulative totals after this snapshot.
4. Verify AWIL's Week 7 form says eliminated and accepts Main/Underdog without SD.
   SD standings should show AWIL `OUT` from Week 6, KIER `OUT` from Week 6, and
   NADE `OUT` from Week 7. Historical weeks before elimination remain inspectable.
5. Check authenticated submission errors and standings requests after release.

No production backfill or deletion is needed: complete reads repair standings
and existing invalid SD picks are ignored after elimination. Do not overwrite
entrant records or rewrite final scores to compensate for the capped query.

If the app needs rollback, retain the database protection: older forms may offer
SD, but the database will reject eliminated SD submissions. Prefer rolling
forward the form fix; reverting the eligibility migration would reopen the bug.
