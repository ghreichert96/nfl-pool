# backend/odds.py
import os
import requests
import pytz
from datetime import datetime
from backend.db import supa

SPORT = "americanfootball_nfl"

def fetch_odds():
    """Fetch spreads + totals from The Odds API for NFL."""
    api_key = os.environ.get("ODDS_API_KEY")
    if not api_key:
        raise RuntimeError("Missing ODDS_API_KEY in environment")

    url = f"https://api.the-odds-api.com/v4/sports/{SPORT}/odds"
    params = {
        "apiKey": api_key,
        "regions": "us",
        "markets": "spreads,totals",
    }
    r = requests.get(url, params=params, timeout=20)
    r.raise_for_status()
    return r.json()

def upsert_games(year: int, nfl_week: int, data: list, freeze: bool = False):
    """Insert (MVP: insert, not true upsert) frozen games into the games table."""
    client = supa()
    eastern_tz = pytz.timezone("US/Eastern")

    for g in data:
        try:
            home = g["home_team"]
            away = g["away_team"]
            start = datetime.fromisoformat(g["commence_time"].replace("Z", "+00:00"))
            eastern = start.astimezone(eastern_tz)

            bk = g["bookmakers"][0]
            markets = {m["key"]: m for m in bk.get("markets", [])}

            spreads = markets.get("spreads")
            totals = markets.get("totals")
            if not spreads or not totals:
                continue

            spread_point = spreads["outcomes"][0]["point"]
            ou_point = totals["outcomes"][0]["point"]
        except Exception:
            # skip any weird/incomplete games
            continue

        # ✅ Upsert with timestamptz for "time"
        client.table("games").upsert({
            "year": year,
            "nfl_week": nfl_week,
            "date": eastern.date().isoformat(),
            "time": eastern.isoformat(),   # full ISO timestamp with TZ
            "home_team": home,
            "away_team": away,
            "spread": float(spread_point),
            "over_under": float(ou_point),
            "locked_at": datetime.utcnow().isoformat() if freeze else None,
        }).execute()
