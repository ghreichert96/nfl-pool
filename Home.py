# Home.py
import os
import streamlit as st
import pandas as pd
from dotenv import load_dotenv, find_dotenv
from backend.auth import ensure_session, login, register, logout
from backend.db import supa

# ---------- Page setup ----------
st.set_page_config(page_title="NFL Pool", page_icon="🏈", layout="wide")

# Load .env from project root (no st.secrets for local dev)
ENV_PATH = find_dotenv(filename=".env", usecwd=True)
load_dotenv(ENV_PATH, override=False)

# Optional: warn if critical env vars are missing (helps during setup)
missing = [k for k in ("SUPABASE_URL", "SUPABASE_KEY") if not os.environ.get(k)]
if missing:
    st.warning(f"Missing env vars: {', '.join(missing)}. Create a .env in your project root.")

# Initialize session keys
ensure_session()


def auth_ui():
    login_tab, register_tab = st.tabs(["Login", "Register"])

    with login_tab:
        email = st.text_input("Email", key="login_email")
        password = st.text_input("Password", type="password", key="login_pw")
        if st.button("Login"):
            ok, msg = login(email, password)
            st.toast(msg)
            if ok:
                st.rerun()

    with register_tab:
        name = st.text_input("Name", key="reg_name")
        email2 = st.text_input("Email", key="reg_email")
        pw2 = st.text_input("Password", type="password", key="reg_pw")
        if st.button("Create Account"):
            ok, msg = register(name, email2, pw2)
            st.toast(msg)


# ---------- Auth gate ----------
if not st.session_state["user"]:
    st.title("NFL Pool")
    auth_ui()
    st.stop()

# ---------- Sidebar ----------
st.sidebar.success(f"Logged in as {st.session_state['user'].get('name') or st.session_state['user'].get('email')}")
if st.sidebar.button("Logout"):
    logout()
    st.rerun()

# ---------- Lazy import views only after login ----------
from views import make_picks, standings, rules, profile, admin  # noqa: E402


# ---------- Helper: color function ----------
def color_picks(val):
    if val is None:
        return ""
    if str(val).endswith("W"):
        return "background-color: #d4edda"  # green
    if str(val).endswith("L"):
        return "background-color: #f8d7da"  # red
    if str(val).endswith("P"):
        return "background-color: #fff3cd"  # yellow
    if str(val).endswith("IP"):
        return "background-color: #e2e3e5"  # grey
    return ""


# ---------- Tabs ----------
tabs = st.tabs(["Home", "Make Picks", "Standings", "Rules", "Profile", "Admin"])

with tabs[0]:
    st.subheader("Commissioner Message")
    st.info("Welcome to the 2025 season! Picks lock Thu 8p ET.")

    # --- Weekly Picks Grid ---
    client = supa()
    data = client.table("weekly_grid").select("*").execute().data

    if not data:
        st.info("No picks submitted yet.")
    else:
        df = pd.DataFrame(data)

        # Reorder cols to match grid design
        display_cols = [
            "user_name", "bb", "ats1", "ats2", "ats3", "ats4", "ats5",
            "ou1", "ou2", "ou3", "sd", "ud", "comment"
        ]
        grid = df[display_cols].rename(columns={"user_name": "Entry", "comment": "Comments"})

        styled = grid.style.applymap(color_picks, subset=grid.columns[1:-1])  # all pick columns
        st.dataframe(styled, use_container_width=True, hide_index=True)

with tabs[1]:
    make_picks.render()

with tabs[2]:
    standings.render()

with tabs[3]:
    rules.render()

with tabs[4]:
    profile.render()

with tabs[5]:
    admin.render()
