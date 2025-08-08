# Home.py
import os
import streamlit as st
from dotenv import load_dotenv, find_dotenv
from backend.auth import ensure_session, login, register, logout

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

# ---------- Tabs ----------
tabs = st.tabs(["Home", "Make Picks", "Standings", "Rules", "Profile", "Admin"])

with tabs[0]:
    st.subheader("Commissioner Message")
    st.info("Welcome to the 2025 season! Picks lock Thu 8p ET. (Grid and chat coming soon.)")
    st.write("Home grid goes here (entrants × picks with red/green shading).")

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
