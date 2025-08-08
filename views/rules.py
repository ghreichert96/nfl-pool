import streamlit as st

def render():
    st.title("Rules")
    st.markdown(
        """
        Paste your league rules here (Markdown supported).

        **MVP idea:** we can load this from a Supabase `rules` table or a file later.
        """
    )
