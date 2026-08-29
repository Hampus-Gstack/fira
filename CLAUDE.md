# CLAUDE.md — Fira

Animated digital invitations SaaS (own product, own brand). See `README.md` for architecture.

## Facts

- **Live test URL:** https://hampus-gstack.github.io/fira/ (GitHub repo `Hampus-Gstack/fira`, Actions → Pages from `site/`)
- **API:** https://fira.cursuscapital.co/api — FastAPI + SQLite on the campaign-architect VPS (`178.104.74.214`), `/opt/fira/`, systemd unit `fira.service`, bound to `172.18.0.1:8091`, routed by the Postal-stack Caddy (`/opt/postal/caddy/Caddyfile`). ufw allows 8091 from `172.18.0.0/16` only.
- **DNS:** `fira.cursuscapital.co` A-record → VPS, managed in Cloudflare (token in `../campaign-architect/.env`).
- **DB:** `/opt/fira/data/fira.db` (SQLite, WAL). Tables: `invites` (id, admin_key, data JSON), `rsvps`.
- **Zero runtime cost is a product constraint.** No AI APIs, no paid services at request time. Theme creation happens at build time (Claude authors themes into the repo). The €249 "Studio" tier = bespoke theme authored via a Claude Code session, delivered as code.
- **CORS:** allowed origins hardcoded in `server/app.py` (`ALLOWED_ORIGINS`). Add any new frontend origin there.

## Rules

- Frontend is deliberately buildless vanilla JS — keep it that way; no npm, no bundler.
- New theme = entry in `site/js/templates.js` implementing `intro(stage,data,done,U)` + `scenes(data,opts,U)` (+ sample in `FIRA_SAMPLES`) + `.theme-<id>` block in `site/css/invite.css`. Compose the shared partials in `U` (details/schedule/rsvp/photo/foot); the intro and hero art are what make a theme bespoke — never ship a recolored skeleton.
- Guest personalization: `i.html?id=X&to=Name` — envelope/intro greets by name, RSVP prefills. Photos: editor downscales to ≤1600px JPEG client-side → `POST /api/photos` → `data.photoId`.
- After any backend change, redeploy AND `curl https://fira.cursuscapital.co/api/health`.
- The editor preview iframe rewrites itself via `document.write` + postMessage — test `create.html` in a browser after touching invite-core/templates.
- Payments are NOT wired (beta = free). Before adding Stripe or any paid integration: ask Hampus.

## Failure log

- 2026-08-29: `.share-modal` had `display:grid` which overrode the `hidden` attribute — publish modal showed empty on page load. Fix: explicit `.share-modal[hidden]{display:none}`. Rule: any always-`display:x` overlay class needs a `[hidden]` override.
- 2026-08-29: Playwright couldn't click the envelope (infinite float animation = never "stable") — use `force=True` in tests; not a product bug.
