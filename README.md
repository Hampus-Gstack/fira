# Fira — animated digital invitations

Create an animated invitation in minutes: wax-seal envelope opening, six hand-crafted themes, live RSVP tracking. Guests need nothing but the link.

**Live (test):** https://hampus-gstack.github.io/fira/
**API:** https://fira.cursuscapital.co/api

## Architecture

Zero runtime cost by design — no AI calls, no paid APIs, no per-request billing.

| Piece | Where | What |
|---|---|---|
| Frontend | `site/` → GitHub Pages (static, no build step) | Landing, editor with live preview, invitation viewer, host dashboard |
| Backend | `server/app.py` → Cursus VPS (`/opt/fira/`, systemd `fira.service`, port 8091 behind Caddy) | FastAPI + SQLite: invites + RSVPs, admin-key auth, rate limiting |
| Themes | `site/js/templates.js` + `site/css/invite.css` | 6 original animated themes; add a new one = one registry entry + one CSS block |

Invite links: `i.html?id=<id>`. Host dashboard: `manage.html?id=<id>&key=<admin_key>` — the admin key is the only credential; shown once at publish and cached in the creator's browser (`localStorage`).

## Deploy

- **Frontend:** push to `main` → GitHub Actions deploys `site/` to Pages.
- **Backend:** `scp server/app.py root@178.104.74.214:/opt/fira/app.py && ssh root@178.104.74.214 systemctl restart fira`

## Local dev

```bash
cd site && python3 -m http.server 8090   # localhost:8090 is CORS-allowed by the API
```
