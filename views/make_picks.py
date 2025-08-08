import os
import streamlit as st
from backend.db import supa

def _team_opts(g):
    return [g["away_team"], g["home_team"]]

def render():
    st.title("Make Picks")

    user = st.session_state.get("user")
    if not user:
        st.warning("Please login.")
        return

    year = int(os.environ.get("DEFAULT_YEAR", "2025"))
    week = int(os.environ.get("NFL_WEEK", "1"))
    client = supa()

    # Show only FROZEN lines for this week
    resp = client.table("games").select("*") \
        .eq("year", year).eq("nfl_week", week) \
        .not_.is_("locked_at", None).execute()
    games = resp.data or []

    if not games:
        st.info("No frozen games for this week yet. Ask the commissioner to freeze odds on the Admin page.")
        return

    st.caption("Select **6 ATS** picks (mark exactly **1** as your Double), **3 O/U** picks, **1 Survivor**, and **1 Underdog**. Add an optional comment at the end.")

    # --- ATS PICKS (exactly 6; 1 double) ---
    st.subheader("Against the Spread (6 picks, 1 double)")
    ats_selections = {}
    double_game_id = st.radio(
        "Pick your **Double** (best bet):",
        [g["id"] for g in games],
        format_func=lambda gid: next(f'{x["away_team"]} @ {x["home_team"]}' for x in games if x["id"] == gid),
        horizontal=True,
    )

    for g in games:
        label = f'{g["away_team"]} @ {g["home_team"]}   |   Spread: {g["spread"]}'
        ats_selections[g["id"]] = st.radio(
            label, _team_opts(g), key=f"ats_{g['id']}", horizontal=True
        )

    st.caption("Tip: You must submit exactly 6 ATS picks; we'll take the first 6 in the order shown for MVP. (We’ll add per-game toggles soon.)")

    # --- O/U PICKS (exactly 3) ---
    st.subheader("Totals (Over/Under) – choose 3")
    ou_selections = {}
    for g in games:
        label = f'{g["away_team"]} @ {g["home_team"]}   |   O/U: {g["over_under"]}'
        ou_selections[g["id"]] = st.radio(
            label, ["O", "U"], key=f"ou_{g['id']}", horizontal=True
        )

    # --- Survivor (1 team to win outright) ---
    st.subheader("Survivor (1 pick to win outright)")
    all_teams = []
    for g in games:
        all_teams.extend(_team_opts(g))
    survivor_pick = st.selectbox("Survivor pick:", sorted(set(all_teams)))

    # --- Underdog (1 team; if they win outright, you get points = spread) ---
    st.subheader("Underdog (1 pick)")
    underdog_pick = st.selectbox("Underdog pick:", sorted(set(all_teams)))
    st.caption("MVP note: We aren’t verifying underdog status here yet; we’ll validate server-side / during scoring.")

    comment = st.text_area("Comments (optional)")

    if st.button("Submit All Picks"):
        # Basic MVP logic: take FIRST 6 ATS and FIRST 3 O/U (in the shown order)
        ats_ids = list(ats_selections.keys())[:6]
        ou_ids = list(ou_selections.keys())[:3]

        # Validate counts
        if len(ats_ids) != 6:
            st.error("You must have 6 ATS picks.")
            return
        if len(ou_ids) != 3:
            st.error("You must have 3 O/U picks.")
            return
        if not survivor_pick:
            st.error("Please select a Survivor pick.")
            return
        if not underdog_pick:
            st.error("Please select an Underdog pick.")
            return

        client = supa()

        # Save ATS
        for gid in ats_ids:
            client.table("picks").insert({
                "user_id": user["id"],
                "game_id": gid,
                "type": "ATS",
                "selection": ats_selections[gid],
                "is_double": (gid == double_game_id)
            }).execute()

        # Save O/U
        for gid in ou_ids:
            client.table("picks").insert({
                "user_id": user["id"],
                "game_id": gid,
                "type": "OU",
                "selection": "TOTAL",
                "over_under_pick": ou_selections[gid]
            }).execute()

        # Save Survivor (use any game_id just to associate week; we’ll compute by team later)
        # MVP: associate with the first game for this week
        first_gid = games[0]["id"]
        client.table("picks").insert({
            "user_id": user["id"],
            "game_id": first_gid,
            "type": "SD",
            "selection": survivor_pick
        }).execute()

        # Save Underdog (same association trick)
        client.table("picks").insert({
            "user_id": user["id"],
            "game_id": first_gid,
            "type": "UD",
            "selection": underdog_pick
        }).execute()

        # Optional: log a comment (create a simple table later if you want it persisted)
        if comment.strip():
            st.session_state["last_comment"] = comment.strip()

        st.success("Picks submitted! (Check the Admin/DB to confirm.)")
