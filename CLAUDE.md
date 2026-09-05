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

## Opening films (AI video, added 2026-09-05)
- Themes may set `openingVideo` (URL). Engine preloads it while the seal idles; on tap it plays full-bleed and dissolves into the hero. Falls back to the CSS crack/unfold if not ready, errored, or reduced-motion.
- Generated with `execution/veo_gen.py` (Veo 3.1 via Gemini API, key = `GEMINI_IMAGE_API_KEY` in `../happa-matcha/.env`). **Paid, ~$1 per 8s Fast clip — ask before generating.** Hosted at `/opt/fira/media/` on the VPS, served by the API at `https://fira.cursuscapital.co/media/<file>` (StaticFiles mount, range requests OK). Strip audio + `-movflags +faststart` before upload.
- Done: botanical, chateau, toscana (each: envelope poster + i2v open film + hero still + hero loop). Pending: noir, confetti, bloom, neon, midsommar — Hampus to approve spend (~$1.20/theme).
- **v4 (2026-09-05): the video IS the envelope.** Theme `opening: {poster, video, hero}` → engine renders `<video poster>` full-bleed paused on frame 0 with "For <guest>" overlaid; tap = haptic + fullscreen + unmuted play (gesture) → dissolve into hero chapter, which uses `opening.hero` as a Ken-Burns backdrop under the names. Floating sound toggle (`.snd-toggle`) controls film audio. Pipeline: `execution/opening_pipeline.py still` (gemini-3.1-flash-image, 9:16) → eyeball → `i2v` (Veo 3.1 Fast image-to-video, keeps audio) → ffmpeg crf 23 + aac 96k + faststart → `/opt/fira/media/`. Botanical total ≈ $1.10 (2 stills + 1 clip). `openingVideo` (v3 film-over-CSS-envelope) is superseded but still supported.

## v5 (2026-09-06) — Château & Toscana, composable chapters
- Recreated the two reference invitations from `active/wedding-invite/` (webgency "Viktor & Paula" burgundy → **chateau**; wooowinvites Tuscan watercolor → **toscana**) in our own art. Themes now declare `chapters: [...]` from: hero · photo · message · countdown · details · venue · schedule · dresscode · gifts · menu · accommodation · faq · contact · rsvp (each renders only when data exists). Engine adds `band-a/band-b` alternation after the hero; chateau styles them as torn burgundy/ivory bands (clip-path polygon + rose layers only on message/contact/rsvp); toscana uses `storyBg` (fixed floral parchment) + `heroFrame`.
- Data model additions: `messageTitle`, `dressCode{title,text,palette[{color,label}],images[{photoId|url,caption}]}`, `gifts{text,links[],details}`, `menu[]`, `accommodation[]`, `faq[]`, `contact{text,name,phone,giftText}`, `rsvpIntro`, `closingText`, `collectEmail`, `photo2Id/photo2Url`, `photoUrl`, `venueImageUrl`, schedule items `icon`/`note`, question types `text|choice|multi|radio`. Editor (`create.html`) has list editors for all of it; `?template=<id>` preloads a sample.
- Assets per theme (all Veo/Gemini-generated, hosted in `/opt/fira/media/`): `env-<t>.jpg` (poster) + `open-<t>.mp4` (i2v glow-open, audio kept) + `hero-<t>.jpg` + `hero-<t>.mp4` (muted loop) + band/bg/venue/attire/hotel/couple stills. Cost this round ≈ $4.60 (14 stills + 4 clips).
- `opening.sealPos/sealSize` position the HTML monogram over the seal in the poster; check with a zoomed screenshot when adding a theme.

## Failure log (v5)
- 2026-09-06: `.env4-mono` was centred with `transform: translate(-50%,-50%)` but its entrance animation (`hero-in`) ends in `transform: none` → the monogram sat ~half its width right of the seal. Fix: centre with the independent `translate` property. Rule: never centre an element with `transform` if any animation on it also sets `transform`.
- 2026-09-06: Playwright `check()` fails on visually-hidden checkbox inputs (label's `<i>` intercepts pointer events) — click the `label:has(input[value=…])` instead. Product works for real taps.
- 2026-09-06: Hand-built ffmpeg hstack/vstack filter graphs are error-prone — for review sheets use `-pattern_type glob -i 'prefix_*.png' -vf tile=CxR`.
