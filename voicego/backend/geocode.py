"""
geocode.py — Trustworthy destination resolution for arbitrary place names.

Pipeline (LLM at the edges, deterministic source for the numbers):
  1. Gemini + Google Search grounding: spoken place name -> REAL full address
     (grounded in live search, with the post-2025 admin reorg) + a candidate coord.
  2. Nominatim (OpenStreetMap): geocode that clean address -> authoritative coords.
  3. Cross-validate: prefer Nominatim; if it misses, fall back to the grounded
     coord (lower confidence). Distance to the user's GPS is read back for safety.

The LLM never invents coordinates as ground truth — coords come from a geocoder,
and the booking only proceeds after the user confirms the read-back address.
"""
import re
import json
import time
import math

import requests

from voice import GEMINI_API_KEY, GEMINI_MODEL

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


def _haversine_km(lat1, lng1, lat2, lng2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _gemini_grounded(prompt):
    """Call Gemini with Google Search grounding; retry on transient 503/overload."""
    if not GEMINI_API_KEY:
        return None
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        return None

    client = genai.Client(api_key=GEMINI_API_KEY)
    cfg = types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())]
    )
    for i in range(4):
        try:
            r = client.models.generate_content(model=GEMINI_MODEL, contents=prompt, config=cfg)
            return (r.text or "").strip()
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            if any(k in msg for k in ("503", "UNAVAILABLE", "overload", "429", "RESOURCE_EXHAUSTED")):
                time.sleep(1.2 * (i + 1))
                continue
            return None
    return None


def _nominatim(address):
    try:
        r = requests.get(
            NOMINATIM_URL,
            params={"q": address, "format": "json", "limit": 1, "countrycodes": "vn"},
            headers={"User-Agent": "VoiceGo/1.0 (hackathon accessibility demo)"},
            timeout=10,
        )
        arr = r.json()
        if arr:
            return float(arr[0]["lat"]), float(arr[0]["lon"])
    except Exception:  # noqa: BLE001
        pass
    return None


def resolve_destination(text, user_lat=None, user_lng=None):
    """
    Resolve a spoken place name to a real address + coordinates.
    Returns a dict (ok True/False). Never fabricates coords as ground truth.
    """
    if not text.strip():
        return {"ok": False, "reason": "empty"}

    loc_hint = ""
    if user_lat is not None and user_lng is not None:
        loc_hint = (
            f"GPS hiện tại của người dùng: {user_lat}, {user_lng}. "
            "Nếu địa điểm có NHIỀU chi nhánh/cơ sở, ưu tiên cơ sở GẦN GPS này nhất, "
            "và liệt kê các cơ sở khác vào 'alternatives'.\n"
        )

    prompt = (
        "Bạn là trợ lý định vị cho ứng dụng gọi xe. Hãy DÙNG TÌM KIẾM để tra địa chỉ THẬT.\n"
        f'Người dùng muốn đến: "{text}"\n'
        f"{loc_hint}"
        "Trả về DUY NHẤT một JSON (không giải thích):\n"
        '{"name":"<tên địa điểm>","full_address":"<địa chỉ đầy đủ kèm phường/quận/tỉnh>",'
        '"province":"<tỉnh/thành>","latitude":<số thập phân hoặc null>,'
        '"longitude":<số thập phân hoặc null>,"confidence":<0..1>,'
        '"alternatives":["<chi nhánh khác nếu có>"]}'
    )

    raw = _gemini_grounded(prompt)
    if not raw:
        return {"ok": False, "reason": "gemini_unavailable"}

    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        return {"ok": False, "reason": "parse_failed"}
    try:
        g = json.loads(m.group(0))
    except json.JSONDecodeError:
        return {"ok": False, "reason": "parse_failed"}

    address = g.get("full_address") or text
    name = g.get("name") or text

    # Authoritative coords from Nominatim; grounded coords as fallback only.
    coords = _nominatim(address)
    source = "nominatim"
    g_lat, g_lng = g.get("latitude"), g.get("longitude")
    if not coords and isinstance(g_lat, (int, float)) and isinstance(g_lng, (int, float)):
        coords = (float(g_lat), float(g_lng))
        source = "gemini_grounded"

    if not coords:
        return {"ok": False, "reason": "no_coords", "name": name, "address": address}

    lat, lng = coords
    confidence = float(g.get("confidence", 0.6))

    # Cross-validate Nominatim vs grounded coord (if both exist).
    if source == "nominatim" and isinstance(g_lat, (int, float)) and isinstance(g_lng, (int, float)):
        gap = _haversine_km(lat, lng, float(g_lat), float(g_lng))
        if gap > 8:  # sources disagree a lot -> be cautious
            confidence = min(confidence, 0.5)

    distance_km = None
    if user_lat is not None and user_lng is not None:
        distance_km = round(_haversine_km(user_lat, user_lng, lat, lng), 1)

    return {
        "ok": True,
        "name": name,
        "address": address,
        "province": g.get("province"),
        "lat": lat,
        "lng": lng,
        "distanceKm": distance_km,
        "confidence": confidence,
        "source": source,
        "alternatives": g.get("alternatives", []),
    }
