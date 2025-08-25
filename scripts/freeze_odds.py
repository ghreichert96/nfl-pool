import os
import datetime
from supabase import create_client, Client
import requests

# Load environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
ODDS_API_KEY = os.getenv("ODDS_API_KEY")  # Assuming you're using The Odds API

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# The Odds API endpoint (adjust based on your league/market)
ODDS_API_URL = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds"

def fetch_latest_odds():
    """Fetch current NFL odds from the API."""
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
    """Update Supabase only if odds changed."""
    # Fetch odds from API
    latest_odds = fetch_latest_odds()

    # Fetch existing games from Supabase
    existing_games = supabase.table("games").select("*").execute()
    existing_map = {g["game_id"]: g for g in existing_games.data}

    updates = []
    now = datetime.datetime.utcnow().isoformat()

    for game in latest_odds:
        game_id = game["id"]
        home_team = game["home_team"]
        away_team = game["away_team"]
        bookmakers = game.get("bookmakers", [])

        if not bookmakers:
            continue

        # Grab the first bookmaker's spreads and totals for simplicity
        spreads = bookmakers[0]["markets"][0]["outcomes"]
        totals = bookmakers[0]["markets"][1]["outcomes"]

        # Structure new odds snapshot
        new_home_odds = spreads[0]["price"] if spreads[0]["name"] == home_team else spreads[1]["price"]
        new_away_odds = spreads[1]["price"] if spreads[1]["name"] == away_team else spreads[0]["price"]
        new_total = totals[0]["point"]  # Over/under number

        # Check existing game data
        existing = existing_map.get(game_id)
        if not existing:
            # New game → always insert
            updates.append({
                "game_id": game_id,
                "home_team": home_team,
                "away_team": away_team,
                "home_odds": new_home_odds,
                "away_odds": new_away_odds,
                "total": new_total,
                "locked_at": now,
            })
        else:
            # Compare existing vs new odds
            if (
                existing["home_odds"] != new_home_odds or
                existing["away_odds"] != new_away_odds or
                existing["total"] != new_total
            ):
                # Only update if odds changed
                updates.append({
                    "id": existing["id"],  # required for update
                    "home_odds": new_home_odds,
                    "away_odds": new_away_odds,
                    "total": new_total,
                    "locked_at": now,
                })

    if updates:
        print(f"Updating {len(updates)} games...")
        supabase.table("games").upsert(updates).execute()
    else:
        print("No odds changed. Nothing updated.")

if __name__ == "__main__":
    freeze_odds()

