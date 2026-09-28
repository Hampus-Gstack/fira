# Fira

Animated digital invitations. A guest gets a link, sees a sealed envelope addressed to them, taps it, and in one shot the envelope opens into the first picture of a scrolling story: the day, the place, the programme, dress code, gifts, menu, where to stay, and an RSVP that lands on the host's private dashboard. No app, no account for guests.

**Live:** https://hampus-gstack.github.io/fira/

## Layout

| Path | What |
|---|---|
| `site/` | The whole frontend. Static HTML, CSS and vanilla JavaScript, no build step. |
| `site/js/invite-core.js` | The invitation engine: envelope, opening film, the hero and the pictures that follow the scroll, chapters, RSVP. |
| `site/js/templates.js` | Theme registry (identity, labels, chapter order, art) and sample data. |
| `site/css/invite.css` | Engine styles and one block per theme. |
| `site/js/scrollfilm.js` | A film cut into frames, drawn on a canvas at the position the page asks for. Frames load coarse to fine. Used by the invitation and by the landing page. |
| `site/js/landing.js` | The landing page: the envelope film follows the scroll, then the live invitation inside the phone. |
| `site/media/seq/<name>/` | A film as WebP frames with a `manifest.json` (frame count, brightness of each frame). |
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
python tests/e2e.py --only landing  # one group: pages, landing, film, scroll, seal, lang, flow
python tests/shots.py --themes chateau,toscana   # review sheets of every chapter
python tests/opening.py chateau --engine webkit  # an opening second by second, then the pictures under the scroll
```

The suite publishes a real invitation through the editor, answers it as a guest, checks the dashboard, edits it and deletes it again.

## How an opening works

A theme with `opening.lands` opens in one shot. The story is built behind the sealed envelope. On the tap
the film plays inside the first screen of the page, from the envelope to the hero picture. From `lands`
seconds the names are written in, and when the film ends a loop of the same view takes over on the same
frame. While the guest scrolls on, the hero stays in place and `opening.heroSeq` (a film as frames) follows
the scroll. Further down, a picture made with `figure(src, { film })` paints itself as it arrives.

| `opening` field | Meaning |
|---|---|
| `poster`, `video`, `videoLight` | The film's first frame, the film, and a 720p version for slow connections |
| `lands` | The second from which the names may arrive. Without it the film plays over the page and fades |
| `hero`, `heroVideo` | The picture the film lands on, and a loop of it |
| `heroSeq`, `pin` | A folder of frames (`media/seq/<name>/`) and for how many screens of scroll the hero is held |

On screens wider than they are high the hero is a portrait card. With reduced motion there is no envelope
and nothing follows the scroll: the page is a still page.

## Add a theme

1. Add an entry to `FIRA_TEMPLATES` in `site/js/templates.js`: fonts, swatch, labels, the `chapters` it uses and, if it has them, its `opening` media.
2. Add sample data under the same id in `FIRA_SAMPLES`.
3. Add a `.theme-<id>` block to `site/css/invite.css`.
4. Run `tests/shots.py --themes <id>` and look at the sheet.

Chapters available to a theme: hero, photo, message, countdown, details, venue, place:<n>, schedule, dresscode, gifts, menu, accommodation, faq, contact, music, section:<key>, rsvp. A chapter renders only when the invitation has data for it.

## Deploy

Pushing to `main` deploys `site/` to GitHub Pages. The workflow writes the commit hash to `version.txt`, so a deploy can be confirmed from outside.
