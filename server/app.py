"""Fira — invitation + RSVP API.

Zero-cost backend: FastAPI + SQLite on the Cursus VPS behind Caddy.
No AI calls, no external APIs. All invitation rendering is client-side.
"""
import json
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).parent / "data" / "fira.db"
DB_PATH.parent.mkdir(exist_ok=True)

MAX_INVITE_BYTES = 60_000
MAX_RSVP_BYTES = 4_000

ALLOWED_ORIGINS = [
    "https://hampus-gstack.github.io",
    "https://fira.cursuscapital.co",
    "http://localhost:8090",
    "http://127.0.0.1:8090",
]

app = FastAPI(title="Fira API", docs_url=None, redoc_url=None)
MEDIA_DIR = Path(__file__).parent / "media"
MEDIA_DIR.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-Admin-Key"],
)


@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS invites (
                id TEXT PRIMARY KEY,
                admin_key TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS rsvps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invite_id TEXT NOT NULL REFERENCES invites(id),
                guest_name TEXT NOT NULL,
                attending TEXT NOT NULL,
                party_size INTEGER NOT NULL DEFAULT 1,
                answers TEXT NOT NULL DEFAULT '{}',
                message TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_rsvps_invite ON rsvps(invite_id);
            CREATE TABLE IF NOT EXISTS photos (
                id TEXT PRIMARY KEY,
                mime TEXT NOT NULL,
                bytes BLOB NOT NULL,
                bound INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );
            """
        )


init_db()

# ---- naive in-memory rate limiting (per IP, per window) ----
_hits: dict[str, list[float]] = {}


def rate_limit(request: Request, limit: int = 30, window: float = 60.0):
    ip = request.client.host if request.client else "?"
    now = time.time()
    hits = [t for t in _hits.get(ip, []) if now - t < window]
    if len(hits) >= limit:
        raise HTTPException(429, "Slow down")
    hits.append(now)
    _hits[ip] = hits
    if len(_hits) > 10_000:
        _hits.clear()


class InviteIn(BaseModel):
    data: dict


class RsvpIn(BaseModel):
    guest_name: str = Field(min_length=1, max_length=120)
    attending: str = Field(pattern="^(yes|no|maybe)$")
    party_size: int = Field(default=1, ge=1, le=20)
    answers: dict = Field(default_factory=dict)
    message: str = Field(default="", max_length=1000)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/invites")
def create_invite(body: InviteIn, request: Request):
    rate_limit(request, limit=10)
    raw = json.dumps(body.data)
    if len(raw.encode()) > MAX_INVITE_BYTES:
        raise HTTPException(413, "Invitation too large")
    invite_id = secrets.token_urlsafe(7)
    admin_key = secrets.token_urlsafe(16)
    now = int(time.time())
    with db() as conn:
        conn.execute(
            "INSERT INTO invites (id, admin_key, data, created_at, updated_at) VALUES (?,?,?,?,?)",
            (invite_id, admin_key, raw, now, now),
        )
        _bind_photo(conn, body.data)
    return {"id": invite_id, "admin_key": admin_key}


@app.get("/api/invites/{invite_id}")
def get_invite(invite_id: str):
    with db() as conn:
        row = conn.execute("SELECT data FROM invites WHERE id=?", (invite_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    return {"id": invite_id, "data": json.loads(row["data"])}


def _auth(invite_id: str, admin_key: str | None) -> None:
    if not admin_key:
        raise HTTPException(401, "Missing admin key")
    with db() as conn:
        row = conn.execute("SELECT admin_key FROM invites WHERE id=?", (invite_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    if not secrets.compare_digest(row["admin_key"], admin_key):
        raise HTTPException(403, "Bad admin key")


@app.put("/api/invites/{invite_id}")
def update_invite(
    invite_id: str,
    body: InviteIn,
    request: Request,
    x_admin_key: str | None = Header(default=None),
):
    rate_limit(request)
    _auth(invite_id, x_admin_key)
    raw = json.dumps(body.data)
    if len(raw.encode()) > MAX_INVITE_BYTES:
        raise HTTPException(413, "Invitation too large")
    with db() as conn:
        conn.execute(
            "UPDATE invites SET data=?, updated_at=? WHERE id=?",
            (raw, int(time.time()), invite_id),
        )
        _bind_photo(conn, body.data)
    return {"ok": True}


@app.post("/api/invites/{invite_id}/rsvp")
def create_rsvp(invite_id: str, body: RsvpIn, request: Request):
    rate_limit(request, limit=15)
    answers = json.dumps(body.answers)
    if len(answers.encode()) > MAX_RSVP_BYTES:
        raise HTTPException(413, "Answers too large")
    with db() as conn:
        exists = conn.execute("SELECT 1 FROM invites WHERE id=?", (invite_id,)).fetchone()
        if not exists:
            raise HTTPException(404, "Not found")
        conn.execute(
            "INSERT INTO rsvps (invite_id, guest_name, attending, party_size, answers, message, created_at)"
            " VALUES (?,?,?,?,?,?,?)",
            (
                invite_id,
                body.guest_name.strip(),
                body.attending,
                body.party_size,
                answers,
                body.message.strip(),
                int(time.time()),
            ),
        )
    return {"ok": True}


@app.get("/api/invites/{invite_id}/rsvps")
def list_rsvps(invite_id: str, x_admin_key: str | None = Header(default=None)):
    _auth(invite_id, x_admin_key)
    with db() as conn:
        rows = conn.execute(
            "SELECT guest_name, attending, party_size, answers, message, created_at"
            " FROM rsvps WHERE invite_id=? ORDER BY created_at DESC",
            (invite_id,),
        ).fetchall()
    return {
        "rsvps": [
            {
                "guest_name": r["guest_name"],
                "attending": r["attending"],
                "party_size": r["party_size"],
                "answers": json.loads(r["answers"]),
                "message": r["message"],
                "created_at": r["created_at"],
            }
            for r in rows
        ]
    }


MAX_PHOTO_BYTES = 2_500_000
PHOTO_MAGIC = {b"\xff\xd8\xff": "image/jpeg", b"\x89PNG": "image/png", b"RIFF": "image/webp"}


@app.post("/api/photos")
async def upload_photo(file: UploadFile, request: Request):
    rate_limit(request, limit=10)
    blob = await file.read()
    if len(blob) > MAX_PHOTO_BYTES:
        raise HTTPException(413, "Photo too large (max 2.5MB)")
    mime = next((m for magic, m in PHOTO_MAGIC.items() if blob.startswith(magic)), None)
    if not mime:
        raise HTTPException(415, "Only JPEG, PNG or WebP")
    photo_id = secrets.token_urlsafe(9)
    now = int(time.time())
    with db() as conn:
        conn.execute(
            "INSERT INTO photos (id, mime, bytes, bound, created_at) VALUES (?,?,?,0,?)",
            (photo_id, mime, blob, now),
        )
        # purge orphans: never bound to an invite and older than a day
        conn.execute("DELETE FROM photos WHERE bound=0 AND created_at < ?", (now - 86400,))
    return {"id": photo_id}


@app.get("/api/photos/{photo_id}")
def get_photo(photo_id: str):
    with db() as conn:
        row = conn.execute("SELECT mime, bytes FROM photos WHERE id=?", (photo_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    return Response(
        content=row["bytes"], media_type=row["mime"],
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


def _bind_photo(conn, data: dict):
    pid = data.get("photoId")
    if pid:
        conn.execute("UPDATE photos SET bound=1 WHERE id=?", (pid,))


@app.delete("/api/invites/{invite_id}")
def delete_invite(invite_id: str, x_admin_key: str | None = Header(default=None)):
    _auth(invite_id, x_admin_key)
    with db() as conn:
        conn.execute("DELETE FROM rsvps WHERE invite_id=?", (invite_id,))
        conn.execute("DELETE FROM invites WHERE id=?", (invite_id,))
    return {"ok": True}
