import os
import datetime
import pytz
import pandas as pd
import streamlit as st
from supabase import create_client

# -------------------------
# Supabase connection
# -------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

st.set_page_config(page_title="NFL Pool", layout="wide")

# -------------------------
# Helpers
# -------------------------
def get_max_available_week():
    resp = supabase.table("spreads").select("nfl_week").execute()
    if not resp.data:
        return 1
    weeks = [row["nfl_week"] for row in resp.data if row.get("nfl_week")]
    return max(weeks) if weeks else 1

def fetch_spreads(week):
    data = (
        supabase.table("spreads")
        .select("date, time, away_team, spread, home_team, over_under")
        .eq("nfl_week", week)
        .order("date", desc=False)
        .order("time", desc=False)
        .execute()
    )
    return data.data or []

def fetch_users():
    resp = supabase.table("users").select("abbrev").order("abbrev").execute()
    return [u["abbrev"] for u in resp.data] if resp.data else []

def convert_to_est(date_str, time_str):
    date_obj = datetime.datetime.strptime(str(date_str), "%Y-%m-%d").date()
    utc_dt = datetime.datetime.combine(
        date_obj,
        datetime.datetime.strptime(time_str, "%H:%M:%S").time()
    )
    utc_dt = utc_dt.replace(tzinfo=pytz.UTC)
    return utc_dt.astimezone(pytz.timezone("US/Eastern")).strftime("%-I:%M %p")

# -------------------------
# Page content
# -------------------------
def fetch_picks_for_week(week):
    resp = (
        supabase.table("picks")
        .select("user_id, type, selection, game_id, submitted_at, over_under_pick, is_double, underdog_points, comments")
        .eq("nfl_week", week)
        .order("submitted_at", desc=False)
        .execute()
    )
    return pd.DataFrame(resp.data) if resp.data else pd.DataFrame()

def fetch_results():
    resp = supabase.table("results").select("game_id, ml_winner, ats_winner, ou_result").execute()
    return pd.DataFrame(resp.data) if resp.data else pd.DataFrame()

def fetch_user_map():
    """Return {user_id: abbrev} for all users."""
    resp = supabase.table("users").select("id, abbrev").execute()
    return {u["id"]: u["abbrev"] for u in resp.data} if resp.data else {}

def render_home():
    st.subheader("Commissioner Message")
    st.info("Welcome to the 2025 season! Picks lock Thu 8p ET.")

    max_week = get_max_available_week()
    selected_week = st.selectbox("Select Week", list(range(1, max_week + 1)), index=max_week - 1)

    sub_tabs = st.tabs(["Board", "Grid"])

    # --- Board tab ---
    with sub_tabs[0]:
        spreads = fetch_spreads(selected_week)
        if spreads:
            df = pd.DataFrame(spreads)
            df["Time (EST)"] = df.apply(lambda row: convert_to_est(row["date"], row["time"]), axis=1)
            df.rename(columns={
                "away_team": "Away",
                "spread": "Spread",
                "home_team": "Home",
                "over_under": "O/U",
                "date": "Date"
            }, inplace=True)

            df = df.sort_values(by=["Date", "Time (EST)"], ascending=[True, True])
            df = df[["Date", "Time (EST)", "Away", "Spread", "Home", "O/U"]]

            st.dataframe(df, use_container_width=True, hide_index=True)
        else:
            st.warning(f"No spreads found for week {selected_week}.")

    # --- Grid tab ---
    with sub_tabs[1]:
        user_map = fetch_user_map()
        if user_map:
            users = sorted(user_map.values())
            grid_cols = ["Entry", "BB"] + [str(i) for i in range(1, 6)] \
                        + [f"O/U {i}" for i in range(1, 3+1)] + ["SD", "UD", "Comments"]
            grid_df = pd.DataFrame(columns=grid_cols)
            grid_df["Entry"] = users

            # fetch picks + results
            picks_df = fetch_picks_for_week(selected_week)
            results_df = fetch_results().set_index("game_id")

            # fill grid
            for user_id, abbrev in user_map.items():
                user_picks = picks_df[picks_df["user_id"] == user_id].sort_values("submitted_at")
                ats_count, ou_count = 0, 0
                for _, row in user_picks.iterrows():
                    sel = row["selection"]
                    if row["type"] == "BB":
                        grid_df.loc[grid_df["Entry"] == abbrev, "BB"] = sel
                    elif row["type"] == "SD":
                        grid_df.loc[grid_df["Entry"] == abbrev, "SD"] = sel
                    elif row["type"] == "UD":
                        grid_df.loc[grid_df["Entry"] == abbrev, "UD"] = sel
                    elif row["type"] == "ATS" and ats_count < 5:
                        col = str(ats_count + 1)
                        grid_df.loc[grid_df["Entry"] == abbrev, col] = sel
                        ats_count += 1
                    elif row["type"] == "OU" and ou_count < 3:
                        col = f"O/U {ou_count + 1}"
                        grid_df.loc[grid_df["Entry"] == abbrev, col] = row["over_under_pick"]
                        ou_count += 1
                # comments
                comments = user_picks["comments"].dropna().unique()
                if len(comments):
                    grid_df.loc[grid_df["Entry"] == abbrev, "Comments"] = comments[-1]

            # shading logic
            def highlight(val, col_name, game_id):
                if pd.isna(val) or val == "":
                    return ""
                if game_id not in results_df.index:
                    return ""
                result = results_df.loc[game_id]
                if col_name.startswith("O/U"):
                    return "background-color: lightgreen" if val == result["ou_result"] else "background-color: salmon"
                elif col_name in ["SD", "UD"]:
                    return "background-color: lightgreen" if val == result["ml_winner"] else "background-color: salmon"
                else:  # BB or ATS
                    return "background-color: lightgreen" if val == result["ats_winner"] else "background-color: salmon"

            # build styles per-cell
            styles = pd.DataFrame("", index=grid_df.index, columns=grid_df.columns)
            for _, row in picks_df.iterrows():
                abbrev = user_map.get(row["user_id"])
                if not abbrev:
                    continue
                col_name = None
                if row["type"] == "BB":
                    col_name = "BB"
                elif row["type"] == "SD":
                    col_name = "SD"
                elif row["type"] == "UD":
                    col_name = "UD"
                elif row["type"] == "ATS":
                    # find which ATS col matches this selection
                    for i in range(1, 6):
                        if grid_df.loc[grid_df["Entry"] == abbrev, str(i)].values[0] == row["selection"]:
                            col_name = str(i)
                            break
                elif row["type"] == "OU":
                    for i in range(1, 4):
                        if grid_df.loc[grid_df["Entry"] == abbrev, f"O/U {i}"].values[0] == row["over_under_pick"]:
                            col_name = f"O/U {i}"
                            break
                if col_name:
                    idx = grid_df.index[grid_df["Entry"] == abbrev][0]
                    styles.loc[idx, col_name] = highlight(
                        grid_df.loc[idx, col_name], col_name, row["game_id"]
                    )

            st.dataframe(grid_df.style.apply(lambda _: styles, axis=None), use_container_width=True, hide_index=True)

        else:
            st.info("No registered users yet.")


def render_standings():
    st.subheader("📊 Standings")
    max_week = get_max_available_week()
    selected_week = st.selectbox("Select Week", list(range(1, max_week + 1)), index=max_week - 1)

    # assuming you already have a view like standings_view
    resp = supabase.table("standings_view").select("*").eq("nfl_week", selected_week).execute()
    if resp.data:
        df = pd.DataFrame(resp.data)
        st.dataframe(df, use_container_width=True, hide_index=True)
    else:
        st.info(f"No standings available for week {selected_week}.")

def render_make_picks():
    import views.make_picks as make_picks
    make_picks.run()

def render_rules():
    st.subheader("📜 Rules")
    st.info("Rules page coming soon.")

def render_profile():
    st.subheader("👤 Profile")
    st.info("Profile page coming soon.")

def render_admin():
    import views.admin as admin
    admin.run()

def load_user_admin_flag():
    user_id = st.session_state.get("user_id")
    if not user_id:
        st.session_state["is_admin"] = False
        return
    resp = (
        supabase.table("users")
        .select("is_admin")
        .eq("id", user_id)
        .single()
        .execute()
    )
    st.session_state["is_admin"] = resp.data["is_admin"] if resp.data else False

# -------------------------
# Main app
# -------------------------
def main():
    if "is_admin" not in st.session_state:
        load_user_admin_flag()

    is_admin = st.session_state.get("is_admin", False)

    tabs = ["Home", "Standings", "Rules", "Profile"]
    if is_admin:
        tabs.insert(1, "Make Picks")
        tabs.append("Admin")

    st_tabs = st.tabs(tabs)
    tab_map = {
        "Home": render_home,
        "Standings": render_standings,
        "Rules": render_rules,
        "Profile": render_profile,
        "Make Picks": render_make_picks,
        "Admin": render_admin,
    }
    for i, tab_name in enumerate(tabs):
        with st_tabs[i]:
            tab_map[tab_name]()

if __name__ == "__main__":
    main()
