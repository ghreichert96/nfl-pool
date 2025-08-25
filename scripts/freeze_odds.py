import os
import datetime
from supabase import create_client, Client
import requests

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
ODDS_API_KEY = os.getenv("ODDS_API_KEY")

# Check for Supabase URL and API key
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase credentials missing! Check your secrets.")

# Check for Odds API key
if not ODDS_API_KEY:
    raise ValueError("Missing ODDS_API_KEY! Add it to your .env and GitHub secrets.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Odds API endpoint (update sport / region as needed)
ODDS_API_URL = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds"

def fetch_odds():
    """Fetches NFL odds from The Odds API."""
    params = {
        "apiKey": ODDS_API_KEY,
        "regions": "us",
        "markets": "spreads,totals",
        "oddsFormat": "american"
    }
    response = requests.get(ODDS_API_URL, params=params)
    response.raise_for_status()
    return response.json()

def freeze_odds():
    print("🔄 Fetching latest odds...")
    odds = fetch_odds()
    now = datetime.datetime.utcnow().isoformat()

    updated, skipped, inserted = 0, 0, 0

    for game in odds:
        game_id = game["id"]
        home_team = game["home_team"]
        away_team = game["away_team"]
        time = game["commence_time"]

        # Check if this game already exists in Supabase
        existing = supabase.table("games").select("*").eq("id", game_id).execute()
        existing_game = existing.data[0] if existing.data else None

        # If exists, check if any field has changed
        if existing_game:
            if (existing_game["home_team"] != home_team or
                existing_game["away_team"] != away_team or
                existing_game["commence_time"] != time):
                
                supabase.table("games").update({
                    "home_team": home_team,
                    "away_team": away_team,
                    "commence_time": time,
                    "locked_at": now
                }).eq("id", game_id).execute()

                updated += 1
                print(f"✅ Updated game {game_id}: {away_team} @ {home_team}")
            else:
                skipped += 1
        else:
            # Insert new game if not found
            supabase.table("games").insert({
                "id": game_id,
                "home_team": home_team,
                "away_team": away_team,
                "commence_time": time,
                "locked_at": now
            }).execute()

            inserted += 1
            print(f"➕ Inserted new game {game_id}: {away_team} @ {home_team}")

    print(f"\n📊 Summary: {updated} updated, {inserted} inserted, {skipped} skipped.")

if __name__ == "__main__":
    freeze_odds()
