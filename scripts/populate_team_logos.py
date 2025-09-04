import os
from supabase import create_client

# Connect to Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Fetch all NFL teams
teams = supabase.table("nfl_teams").select("id, team_name").execute().data

def format_wikipedia_url(team_name: str) -> str:
    # Handle special cases manually (if needed)
    special_cases = {
        "Washington Commanders": "Washington_Commanders_logo.svg",
        "New York Giants": "New_York_Giants_logo.svg",
        "New York Jets": "New_York_Jets_logo.svg",
        "San Francisco 49ers": "San_Francisco_49ers_logo.svg"
    }

    if team_name in special_cases:
        return f"https://en.wikipedia.org/wiki/File:{special_cases[team_name]}"

    parts = team_name.strip().split()
    location = " ".join(parts[:-1])
    nickname = parts[-1]

    # Combine parts with underscore and append "_logo.svg"
    formatted = f"{location}_{nickname}".replace(" ", "_")
    return f"https://en.wikipedia.org/wiki/File:{formatted}_logo.svg"

# Update each team with logo_url
for team in teams:
    team_id = team["id"]
    team_name = team["team_name"]
    logo_url = format_wikipedia_url(team_name)

    print(f"Updating {team_name} → {logo_url}")
    supabase.table("nfl_teams").update({"logo_url": logo_url}).eq("id", team_id).execute()

print("✅ Logo URLs populated successfully.")
