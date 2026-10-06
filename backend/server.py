from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

import asyncio
import logging
import os
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from starlette.middleware.cors import CORSMiddleware

from core import (BaseDocument, db, client, decode_token, get_current_user, hash_password, now_utc,
                  oid, public_user, set_access_cookie, set_auth_cookies, create_access_token, user_tz,
                  verify_password, DEFAULT_TZ)
from notifier import med_doses, notifier_loop, send_to_owner

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI()
api = APIRouter(prefix="/api")
HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


# ---------- Models ----------
class Patient(BaseDocument):
    owner_id: str
    name: str
    age: int
    conditions: str = ""
    allergies: str = ""
    emergency_contact_name: str = ""
    emergency_contact_phone: str = ""
    notes: str = ""
    created_at: datetime


class PatientIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    age: int = Field(ge=0, le=130)
    conditions: str = ""
    allergies: str = ""
    emergency_contact_name: str = ""
    emergency_contact_phone: str = ""
    notes: str = ""


class Medication(BaseDocument):
    owner_id: str
    patient_id: str
    name: str
    dosage: str
    times: List[str] = []
    recurring: bool = True
    date: Optional[str] = None
    interval_hours: Optional[int] = None
    start_at: Optional[datetime] = None
    created_at: datetime


class MedicationIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    dosage: str = Field(min_length=1, max_length=120)
    recurring: bool = True
    interval_hours: Optional[Literal[1, 2, 4, 6, 8, 12, 24]] = None
    start_at: Optional[datetime] = None
    date: Optional[str] = None
    times: List[str] = []

    @model_validator(mode="after")
    def check_schedule(self):
        if self.recurring:
            if not self.interval_hours:
                raise ValueError("Escolha o intervalo entre doses")
            if not self.start_at or self.start_at.tzinfo is None:
                raise ValueError("Informe data e hora da primeira dose (com fuso horário)")
            self.start_at = self.start_at.astimezone(timezone.utc).replace(second=0, microsecond=0)
            self.date, self.times = None, []
            return self
        try:
            date.fromisoformat(self.date or "")
        except ValueError:
            raise ValueError("Informe a data da dose única (AAAA-MM-DD)")
        if not self.times:
            raise ValueError("Informe ao menos um horário")
        self.interval_hours, self.start_at = None, None
        return self

    @field_validator("times")
    @classmethod
    def check_times(cls, v):
        for t in v:
            if not HHMM.match(t):
                raise ValueError("Horário inválido, use HH:MM")
        return sorted(set(v))


class Appointment(BaseDocument):
    owner_id: str
    patient_id: str
    description: str
    location: str = ""
    scheduled_at: datetime
    created_at: datetime


class AppointmentIn(BaseModel):
    description: str = Field(min_length=1, max_length=300)
    location: str = ""
    scheduled_at: datetime

    @field_validator("scheduled_at")
    @classmethod
    def aware(cls, v):
        if v.tzinfo is None:
            raise ValueError("Data/hora deve incluir fuso horário")
        return v.astimezone(timezone.utc)


class AuditLog(BaseDocument):
    owner_id: str
    patient_id: str
    patient_name: str
    caregiver_name: str
    kind: Literal["medication", "appointment"]
    ref_id: str
    occurrence_key: str
    item_title: str
    item_detail: str = ""
    scheduled_at: datetime
    status: Literal["done", "missed"]
    marked_at: datetime


class ActionIn(BaseModel):
    kind: Literal["medication", "appointment"]
    ref_id: str
    occurrence_key: str
    status: Literal["done", "missed"]


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    timezone: str = DEFAULT_TZ


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileIn(BaseModel):
    name: Optional[str] = None
    timezone: Optional[str] = None


class PushSubIn(BaseModel):
    endpoint: str
    expirationTime: Optional[int] = None
    keys: dict


# ---------- Auth ----------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado")
    doc = {"email": email, "name": body.name.strip(), "password_hash": hash_password(body.password),
           "timezone": body.timezone or DEFAULT_TZ, "role": "caregiver", "created_at": now_utc()}
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    set_auth_cookies(response, str(res.inserted_id), email)
    return public_user(doc)


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    identifier = email
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("locked_until") and attempt["locked_until"] > now_utc():
        raise HTTPException(status_code=429, detail="Muitas tentativas. Tente novamente em 15 minutos.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        count = (attempt or {}).get("count", 0) + 1
        update = {"count": count}
        if count >= 5:
            update = {"count": 0, "locked_until": now_utc() + timedelta(minutes=15)}
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
    await db.login_attempts.delete_many({"identifier": identifier})
    set_auth_cookies(response, str(user["_id"]), email)
    return public_user(user)


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    payload = decode_token(token, "refresh")
    user = await db.users.find_one({"_id": oid(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    set_access_cookie(response, create_access_token(str(user["_id"]), user["email"]))
    return public_user(user)


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api.patch("/auth/me")
async def update_me(body: ProfileIn, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump().items() if v}
    if update:
        await db.users.update_one({"_id": oid(user["_id"])}, {"$set": update})
    return public_user({**user, **update})


# ---------- Helpers ----------
async def owned_patient(patient_id: str, user: dict) -> Patient:
    doc = await db.patients.find_one({"_id": oid(patient_id), "owner_id": user["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")
    return Patient.from_mongo(doc)


async def latest_status(owner_id: str, keys: List[str]) -> dict:
    result = {}
    cursor = db.audit_logs.find({"owner_id": owner_id, "occurrence_key": {"$in": keys}}).sort("marked_at", 1)
    async for log in cursor:
        result[log["occurrence_key"]] = {"status": log["status"], "marked_at": log["marked_at"]}
    return result


def med_item(med: Medication, patient_name: str, key: str, due: datetime) -> dict:
    return {"occurrence_key": key, "kind": "medication",
            "ref_id": med.id, "patient_id": med.patient_id, "patient_name": patient_name,
            "title": med.name, "detail": med.dosage, "scheduled_at": due}


def appt_item(appt: Appointment, patient_name: str) -> dict:
    return {"occurrence_key": f"appt:{appt.id}", "kind": "appointment", "ref_id": appt.id,
            "patient_id": appt.patient_id, "patient_name": patient_name, "title": appt.description,
            "detail": appt.location, "scheduled_at": appt.scheduled_at}


async def attach_status(owner_id: str, items: List[dict]) -> List[dict]:
    statuses = await latest_status(owner_id, [i["occurrence_key"] for i in items])
    for i in items:
        s = statuses.get(i["occurrence_key"])
        i["status"] = s["status"] if s else None
        i["marked_at"] = s["marked_at"] if s else None
    return sorted(items, key=lambda i: i["scheduled_at"])


# ---------- Patients ----------
@api.get("/patients")
async def list_patients(user: dict = Depends(get_current_user)):
    docs = await db.patients.find({"owner_id": user["_id"]}).sort("name", 1).to_list(500)
    patients = [Patient.from_mongo(d) for d in docs]
    out = []
    for p in patients:
        meds = await db.medications.count_documents({"patient_id": p.id, "owner_id": user["_id"]})
        appts = await db.appointments.count_documents(
            {"patient_id": p.id, "owner_id": user["_id"], "scheduled_at": {"$gte": now_utc()}})
        out.append({**p.model_dump(), "medication_count": meds, "upcoming_appointments": appts})
    return out


@api.post("/patients")
async def create_patient(body: PatientIn, user: dict = Depends(get_current_user)):
    patient = Patient(owner_id=user["_id"], created_at=now_utc(), **body.model_dump())
    res = await db.patients.insert_one(patient.to_mongo())
    patient.id = str(res.inserted_id)
    return patient.model_dump()


@api.get("/patients/{patient_id}")
async def get_patient(patient_id: str, user: dict = Depends(get_current_user)):
    return (await owned_patient(patient_id, user)).model_dump()


@api.put("/patients/{patient_id}")
async def update_patient(patient_id: str, body: PatientIn, user: dict = Depends(get_current_user)):
    await owned_patient(patient_id, user)
    await db.patients.update_one({"_id": oid(patient_id)}, {"$set": body.model_dump()})
    return (await owned_patient(patient_id, user)).model_dump()


@api.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str, user: dict = Depends(get_current_user)):
    await owned_patient(patient_id, user)
    scope = {"patient_id": patient_id, "owner_id": user["_id"]}
    await db.medications.delete_many(scope)
    await db.appointments.delete_many(scope)
    await db.audit_logs.delete_many(scope)
    await db.patients.delete_one({"_id": oid(patient_id)})
    return {"ok": True}


# ---------- Medications ----------
@api.get("/patients/{patient_id}/medications")
async def list_medications(patient_id: str, user: dict = Depends(get_current_user)):
    await owned_patient(patient_id, user)
    docs = await db.medications.find({"patient_id": patient_id, "owner_id": user["_id"]}).sort("name", 1).to_list(500)
    return [Medication.from_mongo(d).model_dump() for d in docs]


@api.post("/patients/{patient_id}/medications")
async def create_medication(patient_id: str, body: MedicationIn, user: dict = Depends(get_current_user)):
    await owned_patient(patient_id, user)
    med = Medication(owner_id=user["_id"], patient_id=patient_id, created_at=now_utc(), **body.model_dump())
    res = await db.medications.insert_one(med.to_mongo())
    med.id = str(res.inserted_id)
    return med.model_dump()


async def owned_medication(med_id: str, user: dict) -> Medication:
    doc = await db.medications.find_one({"_id": oid(med_id), "owner_id": user["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Medicação não encontrada")
    return Medication.from_mongo(doc)


@api.put("/medications/{med_id}")
async def update_medication(med_id: str, body: MedicationIn, user: dict = Depends(get_current_user)):
    await owned_medication(med_id, user)
    await db.medications.update_one({"_id": oid(med_id)}, {"$set": body.model_dump()})
    return (await owned_medication(med_id, user)).model_dump()


@api.delete("/medications/{med_id}")
async def delete_medication(med_id: str, user: dict = Depends(get_current_user)):
    await owned_medication(med_id, user)
    await db.medications.delete_one({"_id": oid(med_id)})
    return {"ok": True}


# ---------- Appointments ----------
@api.get("/patients/{patient_id}/appointments")
async def list_appointments(patient_id: str, user: dict = Depends(get_current_user)):
    patient = await owned_patient(patient_id, user)
    docs = await db.appointments.find({"patient_id": patient_id, "owner_id": user["_id"]}).to_list(1000)
    items = [appt_item(Appointment.from_mongo(d), patient.name) for d in docs]
    return await attach_status(user["_id"], items)


@api.post("/patients/{patient_id}/appointments")
async def create_appointment(patient_id: str, body: AppointmentIn, user: dict = Depends(get_current_user)):
    await owned_patient(patient_id, user)
    appt = Appointment(owner_id=user["_id"], patient_id=patient_id, created_at=now_utc(), **body.model_dump())
    res = await db.appointments.insert_one(appt.to_mongo())
    appt.id = str(res.inserted_id)
    return appt.model_dump()


async def owned_appointment(appt_id: str, user: dict) -> Appointment:
    doc = await db.appointments.find_one({"_id": oid(appt_id), "owner_id": user["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Compromisso não encontrado")
    return Appointment.from_mongo(doc)


@api.put("/appointments/{appt_id}")
async def update_appointment(appt_id: str, body: AppointmentIn, user: dict = Depends(get_current_user)):
    await owned_appointment(appt_id, user)
    await db.appointments.update_one({"_id": oid(appt_id)}, {"$set": body.model_dump()})
    await db.notification_log.delete_many({"_id": {"$regex": f"^push:appt:{appt_id}:"}})
    return (await owned_appointment(appt_id, user)).model_dump()


@api.delete("/appointments/{appt_id}")
async def delete_appointment(appt_id: str, user: dict = Depends(get_current_user)):
    await owned_appointment(appt_id, user)
    await db.appointments.delete_one({"_id": oid(appt_id)})
    return {"ok": True}


# ---------- Agenda ----------
async def build_agenda(user: dict, patient_id: Optional[str] = None) -> List[dict]:
    tz = user_tz(user)
    today = now_utc().astimezone(tz).date()
    scope = {"owner_id": user["_id"]}
    if patient_id:
        scope["patient_id"] = patient_id
    pscope = {"owner_id": user["_id"]} if not patient_id else {"owner_id": user["_id"], "_id": oid(patient_id)}
    names = {str(p["_id"]): p["name"] async for p in db.patients.find(pscope)}
    items = []
    day_start = datetime.combine(today, time(0, 0), tz).astimezone(timezone.utc)
    day_end = day_start + timedelta(days=1)
    async for d in db.medications.find(scope):
        med = Medication.from_mongo(d)
        since = day_start if med.recurring else day_start - timedelta(days=30)
        for key, due in med_doses(med.model_dump(), since, day_end - timedelta(seconds=1), tz):
            items.append(med_item(med, names.get(med.patient_id, ""), key, due))
    appt_docs = await db.appointments.find(
        {**scope, "scheduled_at": {"$gte": day_start - timedelta(days=30), "$lt": day_end}}).to_list(1000)
    appts = [appt_item(Appointment.from_mongo(d), names.get(d["patient_id"], "")) for d in appt_docs]
    items = await attach_status(user["_id"], items + appts)
    return [i for i in items if i["scheduled_at"] >= day_start or i["status"] is None]


@api.get("/agenda/today")
async def agenda_today(user: dict = Depends(get_current_user)):
    tz = user_tz(user)
    return {"date": now_utc().astimezone(tz).date().isoformat(), "timezone": str(tz),
            "items": await build_agenda(user)}


@api.get("/patients/{patient_id}/agenda")
async def patient_agenda(patient_id: str, user: dict = Depends(get_current_user)):
    await owned_patient(patient_id, user)
    return {"items": await build_agenda(user, patient_id)}


# ---------- Actions / Audit ----------
@api.post("/actions")
async def mark_action(body: ActionIn, user: dict = Depends(get_current_user)):
    tz = user_tz(user)
    if body.kind == "medication":
        parts = body.occurrence_key.split(":", 3)
        if len(parts) != 4 or parts[0] != "med" or parts[1] != body.ref_id:
            raise HTTPException(status_code=400, detail="Ocorrência inválida")
        med = await owned_medication(body.ref_id, user)
        try:
            local_date = date.fromisoformat(parts[2])
            h, m = map(int, parts[3].split(":"))
            scheduled_at = datetime.combine(local_date, time(h, m), tz).astimezone(timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Ocorrência inválida")
        if not any(k == body.occurrence_key for k, _ in med_doses(med.model_dump(), scheduled_at, scheduled_at, tz)):
            raise HTTPException(status_code=400, detail="Horário não pertence à medicação")
        patient_id, title, detail = med.patient_id, med.name, med.dosage
    else:
        if body.occurrence_key != f"appt:{body.ref_id}":
            raise HTTPException(status_code=400, detail="Ocorrência inválida")
        appt = await owned_appointment(body.ref_id, user)
        patient_id, title, detail, scheduled_at = appt.patient_id, appt.description, appt.location, appt.scheduled_at
    patient = await owned_patient(patient_id, user)
    log = AuditLog(owner_id=user["_id"], patient_id=patient_id, patient_name=patient.name,
                   caregiver_name=user.get("name", ""), kind=body.kind, ref_id=body.ref_id,
                   occurrence_key=body.occurrence_key, item_title=title, item_detail=detail,
                   scheduled_at=scheduled_at, status=body.status, marked_at=now_utc())
    res = await db.audit_logs.insert_one(log.to_mongo())
    log.id = str(res.inserted_id)
    return log.model_dump()


@api.get("/patients/{patient_id}/history")
async def patient_history(patient_id: str, days: int = 30, user: dict = Depends(get_current_user)):
    patient = await owned_patient(patient_id, user)
    days = max(1, min(days, 365))
    tz = user_tz(user)
    now = now_utc()
    today = now.astimezone(tz).date()
    first_day = today - timedelta(days=days - 1)
    range_start = datetime.combine(first_day, time(0, 0), tz).astimezone(timezone.utc)
    scope = {"owner_id": user["_id"], "patient_id": patient_id}
    occ = {}
    async for d in db.medications.find(scope):
        med = Medication.from_mongo(d)
        for key, due in med_doses(med.model_dump(), range_start, now, tz):
            occ[key] = med_item(med, patient.name, key, due)
    async for d in db.appointments.find({**scope, "scheduled_at": {"$gte": range_start, "$lte": now}}):
        item = appt_item(Appointment.from_mongo(d), patient.name)
        occ[item["occurrence_key"]] = item
    logs = await db.audit_logs.find({**scope, "$or": [{"scheduled_at": {"$gte": range_start}},
                                                    {"marked_at": {"$gte": range_start}}]}).sort("marked_at", 1).to_list(10000)
    for raw in logs:
        log = AuditLog.from_mongo(raw)
        item = occ.setdefault(log.occurrence_key, {
            "occurrence_key": log.occurrence_key, "kind": log.kind, "ref_id": log.ref_id,
            "patient_id": patient_id, "patient_name": patient.name, "title": log.item_title,
            "detail": log.item_detail, "scheduled_at": log.scheduled_at})
        item.setdefault("changes", []).append(
            {"id": log.id, "status": log.status, "marked_at": log.marked_at, "caregiver_name": log.caregiver_name})
    grouped = {}
    for item in occ.values():
        changes = item.setdefault("changes", [])
        last = changes[-1] if changes else None
        item["status"] = last["status"] if last else None
        item["marked_at"] = last["marked_at"] if last else None
        item["caregiver_name"] = last["caregiver_name"] if last else None
        item["marked_delay_minutes"] = int((last["marked_at"] - item["scheduled_at"]).total_seconds() // 60) if last else None
        grouped.setdefault(item["scheduled_at"].astimezone(tz).date().isoformat(), []).append(item)
    return {"days": [{"date": d, "items": sorted(grouped[d], key=lambda i: i["scheduled_at"])}
                     for d in sorted(grouped, reverse=True)], "range_days": days}


# ---------- Push ----------
@api.get("/push/public-key")
async def push_public_key():
    return {"publicKey": os.environ["VAPID_PUBLIC_KEY"]}


@api.post("/push/subscribe")
async def push_subscribe(body: PushSubIn, user: dict = Depends(get_current_user)):
    await db.push_subscriptions.update_one(
        {"endpoint": body.endpoint},
        {"$set": {"owner_id": user["_id"], "endpoint": body.endpoint, "keys": body.keys, "updated_at": now_utc()},
         "$setOnInsert": {"created_at": now_utc()}}, upsert=True)
    return {"ok": True}


@api.post("/push/unsubscribe")
async def push_unsubscribe(body: PushSubIn, user: dict = Depends(get_current_user)):
    await db.push_subscriptions.delete_one({"endpoint": body.endpoint, "owner_id": user["_id"]})
    return {"ok": True}


@api.get("/push/status")
async def push_status(user: dict = Depends(get_current_user)):
    return {"devices": await db.push_subscriptions.count_documents({"owner_id": user["_id"]})}


@api.post("/push/test")
async def push_test(user: dict = Depends(get_current_user)):
    sent = await send_to_owner(user["_id"], "Velum", "Notificações ativadas! Você receberá os lembretes aqui.", "/")
    return {"sent": sent}


@api.get("/")
async def root():
    return {"message": "Velum API"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({"email": email, "name": "Cauã", "password_hash": hash_password(password),
                                   "timezone": DEFAULT_TZ, "role": "admin", "created_at": now_utc()})
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password)}})


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.patients.create_index("owner_id")
    await db.medications.create_index([("owner_id", 1), ("patient_id", 1)])
    await db.appointments.create_index([("owner_id", 1), ("scheduled_at", 1)])
    await db.audit_logs.create_index([("owner_id", 1), ("occurrence_key", 1)])
    await db.push_subscriptions.create_index("endpoint", unique=True)
    await seed_admin()
    app.state.notifier = asyncio.create_task(notifier_loop())


@app.on_event("shutdown")
async def shutdown():
    task = getattr(app.state, "notifier", None)
    if task:
        task.cancel()
    client.close()
