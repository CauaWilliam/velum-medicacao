import asyncio
import json
import logging
import os
from datetime import datetime, time, timedelta, timezone

from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from pywebpush import WebPushException, webpush

from core import db, now_utc, user_tz

logger = logging.getLogger("notifier")
GRACE = timedelta(minutes=5)
APPT_REMINDERS = [("1d", timedelta(days=1), "amanhã"), ("2h", timedelta(hours=2), "em 2 horas")]


def _send(sub: dict, payload: str) -> None:
    webpush(
        subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
        data=payload,
        vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
        vapid_claims={"sub": os.environ["VAPID_SUBJECT"]},
        ttl=3600,
        timeout=15,
    )


async def send_to_owner(owner_id: str, title: str, body: str, url: str = "/", tag: str = "velum") -> int:
    payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag})
    sent = 0
    async for sub in db.push_subscriptions.find({"owner_id": owner_id}):
        try:
            await asyncio.to_thread(_send, sub, payload)
            sent += 1
        except WebPushException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status in (404, 410):
                await db.push_subscriptions.delete_one({"_id": sub["_id"]})
            else:
                logger.warning("push failed status=%s", status)
        except Exception:
            logger.exception("push error")
    return sent


async def notify_once(key: str, owner_id: str, title: str, body: str, url: str) -> None:
    try:
        await db.notification_log.insert_one({"_id": key, "owner_id": owner_id, "sent_at": now_utc()})
    except DuplicateKeyError:
        return
    await send_to_owner(owner_id, title, body, url, tag=key)


def dose_datetime(local_date, hhmm: str, tz) -> datetime:
    h, m = map(int, hhmm.split(":"))
    return datetime.combine(local_date, time(h, m), tz).astimezone(timezone.utc)


async def process_owner(owner_id: str, now: datetime) -> None:
    user = await db.users.find_one({"_id": ObjectId(owner_id)})
    if not user:
        return
    tz = user_tz(user)
    today = now.astimezone(tz).date()
    patients = {str(p["_id"]): p["name"] async for p in db.patients.find({"owner_id": owner_id})}

    async for med in db.medications.find({"owner_id": owner_id}):
        for hhmm in med.get("times", []):
            due = dose_datetime(today, hhmm, tz)
            if timedelta(0) <= now - due < GRACE:
                occ = f"med:{med['_id']}:{today.isoformat()}:{hhmm}"
                if await db.audit_logs.find_one({"owner_id": owner_id, "occurrence_key": occ}):
                    continue
                name = patients.get(med["patient_id"], "Paciente")
                await notify_once(f"push:{occ}", owner_id, f"Hora do remédio · {name}",
                                  f"{med['name']} — {med['dosage']} ({hhmm})", f"/pacientes/{med['patient_id']}")

    window = {"$gte": now - GRACE, "$lte": now + timedelta(days=1) + GRACE}
    async for appt in db.appointments.find({"owner_id": owner_id, "scheduled_at": window}):
        local_dt = appt["scheduled_at"].astimezone(tz)
        for label, delta, phrase in APPT_REMINDERS:
            trigger = appt["scheduled_at"] - delta
            if timedelta(0) <= now - trigger < GRACE:
                name = patients.get(appt["patient_id"], "Paciente")
                await notify_once(f"push:appt:{appt['_id']}:{label}", owner_id,
                                  f"Compromisso {phrase} · {name}",
                                  f"{appt['description']} — {local_dt.strftime('%d/%m às %H:%M')}",
                                  f"/pacientes/{appt['patient_id']}")


async def notifier_loop() -> None:
    while True:
        try:
            now = now_utc()
            for owner_id in await db.push_subscriptions.distinct("owner_id"):
                await process_owner(owner_id, now)
        except Exception:
            logger.exception("notifier loop error")
        await asyncio.sleep(15)
