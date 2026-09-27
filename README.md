# Fira

Animated digital invitations. A guest gets a link, sees a sealed envelope addressed to them, taps it, and a short film opens it into a scrolling story: the day, the place, the programme, dress code, gifts, menu, where to stay, and an RSVP that lands on the host's private dashboard. No app, no account for guests.

**Live:** https://hampus-gstack.github.io/fira/

## Layout

| Path | What |
|---|---|
| `site/` | The whole frontend. Static HTML, CSS and vanilla JavaScript, no build step. |
| `site/js/invite-core.js` | The invitation engine: envelope, film, chapters, RSVP. |
| `site/js/templates.js` | Theme registry (identity, labels, chapter order, art) and sample data. |
| `site/css/invite.css` | Engine styles and one block per theme. |
| `server/` | The API: FastAPI + SQLite. Invitations, RSVPs, uploaded photos, theme media. |
| `tests/` | End-to-end suite and review-sheet generator (Playwright). |

Pages: `index.html` (landing), `create.html` (editor with live preview), `i.html` (the invitation), `manage.html` (host dashboard).

## How an invitation works

1. The host builds it in the editor and publishes. The API stores one JSON document and returns an id and a host key.
2. The guest link is `i.html?id=<id>`. Adding `&to=<name>` addresses the envelope to that guest and prefills their RSVP.
3. The host link is `manage.html?id=<id>&key=<host key>`. The key is the only credential: it shows the guest list and allows editing.

## Run locally

```bash
cd site && python3 -m http.server 8090 --bind 127.0.0.1
# open http://127.0.0.1:8090  (this origin is on the API's CORS allow-list)
```

The local site talks to the live API. To run your own, see `server/`:

```bash
cd server && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app:app --port 8091   # then point site/js/config.js at it
```

`server/deploy/` holds the systemd unit and the Caddy site block used in production.

## Tests

```bash
pip install playwright && playwright install chromium
python tests/e2e.py                 # local site, live API
python tests/e2e.py --base prod     # the deployed site
python tests/shots.py --themes chateau,toscana   # review sheets of every chapter
```

The suite publishes a real invitation through the editor, answers it as a guest, checks the dashboard, edits it and deletes it again.

## Add a theme

1. Add an entry to `FIRA_TEMPLATES` in `site/js/templates.js`: fonts, swatch, labels, the `chapters` it uses and, if it has them, its `opening` media.
2. Add sample data under the same id in `FIRA_SAMPLES`.
3. Add a `.theme-<id>` block to `site/css/invite.css`.
4. Run `tests/shots.py --themes <id>` and look at the sheet.

Chapters available to a theme: hero, photo, message, countdown, details, venue, schedule, dresscode, gifts, menu, accommodation, faq, contact, rsvp. A chapter renders only when the invitation has data for it.

## Deploy

Pushing to `main` deploys `site/` to GitHub Pages. The workflow writes the commit hash to `version.txt`, so a deploy can be confirmed from outside.
