"""Fira — invitation + RSVP API.

FastAPI + SQLite behind a reverse proxy. Stores invitations, RSVPs and uploaded photos, and
answers the link that is sent to guests (/i/<id>) with a page that carries the preview for
messaging apps and sends people on to the invitation. No external API calls at request time;
all invitation rendering happens in the browser.
"""
import html
import json
import os
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
import urllib.error
import urllib.request
from urllib.parse import quote

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).parent / "data" / "fira.db"
DB_PATH.parent.mkdir(exist_ok=True)

MAX_INVITE_BYTES = 60_000
MAX_RSVP_BYTES = 4_000

# Where the invitation pages live, and what a link preview shows when an invitation names no picture.
SITE_BASE = os.environ.get("FIRA_SITE_BASE", "https://www.ohlalainvites.com").rstrip("/")
SHARE_IMAGE_DEFAULT = "media/env-toscana.jpg"
SHARE_IMAGE = re.compile(r"^media/[A-Za-z0-9][A-Za-z0-9_/-]*(?:\.[A-Za-z0-9_-]+)*\.(?:jpg|jpeg|png|webp)$")
SHARE_WORDS = {
    "en": {"title": "You're invited", "open": "Open the invitation", "gone": "This invitation does not exist (or was removed)."},
    "sv": {"title": "Ni är inbjudna", "open": "Öppna inbjudan", "gone": "Den här inbjudan finns inte (eller har tagits bort)."},
}

ALLOWED_ORIGINS = [
    "https://www.ohlalainvites.com",
    "https://ohlalainvites.com",
    "https://hampus-gstack.github.io",
    "https://fira.cursuscapital.co",
    "http://localhost:8090",
    "http://127.0.0.1:8090",
]

# Email when a guest replies (Cloudflare Email Service, REST API). Off until the server has a token that may
# send: /opt/fira/mail.env, loaded by fira.service. The host picks the address in the dashboard; it is kept in
# its own column, apart from the invitation, which anyone with the link can read.
MAIL_ACCOUNT = os.environ.get("OHLALA_MAIL_ACCOUNT", "")
MAIL_TOKEN = os.environ.get("OHLALA_MAIL_TOKEN", "")
MAIL_FROM = os.environ.get("OHLALA_MAIL_FROM", "svar@ohlalainvites.com")
MAIL_ARCHIVE = os.environ.get("OHLALA_MAIL_ARCHIVE", "")   # our copy of every reply: a second backup
MAIL_ON = bool(MAIL_ACCOUNT and MAIL_TOKEN)
EMAIL = re.compile(r"^[^@\s<>,;\"']{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$")

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
            CREATE TABLE IF NOT EXISTS mail_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invite_id TEXT NOT NULL,
                rsvp_id INTEGER,
                recipients INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                detail TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL
            );
            """
        )
        columns = {row[1] for row in conn.execute("PRAGMA table_info(invites)")}
        if "notify_email" not in columns:
            conn.execute("ALTER TABLE invites ADD COLUMN notify_email TEXT NOT NULL DEFAULT ''")


init_db()

# ---- naive in-memory rate limiting (per IP, per window) ----
_hits: dict[str, list[float]] = {}


def client_ip(request: Request) -> str:
    """The visitor's address. The API is only reachable through the reverse proxy, which sets
    X-Forwarded-For itself; without this every visitor would share the proxy's address."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "?"


def rate_limit(request: Request, bucket: str, limit: int, window: float = 60.0):
    """At most `limit` calls per `window` seconds, per visitor and per kind of action, so that
    uploading photos never uses up the allowance for publishing."""
    key = bucket + ":" + client_ip(request)
    now = time.time()
    hits = [t for t in _hits.get(key, []) if now - t < window]
    if len(hits) >= limit:
        raise HTTPException(429, "Slow down")
    hits.append(now)
    _hits[key] = hits
    if len(_hits) > 10_000:
        _hits.clear()


class InviteIn(BaseModel):
    data: dict


class NotifyIn(BaseModel):
    email: str = Field(default="", max_length=254)


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
    rate_limit(request, "publish", limit=10)
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
        _bind_photos(conn, body.data)
    return {"id": invite_id, "admin_key": admin_key}


def _share_html(lang: str, title: str, text: str, image: str, target: str, status: int = 200) -> HTMLResponse:
    """A page for link previews. Everything that comes from an invitation is escaped."""
    e = lambda s: html.escape(s, quote=True)
    words = SHARE_WORDS.get(lang, SHARE_WORDS["en"])
    open_label = words["open"]
    script_target = json.dumps(target).replace("<", "\\u003c")   # never a closing tag inside the script
    page = f"""<!DOCTYPE html>
<html lang="{e(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(text)}">
<meta property="og:image" content="{e(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url={e(target)}">
<style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#FAF6EF;color:#1E2A23;font-family:Georgia,serif;text-align:center}}a{{color:#C25A3A}}</style>
</head>
<body><p><a href="{e(target)}">{e(open_label)}</a></p>
<script>location.replace({script_target});</script>
</body>
</html>
"""
    return HTMLResponse(page, status_code=status, headers={"Cache-Control": "no-store", "X-Robots-Tag": "noindex"})


@app.get("/i/{invite_id}")
def share_page(invite_id: str, request: Request, to: str = ""):
    """The link that is sent to guests. Messaging apps take the preview from this page (the names,
    the date, the envelope); people are sent on to the invitation itself. `?to=` travels along."""
    rate_limit(request, "share", limit=120)
    with db() as conn:
        row = conn.execute("SELECT data FROM invites WHERE id=?", (invite_id,)).fetchone()
    if not row:
        words = SHARE_WORDS["en"]
        return _share_html("en", words["title"], words["gone"], f"{SITE_BASE}/{SHARE_IMAGE_DEFAULT}", f"{SITE_BASE}/", status=404)
    data = json.loads(row["data"])
    share = data.get("share") if isinstance(data.get("share"), dict) else {}
    text_of = lambda v: v.strip() if isinstance(v, str) else ""
    lang = data.get("lang") if data.get("lang") in SHARE_WORDS else "en"
    title = (text_of(share.get("title")) or text_of(data.get("title")) or SHARE_WORDS[lang]["title"])[:120]
    text = (text_of(share.get("text")) or " · ".join(x for x in (text_of(data.get("dateText")), text_of(data.get("heroNote"))) if x))[:200]
    image = text_of(share.get("image"))
    if not SHARE_IMAGE.match(image) or ".." in image:
        image = SHARE_IMAGE_DEFAULT
    target = f"{SITE_BASE}/i.html?id={quote(invite_id, safe='')}"
    if to.strip():
        target += "&to=" + quote(to.strip()[:80], safe="")
    return _share_html(lang, title, text, f"{SITE_BASE}/{image}", target)


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
    rate_limit(request, "edit", limit=30)
    _auth(invite_id, x_admin_key)
    raw = json.dumps(body.data)
    if len(raw.encode()) > MAX_INVITE_BYTES:
        raise HTTPException(413, "Invitation too large")
    with db() as conn:
        old = conn.execute("SELECT data FROM invites WHERE id=?", (invite_id,)).fetchone()
        before = _photo_ids(json.loads(old["data"])) if old else set()
        conn.execute(
            "UPDATE invites SET data=?, updated_at=? WHERE id=?",
            (raw, int(time.time()), invite_id),
        )
        _bind_photos(conn, body.data)
        _release_photos(conn, before - _photo_ids(body.data))
    return {"ok": True}


@app.post("/api/invites/{invite_id}/rsvp")
def create_rsvp(invite_id: str, body: RsvpIn, request: Request, background: BackgroundTasks):
    rate_limit(request, "rsvp", limit=15)
    answers = json.dumps(body.answers)
    if len(answers.encode()) > MAX_RSVP_BYTES:
        raise HTTPException(413, "Answers too large")
    with db() as conn:
        exists = conn.execute("SELECT 1 FROM invites WHERE id=?", (invite_id,)).fetchone()
        if not exists:
            raise HTTPException(404, "Not found")
        cur = conn.execute(
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
        rsvp_id = cur.lastrowid
    background.add_task(notify_rsvp, invite_id, rsvp_id)
    return {"ok": True}


@app.get("/api/invites/{invite_id}/notify")
def get_notify(invite_id: str, x_admin_key: str | None = Header(default=None)):
    """Where reply emails go, whether the server can send, and how the last one went."""
    _auth(invite_id, x_admin_key)
    with db() as conn:
        row = conn.execute("SELECT notify_email FROM invites WHERE id=?", (invite_id,)).fetchone()
        last = conn.execute(
            "SELECT status, created_at FROM mail_log WHERE invite_id=? ORDER BY id DESC LIMIT 1", (invite_id,)
        ).fetchone()
    return {"email": row["notify_email"], "mail": MAIL_ON, "last": dict(last) if last else None}


@app.put("/api/invites/{invite_id}/notify")
def set_notify(invite_id: str, body: NotifyIn, x_admin_key: str | None = Header(default=None)):
    _auth(invite_id, x_admin_key)
    email = body.email.strip()
    if email and not EMAIL.match(email):
        raise HTTPException(422, "Not an email address")
    with db() as conn:
        conn.execute("UPDATE invites SET notify_email=? WHERE id=?", (email, invite_id))
    return {"email": email, "mail": MAIL_ON}


MAIL_WORDS = {
    "en": {"yes": "is coming", "no": "can't come", "maybe": "might come", "guests": "guests", "party": "Party",
           "message": "Message", "so_far": "So far: {yes} coming ({guests} guests), {no} can't come.",
           "open": "Open your guest list", "subject": "RSVP: {name} {verb}",
           "why": "You get this email because this address was chosen for new replies on Ohlala."},
    "sv": {"yes": "kommer", "no": "kommer inte", "maybe": "kanske kommer", "guests": "gäster", "party": "Antal",
           "message": "Hälsning", "so_far": "Hittills: {yes} kommer ({guests} gäster), {no} kommer inte.",
           "open": "Öppna gästlistan", "subject": "OSA: {name} {verb}",
           "why": "Du får det här mejlet för att adressen är vald för nya svar på Ohlala."},
}


def notify_rsvp(invite_id: str, rsvp_id: int) -> None:
    """Email one reply to the host, with our archive as a hidden copy. Runs after the guest has had their
    answer, so nothing here can fail a reply. Every attempt is written to mail_log."""
    with db() as conn:
        inv = conn.execute("SELECT data, admin_key, notify_email FROM invites WHERE id=?", (invite_id,)).fetchone()
        r = conn.execute("SELECT * FROM rsvps WHERE id=?", (rsvp_id,)).fetchone()
        totals = {row["attending"]: (row["n"], row["g"]) for row in conn.execute(
            "SELECT attending, count(*) AS n, coalesce(sum(party_size), 0) AS g FROM rsvps WHERE invite_id=? GROUP BY attending",
            (invite_id,))}
    if not inv or not r:
        return
    data = json.loads(inv["data"])
    host = inv["notify_email"]
    to = [host] if host else ([MAIL_ARCHIVE] if MAIL_ARCHIVE else [])
    bcc = [MAIL_ARCHIVE] if host and MAIL_ARCHIVE and MAIL_ARCHIVE.lower() != host.lower() else []
    if str(data.get("title") or "").startswith("E2E "):
        status, detail = "test", "the suite's own invitation"
    elif not to:
        status, detail = "none", "no address"
    elif not MAIL_ON:
        status, detail = "off", "the server has no mail token"
    else:
        subject, text, page = _reply_mail(data, r, totals, invite_id, inv["admin_key"])
        answers = json.loads(r["answers"] or "{}")
        guest_email = next((v.strip() for v in answers.values() if isinstance(v, str) and EMAIL.match(v.strip())), "")
        status, detail = _send_mail(to, bcc, subject, text, page, reply_to=guest_email)
    with db() as conn:
        conn.execute(
            "INSERT INTO mail_log (invite_id, rsvp_id, recipients, status, detail, created_at) VALUES (?,?,?,?,?,?)",
            (invite_id, rsvp_id, len(to) + len(bcc), status, detail[:300], int(time.time())),
        )
    print(f"mail {invite_id} rsvp {rsvp_id}: {status} {detail[:120]}", flush=True)


def _reply_mail(data: dict, r, totals: dict, invite_id: str, admin_key: str):
    lang = data.get("lang") if data.get("lang") in MAIL_WORDS else "en"
    w = MAIL_WORDS[lang]
    name = " ".join(str(r["guest_name"]).split())[:80]
    verb = w.get(r["attending"], r["attending"])
    party = r["party_size"] if r["attending"] == "yes" else 0
    subject = w["subject"].format(name=name, verb=verb) + (f" ({party} {w['guests']})" if party > 1 else "")
    title = str(data.get("title") or "")
    answers = json.loads(r["answers"] or "{}")
    lines = [f"{k}: {v}" for k, v in answers.items() if str(v).strip()]
    yes_n, yes_g = totals.get("yes", (0, 0))
    no_n = totals.get("no", (0, 0))[0]
    so_far = w["so_far"].format(yes=yes_n, guests=yes_g, no=no_n)
    link = f"{SITE_BASE}/manage.html?id={quote(invite_id, safe='')}&key={quote(admin_key, safe='')}"
    message = str(r["message"] or "").strip()
    text = "\n".join(
        [title, "", f"{name} {verb}." + (f" {w['party']}: {party}" if party else "")]
        + lines + ([f"{w['message']}: {message}"] if message else []) + ["", so_far, "", f"{w['open']}: {link}", "", w["why"]]
    )
    e = lambda s: html.escape(str(s), quote=True)
    rows = "".join(f"<tr><td style='padding:4px 12px 4px 0;color:#6b6b6b'>{e(k)}</td><td style='padding:4px 0'>{e(v)}</td></tr>"
                   for k, v in answers.items() if str(v).strip())
    quote_block = (f"<p style='margin:16px 0;padding:12px 16px;background:#f6f1e8;border-radius:10px;font-style:italic'>"
                   f"{e(message)}</p>") if message else ""
    party_line = f"{e(w['party'])}: {party}" if party else ""
    page = (
        "<div style='font-family:Georgia,serif;color:#1e2a23;max-width:520px;margin:auto;padding:24px'>"
        f"<p style='letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:#b08d3c;margin:0'>{e(title)}</p>"
        f"<h1 style='font-size:24px;margin:8px 0 4px'>{e(name)} {e(verb)}</h1>"
        f"<p style='margin:0 0 12px;color:#6b6b6b'>{party_line}</p>"
        f"<table style='border-collapse:collapse;font-size:15px'>{rows}</table>{quote_block}"
        f"<p style='margin:18px 0'>{e(so_far)}</p>"
        f"<p><a href='{e(link)}' style='display:inline-block;background:#c25a3a;color:#fff;text-decoration:none;"
        f"padding:12px 22px;border-radius:999px;font-family:Arial,sans-serif'>{e(w['open'])}</a></p>"
        f"<p style='font-size:12px;color:#9a9a9a;margin-top:28px'>{e(w['why'])}</p></div>"
    )
    return subject, text, page


def _send_mail(to: list, bcc: list, subject: str, text: str, page: str, reply_to: str = "") -> tuple:
    """Cloudflare Email Service. Returns (status, detail); never raises, never logs the token or the addresses."""
    body = {"to": to, "from": {"address": MAIL_FROM, "name": "Ohlala"}, "subject": subject, "text": text, "html": page}
    if bcc:
        body["bcc"] = bcc
    if reply_to:
        body["reply_to"] = reply_to
    url = f"https://api.cloudflare.com/client/v4/accounts/{MAIL_ACCOUNT}/email/sending/send"
    detail = ""
    for attempt in range(3):
        req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST", headers={
            "Authorization": "Bearer " + MAIL_TOKEN, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                out = json.load(resp)
            result = out.get("result") or {}
            counts = {k: len(v) for k, v in result.items() if isinstance(v, list)}
            if not out.get("success"):
                return "failed", json.dumps(out.get("errors"))[:300]
            bad = counts.get("permanent_bounces", 0) + counts.get("suppressed_recipients", 0)
            return ("bounced" if bad else "sent"), json.dumps(counts)
        except urllib.error.HTTPError as err:
            try:
                detail = f"{err.code} " + json.dumps(json.load(err).get("errors"))
            except Exception:
                detail = f"HTTP {err.code}"
            if err.code != 429 and err.code < 500:
                return "failed", detail
        except Exception as err:
            detail = type(err).__name__
        time.sleep(4 * (attempt + 1))
    return "failed", "gave up: " + detail


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
    rate_limit(request, "photo", limit=30)
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


PHOTO_KEYS = {"photoId", "photo2Id"}


def _photo_ids(node, found=None) -> set:
    """Every uploaded-photo id referenced anywhere in an invitation (main photo, second photo,
    dress-code images, ...). Walks the whole document so new photo fields are covered automatically."""
    if found is None:
        found = set()
    if isinstance(node, dict):
        for key, value in node.items():
            if key in PHOTO_KEYS and isinstance(value, str) and value:
                found.add(value)
            else:
                _photo_ids(value, found)
    elif isinstance(node, list):
        for value in node:
            _photo_ids(value, found)
    return found


def _bind_photos(conn, data: dict):
    """Mark referenced photos as in use, so the orphan purge in upload_photo never removes them."""
    for pid in _photo_ids(data):
        conn.execute("UPDATE photos SET bound=1 WHERE id=?", (pid,))


def _release_photos(conn, photo_ids):
    """Delete photos that no invitation references any more."""
    for pid in photo_ids:
        used = conn.execute(
            "SELECT 1 FROM invites WHERE instr(data, ?) > 0 LIMIT 1", (json.dumps(pid),)
        ).fetchone()
        if not used:
            conn.execute("DELETE FROM photos WHERE id=?", (pid,))


@app.delete("/api/invites/{invite_id}")
def delete_invite(invite_id: str, x_admin_key: str | None = Header(default=None)):
    _auth(invite_id, x_admin_key)
    with db() as conn:
        row = conn.execute("SELECT data FROM invites WHERE id=?", (invite_id,)).fetchone()
        photo_ids = _photo_ids(json.loads(row["data"])) if row else set()
        conn.execute("DELETE FROM rsvps WHERE invite_id=?", (invite_id,))
        conn.execute("DELETE FROM mail_log WHERE invite_id=?", (invite_id,))
        conn.execute("DELETE FROM invites WHERE id=?", (invite_id,))
        _release_photos(conn, photo_ids)
    return {"ok": True}
