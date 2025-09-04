import streamlit as st
import pandas as pd
from supabase import create_client
import os

# Initialize Supabase client
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def render():
    st.title("Standings")

    # --- Season Standings ---
    season_res = supabase.table("season_standings").select("*").execute()
    season_data = season_res.data or []
    season_df = pd.DataFrame(season_data)

    st.subheader("Season Standings")

    if season_df.empty:
        st.info("No season data available yet.")
    else:
        # Format columns for display
        display_cols = [
            "rk", "user_id", "wins", "losses", "pushes", "win_pct",
            "ats_wins", "ou_wins", "ud_points", "sd_picks"
        ]
        st.dataframe(
            season_df[display_cols].sort_values("rk"),
            hide_index=True,
            use_container_width=True,
        )

    # --- Weekly Standings ---
    weekly_res = supabase.table("weekly_standings").select("*").execute()
    weekly_data = weekly_res.data or []
    weekly_df = pd.DataFrame(weekly_data)

    st.subheader("Weekly Standings")

    if weekly_df.empty:
        st.info("No weekly data available yet.")
    else:
        # Collect unique weeks
        weeks = sorted(list(set(weekly_df["week_start"])), reverse=True)
        selected_week = st.selectbox("Select Week", weeks)

        week_df = weekly_df[weekly_df["week_start"] == selected_week]

        display_cols = [
            "rk", "user_id", "wins", "losses", "pushes",
            "ats_wins", "ou_wins", "sd_wins", "ud_points"
        ]
        st.dataframe(
            week_df[display_cols].sort_values("rk"),
            hide_index=True,
            use_container_width=True,
        )
