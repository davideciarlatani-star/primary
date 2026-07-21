"""BonusRadar backend API tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://bonus-monitor-1.preview.emergentagent.com").rstrip("/")

DEFAULT_PROFILE = {
    "age_range": "26-35",
    "region": "Lazio",
    "employment": "dipendente",
    "household_size": 3,
    "children": 2,
    "children_under_3": 1,
    "isee_range": "10-25",
    "home_owner": False,
    "renting": True,
    "disability": False,
    "has_filed": True,
}

LOW_INCOME_PROFILE = {**DEFAULT_PROFILE, "isee_range": "0-10", "household_size": 4, "employment": "disoccupato"}


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Health & catalog ----
class TestCatalog:
    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert "BonusRadar" in r.json().get("message", "")

    def test_list_bonuses(self, api):
        r = api.get(f"{BASE_URL}/api/bonuses")
        assert r.status_code == 200
        data = r.json()
        assert "bonuses" in data
        assert len(data["bonuses"]) >= 10
        b = data["bonuses"][0]
        for k in ("id", "name", "category", "deadline", "amount"):
            assert k in b

    def test_get_bonus_by_id(self, api):
        r = api.get(f"{BASE_URL}/api/bonus/assegno-unico")
        assert r.status_code == 200
        assert r.json()["id"] == "assegno-unico"

    def test_get_bonus_not_found(self, api):
        r = api.get(f"{BASE_URL}/api/bonus/does-not-exist")
        assert r.status_code == 404


# ---- Matching ----
class TestMatch:
    def test_match_returns_eligible_and_others(self, api):
        r = api.post(f"{BASE_URL}/api/match", json=DEFAULT_PROFILE)
        assert r.status_code == 200
        data = r.json()
        assert "eligible" in data and "others" in data
        assert isinstance(data["eligible"], list)
        assert data["eligible_count"] == len(data["eligible"])
        # Profile has children -> assegno-unico must be eligible
        ids = [b["id"] for b in data["eligible"]]
        assert "assegno-unico" in ids
        assert "bonus-asilo-nido" in ids  # children_under_3=1

    def test_match_low_income_disoccupato(self, api):
        r = api.post(f"{BASE_URL}/api/match", json=LOW_INCOME_PROFILE)
        assert r.status_code == 200
        ids = [b["id"] for b in r.json()["eligible"]]
        assert "naspi" in ids
        assert "carta-dedicata-a-te" in ids


# ---- Calendar ----
class TestCalendar:
    def test_calendar_sorted(self, api):
        r = api.post(f"{BASE_URL}/api/calendar", json=DEFAULT_PROFILE)
        assert r.status_code == 200
        deadlines = r.json()["deadlines"]
        assert len(deadlines) > 0
        dates = [d["deadline"] for d in deadlines]
        assert dates == sorted(dates)
        for d in deadlines:
            for k in ("id", "name", "deadline", "amount"):
                assert k in d


# ---- AI Suggest ----
class TestAISuggest:
    def test_ai_suggest_structure(self, api):
        r = api.post(f"{BASE_URL}/api/ai/suggest", json=DEFAULT_PROFILE, timeout=60)
        assert r.status_code == 200
        data = r.json()
        for k in ("headline", "summary", "tips", "priority", "eligible_count"):
            assert k in data
        assert isinstance(data["tips"], list) and len(data["tips"]) >= 1
        assert isinstance(data["eligible_count"], int)


# ---- Simulate ----
class TestSimulate:
    def test_simulate_structure(self, api):
        payload = {"profile": DEFAULT_PROFILE, "annual_income": 20000}
        r = api.post(f"{BASE_URL}/api/simulate", json=payload, timeout=60)
        assert r.status_code == 200
        data = r.json()
        for k in ("current_situation", "estimated_annual_gain", "breakdown", "conclusion"):
            assert k in data
        assert isinstance(data["estimated_annual_gain"], int)
        assert data["estimated_annual_gain"] > 0
        assert isinstance(data["breakdown"], list) and len(data["breakdown"]) >= 1

    def test_simulate_non_filer(self, api):
        profile = {**DEFAULT_PROFILE, "has_filed": False}
        r = api.post(f"{BASE_URL}/api/simulate", json={"profile": profile, "annual_income": 15000}, timeout=60)
        assert r.status_code == 200
        assert r.json()["estimated_annual_gain"] > 0
