import os
import datetime
import streamlit as st
from supabase import create_client

# Connect to Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Helper: get current NFL week
def get_current_nfl_week():
    today = datetime.datetime.utcnow().date()
    season_start = datetime.date(2025, 9, 4)  # kickoff
    delta_days = (today - season_start).days
    return max(1, delta_days // 7 + 1)

# Fetch spreads for a week
def fetch_spreads(week):
    data = supabase.table("spreads") \
        .select("game_id, date, time, away_team, home_team, spread, over_under") \
        .eq("nfl_week", week) \
        .order("date") \
        .order("time") \
        .execute()
    return data.data or []

# Fetch logos
def get_team_logo(team_abbrev):
    row = supabase.table("nfl_teams").select("logo_url").eq("abbrev", team_abbrev).execute()
    if row.data:
        return row.data[0]["logo_url"]
    return None

# Save pick immediately on toggle
def save_pick(user_id, game_id, pick_type, selection, over_under_pick=None, is_double=False, underdog_points=None):
    supabase.table("picks").upsert({
        "user_id": user_id,
        "game_id": game_id,
        "type": pick_type,
        "selection": selection,
        "over_under_pick": over_under_pick,
        "is_double": is_double,
        "underdog_points": underdog_points,
        "submitted_at": datetime.datetime.utcnow().isoformat()
    }).execute()

# ---- RENDER FUNCTION ----
def render():
    st.header("🏈 Make Picks")

    if "user" not in st.session_state or not st.session_state["user"]:
        st.warning("Please log in to make picks.")
        st.stop()

    user_id = st.session_state["user"]["id"]

    # Week selector
    current_week = get_current_nfl_week()
    week = st.selectbox("Select Week", [current_week, current_week - 1], index=0)

    # Load spreads
    spreads = fetch_spreads(week)
    if not spreads:
        st.warning("No games found for this week.")
        return

    # Fetch existing picks for this user/week
    picks = supabase.table("picks") \
        .select("*") \
        .eq("user_id", user_id) \
        .execute().data

    # Count picks
    pick_counts = {"ATS": 0, "O/U": 0, "SD": 0, "UD": 0, "BB": 0}
    for p in picks:
        if p["is_double"]:
            pick_counts["BB"] += 1
        elif p["type"] in pick_counts:
            pick_counts[p["type"]] += 1

    # --- Summary bar ---
    st.subheader("Your Picks Summary")
    summary_cols = st.columns([1, 1, 1, 1, 1])
    summary_map = {"BB": "Best Bet", "ATS": "ATS", "O/U": "Over/Under", "SD": "Sudden Death", "UD": "Underdog"}

    for i, pick_type in enumerate(["BB", "ATS", "O/U", "SD", "UD"]):
        with summary_cols[i]:
            st.markdown(f"**{summary_map[pick_type]}**")
            for p in picks:
                if (pick_type == "BB" and p["is_double"]) or (p["type"] == pick_type):
                    logo = get_team_logo(p["selection"])
                    if logo:
                        st.image(logo, width=30)

    st.write("Click logos or names to make picks. Picks save automatically.")

    # --- Render game rows ---
    for game in spreads:
        game_id = game["game_id"]
        game_dt = datetime.datetime.fromisoformat(f"{game['date']}T{game['time']}")
        is_locked = datetime.datetime.utcnow() > game_dt.replace(tzinfo=datetime.timezone.utc)

        col1, col2, col3, col4, col5, col6, col7, col8 = st.columns([2, 2, 1, 2, 2, 1, 1, 1])

        away_logo = get_team_logo(game["away_team"])
        home_logo = get_team_logo(game["home_team"])

        if is_locked:
            with col1: st.write(f"{game['away_team']} (locked)")
            with col2: st.write(f"{game['spread']}")
            with col3: st.write(f"{game['home_team']} (locked)")
            with col4: st.write("O/U")
            with col5: st.write(f"{game['over_under']}")
            continue

        # Away pick
        with col1:
            if away_logo: st.image(away_logo, width=40)
            if st.button(game["away_team"], key=f"away_{game_id}"):
                if pick_counts["ATS"] < 5:
                    save_pick(user_id, game_id, "ATS", game["away_team"])
                    pick_counts["ATS"] += 1
                else:
                    st.warning("Max 5 ATS picks reached.")

        with col2:
            st.write(f"{game['spread']}")

        # Home pick
        with col3:
            if home_logo: st.image(home_logo, width=40)
            if st.button(game["home_team"], key=f"home_{game_id}"):
                if pick_counts["ATS"] < 5:
                    save_pick(user_id, game_id, "ATS", game["home_team"])
                    pick_counts["ATS"] += 1
                else:
                    st.warning("Max 5 ATS picks reached.")

        with col4:
            st.write("O/U")

        with col5:
            if st.button(f"O {game['over_under']}", key=f"over_{game_id}"):
                if pick_counts["O/U"] < 3:
                    save_pick(user_id, game_id, "O/U", None, over_under_pick="O")
                    pick_counts["O/U"] += 1
                else:
                    st.warning("Max 3 O/U picks reached.")
            if st.button(f"U {game['over_under']}", key=f"under_{game_id}"):
                if pick_counts["O/U"] < 3:
                    save_pick(user_id, game_id, "O/U", None, over_under_pick="U")
                    pick_counts["O/U"] += 1
                else:
                    st.warning("Max 3 O/U picks reached.")

        # Best Bet toggle
        with col6:
            if st.button("⭐ BB", key=f"bb_{game_id}"):
                if pick_counts["BB"] < 1:
                    save_pick(user_id, game_id, "ATS", game["home_team"], is_double=True)
                    pick_counts["BB"] += 1
                else:
                    st.warning("You can only set 1 Best Bet.")

        # Sudden Death pick
        with col7:
            if st.button("💀 SD", key=f"sd_{game_id}"):
                if pick_counts["SD"] < 1:
                    save_pick(user_id, game_id, "SD", game["home_team"])
                    pick_counts["SD"] += 1
                else:
                    st.warning("Only 1 Sudden Death pick allowed.")

        # Underdog pick (awards points equal to spread if dog wins)
        with col8:
            underdog = None
            underdog_points = None
            try:
                spread_val = float(game["spread"])
                if spread_val > 0:
                    underdog = game["away_team"]
                    underdog_points = spread_val
                elif spread_val < 0:
                    underdog = game["home_team"]
                    underdog_points = abs(spread_val)
            except:
                pass

            if underdog and st.button("🐶 UD", key=f"ud_{game_id}"):
                if pick_counts["UD"] < 1:
                    save_pick(user_id, game_id, "UD", underdog, underdog_points=underdog_points)
                    pick_counts["UD"] += 1
                else:
                    st.warning("Only 1 Underdog pick allowed.")
