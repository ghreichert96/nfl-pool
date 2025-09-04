import os
import datetime
import streamlit as st
from supabase import create_client

# Connect to Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ----------------- Helpers -----------------
def get_current_nfl_week():
    today = datetime.datetime.utcnow().date()
    season_start = datetime.date(2025, 9, 4)  # kickoff
    delta_days = (today - season_start).days
    return max(1, delta_days // 7 + 1)

def fetch_spreads(week):
    data = supabase.table("spreads") \
        .select("game_id, date, time, away_team, home_team, spread, over_under") \
        .eq("nfl_week", week) \
        .order("date") \
        .order("time") \
        .execute()
    return data.data or []

def get_team_logo(team_abbrev):
    row = supabase.table("nfl_teams").select("logo_url").eq("abbrev", team_abbrev).execute()
    if row.data and row.data[0]["logo_url"]:
        return row.data[0]["logo_url"]
    return None

def save_pick(user_id, game_id, pick_type, selection, week,
              over_under_pick=None, is_double=False, underdog_points=None,
              over_under_total=None):
    week_start = datetime.date.fromisocalendar(datetime.date.today().year, week, 4)
    supabase.table("picks").upsert({
        "user_id": user_id,
        "game_id": game_id,
        "type": pick_type,
        "selection": selection,
        "over_under_pick": over_under_pick,
        "over_under_total": over_under_total,
        "is_double": is_double,
        "underdog_points": underdog_points,
        "week_start": week_start.isoformat(),
        "submitted_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }).execute()

def delete_pick(user_id, game_id, pick_type, selection=None):
    q = supabase.table("picks").delete() \
        .eq("user_id", user_id) \
        .eq("game_id", game_id) \
        .eq("type", pick_type)
    if selection:
        q = q.eq("selection", selection)
    q.execute()

# ----------------- UI -----------------
def render():
    st.markdown("""
    <style>
    .stToggle [role="switch"][aria-checked="true"] {
        background-color: #FFD700 !important; /* yellow highlight */
    }
    </style>
    """, unsafe_allow_html=True)

    st.header("🏈 Make Picks 🧮")

    if "user" not in st.session_state or not st.session_state["user"]:
        st.warning("Please log in to make picks.")
        st.stop()

    user_id = st.session_state["user"]["id"]

    # Week selector
    current_week = get_current_nfl_week()
    weeks = [w for w in [current_week, current_week - 1] if w >= 1]
    week = st.selectbox("Select Week", weeks, index=0, key="makepicks_week_selector")

    spreads = fetch_spreads(week)
    if not spreads:
        st.warning("No games found for this week.")
        return

    picks = supabase.table("picks").select(
        "*, games(away_abbrev, home_abbrev)"
    ).eq("user_id", user_id) \
     .eq("week_start", datetime.date.fromisocalendar(datetime.date.today().year, week, 4)) \
     .execute().data

    # Summary
    st.subheader("Your Picks Summary")
    summary_cols = st.columns([1, 3, 1, 1, 1])
    summary_map = {"BB": "BB:", "ATS": "ATS:", "O/U": "O/U:", "SD": "SD:", "UD": "UD:"}

    for i, pick_type in enumerate(["BB", "ATS", "O/U", "SD", "UD"]):
        with summary_cols[i]:
            st.markdown(f"**{summary_map[pick_type]}**")
            if pick_type == "O/U":
                for p in picks:
                    if p["type"] == "O/U":
                        ou_pick = p.get("over_under_pick", "")
                        total = p.get("over_under_total", "")
                        away = p.get("games", {}).get("away_abbrev", "?")
                        home = p.get("games", {}).get("home_abbrev", "?")
                        st.markdown(
                            f"<div style='text-align:center'>{away} {home} {ou_pick} {total}</div>",
                            unsafe_allow_html=True
                        )
            else:
                logos = []
                for p in picks:
                    if (pick_type == "BB" and p["is_double"]) or (p["type"] == pick_type):
                        logo = get_team_logo(p["selection"])
                        if logo:
                            logos.append(f"<img src='{logo}' style='height:24px; margin-right:4px;'/>")
                if logos:
                    st.markdown(
                        f"<div style='display:flex; justify-content:center;'>{''.join(logos)}</div>",
                        unsafe_allow_html=True
                    )

    # Column headers
    st.markdown("""
    <div style="display:grid; grid-template-columns:1fr 2fr 1fr 2fr 2fr 1fr 1fr; text-align:center; font-weight:bold; text-decoration:underline; margin:10px 0 4px 0;">
      <div>BB</div><div>Away</div><div>Spread</div><div>Home</div><div>O/U</div><div>SD</div><div>UD</div>
    </div>
    """, unsafe_allow_html=True)

    # Game rows
    for game in spreads:
        game_id = game["game_id"]
        game_dt = datetime.datetime.fromisoformat(f"{game['date']}T{game['time']}")
        is_locked = datetime.datetime.now(datetime.timezone.utc) > game_dt.astimezone(datetime.timezone.utc)

        cols = st.columns([1, 2, 1, 2, 2, 1, 1])

        # BB toggle
        with cols[0]:
            bb_key = f"bb_{game_id}"
            bb_selected = st.toggle("⭐", key=bb_key)
            if bb_selected:
                save_pick(user_id, game_id, "ATS", game["home_team"], week, is_double=True)
            else:
                delete_pick(user_id, game_id, "ATS", game["home_team"])

        if is_locked:
            with cols[1]: st.markdown(f"<div style='text-align:center'>{game['away_team']} (locked)</div>", unsafe_allow_html=True)
            with cols[2]: st.markdown(f"<div style='text-align:center'>{game['spread']}</div>", unsafe_allow_html=True)
            with cols[3]: st.markdown(f"<div style='text-align:center'>{game['home_team']} (locked)</div>", unsafe_allow_html=True)
            with cols[4]: st.markdown(f"<div style='text-align:center'>{game['over_under']}</div>", unsafe_allow_html=True)
            continue

        # Away ATS
        with cols[1]:
            away_key = f"away_{game_id}"
            away_selected = st.toggle(game["away_team"], key=away_key)
            if away_selected:
                save_pick(user_id, game_id, "ATS", game["away_team"], week)
            else:
                delete_pick(user_id, game_id, "ATS", game["away_team"])

        # Spread
        with cols[2]:
            st.markdown(f"<div style='text-align:center'>{game['spread']}</div>", unsafe_allow_html=True)

        # Home ATS
        with cols[3]:
            home_key = f"home_{game_id}"
            home_selected = st.toggle(game["home_team"], key=home_key)
            if home_selected:
                save_pick(user_id, game_id, "ATS", game["home_team"], week)
            else:
                delete_pick(user_id, game_id, "ATS", game["home_team"])

        # O/U toggles
        with cols[4]:
            ou_cols = st.columns(2)
            with ou_cols[0]:
                over_key = f"over_{game_id}"
                over_selected = st.toggle(f"O {game['over_under']}", key=over_key)
                if over_selected:
                    save_pick(user_id, game_id, "O/U", "O", week, over_under_pick="O", over_under_total=game["over_under"])
                else:
                    delete_pick(user_id, game_id, "O/U", "O")
            with ou_cols[1]:
                under_key = f"under_{game_id}"
                under_selected = st.toggle(f"U {game['over_under']}", key=under_key)
                if under_selected:
                    save_pick(user_id, game_id, "O/U", "U", week, over_under_pick="U", over_under_total=game["over_under"])
                else:
                    delete_pick(user_id, game_id, "O/U", "U")

        # SD toggle
        with cols[5]:
            sd_key = f"sd_{game_id}"
            sd_selected = st.toggle("💀", key=sd_key)
            if sd_selected:
                save_pick(user_id, game_id, "SD", game["home_team"], week)
            else:
                delete_pick(user_id, game_id, "SD", game["home_team"])

        # UD toggle
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
            if underdog:
                ud_key = f"ud_{game_id}"
                ud_selected = st.toggle("🐶", key=ud_key)
                if ud_selected:
                    save_pick(user_id, game_id, "UD", underdog, week, underdog_points=underdog_points)
                else:
                    delete_pick(user_id, game_id, "UD", underdog)

    # Weekly Comment
    st.divider()
    st.subheader("Weekly Comment")
    week_start = datetime.date.fromisocalendar(datetime.date.today().year, week, 4)
    existing = supabase.table("weekly_entries").select("comment").eq("user_id", user_id).eq("week_start", week_start).execute().data
    existing_comment = existing[0]["comment"] if existing else ""
    comment = st.text_area("Add a comment for this week", value=existing_comment, key="weekly_comment")
    if st.button("Save Comment"):
        supabase.table("weekly_entries").upsert({
            "user_id": user_id,
            "week_start": week_start.isoformat(),
            "comment": comment,
            "submitted_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }).execute()
        st.success("Comment saved!")
