# backend/db.py
import os
from supabase import create_client, Client

_supa: Client | None = None

def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise RuntimeError(
            f"Missing env var {name}. "
            "Create a .env in your project root and set SUPABASE_URL and SUPABASE_KEY. "
            "Example:\nSUPABASE_URL=https://YOURPROJECT.supabase.co\nSUPABASE_KEY=YOUR_ANON_KEY"
        )
    return val

def supa() -> Client:
    global _supa
    if _supa is None:
        url = _require_env("SUPABASE_URL")
        key = _require_env("SUPABASE_KEY")
        _supa = create_client(url, key)
    return _supa
