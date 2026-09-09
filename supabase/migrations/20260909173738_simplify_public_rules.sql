update public.rule_sections
set
  summary = content.summary,
  detail = content.detail,
  revision = revision + 1
from (values
  ('lines_deadlines',
    'Line freeze, pick lock, and public reveal times.',
    E'Standard lines: Thu 8 PM ET\nEarly/irregular games: 1 hour before kickoff\nPicks: Game kickoff\nVisibility: Picks and Most Picked reveal after kickoff'),
  ('weekly_card',
    '6 ATS + 3 O/U = 10 weekly decisions.',
    E'ATS: 6 picks against the frozen spread\nBest Bet: 1 ATS pick counts twice\nO/U: 3 game totals\nMissing: Loss for each empty decision\nPush: Tie'),
  ('sudden_death',
    'Sudden Death and Underdog · $200 each.',
    E'Sudden Death: 1 outright winner weekly; 2 strikes eliminates\nSD loss/missing: 1 strike\nSD tie: No strike\nSD reuse: Team unavailable after lock\nUnderdog: Outright win earns frozen positive spread\nUD tie/loss/missing: 0 points'),
  ('scoring',
    'Main ±$350 · Side pools $200 · Playoffs $20/entry.',
    E'Main: +$350 to −$350; middle rank $0\nTies: Average occupied rank slots\nSD / UD: $200 each; funded evenly by non-winners\nPlayoffs: 100 points; $20/entry; 1st/2nd/3rd paid\nSettlement: After season via Venmo or Zelle')
) as content(section_key, summary, detail)
where public.rule_sections.section_key = content.section_key;
