import streamlit as st
from backend.db import supa

def render():
    st.title("Profile / Settings")

    user = st.session_state.get("user")
    if not user:
        st.warning("Please login.")
        return

    client = supa()
    st.subheader("Account Info")

    name = st.text_input("Display name", value=user.get("name") or "")
    abbrev = st.text_input("Entry abbreviation", value=user.get("entry_abbreviation") or "")
    email = st.text_input("Email", value=user.get("email") or "")

    # (Password: typically via Supabase auth update; MVP skip actual change)
    new_pw = st.text_input("New password (optional)", type="password")

    if st.button("Save Profile"):
        updates = {"name": name, "entry_abbreviation": abbrev}
        # Only update email if changed
        if email and email != user.get("email"):
            updates["email"] = email

        client.table("users").update(updates).eq("id", user["id"]).execute()

        # TODO: update password via supabase.auth.update_user (needs a logged-in session token)
        if new_pw:
            st.info("Password change flow not wired yet (Supabase auth update required).")

        # Refresh session user
        row = client.table("users").select("*").eq("id", user["id"]).single().execute().data
        st.session_state["user"] = row
        st.success("Profile updated.")
