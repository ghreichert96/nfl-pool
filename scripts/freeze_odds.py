import os
import datetime
from supabase import create_client, Client
import requests

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
ODDS_API_KEY = os.getenv("ODDS_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase credentials missing! Check your secrets.")

if not ODDS_API_KEY:
    raise ValueError("Missing ODDS_API_KEY! Add it to your .env and GitHub secrets.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

ODDS_API_URL = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds"

def get_nfl_week(game_datetime: datetime.datetime) -> int:
    """Returns the NFL week number based on the game start datetime."""
    season_start = datetime.datetime(2025, 9, 4, tzinfo=datetime.timezone.utc)
    delta_days = (game_datetime - season_start).days
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

def extract_spread_and_totals(game, home_team):
    """Safely extracts spread and over/under from Odds API response."""
    spread = None
    over_under = None

    if not game.get("bookmakers"):
        return spread, over_under

    first_bookmaker = game["bookmakers"][0]
    for market in first_bookmaker.get("markets", []):
        if market["key"] == "spreads":
            for outcome in market.get("outcomes", []):
                if outcome["name"] == home_team:
                    spread = outcome.get("point")
        elif market["key"] == "totals":
            if market.get("outcomes"):
                over_under = market["outcomes"][0].get("point")

    return spread, over_under

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
        nfl_week = get_nfl_week(datetime.datetime.fromisoformat(time.replace("Z", "+00:00")))
        year = datetime.datetime.fromisoformat(time.replace("Z", "+00:00")).year

        spread, over_under = extract_spread_and_totals(game, home_team)

        existing = supabase.table("games").select("*").eq("id", game_id).execute()
        existing_game = existing.data[0] if existing.data else None

        if existing_game:
            if (
                existing_game["home_team"] != home_team
                or existing_game["away_team"] != away_team
                or existing_game["time"] != time
                or existing_game.get("spread") != spread
                or existing_game.get("over_under") != over_under
            ):
                supabase.table("games").update({
                    "home_team": home_team,
                    "away_team": away_team,
                    "time": time,
                    "year": year,
                    "nfl_week": nfl_week,
                    "spread": spread,
                    "over_under": over_under,
                    "locked_at": now
                }).eq("id", game_id).execute()

                updated += 1
                print(f"✅ Updated game {game_id}: {away_team} @ {home_team} | Spread: {spread} | O/U: {over_under}")
            else:
                skipped += 1
        else:
            supabase.table("games").insert({
                "id": game_id,
                "home_team": home_team,
                "away_team": away_team,
                "time": time,
                "year": year,
                "nfl_week": nfl_week,
                "spread": spread,
                "over_under": over_under,
                "locked_at": now
            }).execute()

            inserted += 1
            print(f"➕ Inserted new game {game_id}: {away_team} @ {home_team} | Spread: {spread} | O/U: {over_under}")

    print(f"\n📊 Summary: {updated} updated, {inserted} inserted, {skipped} skipped.")

if __name__ == "__main__":
    freeze_odds()

