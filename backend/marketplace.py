import asyncio
import logging
import os
import re
import uuid
from datetime import datetime
from typing import List, Literal, Optional

import requests
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field, field_validator
from pymongo import ReturnDocument

from core import BaseDocument, db, get_current_user, now_utc, oid, require_roles
from notifier import send_to_owner

logger = logging.getLogger("marketplace")
router = APIRouter(prefix="/api")
caregiver_only = require_roles("caregiver", "admin")
family_only = require_roles("family")
viewer_only = require_roles("family", "admin")
admin_only = require_roles("admin")

SPECIALTIES = ["Alzheimer e demências", "Parkinson", "Pós-operatório", "Mobilidade reduzida", "Cuidados paliativos",
               "Diabetes", "Pós-AVC", "Higiene e banho", "Administração de medicamentos", "Acompanhamento em consultas"]
DAYS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]
SHIFTS = ["manha", "tarde", "noite", "pernoite"]
PHOTO_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_PHOTO = 5 * 1024 * 1024

# ---------- Object storage ----------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
_storage_key = None


def init_storage(force: bool = False) -> str:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ["EMERGENT_LLM_KEY"]}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _storage_call(method: str, path: str, headers: Optional[dict] = None, **kwargs) -> requests.Response:
    url = f"{STORAGE_URL}/objects/{path}"
    resp = requests.request(method, url, headers={"X-Storage-Key": init_storage(), **(headers or {})}, **kwargs)
    if resp.status_code == 404 and method == "PUT":
        resp = requests.request(method, url, headers={"X-Storage-Key": init_storage(force=True), **(headers or {})}, **kwargs)
    resp.raise_for_status()
    return resp


def put_object(path: str, data: bytes, content_type: str) -> dict:
    return _storage_call("PUT", path, headers={"Content-Type": content_type}, data=data, timeout=120).json()


def get_object(path: str) -> bytes:
    return _storage_call("GET", path, timeout=60).content


# ---------- Models ----------
class Ad(BaseDocument):
    owner_id: str
    display_name: str
    headline: str = ""
    bio: str = ""
    city: str
    state: str
    experience_years: int
    specialties: List[str] = []
    days: List[str] = []
    shifts: List[str] = []
    price_value: float
    price_unit: Literal["hora", "diaria"]
    photo_path: Optional[str] = None
    photo_type: Optional[str] = None
    status: Literal["pending", "approved", "rejected"]
    paused: bool = False
    rejection_reason: str = ""
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None
    updated_at: datetime


class AdIn(BaseModel):
    display_name: str = Field(min_length=2, max_length=80)
    headline: str = Field(default="", max_length=120)
    bio: str = Field(default="", max_length=1500)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=2)
    experience_years: int = Field(ge=0, le=70)
    specialties: List[str] = []
    days: List[str] = []
    shifts: List[str] = []
    price_value: float = Field(gt=0, le=100000)
    price_unit: Literal["hora", "diaria"]

    @field_validator("state")
    @classmethod
    def upper_state(cls, v):
        return v.upper()

    @field_validator("specialties")
    @classmethod
    def check_specialties(cls, v):
        if any(s not in SPECIALTIES for s in v):
            raise ValueError("Especialidade inválida")
        return list(dict.fromkeys(v))

    @field_validator("days")
    @classmethod
    def check_days(cls, v):
        if any(d not in DAYS for d in v):
            raise ValueError("Dia inválido")
        return [d for d in DAYS if d in v]

    @field_validator("shifts")
    @classmethod
    def check_shifts(cls, v):
        if any(s not in SHIFTS for s in v):
            raise ValueError("Turno inválido")
        return [s for s in SHIFTS if s in v]


class Interest(BaseDocument):
    ad_id: str
    caregiver_id: str
    family_id: str
    contact_name: str
    contact_phone: str
    message: str = ""
    seen: bool = False
    created_at: datetime


class InterestIn(BaseModel):
    contact_name: str = Field(min_length=2, max_length=80)
    contact_phone: str = Field(min_length=10, max_length=20)
    message: str = Field(default="", max_length=1000)

    @field_validator("contact_phone")
    @classmethod
    def check_phone(cls, v):
        if not 10 <= len(re.sub(r"\D", "", v)) <= 11:
            raise ValueError("Telefone inválido")
        return v


class Review(BaseDocument):
    ad_id: str
    caregiver_id: str
    family_id: str
    family_name: str
    rating: int
    comment: str = ""
    created_at: datetime
    updated_at: datetime


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=600)


class PauseIn(BaseModel):
    paused: bool


class RejectIn(BaseModel):
    reason: str = Field(default="", max_length=300)


# ---------- Helpers ----------
VISIBLE = {"status": "approved", "paused": False}


def ad_out(ad: Ad, ratings: dict, private: bool = False) -> dict:
    data = ad.model_dump(exclude={"photo_path", "photo_type"})
    if not private:
        for k in ("owner_id", "rejection_reason", "status", "paused", "reviewed_at", "submitted_at"):
            data.pop(k, None)
    avg, count = ratings.get(ad.id, (None, 0))
    return {**data, "has_photo": bool(ad.photo_path), "rating_avg": avg, "rating_count": count}


async def ratings_for(ad_ids: List[str]) -> dict:
    pipeline = [{"$match": {"ad_id": {"$in": ad_ids}}},
                {"$group": {"_id": "$ad_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}]
    return {r["_id"]: (round(r["avg"], 1), r["count"]) async for r in db.reviews.aggregate(pipeline)}


async def visible_ad(ad_id: str) -> Ad:
    doc = await db.caregiver_ads.find_one({"_id": oid(ad_id), **VISIBLE})
    if not doc:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    return Ad.from_mongo(doc)


async def my_ad_doc(user: dict) -> Optional[dict]:
    return await db.caregiver_ads.find_one({"owner_id": user["_id"]})


def notify(owner_id: str, title: str, body: str, url: str) -> None:
    asyncio.create_task(send_to_owner(owner_id, title, body, url))


# ---------- Caregiver: own ad ----------
@router.get("/my-ad")
async def get_my_ad(user: dict = Depends(caregiver_only)):
    doc = await my_ad_doc(user)
    if not doc:
        return {"ad": None, "options": {"specialties": SPECIALTIES}}
    ad = Ad.from_mongo(doc)
    return {"ad": ad_out(ad, await ratings_for([ad.id]), private=True), "options": {"specialties": SPECIALTIES}}


@router.put("/my-ad")
async def save_my_ad(body: AdIn, user: dict = Depends(caregiver_only)):
    now = now_utc()
    doc = await db.caregiver_ads.find_one_and_update(
        {"owner_id": user["_id"]},
        {"$set": {**body.model_dump(), "status": "pending", "rejection_reason": "", "submitted_at": now, "updated_at": now},
         "$setOnInsert": {"owner_id": user["_id"], "paused": False}},
        upsert=True, return_document=ReturnDocument.AFTER)
    ad = Ad.from_mongo(doc)
    return ad_out(ad, await ratings_for([ad.id]), private=True)


@router.post("/my-ad/photo")
async def upload_my_photo(file: UploadFile = File(...), user: dict = Depends(caregiver_only)):
    doc = await my_ad_doc(user)
    if not doc:
        raise HTTPException(status_code=400, detail="Salve o anúncio antes de enviar a foto")
    ext = PHOTO_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(status_code=400, detail="Envie uma foto JPG, PNG ou WEBP")
    data = await file.read()
    if len(data) > MAX_PHOTO:
        raise HTTPException(status_code=400, detail="A foto deve ter no máximo 5 MB")
    result = await asyncio.to_thread(put_object, f"velum/ads/{user['_id']}/{uuid.uuid4()}.{ext}", data, file.content_type)
    await db.caregiver_ads.update_one({"_id": doc["_id"]}, {"$set": {
        "photo_path": result["path"], "photo_type": file.content_type, "status": "pending",
        "submitted_at": now_utc(), "updated_at": now_utc()}})
    return {"ok": True}


@router.patch("/my-ad/pause")
async def pause_my_ad(body: PauseIn, user: dict = Depends(caregiver_only)):
    res = await db.caregiver_ads.update_one({"owner_id": user["_id"]}, {"$set": {"paused": body.paused}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    return {"paused": body.paused}


@router.delete("/my-ad")
async def delete_my_ad(user: dict = Depends(caregiver_only)):
    doc = await my_ad_doc(user)
    if not doc:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    ad_id = str(doc["_id"])
    await db.interests.delete_many({"ad_id": ad_id})
    await db.reviews.delete_many({"ad_id": ad_id})
    await db.caregiver_ads.delete_one({"_id": doc["_id"]})
    return {"ok": True}


@router.get("/my-ad/interests")
async def my_interests_received(user: dict = Depends(caregiver_only)):
    docs = await db.interests.find({"caregiver_id": user["_id"]}).sort("created_at", -1).to_list(500)
    return [Interest.from_mongo(d).model_dump(exclude={"family_id"}) for d in docs]


@router.patch("/my-ad/interests/{interest_id}/seen")
async def mark_interest_seen(interest_id: str, user: dict = Depends(caregiver_only)):
    res = await db.interests.update_one({"_id": oid(interest_id), "caregiver_id": user["_id"]}, {"$set": {"seen": True}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return {"ok": True}


# ---------- Families: browse ----------
@router.get("/marketplace/options")
async def marketplace_options(user: dict = Depends(get_current_user)):
    return {"specialties": SPECIALTIES, "days": DAYS, "shifts": SHIFTS}


@router.get("/marketplace/ads")
async def list_ads(city: str = "", specialty: str = "", shift: str = "", user: dict = Depends(viewer_only)):
    query = dict(VISIBLE)
    if city.strip():
        query["city"] = {"$regex": re.escape(city.strip()), "$options": "i"}
    if specialty:
        query["specialties"] = specialty
    if shift:
        query["shifts"] = shift
    docs = await db.caregiver_ads.find(query).sort("reviewed_at", -1).to_list(200)
    ads = [Ad.from_mongo(d) for d in docs]
    ratings = await ratings_for([a.id for a in ads])
    return [ad_out(a, ratings) for a in ads]


@router.get("/marketplace/ads/{ad_id}")
async def get_ad(ad_id: str, user: dict = Depends(viewer_only)):
    ad = await visible_ad(ad_id)
    reviews = await db.reviews.find({"ad_id": ad.id}).sort("updated_at", -1).to_list(200)
    interest = await db.interests.find_one({"ad_id": ad.id, "family_id": user["_id"]})
    mine = next((r for r in reviews if r["family_id"] == user["_id"]), None)
    return {**ad_out(ad, await ratings_for([ad.id])),
            "reviews": [Review.from_mongo(r).model_dump(exclude={"family_id", "caregiver_id"}) for r in reviews],
            "my_interest": Interest.from_mongo(interest).model_dump(exclude={"family_id", "caregiver_id"}) if interest else None,
            "my_review": Review.from_mongo(mine).model_dump(exclude={"family_id", "caregiver_id"}) if mine else None,
            "can_review": bool(interest) and user["role"] == "family"}


@router.get("/marketplace/ads/{ad_id}/photo")
async def ad_photo(ad_id: str, user: dict = Depends(get_current_user)):
    doc = await db.caregiver_ads.find_one({"_id": oid(ad_id)})
    allowed = doc and (user["role"] == "admin" or doc["owner_id"] == user["_id"]
                       or (user["role"] == "family" and doc["status"] == "approved" and not doc.get("paused")))
    if not allowed or not doc.get("photo_path"):
        raise HTTPException(status_code=404, detail="Foto não encontrada")
    data = await asyncio.to_thread(get_object, doc["photo_path"])
    return Response(content=data, media_type=doc.get("photo_type") or "image/jpeg",
                    headers={"Cache-Control": "private, max-age=300"})


@router.post("/marketplace/ads/{ad_id}/interest")
async def send_interest(ad_id: str, body: InterestIn, user: dict = Depends(family_only)):
    ad = await visible_ad(ad_id)
    doc = await db.interests.find_one_and_update(
        {"ad_id": ad.id, "family_id": user["_id"]},
        {"$set": {**body.model_dump(), "seen": False, "created_at": now_utc(), "caregiver_id": ad.owner_id}},
        upsert=True, return_document=ReturnDocument.AFTER)
    notify(ad.owner_id, "Nova família interessada", f"{body.contact_name} quer falar com você.", "/anuncio")
    return Interest.from_mongo(doc).model_dump(exclude={"family_id", "caregiver_id"})


@router.get("/marketplace/my-interests")
async def my_interests_sent(user: dict = Depends(family_only)):
    docs = await db.interests.find({"family_id": user["_id"]}).sort("created_at", -1).to_list(500)
    ad_ids = [oid(d["ad_id"]) for d in docs]
    ads = {str(a["_id"]): a async for a in db.caregiver_ads.find({"_id": {"$in": ad_ids}})}
    out = []
    for d in docs:
        ad = ads.get(d["ad_id"])
        visible = bool(ad and ad["status"] == "approved" and not ad.get("paused"))
        out.append({**Interest.from_mongo(d).model_dump(exclude={"family_id", "caregiver_id"}),
                    "caregiver_name": ad["display_name"] if ad else "Anúncio removido",
                    "city": f"{ad['city']}/{ad['state']}" if ad else "", "ad_available": visible})
    return out


@router.post("/marketplace/ads/{ad_id}/reviews")
async def review_ad(ad_id: str, body: ReviewIn, user: dict = Depends(family_only)):
    ad = await visible_ad(ad_id)
    if not await db.interests.find_one({"ad_id": ad.id, "family_id": user["_id"]}):
        raise HTTPException(status_code=403, detail="Envie um pedido de contato antes de avaliar")
    now = now_utc()
    doc = await db.reviews.find_one_and_update(
        {"ad_id": ad.id, "family_id": user["_id"]},
        {"$set": {**body.model_dump(), "family_name": user.get("name", ""), "updated_at": now, "caregiver_id": ad.owner_id},
         "$setOnInsert": {"created_at": now}},
        upsert=True, return_document=ReturnDocument.AFTER)
    return Review.from_mongo(doc).model_dump(exclude={"family_id", "caregiver_id"})


# ---------- Admin moderation ----------
@router.get("/admin/ads")
async def admin_list_ads(status: Literal["pending", "approved", "rejected"] = "pending", user: dict = Depends(admin_only)):
    docs = await db.caregiver_ads.find({"status": status}).sort("submitted_at", 1).to_list(500)
    ads = [Ad.from_mongo(d) for d in docs]
    owners = {str(u["_id"]): u["email"] async for u in db.users.find({"_id": {"$in": [oid(a.owner_id) for a in ads]}})}
    ratings = await ratings_for([a.id for a in ads])
    return [{**ad_out(a, ratings, private=True), "owner_email": owners.get(a.owner_id, "")} for a in ads]


@router.get("/admin/ads/counts")
async def admin_counts(user: dict = Depends(admin_only)):
    return {s: await db.caregiver_ads.count_documents({"status": s}) for s in ("pending", "approved", "rejected")}


async def _moderate(ad_id: str, update: dict) -> Ad:
    doc = await db.caregiver_ads.find_one_and_update(
        {"_id": oid(ad_id)}, {"$set": {**update, "reviewed_at": now_utc()}}, return_document=ReturnDocument.AFTER)
    if not doc:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    return Ad.from_mongo(doc)


@router.post("/admin/ads/{ad_id}/approve")
async def admin_approve(ad_id: str, user: dict = Depends(admin_only)):
    ad = await _moderate(ad_id, {"status": "approved", "rejection_reason": ""})
    notify(ad.owner_id, "Anúncio aprovado", "Seu anúncio já aparece para as famílias no Velum.", "/anuncio")
    return {"status": ad.status}


@router.post("/admin/ads/{ad_id}/reject")
async def admin_reject(ad_id: str, body: RejectIn, user: dict = Depends(admin_only)):
    ad = await _moderate(ad_id, {"status": "rejected", "rejection_reason": body.reason})
    notify(ad.owner_id, "Anúncio precisa de ajustes", body.reason or "Revise seu anúncio e envie novamente.", "/anuncio")
    return {"status": ad.status}
