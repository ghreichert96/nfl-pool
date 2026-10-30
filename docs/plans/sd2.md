# SD2 plan — October 28, 2026

Status: implementation authorized October 29, 2026. Uses two strikes and a $225 SD2 pot.

## Contest rules

- SD1 is complete through Week 7. Preserve its picks, strike history, final order,
  and $225 payout calculation. HUNT is the sole survivor in current results.
- SD2 begins Week 8. All 16 existing entries participate, including HUNT. Everyone
  starts with zero strikes and may use any team, including teams used in SD1.
- Default to two strikes, matching the user's selected answer. Make the strike
  limit a contest setting supporting one or two, locked when the first game of
  that contest starts. The selected limit is two.
- One outright winner pick per week. A loss or missing pick adds one strike;
  a tie adds none. No team reuse within SD2 once the original selection locks.
  Preserve kickoff locking, latest-revision handling, and the existing field
  reprieve when every remaining entrant would otherwise be eliminated.
- End when one survivor remains after a fully finalized weekly slate. Stop future
  pick requirements and missing-pick strikes for that contest. If multiple remain
  after Week 18, split the prize equally among survivors.
- Separate $225 pot. Winners share $225; non-winners share the $225 cost equally.
  With one winner and 16 entries: +$225 / -$15. If everyone is tied, net $0 each.
  Overall rank continues to use Main record; overall net adds Main + SD1 + SD2 + UD.

## Data and enforcement

Introduce a season-scoped SD contest model with ID, sequence/label, first/last
eligible week, strike limit, payout amount, completion week, and participant
membership. Prevent overlapping active contest week ranges. SD1 covers Weeks 1–7;
SD2 covers Weeks 8–18 with earlier completion when appropriate.

Attach an SD contest ID to SD picks; non-SD picks have no contest ID. Backfill
existing picks through Week 7 into SD1, preserving invalid post-elimination rows
for audit. Recheck before migration: there were no Week 8+ SD rows on inspection.
If any appear, halt activation and review them instead of silently reassigning.

Keep the `sudden_death` pick kind. Extend the application submission context with
contest identity; validate it against the entry's season and target week. Keep a
compatible existing RPC wrapper that resolves the contest from the week, with
all authorization enforced server-side. Reject closed contests, nonparticipants,
eliminated entrants, out-of-range games, and reused teams. Apply these checks to
RPC submissions and direct inserts/updates. Main/UD submissions remain possible
when SD is closed or the entry is eliminated.

Refactor strike calculation, team reuse, omission losses, completion detection,
and rank history to operate within one contest and its participant set. Use the
same fixtures to verify SQL and application results. Completion stops evaluation
after the closing week; commissioner score corrections remain auditable and
recalculate the affected contest without contaminating the other contest.

Use contest-specific SD draft identity. Existing Main, BB, totals, and UD drafts
and submissions remain intact. Invalidate any stale SD draft when the active
contest changes. Re-saving a partial Week 8 submission adds SD2 without dropping
locked Main/UD picks. Unsaved drafts never count as submitted grid slots.

New contest tables use RLS and pool-membership SELECT policies. Commissioner
configuration writes use authorized functions. Keep privileged helpers private,
set empty search paths, and deny anonymous execution. Migrate first, then release
clients; inspect advisors and validate both old/new submission signatures.

## Screens and labels

- Rename the original contest to SD1 everywhere it is referenced: standings,
  Grid history, profile summaries, entry overlays, admin controls, help, rules,
  accessible labels, validation messages, and payout labels. Generic explanatory
  prose can define “Sudden Death (SD)” once.
- Standings choices: Overall, Main, SD1, SD2, UD (for Underdog). Preserve old `view=sd`
  links as an alias for SD1; use explicit SD1/SD2 routes in new links.
- Overall adds separate SD1 and SD2 strike columns. Preserve current colors and
  eliminated marks; show a distinct “not started” dash for SD2 before Week 8.
- Current Picks and Grid use SD2 in the existing SD position. Historical Grid
  Weeks 1–7 retain SD1; Weeks 8+ show SD2. Do not rewrite historical picks.
- SD1 standings stop at Week 7 and display final payouts. SD2 standings begin at
  Week 8 and display current projected payouts, becoming final on completion.
- Main/Overall week filtering remains historical. SD2 contributes $0 before
  Week 8. From Week 8 onward Overall includes finalized SD1 plus selected-week
  SD2 projections. Entry details/profile totals expose both contest components.
- Text vs. logos applies to both SD standings tabs and Grid. SD2 uses the same
  disabled/cross styling, ranking by strikes incurred then later strike timing.
- Rules state start week, fresh team availability, strike limit, lock/reuse/tie/
  omission rules, field reprieve, completion, $225 funding, and season-end split.

## Acceptance and rollout

1. Snapshot SD1 records, order, winner, and payouts; prove these remain identical
   after migration and after SD2 games are finalized.
2. Verify an SD1-eliminated entry can submit SD2 and reuse an SD1 team. Verify a
   team used in SD2 cannot be reused there, including direct SQL/API attempts.
3. Test one- and two-strike configurations; no strikes before Week 8 or after
   completion; ties, missing picks, field reprieve, score corrections, ties in
   ranking, and Week 18 survivor splits.
4. Verify Week 6/7 Overall payouts exclude SD2, Week 8 includes it, side-tab payouts
   use their own contest, and Main rank/history are unchanged.
5. Verify category occupancy remains private, empty/partial revisions display
   correctly, stale drafts are reset only for SD, and locked Main/UD picks survive.
6. Browser-check phone and desktop: all five standings views, horizontal/vertical
   sticky headers, SD2 selection, profile/overlay totals, historical Grid, and rules.
7. Apply the additive migration before deployment; verify SD1 and SD2 participants,
   Week 8 eligibility, and payout amount. Run full app/database CI and smoke-test
   owner and commissioner flows without altering real entrants' selections.
8. SD2 remains in Week 8 after the opener has kicked off. The opener itself is not a
   survivor selection and adds no strike. Entrants may choose any other unlocked
   Week 8 game; only a loss or missing weekly selection after the full slate is final
   adds a strike. No one selected the opener through the text submissions. Apply the
   migration, release, and verify Week 8 picks and eligibility; monitor submission errors.
