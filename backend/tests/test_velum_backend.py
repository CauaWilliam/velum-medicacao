"""Velum backend regression tests - auth, patients, medications (interval mode), appointments, actions, agenda, history, push."""
import os
import uuid
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://velum-medicacao.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "cauabeckler0@gmail.com"
OWNER_PASSWORD = "Velum@2026"
TZ = ZoneInfo("America/Sao_Paulo")
CREATED_EMAILS = []  # exact emails registered by this suite (cleanup by these only)


def _new_email(prefix="test"):
    email = f"test_{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    CREATED_EMAILS.append(email.lower())
    return email


def _iso_tz(dt: datetime) -> str:
    """Return RFC3339 with explicit offset (never naive)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TZ)
    return dt.isoformat()


def _local_today(session) -> str:
    return session.get(f"{API}/agenda/today").json()["date"]


def _start_at_today(hour=8, minute=0):
    """Build a start_at timestamp with tz for today at HH:MM local."""
    now_local = datetime.now(TZ)
    return now_local.replace(hour=hour, minute=minute, second=0, microsecond=0)


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def owner_client():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200, f"owner login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def caregiver_a():
    s = requests.Session()
    email = _new_email("A")
    r = s.post(f"{API}/auth/register", json={"name": "TEST_A", "email": email, "password": "teste123"})
    assert r.status_code == 200, r.text
    return s, email, r.json()["id"]


@pytest.fixture(scope="session")
def caregiver_b():
    s = requests.Session()
    email = _new_email("B")
    r = s.post(f"{API}/auth/register", json={"name": "TEST_B", "email": email, "password": "teste123"})
    assert r.status_code == 200, r.text
    return s, email, r.json()["id"]


def _mk_recurring(session, patient_id, interval=8, hour=8, minute=0, name="Rec", dosage="1"):
    """Create a recurring med with start_at today at HH:MM local in TZ."""
    start = _start_at_today(hour=hour, minute=minute)
    r = session.post(
        f"{API}/patients/{patient_id}/medications",
        json={"name": name, "dosage": dosage, "recurring": True,
              "interval_hours": interval, "start_at": _iso_tz(start)},
    )
    return r


def _mk_single(session, patient_id, date_str, times, name="Single", dosage="1"):
    return session.post(
        f"{API}/patients/{patient_id}/medications",
        json={"name": name, "dosage": dosage, "recurring": False,
              "date": date_str, "times": times},
    )


# ---------- Auth ----------
class TestAuth:
    def test_login_owner(self, owner_client):
        r = owner_client.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == OWNER_EMAIL

    def test_login_wrong_password(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": "wrong_xyz"})
        assert r.status_code == 401

    def test_register_duplicate(self, caregiver_a):
        _, email, _ = caregiver_a
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={"name": "dup", "email": email, "password": "teste123"})
        assert r.status_code == 400

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Patients ----------
class TestPatients:
    def test_crud(self, caregiver_a):
        s, _, _ = caregiver_a
        p = s.post(f"{API}/patients", json={"name": "TEST_Dona Maria", "age": 72}).json()
        pid = p["id"]
        assert s.get(f"{API}/patients/{pid}").json()["name"] == "TEST_Dona Maria"
        assert s.put(f"{API}/patients/{pid}",
                     json={"name": "TEST_Dona Maria", "age": 73}).json()["age"] == 73
        assert s.delete(f"{API}/patients/{pid}").status_code == 200
        assert s.get(f"{API}/patients/{pid}").status_code == 404


# ---------- Multi-tenant isolation ----------
class TestIsolation:
    def test_b_cannot_access_a_resources(self, caregiver_a, caregiver_b):
        sa, _, _ = caregiver_a
        sb, _, _ = caregiver_b
        pa = sa.post(f"{API}/patients", json={"name": "TEST_IsoPatient", "age": 70}).json()
        pid = pa["id"]
        m = _mk_recurring(sa, pid, name="TEST_Med")
        assert m.status_code == 200, m.text
        mid = m.json()["id"]

        future = _iso_tz(datetime.now(TZ) + timedelta(days=1))
        aid = sa.post(f"{API}/patients/{pid}/appointments",
                      json={"description": "TEST_Appt", "scheduled_at": future}).json()["id"]

        assert sb.get(f"{API}/patients/{pid}").status_code == 404
        # B tries to update A's med
        assert sb.put(f"{API}/medications/{mid}",
                      json={"name": "x", "dosage": "x", "recurring": True,
                            "interval_hours": 4, "start_at": _iso_tz(_start_at_today())}
                      ).status_code == 404
        assert sb.delete(f"{API}/appointments/{aid}").status_code == 404
        bl = sb.get(f"{API}/patients").json()
        assert not any(x["id"] == pid for x in bl)
        # B's history of A's patient -> 404
        assert sb.get(f"{API}/patients/{pid}/history").status_code == 404

        sa.delete(f"{API}/patients/{pid}")


# ---------- Medications: interval validation ----------
class TestMedicationValidation:
    def test_recurring_requires_interval_hours(self, caregiver_a):
        s, _, _ = caregiver_a
        pid = s.post(f"{API}/patients", json={"name": "TEST_V1", "age": 70}).json()["id"]
        # Missing interval_hours
        r = s.post(f"{API}/patients/{pid}/medications",
                   json={"name": "X", "dosage": "1", "recurring": True,
                         "start_at": _iso_tz(_start_at_today())})
        assert r.status_code == 422, r.text
        s.delete(f"{API}/patients/{pid}")

    def test_recurring_invalid_interval_hours(self, caregiver_a):
        s, _, _ = caregiver_a
        pid = s.post(f"{API}/patients", json={"name": "TEST_V2", "age": 70}).json()["id"]
        # 3 is not in [1,2,4,6,8,12,24]
        r = s.post(f"{API}/patients/{pid}/medications",
                   json={"name": "X", "dosage": "1", "recurring": True,
                         "interval_hours": 3,
                         "start_at": _iso_tz(_start_at_today())})
        assert r.status_code == 422, r.text
        s.delete(f"{API}/patients/{pid}")

    def test_recurring_requires_tz_in_start_at(self, caregiver_a):
        s, _, _ = caregiver_a
        pid = s.post(f"{API}/patients", json={"name": "TEST_V3", "age": 70}).json()["id"]
        # naive datetime - no tz
        r = s.post(f"{API}/patients/{pid}/medications",
                   json={"name": "X", "dosage": "1", "recurring": True,
                         "interval_hours": 8,
                         "start_at": "2026-02-01T08:00:00"})
        assert r.status_code == 422, r.text
        s.delete(f"{API}/patients/{pid}")

    def test_recurring_clears_times_and_date(self, caregiver_a):
        s, _, _ = caregiver_a
        pid = s.post(f"{API}/patients", json={"name": "TEST_V4", "age": 70}).json()["id"]
        r = s.post(f"{API}/patients/{pid}/medications",
                   json={"name": "X", "dosage": "1", "recurring": True,
                         "interval_hours": 6,
                         "start_at": _iso_tz(_start_at_today(hour=7)),
                         "date": "2026-01-15", "times": ["09:00", "15:00"]})
        assert r.status_code == 200, r.text
        med = r.json()
        assert med["recurring"] is True
        assert med["interval_hours"] == 6
        assert med["date"] is None
        assert med["times"] == []
        assert med["start_at"] is not None
        s.delete(f"{API}/patients/{pid}")

    def test_non_recurring_requires_date_and_times(self, caregiver_a):
        s, _, _ = caregiver_a
        pid = s.post(f"{API}/patients", json={"name": "TEST_V5", "age": 70}).json()["id"]
        # missing date
        r = s.post(f"{API}/patients/{pid}/medications",
                   json={"name": "X", "dosage": "1", "recurring": False, "times": ["09:00"]})
        assert r.status_code == 422
        # missing times
        r2 = s.post(f"{API}/patients/{pid}/medications",
                    json={"name": "X", "dosage": "1", "recurring": False, "date": "2026-01-15"})
        assert r2.status_code == 422
        # ok and clears interval/start
        r3 = s.post(f"{API}/patients/{pid}/medications",
                    json={"name": "X", "dosage": "1", "recurring": False,
                          "date": "2026-01-15", "times": ["09:00"],
                          "interval_hours": 8,
                          "start_at": _iso_tz(_start_at_today())})
        assert r3.status_code == 200
        med = r3.json()
        assert med["recurring"] is False
        assert med["date"] == "2026-01-15"
        assert med["times"] == ["09:00"]
        assert med["interval_hours"] is None
        assert med["start_at"] is None
        s.delete(f"{API}/patients/{pid}")

    def test_invalid_time_format_rejected(self, caregiver_a):
        s, _, _ = caregiver_a
        pid = s.post(f"{API}/patients", json={"name": "TEST_V6", "age": 70}).json()["id"]
        r = s.post(f"{API}/patients/{pid}/medications",
                   json={"name": "X", "dosage": "1", "recurring": False,
                         "date": "2026-01-15", "times": ["25:00"]})
        assert r.status_code == 422
        s.delete(f"{API}/patients/{pid}")

    def test_crud_recurring(self, caregiver_a):
        s, _, _ = caregiver_a
        pid = s.post(f"{API}/patients", json={"name": "TEST_Crud", "age": 70}).json()["id"]
        m = _mk_recurring(s, pid, interval=4, hour=6, name="Losartana", dosage="50mg")
        assert m.status_code == 200, m.text
        med = m.json()
        mid = med["id"]
        # Update to different interval
        new_start = _start_at_today(hour=9)
        u = s.put(f"{API}/medications/{mid}",
                  json={"name": "Losartana", "dosage": "100mg", "recurring": True,
                        "interval_hours": 12, "start_at": _iso_tz(new_start)})
        assert u.status_code == 200
        assert u.json()["interval_hours"] == 12
        assert u.json()["dosage"] == "100mg"
        assert s.delete(f"{API}/medications/{mid}").status_code == 200
        s.delete(f"{API}/patients/{pid}")


# ---------- Agenda for interval meds ----------
class TestIntervalAgenda:
    def test_agenda_today_lists_all_doses_matching_today(self, caregiver_a):
        s, _, _ = caregiver_a
        pid = s.post(f"{API}/patients", json={"name": "TEST_IntAg", "age": 70}).json()["id"]
        # 6h interval starting at 00:00 today -> 00:00, 06:00, 12:00, 18:00
        start = _start_at_today(hour=0, minute=0)
        r = s.post(f"{API}/patients/{pid}/medications",
                   json={"name": "Int6", "dosage": "1", "recurring": True,
                         "interval_hours": 6, "start_at": _iso_tz(start)})
        assert r.status_code == 200, r.text
        mid = r.json()["id"]

        agenda = s.get(f"{API}/agenda/today").json()
        today_str = agenda["date"]
        items = [i for i in agenda["items"] if i["ref_id"] == mid]
        # Expect 4 occurrences on today
        times_seen = sorted({i["occurrence_key"].split(":")[-2] + ":" + i["occurrence_key"].split(":")[-1]
                             for i in items})
        assert len(items) == 4, f"expected 4 doses got {len(items)}: {items}"
        expected = ["00:00", "06:00", "12:00", "18:00"]
        assert times_seen == expected, times_seen
        # All keys well-formed
        for i in items:
            assert i["occurrence_key"].startswith(f"med:{mid}:{today_str}:")
        s.delete(f"{API}/patients/{pid}")

    def test_action_wrong_minute_rejected(self, caregiver_a):
        s, _, _ = caregiver_a
        pid = s.post(f"{API}/patients", json={"name": "TEST_WrongMin", "age": 70}).json()["id"]
        start = _start_at_today(hour=8, minute=0)
        r = s.post(f"{API}/patients/{pid}/medications",
                   json={"name": "X", "dosage": "1", "recurring": True,
                         "interval_hours": 8, "start_at": _iso_tz(start)})
        assert r.status_code == 200
        mid = r.json()["id"]
        today_str = _local_today(s)

        # Correct dose 08:00 -> 200
        ok = s.post(f"{API}/actions", json={"kind": "medication", "ref_id": mid,
                                            "occurrence_key": f"med:{mid}:{today_str}:08:00",
                                            "status": "done"})
        assert ok.status_code == 200, ok.text
        # Wrong minute 08:15 -> 400
        bad = s.post(f"{API}/actions", json={"kind": "medication", "ref_id": mid,
                                             "occurrence_key": f"med:{mid}:{today_str}:08:15",
                                             "status": "done"})
        assert bad.status_code == 400, bad.text
        # Wrong hour (not multiple of interval) 09:00 -> 400
        bad2 = s.post(f"{API}/actions", json={"kind": "medication", "ref_id": mid,
                                              "occurrence_key": f"med:{mid}:{today_str}:09:00",
                                              "status": "done"})
        assert bad2.status_code == 400
        # Malformed key
        bad3 = s.post(f"{API}/actions", json={"kind": "medication", "ref_id": mid,
                                              "occurrence_key": "med:bad", "status": "done"})
        assert bad3.status_code == 400
        s.delete(f"{API}/patients/{pid}")

    def test_non_recurring_in_agenda(self, caregiver_a):
        s, _, _ = caregiver_a
        pid = s.post(f"{API}/patients", json={"name": "TEST_NRAg", "age": 70}).json()["id"]
        today_str = _local_today(s)
        today = date.fromisoformat(today_str)
        future = (today + timedelta(days=5)).isoformat()
        yesterday = (today - timedelta(days=1)).isoformat()

        tod = _mk_single(s, pid, today_str, ["09:00"], name="Tod").json()
        fut = _mk_single(s, pid, future, ["09:00"], name="Fut").json()
        past = _mk_single(s, pid, yesterday, ["09:00"], name="Past").json()

        items = s.get(f"{API}/agenda/today").json()["items"]
        refs = {i["ref_id"] for i in items}
        assert tod["id"] in refs
        assert fut["id"] not in refs
        assert past["id"] in refs  # overdue unmarked still visible
        s.delete(f"{API}/patients/{pid}")


# ---------- History ----------
class TestHistoryInterval:
    def test_history_lists_dose_per_scheduled_slot(self, caregiver_a):
        s, _, _ = caregiver_a
        pid = s.post(f"{API}/patients", json={"name": "TEST_Hist", "age": 70}).json()["id"]
        today_str = _local_today(s)
        # Start at 00:01 today, 1h interval -> many doses in day; mark one and check
        start = _start_at_today(hour=0, minute=1)
        r = s.post(f"{API}/patients/{pid}/medications",
                   json={"name": "Hist", "dosage": "1", "recurring": True,
                         "interval_hours": 1, "start_at": _iso_tz(start)})
        assert r.status_code == 200
        mid = r.json()["id"]
        occ = f"med:{mid}:{today_str}:00:01"
        a1 = s.post(f"{API}/actions", json={"kind": "medication", "ref_id": mid,
                                            "occurrence_key": occ, "status": "done"})
        assert a1.status_code == 200
        a2 = s.post(f"{API}/actions", json={"kind": "medication", "ref_id": mid,
                                            "occurrence_key": occ, "status": "missed"})
        assert a2.status_code == 200

        h = s.get(f"{API}/patients/{pid}/history", params={"days": 2}).json()
        assert "days" in h and h["range_days"] == 2
        all_items = [i for d in h["days"] for i in d["items"]]
        mine = [i for i in all_items if i["occurrence_key"] == occ]
        assert len(mine) == 1
        it = mine[0]
        assert it["status"] == "missed"  # last wins
        assert len(it["changes"]) == 2
        assert it["caregiver_name"]
        assert it["marked_delay_minutes"] is not None
        assert "scheduled_at" in it and "marked_at" in it

        # Multi-tenant: history of A's patient as B -> 404 (also tested in isolation)
        s.delete(f"{API}/patients/{pid}")


# ---------- Appointments ----------
class TestAppointments:
    def test_crud(self, caregiver_a):
        s, _, _ = caregiver_a
        pid = s.post(f"{API}/patients", json={"name": "TEST_ApptP", "age": 65}).json()["id"]
        future = _iso_tz(datetime.now(TZ) + timedelta(days=2))
        a = s.post(f"{API}/patients/{pid}/appointments",
                   json={"description": "Consulta", "location": "Clinica", "scheduled_at": future})
        assert a.status_code == 200, a.text
        aid = a.json()["id"]
        # Missing tz -> 422
        no_tz = s.post(f"{API}/patients/{pid}/appointments",
                       json={"description": "x", "scheduled_at": "2026-02-01T10:00:00"})
        assert no_tz.status_code == 422
        assert s.delete(f"{API}/appointments/{aid}").status_code == 200
        s.delete(f"{API}/patients/{pid}")


# ---------- Push ----------
class TestPush:
    def test_public_key(self, owner_client):
        r = owner_client.get(f"{API}/push/public-key")
        assert r.status_code == 200
        assert "publicKey" in r.json()

    def test_subscribe_status_unsubscribe(self, caregiver_a):
        s, _, _ = caregiver_a
        endpoint = f"https://fcm.googleapis.com/fake/{uuid.uuid4().hex}"
        sub = {"endpoint": endpoint, "keys": {"p256dh": "x", "auth": "y"}}
        assert s.post(f"{API}/push/subscribe", json=sub).status_code == 200
        st = s.get(f"{API}/push/status").json()
        assert st["devices"] >= 1
        assert s.post(f"{API}/push/unsubscribe", json=sub).status_code == 200


# ---------- Session ----------
class TestSession:
    def test_refresh_and_logout(self):
        s = requests.Session()
        email = _new_email("sess")
        assert s.post(f"{API}/auth/register",
                      json={"name": "TEST", "email": email, "password": "goodpass1"}).status_code == 200
        assert s.post(f"{API}/auth/refresh").status_code == 200
        assert s.get(f"{API}/auth/me").status_code == 200
        assert s.post(f"{API}/auth/logout").status_code == 200
        s.cookies.clear()
        assert s.get(f"{API}/auth/me").status_code == 401


# ---------- Cleanup ----------
@pytest.fixture(scope="session", autouse=True)
def cleanup(request):
    yield
    try:
        from pymongo import MongoClient
        c = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        d = c[os.environ.get("DB_NAME", "test_database")]
        test_users = list(d.users.find({"email": {"$in": CREATED_EMAILS}}))
        ids = [str(u["_id"]) for u in test_users]
        for col in ("patients", "medications", "appointments", "audit_logs", "push_subscriptions"):
            d[col].delete_many({"owner_id": {"$in": ids}})
        d.users.delete_many({"_id": {"$in": [u["_id"] for u in test_users]}})
        c.close()
    except Exception as e:
        print(f"cleanup failed: {e}")
