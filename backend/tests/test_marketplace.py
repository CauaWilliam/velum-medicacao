"""Velum marketplace + RBAC tests: account types, caregiver ad, admin moderation, family browse/interest/reviews, photo."""
import io
import os
import struct
import uuid
import zlib

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "cauabeckler0@gmail.com", "password": "Velum@2026"}
CREATED_USERS = []  # ids for teardown (cleanup via mongo by id)


def _email(p):
    return f"test_mk{p}_{uuid.uuid4().hex[:8]}@example.com"


def _register(kind, name):
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"name": name, "email": _email(kind), "password": "teste123",
                                             "account_type": kind})
    assert r.status_code == 200, r.text
    data = r.json()
    CREATED_USERS.append(data["id"])
    return s, data


def _png():
    raw = b"\x00\xff\x00\x00"
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


AD = {"display_name": "TEST_Maria Cuidadora", "headline": "Cuidadora experiente", "bio": "Bio teste",
      "city": "Belo Horizonte", "state": "mg", "experience_years": 7, "specialties": ["Parkinson", "Diabetes"],
      "days": ["sex", "seg"], "shifts": ["noite", "manha"], "price_value": 45.5, "price_unit": "hora"}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def cg():
    return _register("caregiver", "TEST_CG")


@pytest.fixture(scope="module")
def fam():
    return _register("family", "TEST_FAM")


@pytest.fixture(scope="module")
def fam2():
    return _register("family", "TEST_FAM2")


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    from pymongo import MongoClient
    from bson import ObjectId
    from dotenv import dotenv_values
    env = dotenv_values("/app/backend/.env")
    db = MongoClient(env["MONGO_URL"])[env["DB_NAME"]]
    for uid in CREATED_USERS:
        ads = [str(a["_id"]) for a in db.caregiver_ads.find({"owner_id": uid})]
        db.interests.delete_many({"$or": [{"family_id": uid}, {"caregiver_id": uid}]})
        db.reviews.delete_many({"$or": [{"family_id": uid}, {"caregiver_id": uid}]})
        db.caregiver_ads.delete_many({"owner_id": uid})
        db.push_subscriptions.delete_many({"owner_id": uid})
        db.users.delete_one({"_id": ObjectId(uid)})


# --- Registration / roles
class TestRoles:
    def test_register_roles(self, cg, fam):
        assert cg[1]["role"] == "caregiver"
        assert fam[1]["role"] == "family"
        assert fam[0].get(f"{API}/auth/me").json()["role"] == "family"

    def test_register_default_caregiver(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={"name": "TEST_def", "email": _email("d"), "password": "teste123"})
        assert r.status_code == 200
        CREATED_USERS.append(r.json()["id"])
        assert r.json()["role"] == "caregiver"

    def test_register_admin_rejected(self):
        r = requests.post(f"{API}/auth/register", json={"name": "TEST_adm", "email": _email("a"),
                                                         "password": "teste123", "account_type": "admin"})
        assert r.status_code == 422

    def test_family_forbidden_caregiver_apis(self, fam):
        s = fam[0]
        for path in ["/patients", "/agenda/today", "/my-ad", "/my-ad/interests"]:
            assert s.get(f"{API}{path}").status_code == 403, path
        assert s.post(f"{API}/patients", json={"name": "x"}).status_code == 403

    def test_caregiver_forbidden_market(self, cg):
        s = cg[0]
        assert s.get(f"{API}/marketplace/ads").status_code == 403
        assert s.get(f"{API}/marketplace/my-interests").status_code == 403
        assert s.get(f"{API}/patients").status_code == 200

    def test_admin_routes_forbidden(self, cg, fam):
        for s in (cg[0], fam[0]):
            assert s.get(f"{API}/admin/ads").status_code == 403
            assert s.get(f"{API}/admin/ads/counts").status_code == 403

    def test_unauth(self):
        assert requests.get(f"{API}/marketplace/ads").status_code == 401


# --- Full marketplace flow (ordered)
class TestMarketFlow:
    state = {}

    def test_01_create_ad_pending(self, cg):
        s = cg[0]
        assert s.get(f"{API}/my-ad").json()["ad"] is None
        r = s.put(f"{API}/my-ad", json=AD)
        assert r.status_code == 200, r.text
        ad = r.json()
        assert ad["status"] == "pending" and ad["state"] == "MG"
        assert ad["days"] == ["seg", "sex"] and ad["shifts"] == ["manha", "noite"]
        assert ad["has_photo"] is False
        TestMarketFlow.state["ad_id"] = ad["id"]

    def test_02_invalid_ad(self, cg):
        bad = {**AD, "specialties": ["Xyz"]}
        assert cg[0].put(f"{API}/my-ad", json=bad).status_code == 422
        assert cg[0].put(f"{API}/my-ad", json={**AD, "price_value": 0}).status_code == 422

    def test_03_pending_hidden_from_family(self, fam):
        ad_id = TestMarketFlow.state["ad_id"]
        ids = [a["id"] for a in fam[0].get(f"{API}/marketplace/ads").json()]
        assert ad_id not in ids
        assert fam[0].get(f"{API}/marketplace/ads/{ad_id}").status_code == 404
        assert fam[0].post(f"{API}/marketplace/ads/{ad_id}/interest",
                           json={"contact_name": "X Y", "contact_phone": "(31) 97306-1826"}).status_code == 404

    def test_04_photo_upload(self, cg):
        s = cg[0]
        r = s.post(f"{API}/my-ad/photo", files={"file": ("a.txt", b"hello", "text/plain")})
        assert r.status_code == 400
        r = s.post(f"{API}/my-ad/photo", files={"file": ("p.png", _png(), "image/png")})
        assert r.status_code == 200, r.text
        assert s.get(f"{API}/my-ad").json()["ad"]["has_photo"] is True
        r = s.get(f"{API}/marketplace/ads/{TestMarketFlow.state['ad_id']}/photo")
        assert r.status_code == 200 and r.headers["content-type"].startswith("image/png")
        assert r.content[:4] == b"\x89PNG"

    def test_05_photo_too_big(self, cg):
        big = b"\x00" * (5 * 1024 * 1024 + 10)
        r = cg[0].post(f"{API}/my-ad/photo", files={"file": ("b.jpg", big, "image/jpeg")})
        assert r.status_code == 400

    def test_06_family_photo_404_pending(self, fam):
        r = fam[0].get(f"{API}/marketplace/ads/{TestMarketFlow.state['ad_id']}/photo")
        assert r.status_code == 404

    def test_07_admin_list_and_approve(self, admin):
        ad_id = TestMarketFlow.state["ad_id"]
        counts = admin.get(f"{API}/admin/ads/counts").json()
        assert set(counts) == {"pending", "approved", "rejected"} and counts["pending"] >= 1
        pend = admin.get(f"{API}/admin/ads", params={"status": "pending"}).json()
        mine = [a for a in pend if a["id"] == ad_id]
        assert mine and mine[0]["owner_email"].startswith("test_mk")
        assert admin.get(f"{API}/marketplace/ads/{ad_id}/photo").status_code == 200
        r = admin.post(f"{API}/admin/ads/{ad_id}/approve")
        assert r.status_code == 200 and r.json()["status"] == "approved"

    def test_08_family_sees_approved_and_filters(self, fam):
        s, ad_id = fam[0], TestMarketFlow.state["ad_id"]
        ids = lambda **p: [a["id"] for a in s.get(f"{API}/marketplace/ads", params=p).json()]
        assert ad_id in ids()
        assert ad_id in ids(city="belo hor")
        assert ad_id not in ids(city="Recife")
        assert ad_id in ids(specialty="Parkinson")
        assert ad_id not in ids(specialty="Pós-AVC")
        assert ad_id in ids(shift="noite")
        assert ad_id not in ids(shift="pernoite")
        card = [a for a in s.get(f"{API}/marketplace/ads").json() if a["id"] == ad_id][0]
        assert "owner_id" not in card and "status" not in card
        assert card["price_value"] == 45.5 and card["has_photo"] is True
        assert s.get(f"{API}/marketplace/ads/{ad_id}/photo").status_code == 200

    def test_09_review_before_interest_403(self, fam):
        r = fam[0].post(f"{API}/marketplace/ads/{TestMarketFlow.state['ad_id']}/reviews", json={"rating": 5})
        assert r.status_code == 403

    def test_10_interest_and_resend(self, fam, cg):
        s, ad_id = fam[0], TestMarketFlow.state["ad_id"]
        bad = s.post(f"{API}/marketplace/ads/{ad_id}/interest", json={"contact_name": "TEST Fam", "contact_phone": "123"})
        assert bad.status_code == 422
        r = s.post(f"{API}/marketplace/ads/{ad_id}/interest",
                   json={"contact_name": "TEST Fam", "contact_phone": "(31) 97306-1826", "message": "Oi"})
        assert r.status_code == 200, r.text
        iid = r.json()["id"]
        r2 = s.post(f"{API}/marketplace/ads/{ad_id}/interest",
                    json={"contact_name": "TEST Fam", "contact_phone": "(31) 97306-1826", "message": "Oi de novo"})
        assert r2.json()["id"] == iid
        sent = s.get(f"{API}/marketplace/my-interests").json()
        assert len([x for x in sent if x["ad_id"] == ad_id]) == 1
        assert sent[0]["caregiver_name"] == AD["display_name"] and sent[0]["ad_available"] is True
        recv = cg[0].get(f"{API}/my-ad/interests").json()
        assert len(recv) == 1 and recv[0]["message"] == "Oi de novo" and recv[0]["seen"] is False
        assert "family_id" not in recv[0]
        assert cg[0].patch(f"{API}/my-ad/interests/{iid}/seen").status_code == 200
        assert cg[0].get(f"{API}/my-ad/interests").json()[0]["seen"] is True
        TestMarketFlow.state["iid"] = iid

    def test_11_detail_has_interest(self, fam):
        d = fam[0].get(f"{API}/marketplace/ads/{TestMarketFlow.state['ad_id']}").json()
        assert d["my_interest"]["message"] == "Oi de novo" and d["can_review"] is True

    def test_12_review_and_edit(self, fam):
        s, ad_id = fam[0], TestMarketFlow.state["ad_id"]
        assert s.post(f"{API}/marketplace/ads/{ad_id}/reviews", json={"rating": 6}).status_code == 422
        r = s.post(f"{API}/marketplace/ads/{ad_id}/reviews", json={"rating": 4, "comment": "Boa"})
        assert r.status_code == 200
        r = s.post(f"{API}/marketplace/ads/{ad_id}/reviews", json={"rating": 2, "comment": "Editado"})
        assert r.status_code == 200
        d = s.get(f"{API}/marketplace/ads/{ad_id}").json()
        assert d["rating_count"] == 1 and d["rating_avg"] == 2
        assert d["my_review"]["comment"] == "Editado" and len(d["reviews"]) == 1

    def test_13_other_family_cannot_review_or_see_others_interest(self, fam2):
        s, ad_id = fam2[0], TestMarketFlow.state["ad_id"]
        d = s.get(f"{API}/marketplace/ads/{ad_id}").json()
        assert d["my_interest"] is None and d["can_review"] is False
        assert s.post(f"{API}/marketplace/ads/{ad_id}/reviews", json={"rating": 5}).status_code == 403
        assert s.get(f"{API}/marketplace/my-interests").json() == []

    def test_14_pause_hides(self, cg, fam):
        ad_id = TestMarketFlow.state["ad_id"]
        assert cg[0].patch(f"{API}/my-ad/pause", json={"paused": True}).json()["paused"] is True
        assert fam[0].get(f"{API}/marketplace/ads/{ad_id}").status_code == 404
        assert fam[0].get(f"{API}/marketplace/ads/{ad_id}/photo").status_code == 404
        assert ad_id not in [a["id"] for a in fam[0].get(f"{API}/marketplace/ads").json()]
        sent = fam[0].get(f"{API}/marketplace/my-interests").json()
        assert sent[0]["ad_available"] is False
        cg[0].patch(f"{API}/my-ad/pause", json={"paused": False})
        assert fam[0].get(f"{API}/marketplace/ads/{ad_id}").status_code == 200

    def test_15_edit_resets_pending(self, cg, fam):
        ad_id = TestMarketFlow.state["ad_id"]
        r = cg[0].put(f"{API}/my-ad", json={**AD, "price_value": 300, "price_unit": "diaria"})
        assert r.json()["status"] == "pending" and r.json()["id"] == ad_id
        assert fam[0].get(f"{API}/marketplace/ads/{ad_id}").status_code == 404

    def test_16_reject_shows_reason(self, admin, cg, fam):
        ad_id = TestMarketFlow.state["ad_id"]
        r = admin.post(f"{API}/admin/ads/{ad_id}/reject", json={"reason": "Foto inadequada"})
        assert r.status_code == 200 and r.json()["status"] == "rejected"
        ad = cg[0].get(f"{API}/my-ad").json()["ad"]
        assert ad["status"] == "rejected" and ad["rejection_reason"] == "Foto inadequada"
        assert fam[0].get(f"{API}/marketplace/ads/{ad_id}").status_code == 404
        assert ad_id in [a["id"] for a in admin.get(f"{API}/admin/ads", params={"status": "rejected"}).json()]

    def test_17_photo_resets_pending(self, admin, cg):
        ad_id = TestMarketFlow.state["ad_id"]
        admin.post(f"{API}/admin/ads/{ad_id}/approve")
        assert cg[0].get(f"{API}/my-ad").json()["ad"]["status"] == "approved"
        cg[0].post(f"{API}/my-ad/photo", files={"file": ("p.png", _png(), "image/png")})
        assert cg[0].get(f"{API}/my-ad").json()["ad"]["status"] == "pending"

    def test_18_admin_moderate_404(self, admin):
        assert admin.post(f"{API}/admin/ads/000000000000000000000000/approve").status_code == 404
        assert admin.post(f"{API}/admin/ads/bad/approve").status_code == 404

    def test_19_delete_ad_cascades(self, cg):
        assert cg[0].delete(f"{API}/my-ad").status_code == 200
        assert cg[0].get(f"{API}/my-ad").json()["ad"] is None
        assert cg[0].get(f"{API}/my-ad/interests").json() == []
        assert cg[0].delete(f"{API}/my-ad").status_code == 404
