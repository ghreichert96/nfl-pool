import streamlit as st

def render():
    st.title("📜 Rules")

    with st.expander("Main Pool", expanded=True):
        st.markdown("""
- Pick 6 games ATS per week, one counts as double (your “Best Bet”)
- Pick 3 O/Us
- 10 “points” per week, resulting in a W-L-T record
- Standings are sorted first by most wins, second by fewest losses
- Payouts are on a normalized scale based on your ranking relative to the group; Max win/loss = $300
        """)

    with st.expander("Side Pools", expanded=True):
        st.markdown("""
**Sudden Death**
- Pick 1 team per week to NOT lose (ties are safe)
- If they lose, you get a strike
- Cannot pick a team twice
- 2 strikes and you’re out
- Last one standing wins; tie = split pot
- Winner gets $120 paid out evenly by the rest of the pool

**Underdog**
- Pick 1 underdog per week
- If they win, you are awarded the points they were favored to lose by
- They must win outright (ties do not count)
- Tiebreaker (very rare that this is needed) is most underdogs correctly picked
- Winner gets $120 paid out evenly by the rest of the pool

**Playoffs (*new this year*)**
- We’ll pick every game ATS + O/U and you rank your picks in order of confidence to determine points
- Each week will be equivalent in terms of total points
- Top 3 will get payouts ($150/$75/$50 or something), paid evenly by the rest of the pool
- More on this to come…
        """)

    with st.expander("General", expanded=True):
        st.markdown("""
- All spreads will lock Thursday at 8pm
- Failure to submit before game start results in a loss - no exceptions  
  - With that being said, games lock at start time, so if you miss early games you’re allowed to select from later games
- Mistake picks (e.g. picking the same team twice or a Sudden Death team you’ve already picked before) can warrant a re-pick from games which haven’t started
- Rules are subject to change at the commissioner’s discretion
                            """)