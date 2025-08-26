import os
import datetime
from supabase import create_client, Client
import requests

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
ODDS_API_KEY = os.getenv("ODDS_API_KEY")

# Validate required secrets
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase credentials missing! Check your secrets.")
if not ODDS_API_KEY:
    raise ValueError("Missing ODDS_API_KEY! Add it to your .env and GitHub secrets.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

ODDS_API_URL = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds"

def get_nfl_week(game_datetime: datetime.datetime) -> int:
    """Derive NFL week number based on season start."""
    season_start = datetime.datetime(2025, 9, 4, tzinfo=datetime.timezone.utc)
    delta_days = (game_datetime - season_start).days
    return max(1, delta_days // 7 + 1)

def get_current_nfl_week() -> int:
    """Returns the current NFL week based on today's UTC date."""
    today = datetime.datetime.utcnow().date()
    season_start = datetime.date(2025, 9, 4)
    delta_days = (today - season_start).days
    return max(1, delta_days // 7 + 1)

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
    print("Fetching latest odds...")
    odds = fetch_odds()
    now = datetime.datetime.utcnow().isoformat()
    current_week = get_current_nfl_week()

    updated, skipped, inserted = 0, 0, 0

    for game in odds:
        game_id = game["id"]
        home_team = game["home_team"]
        away_team = game["away_team"]
        time = game["commence_time"]
        dt_obj = datetime.datetime.fromisoformat(time.replace("Z", "+00:00"))
        date = dt_obj.date().isoformat()
        year = dt_obj.year
        nfl_week = get_nfl_week(dt_obj)

        # Skip any games outside the current week
        if nfl_week != current_week:
            continue

        # Extract spread and over/under if available
        spread = None
        over_under = None
        for bookmaker in game.get("bookmakers", []):
            for market in bookmaker.get("markets", []):
                if market["key"] == "spreads" and market["outcomes"]:
                    spread = market["outcomes"][0]["point"]
                elif market["key"] == "totals" and market["outcomes"]:
                    over_under = market["outcomes"][0]["point"]

        # Check if this game already exists in Supabase
        existing = supabase.table("games").select("*").eq("id", game_id).execute()
        existing_game = existing.data[0] if existing.data else None

        if existing_game:
            # Update if any relevant field has changed
            if (existing_game["home_team"] != home_team or
                existing_game["away_team"] != away_team or
                existing_game["time"] != time or
                existing_game.get("spread") != spread or
                existing_game.get("over_under") != over_under):

                supabase.table("games").update({
                    "home_team": home_team,
                    "away_team": away_team,
                    "time": time,
                    "date": date,
                    "year": year,
                    "nfl_week": nfl_week,
                    "spread": spread,
                    "over_under": over_under,
                    "locked_at": now
                }).eq("id", game_id).execute()
                updated += 1
            else:
                skipped += 1
        else:
            # Insert new game if not found
            supabase.table("games").insert({
                "id": game_id,
                "home_team": home_team,
                "away_team": away_team,
                "time": time,
                "date": date,
                "year": year,
                "nfl_week": nfl_week,
                "spread": spread,
                "over_under": over_under,
                "locked_at": now
            }).execute()
            inserted += 1

    print(f"Summary: {updated} updated, {inserted} inserted, {skipped} skipped.")

if __name__ == "__main__":
    freeze_odds()

