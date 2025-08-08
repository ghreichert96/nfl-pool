import streamlit as st

def render():
    st.title("Standings")

    st.subheader("Current Week")
    st.info("Coming next: Rk, Total W-L-T, ATS W-L-T, O/U W-L-T, Underdog (W/L), Sudden Death (W/L).")

    st.subheader("Overall")
    st.info("Coming next: Rk, Total W-L-T, ATS W-L-T, O/U W-L-T, Underdog Pts, SD strikes left, SD picks so far.")
