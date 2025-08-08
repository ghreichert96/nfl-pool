import streamlit as st
from backend.db import supa

def ensure_session():
    """Initialize session keys once."""
    st.session_state.setdefault("user", None)
    st.session_state.setdefault("is_admin", False)

def register(name, email, password):
    client = supa()
    r = client.auth.sign_up({"email": email, "password": password})
    if r.user:
        client.table("users").insert({"id": r.user.id, "name": name, "email": email}).execute()
        return True, "Registered."
    return False, "Registration failed."

def login(email, password):
    client = supa()
    r = client.auth.sign_in_with_password({"email": email, "password": password})
    if r.user:
        row = client.table("users").select("*").eq("id", r.user.id).execute().data
        user = row[0] if row else {"id": r.user.id, "email": email, "name": email}
        st.session_state["user"] = user
        st.session_state["is_admin"] = bool(user.get("is_admin"))
        return True, "Logged in."
    return False, "Login failed."

def logout():
    st.session_state["user"] = None
    st.session_state["is_admin"] = False
