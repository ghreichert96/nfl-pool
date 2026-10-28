# Standings and grid refinement — October 28, 2026

## Behavior

Overall remains ranked by Main record. Overall and Main Standing charts therefore
share the same rank history; Overall payouts combine Main, SD, and UD. Main and
Overall payouts use results through the selected week. Side-pool payouts use the
current state. Win percentage credits ties as half a win; Best Bet counts twice
in Main and weekly ATS records.

SD sorts by strikes incurred, then later most-recent strike, then later first
strike. Equal strike histories share a rank. Used teams have disabled grey
buttons with corner-to-corner crosses. Elimination disables every SD button;
only used teams have crosses. Historical weeks after elimination show an em dash.

Production read-only inspection confirmed AWIL's Week 7 NYJ revisions were saved
October 20–22 and BENJ's Week 7 DAL revision October 21. Both already had two
strikes. These saves predate the October 25 database enforcement migration.
Keep those audit rows; exclude them from SD standings, grid, and consensus after
elimination. The earlier pagination repair remains responsible for correcting
NADE/KIER records; no result backfill is needed.

The grid shows placeholders only for submitted slots. The new membership-checked
RPC returns category counts and flags for each latest revision, never teams,
games, directions, or kickoff times. Unsubmitted slots stay blank. Missing RPC
availability degrades to no hidden-slot hints, without crashing the page.

Text vs. logos is stored on the current device, matching existing display
preferences. Whole standings rows support click, Enter, and Space to open details.
Tables share type sizing, padding, rank contrast, and light-theme semantic colors.

## Verification and release

- 153 application tests pass, including ranking, historic payouts, percentage,
  disabled SD controls, hidden-slot occupancy, row activation, and preferences.
- 33 focused database assertions pass: elimination enforcement and count privacy,
  membership checks, unpublished-week rejection, and empty latest revisions.
- TypeScript, ESLint, and local database lint pass.
- Desktop browser checks cover standings, row-click details, grid, and preferences
  against existing local fixtures. Production picks were not modified.

Apply `20261028203227_add_week_pick_counts.sql` before releasing the application.
Keep the October 25 eligibility migration installed. Check signed-in Grid,
Overall/Main week selection, SD ordering, and an eliminated entrant's form after
release. No production migration or deployment was performed for this refinement.
