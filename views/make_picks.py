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
    if row.data and row.data[0]["logo_url"]:
        return row.data[0]["logo_url"]
    return None

# Save pick immediately on toggle
def save_pick(user_id, game_id, pick_type, selection, week, over_under_pick=None, is_double=False, underdog_points=None):
    week_start = datetime.date.fromisocalendar(datetime.date.today().year, week, 4)
    supabase.table("picks").upsert({
        "user_id": user_id,
        "game_id": game_id,
        "type": pick_type,
        "selection": selection,
        "over_under_pick": over_under_pick,
        "is_double": is_double,
        "underdog_points": underdog_points,
        "week_start": week_start,
        "submitted_at": datetime.datetime.utcnow().isoformat()
    }).execute()

# ---- RENDER FUNCTION ----
def render():
    st.header("🏈 Make Picks 🧮")

    # Must be logged in
    if "user" not in st.session_state or not st.session_state["user"]:
        st.warning("Please log in to make picks.")
        st.stop()

    user_id = st.session_state["user"]["id"]

    # Week selector (skip week 0)
    current_week = get_current_nfl_week()
    weeks = [w for w in [current_week, current_week - 1] if w >= 1]
    week = st.selectbox("Select Week", weeks, index=0, key="makepicks_week_selector")

    # Load spreads
    spreads = fetch_spreads(week)
    if not spreads:
        st.warning("No games found for this week.")
        return

    # Fetch existing picks for this user/week
    picks = supabase.table("picks") \
        .select("*") \
        .eq("user_id", user_id) \
        .eq("week_start", datetime.date.fromisocalendar(datetime.date.today().year, week, 4)) \
        .execute().data

    # Count picks
    pick_counts = {"ATS": 0, "O/U": 0, "SD": 0, "UD": 0, "BB": 0}
    for p in picks:
        if p["is_double"]:
            pick_counts["BB"] += 1
        elif p["type"] in pick_counts:
            pick_counts[p["type"]] += 1

    # --- Picks Summary ---
    st.subheader("Your Picks Summary")
    summary_cols = st.columns([1, 3, 1, 1, 1])  # ATS wider
    summary_map = {"BB": "BB:", "ATS": "ATS:", "O/U": "O/U:", "SD": "SD:", "UD": "UD:"}

    for i, pick_type in enumerate(["BB", "ATS", "O/U", "SD", "UD"]):
        with summary_cols[i]:
            st.markdown(f"**{summary_map[pick_type]}**")
            logos = []
            for p in picks:
                if (pick_type == "BB" and p["is_double"]) or (p["type"] == pick_type):
                    logo = get_team_logo(p["selection"])
                    if logo:
                        logos.append(f"<img src='{logo}' style='height:24px; margin-right:4px;'/>")
            if logos:
                st.markdown("".join(logos), unsafe_allow_html=True)

    st.write("Click a button to make picks. Picks save automatically.")

    # --- Column headers ---
    st.markdown("""
    <div style="display: grid; grid-template-columns: 1fr 2fr 1fr 2fr 2fr 1fr 1fr; text-align: center; font-weight: bold; text-decoration: underline; margin-top:10px; margin-bottom:4px;">
      <div>BB</div>
      <div>Away</div>
      <div>Spread</div>
      <div>Home</div>
      <div>O/U</div>
      <div>SD</div>
      <div>UD</div>
    </div>
    """, unsafe_allow_html=True)

    # --- Render game rows ---
    for game in spreads:
        game_id = game["game_id"]
        game_dt = datetime.datetime.fromisoformat(f"{game['date']}T{game['time']}")
        is_locked = datetime.datetime.now(datetime.timezone.utc) > game_dt.astimezone(datetime.timezone.utc)

        cols = st.columns([1, 2, 1, 2, 2, 1, 1])

        away_logo = get_team_logo(game["away_team"])
        home_logo = get_team_logo(game["home_team"])

        # BB
        with cols[0]:
            if st.button("⭐", key=f"bb_{game_id}"):
                if pick_counts["BB"] < 1:
                    save_pick(user_id, game_id, "ATS", game["home_team"], week, is_double=True)
                    pick_counts["BB"] += 1
                else:
                    st.warning("You can only set 1 Best Bet.")

        if is_locked:
            with cols[1]: st.markdown(f"<div style='text-align:center'>{game['away_team']} (locked)</div>", unsafe_allow_html=True)
            with cols[2]: st.markdown(f"<div style='text-align:center'>{game['spread']}</div>", unsafe_allow_html=True)
            with cols[3]: st.markdown(f"<div style='text-align:center'>{game['home_team']} (locked)</div>", unsafe_allow_html=True)
            with cols[4]: st.markdown(f"<div style='text-align:center'>{game['over_under']}</div>", unsafe_allow_html=True)
            continue

        # Away pick
        with cols[1]:
            btn = st.button(f"{game['away_team']}", key=f"away_{game_id}")
            if btn:
                if pick_counts["ATS"] < 5:
                    save_pick(user_id, game_id, "ATS", game["away_team"], week)
                    pick_counts["ATS"] += 1
                else:
                    st.warning("Max 5 ATS picks reached.")
            if away_logo:
                st.markdown(f"<div style='text-align:center'><img src='{away_logo}' style='height:30px;'/></div>", unsafe_allow_html=True)

        # Spread
        with cols[2]:
            st.markdown(f"<div style='text-align:center'>{game['spread']}</div>", unsafe_allow_html=True)

        # Home pick
        with cols[3]:
            btn = st.button(f"{game['home_team']}", key=f"home_{game_id}")
            if btn:
                if pick_counts["ATS"] < 5:
                    save_pick(user_id, game_id, "ATS", game["home_team"], week)
                    pick_counts["ATS"] += 1
                else:
                    st.warning("Max 5 ATS picks reached.")
            if home_logo:
                st.markdown(f"<div style='text-align:center'><img src='{home_logo}' style='height:30px;'/></div>", unsafe_allow_html=True)

        # Over/Under
        with cols[4]:
            ou_cols = st.columns(2)
            with ou_cols[0]:
                if st.button(f"O {game['over_under']}", key=f"over_{game_id}"):
                    if pick_counts["O/U"] < 3:
                        save_pick(user_id, game_id, "O/U", None, week, over_under_pick="O")
                        pick_counts["O/U"] += 1
            with ou_cols[1]:
                if st.button(f"U {game['over_under']}", key=f"under_{game_id}"):
                    if pick_counts["O/U"] < 3:
                        save_pick(user_id, game_id, "O/U", None, week, over_under_pick="U")
                        pick_counts["O/U"] += 1

        # SD
        with cols[5]:
            if st.button("💀", key=f"sd_{game_id}"):
                if pick_counts["SD"] < 1:
                    save_pick(user_id, game_id, "SD", game["home_team"], week)
                    pick_counts["SD"] += 1
                else:
                    st.warning("Only 1 Sudden Death pick allowed.")

        # UD
        with cols[6]:
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

            if underdog and st.button("🐶", key=f"ud_{game_id}"):
                if pick_counts["UD"] < 1:
                    save_pick(user_id, game_id, "UD", underdog, week, underdog_points=underdog_points)
                    pick_counts["UD"] += 1
                else:
                    st.warning("Only 1 Underdog pick allowed.")

    # --- Weekly Comment ---
    st.divider()
    st.subheader("Weekly Comment")

    week_start = datetime.date.fromisocalendar(datetime.date.today().year, week, 4)  # anchor to Thu
    existing = supabase.table("weekly_entries") \
        .select("comment") \
        .eq("user_id", user_id) \
        .eq("week_start", week_start) \
        .execute().data

    existing_comment = existing[0]["comment"] if existing else ""
    comment = st.text_area("Add a comment for this week", value=existing_comment, key="weekly_comment")

    if st.button("Save Comment"):
        supabase.table("weekly_entries").upsert({
            "user_id": user_id,
            "week_start": week_start,
            "comment": comment,
            "submitted_at": datetime.datetime.utcnow().isoformat()
        }).execute()
        st.success("Comment saved!")
