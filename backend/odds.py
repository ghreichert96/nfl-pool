# backend/odds.py
import os
import json
import requests
import datetime
import pytz
import streamlit as st
from backend.db import supa
from collections import Counter

class NFLDataService:
    def __init__(self):
        self.odds_api_key = os.getenv("ODDS_API_KEY")
        
    @st.cache_data(ttl=3600)  # Cache for 1 hour
    def get_spreads_for_week(_self, week: int):
        """Get spreads from database with caching"""
        try:
            client = supa()
            data = client.table("spreads") \
                .select("nfl_game_id, date, time, away, home, spread, total") \
                .eq("nfl_week", week) \
                .order("date") \
                .order("time") \
                .execute()
            
            return data.data or []
            
        except Exception as e:
            print(f"Error fetching spreads: {e}")
            return []
    
    @st.cache_data(ttl=1800)  # Cache for 30 minutes
    def get_team_logos(_self):
        """Get all team logos as a lookup dict"""
        try:
            client = supa()
            data = client.table("nfl_teams") \
                .select("abbrev, logo_url") \
                .execute()
            
            return {team['abbrev']: team['logo_url'] 
                   for team in data.data if team.get('logo_url')}
        except:
            return {}
    
def get_current_week(self):
    """Calculate current NFL week"""
    today = datetime.date.today()
    season_start = datetime.date(2025, 9, 3)  # Wednesday 9/3
    if today < season_start:
        return 1
    delta_days = (today - season_start).days
    return min(18, max(1, (delta_days // 7) + 1))

# Global instance
nfl_data = NFLDataService()

# Drop-in replacements for your existing functions
def fetch_spreads(week: int):
    """Drop-in replacement - use this in make_picks.py"""
    return nfl_data.get_spreads_for_week(week)

def get_team_logo(team_abbrev: str):
    """Drop-in replacement"""
    logos = nfl_data.get_team_logos()
    return logos.get(team_abbrev)

def get_current_nfl_week():
    """Drop-in replacement"""
    return nfl_data.get_current_week()

# Updated freeze functionality for new schema
def fetch_odds():
    """Fetch odds from API"""
    api_key = os.environ.get("ODDS_API_KEY")
    if not api_key:
        raise RuntimeError("Missing ODDS_API_KEY in environment")

    url = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds"
    params = {
        "apiKey": api_key,
        "regions": "us",
        "markets": "spreads,totals",
        "oddsFormat": "american"
    }
    r = requests.get(url, params=params, timeout=20)
    r.raise_for_status()
    return r.json()

def upsert_games(week: int):
    client = supa()
    eastern_tz = pytz.timezone("US/Eastern")
    
    # Get team abbreviation mapping
    teams_data = client.table("nfl_teams").select("team_name, abbrev").execute()
    team_map = {team['team_name']: team['abbrev'] for team in teams_data.data}
    
    odds_data = fetch_odds()
    games_to_insert = []
    spreads_to_insert = []
    
    for game in odds_data:
        try:
            home_team = game["home_team"]
            away_team = game["away_team"]
            start_time = datetime.datetime.fromisoformat(game["commence_time"].replace("Z", "+00:00"))
            eastern_time = start_time.astimezone(eastern_tz)
            
            # Calculate which NFL week this game belongs to based on its date
            def get_nfl_week_from_date(game_date):
                season_start = datetime.date(2025, 9, 3)  # Wednesday 9/3
                if game_date < season_start:
                    return 1
                delta_days = (game_date - season_start).days
                return min(18, max(1, (delta_days // 7) + 1))

            game_week = get_nfl_week_from_date(eastern_time.date())
            if game_week != week:
                continue
            
            # Collect all spreads and totals from all bookmakers
            game_spreads = []
            game_totals = []
            
            for bookmaker in game.get("bookmakers", []):
                for market in bookmaker.get("markets", []):
                    if market["key"] == "spreads" and market["outcomes"]:
                        # Find away team spread
                        for outcome in market["outcomes"]:
                            if outcome["name"] == away_team:
                                game_spreads.append(float(outcome["point"]))
                                break
                    elif market["key"] == "totals" and market["outcomes"]:
                        game_totals.append(float(market["outcomes"][0]["point"]))

            # Find the most common spread and total
            spread = None
            total = None

            if game_spreads:
                spread_counts = Counter(game_spreads)
                spread = spread_counts.most_common(1)[0][0]  # Most frequent spread

            if game_totals:
                total_counts = Counter(game_totals)
                total = total_counts.most_common(1)[0][0]  # Most frequent total
            
            if spread is not None and total is not None:
                # Create game_id 
                game_id = f"{2025}-{week:02d}-{team_map.get(away_team, away_team).lower()}-{team_map.get(home_team, home_team).lower()}"
                
                # Prepare nfl_games insert
                games_to_insert.append({
                    "away": team_map.get(away_team, away_team),
                    "home": team_map.get(home_team, home_team),
                    "season_year": 2025,
                    "nfl_week": week,
                    "game_id": game_id,
                    "date": eastern_time.date().isoformat(),
                    "start_time": eastern_time.time().isoformat(),
                    "spread": spread,
                    "total": total,
                    "locked": eastern_time < datetime.datetime.now(eastern_tz)
                })
                
                # Prepare spreads insert
                spreads_to_insert.append({
                    "nfl_game_id": game_id,
                    "season_year": 2025,
                    "nfl_week": week,
                    "date": eastern_time.date().isoformat(),
                    "time": eastern_time.time().isoformat(),
                    "away": team_map.get(away_team, away_team),
                    "home": team_map.get(home_team, home_team),
                    "spread": spread,
                    "total": total,
                    "locked": eastern_time < datetime.datetime.now(eastern_tz)
                })
                
        except Exception as e:
            print(f"Error processing game: {e}")
            continue
    
    # Insert into both tables
    if games_to_insert:
        client.table("nfl_games").upsert(games_to_insert, on_conflict="game_id").execute()
        print(f"Upserted {len(games_to_insert)} games")
    
    if spreads_to_insert:
        client.table("spreads").upsert(spreads_to_insert, on_conflict="nfl_game_id").execute()
        print(f"Upserted {len(spreads_to_insert)} spreads")
        
    return len(games_to_insert)