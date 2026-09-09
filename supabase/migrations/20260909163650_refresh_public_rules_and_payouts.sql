-- Keep the displayed rules, commissioner editor, and mechanical payout scale aligned.
delete from public.rule_sections
where section_key in ('visibility', 'underdog');

update public.rule_sections
set position = position + 10;

update public.rule_sections
set
  position = content.position,
  title = content.title,
  summary = content.summary,
  detail = content.detail,
  revision = revision + 1
from (values
  ('lines_deadlines', 1::smallint, 'Deadlines',
    'Lines normally freeze Thursday at 8:00 PM ET. Picks lock and become public game by game at kickoff.',
    E'Standard weeks: All pool lines freeze Thursday at 8:00 PM ET.\nIrregular games: Games before Thursday’s deadline freeze one hour before kickoff.\nPick deadline: Each pick remains editable until that game kicks off.\nVisibility: Other entrants’ picks and Most Picked counts appear only after kickoff.'),
  ('weekly_card', 2::smallint, 'Main pool',
    'Six ATS picks, including one 2× Best Bet, plus three game totals create ten decisions each week.',
    E'ATS: Choose six teams against the frozen spread.\nBest Bet: Mark one ATS pick; it counts as a second decision.\nO/U: Choose three game totals.\nMissing picks: Every omitted decision is a loss; an omitted Best Bet adds another loss.\nPushes: Main-pool pushes count as ties.'),
  ('sudden_death', 3::smallint, 'Side pools',
    'Sudden Death and Underdog each carry a $200 prize funded evenly by the rest of the pool.',
    E'Sudden Death: Pick one outright winner weekly. A loss or missing pick earns a strike; two strikes eliminate the entry. An NFL tie adds no strike. A team cannot be reused after its pick locks.\nUnderdog: Pick one eligible underdog to win outright. A win earns points equal to its frozen positive spread; a tie, loss, or missing pick earns zero. Highest season total wins.'),
  ('scoring', 4::smallint, 'Payouts',
    'Main standings use a balanced +$350 to −$350 rank schedule. Side pools and the separate playoff contest settle after the season.',
    E'Main: Rank payouts are normalized from +$350 to −$350 with the middle of the field at $0; tied entries average occupied rank slots.\nSide pools: SD and UD winners split their $200 pool; all non-winners fund it evenly.\nPlayoffs: Separate 100-point ATS/O/U contest, weighted more heavily by round, with $20 per entry and bonuses for first, second, and third.\nSettlement: Total season exposure can move roughly $400 either way. The commissioner collects and pays after the season by Venmo or Zelle.')
) as content(section_key, position, title, summary, detail)
where public.rule_sections.section_key = content.section_key;

-- Rescale every existing season symmetrically while preserving rank order and lock state.
with schedule_sizes as (
  select season_id, count(*)::numeric as rank_count
  from public.payout_schedules
  group by season_id
)
update public.payout_schedules as schedule
set amount = round(
  350 - (700 * (schedule.rank - 1)::numeric / (sizes.rank_count - 1)),
  2
)
from schedule_sizes as sizes
where sizes.season_id = schedule.season_id
  and sizes.rank_count > 1;
