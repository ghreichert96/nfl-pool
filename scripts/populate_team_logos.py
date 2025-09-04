import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

# Connect to Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ✅ Hardcoded 32-team dictionary with direct PNG links
LOGO_URLS = {
    "Arizona Cardinals": "https://upload.wikimedia.org/wikipedia/en/thumb/7/72/Arizona_Cardinals_logo.svg/1200px-Arizona_Cardinals_logo.svg.png",
    "Atlanta Falcons": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c5/Atlanta_Falcons_logo.svg/1200px-Atlanta_Falcons_logo.svg.png",
    "Baltimore Ravens": "https://upload.wikimedia.org/wikipedia/en/thumb/1/16/Baltimore_Ravens_logo.svg/1200px-Baltimore_Ravens_logo.svg.png",
    "Buffalo Bills": "https://upload.wikimedia.org/wikipedia/en/thumb/7/77/Buffalo_Bills_logo.svg/1200px-Buffalo_Bills_logo.svg.png",
    "Carolina Panthers": "https://upload.wikimedia.org/wikipedia/en/thumb/1/1c/Carolina_Panthers_logo.svg/1200px-Carolina_Panthers_logo.svg.png",
    "Chicago Bears": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Chicago_Bears_logo.svg/1024px-Chicago_Bears_logo.svg.png",
    "Cincinnati Bengals": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Cincinnati_Bengals_logo.svg/1024px-Cincinnati_Bengals_logo.svg.png",
    "Cleveland Browns": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d9/Cleveland_Browns_logo.svg/1200px-Cleveland_Browns_logo.svg.png",
    "Dallas Cowboys": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Dallas_Cowboys.svg/1024px-Dallas_Cowboys.svg.png",
    "Denver Broncos": "https://upload.wikimedia.org/wikipedia/en/thumb/4/44/Denver_Broncos_logo.svg/1200px-Denver_Broncos_logo.svg.png",
    "Detroit Lions": "https://upload.wikimedia.org/wikipedia/en/thumb/7/71/Detroit_Lions_logo.svg/1200px-Detroit_Lions_logo.svg.png",
    "Green Bay Packers": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Green_Bay_Packers_logo.svg/1024px-Green_Bay_Packers_logo.svg.png",
    "Houston Texans": "https://upload.wikimedia.org/wikipedia/en/thumb/2/28/Houston_Texans_logo.svg/1200px-Houston_Texans_logo.svg.png",
    "Indianapolis Colts": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Indianapolis_Colts_logo.svg/1024px-Indianapolis_Colts_logo.svg.png",
    "Jacksonville Jaguars": "https://upload.wikimedia.org/wikipedia/en/thumb/7/74/Jacksonville_Jaguars_logo.svg/1200px-Jacksonville_Jaguars_logo.svg.png",
    "Kansas City Chiefs": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e1/Kansas_City_Chiefs_logo.svg/1200px-Kansas_City_Chiefs_logo.svg.png",
    "Las Vegas Raiders": "https://upload.wikimedia.org/wikipedia/en/thumb/4/48/Las_Vegas_Raiders_logo.svg/1200px-Las_Vegas_Raiders_logo.svg.png",
    "Los Angeles Chargers": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a0/Los_Angeles_Chargers_logo.svg/1200px-Los_Angeles_Chargers_logo.svg.png",
    "Los Angeles Rams": "https://upload.wikimedia.org/wikipedia/en/thumb/8/8a/Los_Angeles_Rams_logo.svg/1200px-Los_Angeles_Rams_logo.svg.png",
    "Miami Dolphins": "https://upload.wikimedia.org/wikipedia/en/thumb/3/37/Miami_Dolphins_logo.svg/1200px-Miami_Dolphins_logo.svg.png",
    "Minnesota Vikings": "https://upload.wikimedia.org/wikipedia/en/thumb/4/48/Minnesota_Vikings_logo.svg/1200px-Minnesota_Vikings_logo.svg.png",
    "New England Patriots": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b9/New_England_Patriots_logo.svg/1200px-New_England_Patriots_logo.svg.png",
    "New Orleans Saints": "https://upload.wikimedia.org/wikipedia/en/thumb/9/9d/New_Orleans_Saints_logo.svg/1200px-New_Orleans_Saints_logo.svg.png",
    "New York Giants": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/New_York_Giants_logo.svg/1200px-New_York_Giants_logo.svg.png",
    "New York Jets": "https://upload.wikimedia.org/wikipedia/en/thumb/6/6b/New_York_Jets_logo.svg/1200px-New_York_Jets_logo.svg.png",
    "Philadelphia Eagles": "https://upload.wikimedia.org/wikipedia/en/thumb/8/8e/Philadelphia_Eagles_logo.svg/1200px-Philadelphia_Eagles_logo.svg.png",
    "Pittsburgh Steelers": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Pittsburgh_Steelers_logo.svg/1024px-Pittsburgh_Steelers_logo.svg.png",
    "San Francisco 49ers": "https://upload.wikimedia.org/wikipedia/en/thumb/8/8e/San_Francisco_49ers_logo.svg/1200px-San_Francisco_49ers_logo.svg.png",
    "Seattle Seahawks": "https://upload.wikimedia.org/wikipedia/en/thumb/8/8e/Seattle_Seahawks_logo.svg/1200px-Seattle_Seahawks_logo.svg.png",
    "Tampa Bay Buccaneers": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Tampa_Bay_Buccaneers_logo.svg/1200px-Tampa_Bay_Buccaneers_logo.svg.png",
    "Tennessee Titans": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c1/Tennessee_Titans_logo.svg/1200px-Tennessee_Titans_logo.svg.png",
    "Washington Commanders": "https://upload.wikimedia.org/wikipedia/en/thumb/6/6c/Washington_Commanders_logo.svg/1200px-Washington_Commanders_logo.svg.png",
}

# Fetch all NFL teams from DB
teams = supabase.table("nfl_teams").select("id, team_name").execute().data

# Update each team with its correct logo_url
for team in teams:
    team_id = team["id"]
    team_name = team["team_name"]
    logo_url = LOGO_URLS.get(team_name)

    if logo_url:
        print(f"Updating {team_name} → {logo_url}")
        supabase.table("nfl_teams").update({"logo_url": logo_url}).eq("id", team_id).execute()
    else:
        print(f"⚠️ No logo found for {team_name}")

print("✅ Logo URLs populated successfully.")
