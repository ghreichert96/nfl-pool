import os
import pandas as pd
import streamlit as st
from backend.odds import fetch_odds, upsert_games
from backend.db import supa

def render():
    st.title("Admin")

    if not st.session_state.get("is_admin"):
        st.warning("Admins only.")
        return

    client = supa()

    year = int(os.environ.get("DEFAULT_YEAR", "2025"))
    week = st.number_input("NFL Week", min_value=1, max_value=22, value=int(os.environ.get("NFL_WEEK", "1")))

    st.subheader("Odds Control")
    if st.button("Fetch & Freeze Odds (now)"):
        data = fetch_odds()
        upsert_games(year, int(week), data, freeze=True)
        st.success("Frozen odds inserted into Supabase.")

        # Preview what was just inserted
        games = client.table("games") \
            .select("date, time, away_team, home_team, spread, over_under") \
            .eq("year", year) \
            .eq("nfl_week", int(week)) \
            .order("date") \
            .order("time") \
            .execute().data

        if games:
            st.subheader("This Week's Games (from DB)")
            st.dataframe(
                pd.DataFrame(games),
                hide_index=True,
                use_container_width=True
            )


    st.divider()

    st.subheader("Results Editor (MVP)")
    client = supa()
    games = client.table("games").select("*").eq("year", year).eq("nfl_week", int(week)).execute().data
    if not games:
        st.info("No games found for this week.")
        return

    # Pick a game to score
    game_map = {f'{g["away_team"]} @ {g["home_team"]} ({g["date"]})': g for g in games}
    picked = st.selectbox("Select game", list(game_map.keys()))
    g = game_map[picked]

    col1, col2 = st.columns(2)
    with col1:
        away_score = st.number_input(
            f'{g["away_team"]} score',
            min_value=0,
            step=1,
            key=f"away_{g['id']}_{g['away_team']}"
        )
    with col2:
        home_score = st.number_input(
            f'{g["home_team"]} score',
            min_value=0,
            step=1,
            key=f"home_{g['id']}_{g['home_team']}"
        )

    if st.button("Save Result"):
        # Compute basic O/U and ATS winners (MVP logic)
        total = int(away_score) + int(home_score)
        ou_res = "Push"
        if g.get("over_under") is not None:
            if total > float(g["over_under"]):
                ou_res = "O"
            elif total < float(g["over_under"]):
                ou_res = "U"

        ml_winner = None
        if away_score > home_score:
            ml_winner = g["away_team"]
        elif home_score > away_score:
            ml_winner = g["home_team"]

        ats_winner = "push"
        if g.get("spread") is not None:
            # MVP note: we don't assume which side the spread favors; a full solution should store favorite & line
            # For display only; proper ATS calc will be in scoring.py later.
            ats_winner = "home/away (calc in scoring)"

        # Upsert into results
        client.table("results").upsert({
            "game_id": g["id"],
            "home_score": int(home_score),
            "away_score": int(away_score),
            "ml_winner": ml_winner,
            "ats_winner": ats_winner,
            "ou_result": ou_res
        }).execute()

        st.success("Result saved (MVP). Scoring/leaderboards next.")
        st.rerun()

