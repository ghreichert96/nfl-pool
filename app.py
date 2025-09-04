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
def get_current_nfl_week():
    today = datetime.datetime.utcnow().date()
    season_start = datetime.date(2025, 9, 4)
    delta_days = (today - season_start).days
    return max(1, delta_days // 7 + 1)

def fetch_spreads():
    current_week = get_current_nfl_week()
    data = (
        supabase.table("spreads")
        .select("date, time, away_team, spread, home_team, over_under")
        .eq("nfl_week", current_week)
        .order("date", desc=False)
        .order("time", desc=False)
        .execute()
    )
    return data.data or []

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
def render_home():
    st.subheader("Commissioner Message")
    st.info("Welcome to the 2025 season! Picks lock Thu 8p ET.")

    spreads = fetch_spreads()
    if not spreads:
        st.warning("No spreads found for the current week.")
        return

    df = pd.DataFrame(spreads)
    df["time"] = df.apply(lambda row: convert_to_est(row["date"], row["time"]), axis=1)
    df.rename(columns={
        "away_team": "Away",
        "spread": "Spread",
        "home_team": "Home",
        "over_under": "O/U",
        "date": "Date",
        "time": "Time"
    }, inplace=True)

    df = df.sort_values(by=["Date", "Time"], ascending=[True, True])
    df = df[["Date", "Time", "Away", "Spread", "Home", "O/U"]]

    st.dataframe(df, use_container_width=True)

def render_standings():
    st.subheader("📊 Standings")
    st.info("Standings view coming soon.")

def render_make_picks():
    if st.session_state.get("is_admin", False):
        import views.make_picks as make_picks
        make_picks.run()
    else:
        st.markdown("### **UNDER CONSTRUCTION**")

def render_rules():
    st.subheader("📜 Rules")
    st.info("Rules page coming soon.")

def render_profile():
    st.subheader("👤 Profile")
    st.info("Profile page coming soon.")

def render_admin():
    st.subheader("⚙️ Admin")
    st.info("Admin tools go here.")

# -------------------------
# Main app
# -------------------------
def main():
    # build tab row
    tabs = st.tabs(["Home", "Make Picks", "Standings", "Rules", "Profile", "Admin"])

    with tabs[0]:
        render_home()
    with tabs[1]:
        render_make_picks()
    with tabs[2]:
        render_standings()
    with tabs[3]:
        render_rules()
    with tabs[4]:
        render_profile()
    with tabs[5]:
        render_admin()

if __name__ == "__main__":
    main()
