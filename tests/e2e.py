#!/usr/bin/env python3
"""Fira end-to-end suite: Playwright, headless Chromium, real API.

Run from the repo root with a Python that has Playwright installed, in the FOREGROUND
(the Playwright driver hangs when its process is backgrounded):

    python tests/e2e.py                      # local: serves site/ on 127.0.0.1:8090, talks to the live API
    python tests/e2e.py --base prod          # the deployed site
    python tests/e2e.py --only pages,film    # any of: pages, landing, film, scroll, seal, lang, flow
    python tests/e2e.py --base prod --invite <id>   # one published invitation, read only

`flow` publishes a real invitation through the editor, answers it as a guest, reads it back on
the host dashboard, edits it and deletes it again. Invitations are deleted even when a check fails.
Host links and admin keys are never printed.
"""
import argparse
import contextlib
import functools
import http.server
import json
import os
import struct
import sys
import tempfile
import threading
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import zlib
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parents[1]
SITE = REPO / "site"
PROD = os.environ.get("FIRA_SITE_BASE", "https://hampus-gstack.github.io/fira").rstrip("/")
API = os.environ.get("FIRA_API_BASE", "https://fira.cursuscapital.co/api").rstrip("/")
API_ORIGIN = API.rsplit("/api", 1)[0]
PORT = 8090  # http://127.0.0.1:8090 is on the API's CORS allow-list
GROUPS = ("pages", "landing", "film", "scroll", "seal", "lang", "flow")


class Check(Exception):
    pass


def expect(condition, message):
    if not condition:
        raise Check(message)


def write_png(path, w=640, h=800, tint=(190, 120, 110)):
    """A photo-sized PNG (vertical gradient) written with the standard library only."""
    rows = bytearray()
    for y in range(h):
        k = 0.55 + 0.45 * y / (h - 1)
        rows += b"\x00" + bytes(int(c * k) for c in tint) * w

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    Path(path).write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + chunk(b"IEND", b"")
    )


def api(method, path, admin_key=None):
    """Status code and parsed JSON (or None). The admin key travels in a header, never in the URL."""
    req = urllib.request.Request(API + path, method=method)
    if admin_key:
        req.add_header("X-Admin-Key", admin_key)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read()
            kind = r.headers.get("Content-Type", "")
            return r.status, (json.loads(body) if "json" in kind else None)
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception as e:  # never echo the request
        raise Check(f"API {method} failed: {type(e).__name__}")


def served_as_image(url):
    """True when the server delivers this URL as an image (checked outside the browser)."""
    try:
        req = urllib.request.Request(url, method="GET", headers={"Range": "bytes=0-1023"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status in (200, 206) and r.headers.get("Content-Type", "").startswith("image/")
    except Exception:
        return False


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class QuietServer(http.server.ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        # A browser that closes a page drops its open downloads. That is not an error worth a traceback.
        if not isinstance(sys.exc_info()[1], (BrokenPipeError, ConnectionResetError)):
            super().handle_error(request, client_address)


@contextlib.contextmanager
def local_site():
    base = f"http://127.0.0.1:{PORT}"
    try:
        server = QuietServer(("127.0.0.1", PORT), functools.partial(QuietHandler, directory=str(SITE)))
    except OSError:
        try:
            with urllib.request.urlopen(base + "/js/invite-core.js", timeout=3) as r:
                body = r.read()
        except Exception:
            body = b""
        if body != (SITE / "js" / "invite-core.js").read_bytes():
            sys.exit(f"port {PORT} is busy and is not serving this repo's site/ — stop that process first")
        yield base
        return
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        yield base
    finally:
        server.shutdown()


class Suite:
    def __init__(self, browser, base, invite_id=None):
        self.browser = browser
        self.invite_id = invite_id
        self.base = base.rstrip("/")
        self.errors = []
        self.created = []  # [invite_id, admin_key, deleted]
        self._themes = None

    # ---- plumbing
    def url(self, path):
        return f"{self.base}/{path}"

    def page(self, w=430, h=860):
        page = self.browser.new_page(viewport={"width": w, "height": h})
        page.set_default_timeout(25000)
        page.on("pageerror", lambda e: self.errors.append(f"pageerror: {str(e)[:200]}"))
        page.on("console", self._console)
        return page

    def _console(self, msg):
        if msg.type != "error":
            return
        where = (msg.location or {}).get("url", "")
        if where and not (where.startswith(self.base) or where.startswith(API_ORIGIN)):
            return  # third-party frames (maps) are not ours to fix
        self.errors.append(f"console: {msg.text[:200]}")

    def no_errors(self, label):
        errors, self.errors = self.errors, []
        expect(not errors, f"{label}: browser errors: {errors[:3]}")

    def themes(self):
        if self._themes is None:
            page = self.page()
            page.goto(self.url("index.html"))
            page.wait_for_function("window.FIRA_TEMPLATES && window.FIRA_SAMPLES")
            self._themes = page.evaluate(
                """Object.values(FIRA_TEMPLATES).map(t => ({
                     id: t.id, film: !!(t.opening && t.opening.video),
                     heroVideo: !!(t.opening && t.opening.heroVideo),
                     lands: (t.opening && t.opening.lands) || 0,
                     heroSeq: !!(t.opening && t.opening.heroSeq),
                     sample: !!FIRA_SAMPLES[t.id] }))"""
            )
            page.close()
            expect(len(self._themes) >= 8, f"expected at least 8 themes, found {len(self._themes)}")
            expect(all(t["sample"] for t in self._themes), "a theme has no sample data")
        return self._themes

    def open_envelope(self, page, film):
        if film:
            page.wait_for_selector(".env4-tap")
            page.wait_for_function("document.querySelector('.hero-film, .env4-film').readyState >= 3", timeout=45000)
            page.click(".env4-tap")
        else:
            page.wait_for_selector(".env3-seal")
            page.click(".env3-seal", force=True)  # the seal breathes, so it is never "stable"
        page.wait_for_function("!document.querySelector('.env4') && !document.querySelector('.env3')", timeout=30000)
        page.wait_for_selector(".story .ch-hero")

    # ---- groups
    def test_pages(self):
        page = self.page(1280, 860)
        page.goto(self.url("index.html"))
        page.wait_for_selector("#tplGrid .tpl-card")
        cards = page.locator("#tplGrid .tpl-card").count()
        expect(cards == len(self.themes()), f"landing shows {cards} theme cards for {len(self.themes())} themes")
        page.close()
        self.no_errors("index.html")

        page = self.page(1280, 860)
        page.goto(self.url("create.html"))
        page.wait_for_selector("#f_title")
        expect(not page.is_visible("#shareModal"), "share dialog is visible before publishing")
        for where in ("top", "bottom"):
            page.evaluate("w => scrollTo({top: w === 'top' ? 0 : document.documentElement.scrollHeight, behavior: 'instant'})", where)
            page.wait_for_timeout(300)
            box = page.evaluate("(() => { const r = document.getElementById('publishBtn').getBoundingClientRect(); return [r.top, r.bottom, innerHeight]; })()")
            expect(0 <= box[0] and box[1] <= box[2], f"publish button is off screen at the {where} of the editor")
        page.locator("#ph_second").click(trial=True, timeout=5000)  # the last field must not sit under the publish bar
        page.frame_locator("#previewFrame").locator(".story .ch-hero").wait_for(timeout=20000)
        page.close()
        self.no_errors("create.html")

        page = self.page(1280, 860)
        page.goto(self.url("manage.html"))
        page.wait_for_selector("#dash h1, #dash .dash-empty")
        page.close()
        self.no_errors("manage.html")

        slow = 0
        for t in self.themes():
            page = self.page()
            page.goto(self.url(f"i.html?demo={t['id']}&embed=1"))
            page.wait_for_selector(".story .ch-hero")
            chapters = page.locator(".ch").count()
            expect(chapters >= 5, f"{t['id']}: only {chapters} chapters rendered")
            expect(page.locator("#rsvp .rf").count() == 1, f"{t['id']}: RSVP form missing")
            height = page.evaluate("document.documentElement.scrollHeight")
            for y in range(0, height, 600):  # walk the page so lazily loaded images start loading
                page.evaluate("y => scrollTo({top: y, behavior: 'instant'})", y)
                page.wait_for_timeout(120)
            try:
                page.wait_for_function("[...document.images].every(i => i.complete)", timeout=20000)
            except Exception:
                pass  # reported below, by name
            pending = page.evaluate(
                "[...document.images].filter(i => !(i.complete && i.naturalWidth > 0)).map(i => i.currentSrc || i.src)"
            )
            # An image that is merely slow on this connection is not a defect; one the server cannot deliver is.
            broken = [u for u in pending if not served_as_image(u)]
            expect(not broken, f"{t['id']}: images failed to load: {broken[:3]}")
            slow += len(pending) - len(broken)
            page.close()
            self.no_errors(f"story {t['id']}")
        note = f" ({slow} image(s) still loading on this connection)" if slow else ""
        return f"{len(self.themes())} theme stories, 3 site pages{note}"

    def test_landing(self):
        """The landing page's opening film: it follows the scroll, then the invitation itself takes over."""
        read = """() => { const film = document.querySelector('.film'), css = getComputedStyle(film);
                   const caps = [...document.querySelectorAll('.film-step')].map(c => parseFloat(getComputedStyle(c).getPropertyValue('--o')) || 0);
                   const c = document.querySelector('.phone-film'), box = c.getBoundingClientRect();
                   const px = c.width ? [...c.getContext('2d').getImageData(c.width >> 1, c.height >> 1, 1, 1).data].slice(0, 3) : [0, 0, 0];
                   return { beat: FiraLanding.beat(), frame: FiraLanding.film.drawn, count: FiraLanding.film.count,
                            loaded: FiraLanding.film.loaded, over: parseFloat(css.getPropertyValue('--over')),
                            fade: parseFloat(css.getPropertyValue('--fade')), caps, pixel: px[0] + px[1] + px[2],
                            sideways: document.documentElement.scrollWidth - innerWidth,
                            stage: [Math.round(box.top), Math.round(box.bottom), innerHeight] }; }"""
        partial = []
        for name, (w, h) in (("phone", (430, 860)), ("desktop", (1280, 860))):
            page = self.page(w, h)

            def go(beat):
                page.evaluate("b => scrollTo({top: FiraLanding.scrollFor(b), behavior: 'instant'})", beat)
                page.wait_for_function("b => Math.abs(FiraLanding.beat() - b) < 0.03", arg=beat, timeout=10000)
                page.wait_for_timeout(250)
                return page.evaluate(read)

            page.goto(self.url("index.html"))
            page.wait_for_function("window.FiraLanding && FiraLanding.film.count > 0", timeout=30000)
            page.wait_for_function("FiraLanding.film.loaded >= 8", timeout=60000)   # the coarse pass: every 16th frame
            s = page.evaluate(read)
            expect(s["count"] >= 40, f"{name}: the film has only {s['count']} frames")
            expect(s["beat"] == 0 and s["frame"] == 0, f"{name}: the envelope is not sealed at the top of the page: {s}")
            expect(s["over"] > 0.95 and page.is_visible(".po-addr"), f"{name}: the greeting is missing on the sealed envelope")
            expect(s["sideways"] <= 0, f"{name}: the page scrolls sideways by {s['sideways']}px")

            s = go(1.5)
            expect(0.38 * s["count"] <= s["frame"] <= 0.78 * s["count"], f"{name}: half way, the film shows frame {s['frame']} of {s['count']}")
            expect(s["pixel"] > 0, f"{name}: the film canvas is empty")
            expect(s["over"] < 0.05, f"{name}: the greeting is still on the envelope while it opens")
            expect(s["fade"] == 0, f"{name}: the invitation shows through before the film has run")
            top, bottom, screen = s["stage"]
            held = (top <= 1 and bottom >= screen * 0.8) if name == "phone" else (top >= 0 and bottom <= screen)
            expect(held, f"{name}: the film does not stay on screen while the page scrolls: {s['stage']}")

            s = go(3.2)
            expect(s["fade"] == 1 and s["frame"] >= s["count"] - 9, f"{name}: the film did not hand over to the invitation: {s}")
            expect(s["caps"][2] > 0.9, f"{name}: caption 3 is not showing at its beat: {s['caps']}")
            try:
                page.wait_for_selector(".film.live-ready", timeout=45000)
            except Exception:
                raise Check(f"{name}: the invitation inside the phone did not load")
            inside = page.frame_locator(".phone-live")
            expect("Sofia" in inside.locator(".ch-hero").inner_text(), f"{name}: the invitation inside the phone shows no names")

            go(5.0)
            page.wait_for_timeout(600)
            top = page.evaluate("""(() => { const w = document.querySelector('.phone-live').contentWindow;
                      const r = w.document.querySelector('#rsvp').getBoundingClientRect(); return [Math.round(r.top), w.innerHeight, Math.round(w.scrollY)]; })()""")
            expect(top[2] > 1000 and top[0] < top[1] * 0.5, f"{name}: the page did not scroll the invitation to its reply form: {top}")
            expect(page.is_visible(".film-step:last-child .cap-ctas .btn-primary"), f"{name}: the last caption has no button")
            expect(not inside.locator(".cta-pill").is_visible(), f"{name}: the invitation's own button shows inside the phone")

            go(0)
            page.click(".phone")                                            # a tap opens it: the page scrolls itself
            try:
                page.wait_for_function("FiraLanding.beat() > 2.9", timeout=9000)
            except Exception:
                raise Check(f"{name}: a tap on the envelope did not open it (beat {page.evaluate('FiraLanding.beat()'):.2f})")
            s = page.evaluate(read)
            if s["loaded"] < s["count"]:
                partial.append(f"{name} {s['loaded']}/{s['count']}")
            page.close()
            self.no_errors(f"landing {name}")

        page = self.browser.new_page(viewport={"width": 430, "height": 860}, reduced_motion="reduce")
        page.goto(self.url("index.html"))
        page.wait_for_selector("#tplGrid .tpl-card")
        calm = page.evaluate("""({ live: document.querySelector('.film').classList.contains('film-live'),
                                   caption: getComputedStyle(document.querySelector('.film-cap')).opacity,
                                   hidden: [...document.querySelectorAll('.rv')].length })""")
        expect(not calm["live"] and calm["caption"] == "1" and calm["hidden"] == 0, f"reduced motion is not respected: {calm}")
        page.close()
        note = f" (frames still arriving on this connection: {', '.join(partial)})" if partial else ""
        return f"film follows the scroll on phone and desktop, invitation inside the phone, tap to open, reduced motion{note}"

    def test_film(self):
        """Every theme with a film: sealed, tap, the film with sound, the story. A film that lands on the
        hero plays inside it: the names wait until it has settled, then the hero follows the scroll."""
        films = [t for t in self.themes() if t["film"]]
        expect(films, "no theme has an opening film")
        slow = []
        for t in films:
            page = self.page()
            page.goto(self.url(f"i.html?demo={t['id']}&to=" + urllib.parse.quote("Anna & Johan")))
            page.wait_for_selector(".env4-tap")
            expect("Anna & Johan" in page.inner_text(".env4-addr"), f"{t['id']}: envelope is not addressed to the guest")
            expect(page.is_visible(".env4-sound"), f"{t['id']}: sound hint missing on the sealed envelope")
            expect(page.is_visible(".env4-hint"), f"{t['id']}: tap hint missing")
            if t["lands"]:
                page.evaluate("scrollTo(0, 400)")
                page.wait_for_timeout(250)
                sealed = page.evaluate(
                    """(() => { const h = document.querySelector('.ch-hero'), words = h.querySelector('.ch-inner');
                         return { held: h.classList.contains('held'), words: getComputedStyle(words).visibility,
                                  locked: document.documentElement.classList.contains('sealed'), moved: scrollY,
                                  inside: !!h.querySelector('.hero-stage > .hero-film') }; })()"""
                )
                expect(sealed["held"] and sealed["words"] == "hidden", f"{t['id']}: the names show on the sealed envelope: {sealed}")
                expect(sealed["locked"] and sealed["moved"] == 0, f"{t['id']}: the page scrolls behind the sealed envelope: {sealed}")
                expect(sealed["inside"], f"{t['id']}: the film is not inside the hero")
            page.wait_for_function("document.querySelector('.hero-film, .env4-film').readyState >= 3", timeout=45000)
            expect(page.evaluate("document.querySelector('.hero-film, .env4-film').paused"), f"{t['id']}: film plays before the tap")
            page.click(".env4-tap")
            page.wait_for_timeout(1600)
            state = page.evaluate(
                """(() => { const f = document.querySelector('.hero-film, .env4-film'), h = document.querySelector('.ch-hero');
                     const o = s => parseFloat(getComputedStyle(document.querySelector(s)).opacity);
                     return { t: f.currentTime, muted: f.muted, addr: o('.env4-addr'), hint: o('.env4-hint'),
                              sound: o('.env4-sound'), toggle: document.querySelector('.snd-toggle').classList.contains('on'),
                              held: !!h && h.classList.contains('held') }; })()"""
            )
            expect(state["t"] > 0.5, f"{t['id']}: film did not start ({state['t']:.2f}s)")
            expect(not state["muted"] and state["toggle"], f"{t['id']}: film did not start with sound on")
            for key in ("addr", "hint", "sound"):
                expect(state[key] < 0.15, f"{t['id']}: envelope overlay '{key}' still visible during the film (opacity {state[key]:.2f})")
            if t["lands"]:
                expect(state["held"], f"{t['id']}: the names arrive before the film has landed")
                page.wait_for_function("!document.querySelector('.ch-hero').classList.contains('held')", timeout=20000)
                landed = page.evaluate("document.querySelector('.hero-film').currentTime")
                expect(t["lands"] - 0.05 <= landed <= t["lands"] + 0.8, f"{t['id']}: the names arrived at {landed:.2f}s, the film lands at {t['lands']}s")
                expect(page.evaluate("!!document.querySelector('.env4') && document.documentElement.classList.contains('sealed')"),
                       f"{t['id']}: the page opened before the film had ended")
            page.wait_for_function("!document.querySelector('.env4')", timeout=30000)
            page.wait_for_selector(".story .ch-hero")
            if t["lands"]:
                page.wait_for_function("!document.querySelector('.hero-film')", timeout=5000)
                after = page.evaluate(
                    """({ locked: document.documentElement.classList.contains('sealed'), toggle: !!document.querySelector('.snd-toggle'),
                          words: getComputedStyle(document.querySelector('.ch-hero .ch-inner')).visibility })"""
                )
                expect(not after["locked"] and not after["toggle"] and after["words"] == "visible", f"{t['id']}: the page is not open after the film: {after}")
            if t["heroVideo"]:
                try:
                    page.wait_for_function("(document.querySelector('.hero-video') || {}).currentTime > 0.5", timeout=20000)
                except Exception:
                    state = page.evaluate(
                        """(() => { const v = document.querySelector('.hero-video');
                             return v ? { t: v.currentTime, ready: v.readyState, net: v.networkState, paused: v.paused,
                                          error: v.error && v.error.code, visible: v.getBoundingClientRect().height > 0 } : 'no .hero-video element'; })()"""
                    )
                    # Autoplay waits until the browser has buffered enough. On a slow link that can take
                    # longer than this check; the poster shows meanwhile, so only a broken video is a failure.
                    still_loading = isinstance(state, dict) and not state["error"] and state["net"] == 2 and state["visible"]
                    expect(still_loading, f"{t['id']}: hero video is not playing: {state}")
                    slow.append(t["id"])
            page.wait_for_selector(".cta-pill.show", timeout=8000)
            page.close()
            self.no_errors(f"film {t['id']}")
        landing = [t for t in films if t["lands"]]
        if landing:
            theme = landing[0]["id"]
            # a slow connection gets the light film
            context = self.browser.new_context(viewport={"width": 430, "height": 860})
            context.add_init_script("Object.defineProperty(navigator, 'connection', { value: { downlink: 1.2, effectiveType: '3g', saveData: false } })")
            page = context.new_page()
            page.goto(self.url(f"i.html?demo={theme}"))
            page.wait_for_function("!!(document.querySelector('.hero-film') || {}).currentSrc", timeout=20000)
            chosen = page.evaluate("document.querySelector('.hero-film').currentSrc.split('/').pop()")
            context.close()
            expect(chosen.endswith("-small.mp4"), f"{theme}: a slow connection was given {chosen}")
            # drawn again while sealed (the editor does that): the page must not stay locked
            page = self.page()
            page.goto(self.url(f"i.html?demo={theme}"))
            page.wait_for_selector(".env4-tap")
            state = page.evaluate(
                """async (theme) => { const before = document.documentElement.classList.contains('sealed');
                     FiraInvite.render(JSON.parse(JSON.stringify(FIRA_SAMPLES[theme])), document.getElementById('mount'), { skipEnvelope: true });
                     await new Promise(r => setTimeout(r, 300));
                     scrollTo(0, 500); await new Promise(r => setTimeout(r, 300));
                     return { before, after: document.documentElement.classList.contains('sealed'), moved: scrollY, envelope: !!document.querySelector('.env4') }; }""",
                theme,
            )
            page.close()
            expect(state["before"] and not state["after"] and state["moved"] == 500 and not state["envelope"],
                   f"{theme}: drawn again while sealed, the page stays locked: {state}")
            self.no_errors(f"film {theme} (light film, drawn again)")
        note = f" (hero video still buffering on this connection: {', '.join(slow)})" if slow else ""
        return ", ".join(t["id"] + ("*" if t["lands"] else "") for t in films) + " (* lands on the hero); light film on a slow connection" + note

    def test_scroll(self):
        """Pictures that follow the scroll inside the story: the held hero and the paintings."""
        seen = []
        for t in self.themes():
            page = self.page()
            page.goto(self.url(f"i.html?demo={t['id']}&embed=1"))
            page.wait_for_selector(".story .ch-hero")
            figures = page.locator(".venue-art.has-film").count()
            if not (t["heroSeq"] or figures):
                page.close()
                continue
            if t["heroSeq"]:
                page.wait_for_function("(() => { const c = document.querySelector('.hero-seq-film'); return c && c.width > 0; })()", timeout=30000)
                hero = page.evaluate("(() => { const r = document.querySelector('.ch-hero').getBoundingClientRect(); return { range: r.height - innerHeight, screen: innerHeight }; })()")
                expect(hero["range"] > hero["screen"] * 0.5, f"{t['id']}: the hero is not held while the page scrolls: {hero}")
                page.evaluate("y => scrollTo({top: y, behavior: 'instant'})", hero["range"] * 0.5)
                page.wait_for_function("document.querySelector('.ch-hero').classList.contains('filming')", timeout=30000)
                mid = page.evaluate(
                    """(() => { const h = document.querySelector('.ch-hero'), s = h.querySelector('.hero-stage').getBoundingClientRect();
                         const c = h.querySelector('.hero-seq-film');
                         const px = [...c.getContext('2d').getImageData(c.width >> 1, c.height >> 1, 1, 1).data];
                         return { pin: parseFloat(getComputedStyle(h).getPropertyValue('--pin-p')), top: Math.round(s.top),
                                  bottom: Math.round(s.bottom), screen: innerHeight, pixel: px[0] + px[1] + px[2],
                                  words: getComputedStyle(h.querySelector('.ch-inner')).filter }; })()"""
                )
                expect(abs(mid["pin"] - 0.5) < 0.02, f"{t['id']}: half way through its hold the hero reports {mid['pin']}")
                expect(mid["top"] == 0 and mid["bottom"] >= mid["screen"] - 1, f"{t['id']}: the hero does not stay on screen: {mid}")
                expect(mid["pixel"] > 0, f"{t['id']}: the hero film is empty")
                expect("opacity(0)" in mid["words"], f"{t['id']}: the names are still over the hero half way: {mid['words']}")
                page.evaluate("scrollTo({top: 0, behavior: 'instant'})")
                page.wait_for_function("!document.querySelector('.ch-hero').classList.contains('filming')", timeout=5000)
            for i in range(figures):
                # A page of its own, and one jump: the frames arrive after the scroll has stopped,
                # as they do for a guest on a slow connection who scrolls and then waits.
                page.close()
                page = self.page()
                page.goto(self.url(f"i.html?demo={t['id']}&embed=1"))
                page.wait_for_selector(".story .ch-hero")
                fig = page.locator(".venue-art.has-film").nth(i)
                top = fig.evaluate("f => f.getBoundingClientRect().top + scrollY")
                screen = page.evaluate("innerHeight")
                page.evaluate("y => scrollTo({top: y, behavior: 'instant'})", max(0, top - screen * 0.94 + 0.5 * screen * 0.62))
                try:
                    page.wait_for_function(
                        """i => { const f = document.querySelectorAll('.venue-art.has-film')[i];
                                  const ap = parseFloat(getComputedStyle(f).getPropertyValue('--ap'));
                                  return f.classList.contains('filming') && ap > 0.4 && ap < 0.6; }""", arg=i, timeout=30000)
                except Exception:
                    seen_frames = fig.evaluate("f => f.querySelector('canvas').width")
                    raise Check(f"{t['id']}: picture {i + 1} did not start to paint itself: {fig.get_attribute('class')} (canvas {seen_frames} px wide)")
                half = fig.evaluate(
                    """f => { const c = f.querySelector('canvas');
                         return { ap: parseFloat(getComputedStyle(f).getPropertyValue('--ap')), still: getComputedStyle(f.querySelector('img')).opacity,
                                  film: getComputedStyle(c).opacity, width: c.width }; }"""
                )
                expect(0.4 < half["ap"] < 0.6 and half["width"] > 0, f"{t['id']}: picture {i + 1} half way: {half}")
                page.evaluate("y => scrollTo({top: y, behavior: 'instant'})", max(0, top - screen * 0.2))
                page.wait_for_function("i => document.querySelectorAll('.venue-art.has-film')[i].classList.contains('done')", arg=i, timeout=5000)
                page.wait_for_timeout(900)
                expect(fig.evaluate("f => getComputedStyle(f.querySelector('img')).opacity") == "1", f"{t['id']}: picture {i + 1} is not finished when it has arrived")
            seen.append(f"{t['id']} (hero{' and ' + str(figures) + ' pictures' if figures else ''})" if t["heroSeq"] else f"{t['id']} ({figures} pictures)")
            page.close()
            self.no_errors(f"scroll {t['id']}")
        expect(seen, "no theme has a picture that follows the scroll")
        return ", ".join(seen)

    def test_seal(self):
        coded = [t for t in self.themes() if not t["film"]]
        for t in coded:
            page = self.page()
            page.goto(self.url(f"i.html?demo={t['id']}&to=Anna"))
            page.wait_for_selector(".env3-seal")
            expect("Anna" in page.inner_text(".env3-addr"), f"{t['id']}: envelope is not addressed to the guest")
            self.open_envelope(page, film=False)
            page.close()
            self.no_errors(f"seal {t['id']}")
        return ", ".join(t["id"] for t in coded) or "no coded-envelope themes left"

    def test_lang(self):
        """A Swedish invitation: words, dates, two places, free sections, music, one meal choice per guest."""
        page = self.page()
        page.goto(self.url("i.html?demo=agapi&embed=1"))
        page.wait_for_selector(".story .ch-hero")
        expect(page.evaluate("document.documentElement.lang") == "sv", "page language is not Swedish")
        expect(page.locator(".ch-place").count() == 2, "expected two places (ceremony and dinner)")
        expect(page.locator(".ch-section").count() >= 6, "free-form sections are missing")
        hero = page.inner_text(".ch-hero")
        expect("LÖRDAGEN DEN 21 AUGUSTI 2027" in hero.upper(), "hero does not show the written date")
        labels = page.inner_text(".ch-countdown")
        expect("DAGAR" in labels.upper() and "DAYS" not in labels.upper(), f"countdown is not in Swedish: {labels!r}")
        expect(page.inner_text(".rf-send").strip().upper() == "SKICKA SVAR", "RSVP button is not in Swedish")
        expect("OSA SENAST" in page.inner_text(".rf-deadline").upper(), "reply-by line is not in Swedish")
        cal = page.get_attribute(".ch-place a[download]", "href")
        expect(cal and "DTSTART%3A20270821T150000Z" in cal, "calendar entry is not 18:00 Athens time (15:00 UTC)")
        directions = page.get_attribute(".place-0 .inv-cta a >> nth=0", "href")
        expect(directions.startswith("https://www.google.com/maps/search/"), "directions link is wrong")

        page.evaluate("document.querySelector('#rsvp').scrollIntoView({behavior: 'instant'})")
        expect(page.locator(".rf-perguest select").count() == 1, "one guest should have one meal choice")
        page.click(".rf-step button[data-d='1']")
        page.click(".rf-step button[data-d='1']")
        expect(page.locator(".rf-perguest select").count() == 3, "three guests should have three meal choices")
        page.select_option(".rf-perguest select >> nth=1", "Veganskt")
        page.click(".rf-step button[data-d='-1']")
        expect(page.locator(".rf-perguest select").count() == 2, "meal choices did not follow the guest count")
        expect(page.input_value(".rf-perguest select >> nth=1") == "Veganskt", "a guest's choice was lost when the count changed")
        page.click(".rf-attend label:has(input[value='no'])")
        expect(not page.is_visible(".rf-perguest"), "meal choice is still shown to a guest who declines")
        page.click(".rf-attend label:has(input[value='yes'])")

        page.locator(".music-card >> nth=0").scroll_into_view_if_needed()
        page.click(".music-card >> nth=0 >> .music-play")
        page.wait_for_selector(".music-card.is-open iframe[src*='open.spotify.com/embed/track/']", timeout=15000)
        page.click(".music-card >> nth=1 >> .music-play")
        page.wait_for_function("document.querySelectorAll('.music-card iframe').length === 1", timeout=15000)

        safe = page.evaluate("""[FiraInvite.safeUrl('javascript:alert(1)'), FiraInvite.safeUrl(' JaVaScRiPt:alert(1)'),
                                 FiraInvite.safeUrl('data:text/html,x'), FiraInvite.safeUrl('https://example.com/a'),
                                 FiraInvite.safeUrl('tel:+46701740605'), FiraInvite.safeUrl('media/x.jpg')]""")
        expect(safe == ["", "", "", "https://example.com/a", "tel:+46701740605", "media/x.jpg"], f"link filter is wrong: {safe}")
        page.close()
        self.no_errors("lang")
        return "Swedish words and dates, time zone, per-guest choices, music, link filter"

    def test_invite(self):
        """A published invitation, read only: nothing is sent, so a customer's guest list stays clean."""
        invite_id = self.invite_id
        status, doc = api("GET", f"/invites/{invite_id}")
        expect(status == 200, f"invitation {invite_id} is not readable (HTTP {status})")
        data = doc["data"]
        page = self.page()
        page.goto(self.url(f"i.html?id={invite_id}&to=" + urllib.parse.quote("Anna & Johan")))
        page.wait_for_selector(".env4-tap, .env3-seal")
        film = page.locator(".env4-tap").count() == 1
        expect("Anna & Johan" in page.inner_text(".env4-addr, .env3-addr"), "envelope is not addressed to the guest")
        self.open_envelope(page, film)
        expect((data.get("title") or "") in page.inner_text(".ch-hero"), "hero does not show the title")
        expect(page.evaluate("document.documentElement.lang") == (data.get("lang") or "en"), "page language does not match the invitation")
        chapters = page.locator(".ch").count()
        expect(chapters >= 5, f"only {chapters} chapters rendered")
        expect(page.locator("#rsvp .rf").count() == 1, "RSVP form missing")
        expect(page.input_value("input[name=guest_name]") == "Anna & Johan", "guest name is not prefilled")
        height = page.evaluate("document.documentElement.scrollHeight")
        for y in range(0, height, 600):
            page.evaluate("y => scrollTo({top: y, behavior: 'instant'})", y)
            page.wait_for_timeout(120)
        try:
            page.wait_for_function("[...document.images].every(i => i.complete)", timeout=20000)
        except Exception:
            pass
        pending = page.evaluate("[...document.images].filter(i => !(i.complete && i.naturalWidth > 0)).map(i => i.currentSrc || i.src)")
        broken = [u for u in pending if not served_as_image(u)]
        expect(not broken, f"images failed to load: {broken[:3]}")
        links = page.evaluate("[...document.querySelectorAll('.story a[href]')].map(a => a.getAttribute('href'))")
        bad = [h for h in links if not h.startswith(("https://", "http://", "tel:", "mailto:", "data:text/calendar", "index.html"))]
        expect(not bad, f"unexpected link targets: {bad[:3]}")
        page.close()
        self.no_errors("invite")
        return f"{invite_id}: {data.get('title')} · {data.get('template')} · {chapters} chapters, {len(links)} links, nothing sent"

    def test_flow(self):
        title = "E2E " + time.strftime("%m%d-%H%M%S")
        guest_name = "Testgäst Åsa"
        tmp = Path(tempfile.mkdtemp(prefix="fira-e2e-"))
        photos = {k: tmp / f"{k}.png" for k in ("main", "second", "attire")}
        for i, p in enumerate(photos.values()):
            write_png(p, tint=(190 - 40 * i, 120 + 30 * i, 110 + 40 * i))

        def upload(page, selector, file):
            with page.expect_file_chooser() as chooser:
                page.click(selector)
            chooser.value.set_files(str(file))
            page.wait_for_function(
                "s => getComputedStyle(document.querySelector(s)).backgroundImage.includes('/photos/')", arg=selector, timeout=30000
            )

        # -- host: build and publish
        host = self.page(1300, 900)
        host.goto(self.url("create.html?template=toscana"))
        host.wait_for_selector("#f_title")
        host.wait_for_function("document.getElementById('f_title').value !== ''")
        host.fill("#f_title", title)
        upload(host, "#ph_main", photos["main"])
        upload(host, "#ph_second", photos["second"])
        host.locator("details.ed-block", has=host.locator("#f_dcTitle")).locator("summary").click()
        before = host.locator("#dcImgList .ed-photo-row").count()
        host.click("#dcImgAdd")
        row = f"#dcImgList .ed-photo-row:nth-child({before + 1})"
        upload(host, row + " .thumb", photos["attire"])
        host.fill(row + " input", "Uploaded attire")
        host.click("#publishBtn")
        host.wait_for_selector("#shareModal:not([hidden])", timeout=30000)
        share, manage = host.input_value("#shareUrl"), host.input_value("#manageUrl")
        query = urllib.parse.parse_qs(urllib.parse.urlparse(manage).query)
        invite_id, key = query["id"][0], query["key"][0]
        record = [invite_id, key, False]
        self.created.append(record)
        expect(share.startswith(self.base + "/i.html?id=" + invite_id), "guest link has an unexpected shape")
        host.close()

        status, doc = api("GET", f"/invites/{invite_id}")
        expect(status == 200, f"published invitation not readable (HTTP {status})")
        data = doc["data"]
        ids = {"main": data.get("photoId"), "second": data.get("photo2Id"),
               "attire": ((data.get("dressCode") or {}).get("images") or [{}])[-1].get("photoId")}
        expect(all(ids.values()), f"published data is missing photo ids: { {k: bool(v) for k, v in ids.items()} }")
        for name, pid in ids.items():
            expect(api("GET", f"/photos/{pid}")[0] == 200, f"{name} photo is not served")

        # -- guest: open, read, answer
        guest = self.page()
        guest.goto(share + "&to=" + urllib.parse.quote(guest_name))
        guest.wait_for_selector(".env4-tap")
        expect(guest_name in guest.inner_text(".env4-addr"), "envelope is not addressed to the guest")
        self.open_envelope(guest, film=True)
        expect(title in guest.inner_text(".ch-hero"), "hero does not show the title")
        guest.wait_for_selector(".cta-pill.show", timeout=8000)
        guest.click(".cta-pill")
        try:
            guest.wait_for_function("Math.abs(document.querySelector('#rsvp').getBoundingClientRect().top) <= 40", timeout=15000)
        except Exception:
            where = guest.evaluate("({rsvpTop: Math.round(document.querySelector('#rsvp').getBoundingClientRect().top), scrollY: Math.round(scrollY), height: document.documentElement.scrollHeight})")
            raise Check(f"the RSVP button did not bring the form into view: {where}")
        for label, selector in (("main", ".ch-photo img"), ("second", ".rf-couple img"), ("attire", ".dc-img img >> nth=-1")):
            img = guest.locator(selector)
            img.scroll_into_view_if_needed()
            guest.wait_for_function("el => el.complete && el.naturalWidth > 0", arg=img.element_handle(), timeout=15000)
            expect(ids[label] in img.get_attribute("src"), f"{label} photo in the story is not the uploaded one")
        guest.evaluate("document.querySelector('#rsvp').scrollIntoView({behavior: 'instant'})")
        expect(guest.input_value("input[name=guest_name]") == guest_name, "guest name is not prefilled")
        guest.fill("input[name=email]", "asa@example.com")
        guest.click(".rf-step button[data-d='1']")
        guest.click(".rf-step button[data-d='1']")
        expect(guest.input_value("input[name=party_size]") == "3", "guest stepper did not reach 3")
        guest.click(".rf-multi[data-q='0'] label:has(input[value='Vegan'])")
        guest.click(".rf-multi[data-q='0'] label:has(input[value='Nut allergy'])")
        guest.click(".rf-radio[data-q='2'] label:has(input[value='Fish'])")
        guest.fill("input[data-q='3']", "ABBA – Dancing Queen")
        guest.fill("textarea[name=message]", "Vi kommer!")
        guest.locator(".rf-send").scroll_into_view_if_needed()
        guest.click(".rf-send")
        guest.wait_for_selector(".rf-done", timeout=20000)
        guest.wait_for_function("!document.querySelector('.cta-pill')", timeout=5000)
        guest.close()

        # -- host: dashboard, personal links, edit
        host = self.page(1300, 900)
        host.goto(manage)
        host.wait_for_selector(".dash-table", timeout=20000)
        table = host.inner_text(".dash-table")
        for needle in (guest_name, "asa@example.com", "Vegan, Nut allergy", "Fish", "Dancing Queen", "Vi kommer!"):
            expect(needle in table, f"dashboard is missing '{needle}'")
        stats = " ".join(host.inner_text(".stat-row").split())
        expect(stats.upper().startswith("1 YES 0 NO 3 GUESTS COMING 1 TOTAL"), f"dashboard totals are wrong: {stats}")
        host.click("text=Personalized guest links")
        host.fill("#plNames", "Anna & Johan\nFamiljen Berg")
        host.click("#plGen")
        links = host.locator("#plOut input")
        expect(links.count() == 2, f"expected 2 personal links, got {links.count()}")
        expect("&to=" + urllib.parse.quote("Anna & Johan", safe="") in links.first.input_value(), "personal link does not carry the name")
        host.click("text=Edit invitation")
        host.wait_for_function("t => document.getElementById('f_title') && document.getElementById('f_title').value === t", arg=title)
        host.fill("#f_subtitle", "edited by the suite")
        host.click("#ph_second", modifiers=["Shift"])  # remove the second photo
        host.click("#publishBtn")
        host.wait_for_function("document.getElementById('publishStatus').textContent.startsWith('Saved')", timeout=20000)
        host.close()

        status, doc = api("GET", f"/invites/{invite_id}")
        expect(status == 200 and doc["data"].get("subtitle") == "edited by the suite", "edit was not saved")
        expect(not doc["data"].get("photo2Id"), "removed photo is still referenced after the edit")
        expect(api("GET", f"/photos/{ids['second']}")[0] == 404, "removed photo is still stored after the edit")
        expect(api("GET", f"/photos/{ids['main']}")[0] == 200, "main photo was lost by the edit")
        expect(api("GET", f"/invites/{invite_id}/rsvps")[0] == 401, "guest list is readable without the host key")

        # -- delete: the invitation and everything that belonged to it
        expect(api("DELETE", f"/invites/{invite_id}", key)[0] == 200, "delete failed")
        record[2] = True
        expect(api("GET", f"/invites/{invite_id}")[0] == 404, "invitation still readable after delete")
        for name in ("main", "attire"):
            expect(api("GET", f"/photos/{ids[name]}")[0] == 404, f"{name} photo survived the delete")
        self.no_errors("flow")
        return f"invitation {invite_id}: publish, 3 photos, RSVP, dashboard, links, edit, delete"

    def cleanup(self):
        for record in self.created:
            if not record[2]:
                status, _ = api("DELETE", f"/invites/{record[0]}", record[1])
                print(f"  cleanup: deleted invitation {record[0]} (HTTP {status})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default="local", help="local (default), prod, or a full base URL")
    ap.add_argument("--only", default=",".join(GROUPS), help="comma-separated groups: " + ", ".join(GROUPS))
    ap.add_argument("--invite", default="", help="check this published invitation instead (read only, nothing is sent)")
    args = ap.parse_args()
    groups = ["invite"] if args.invite else [g.strip() for g in args.only.split(",") if g.strip()]
    unknown = [g for g in groups if g not in GROUPS + ("invite",)]
    if unknown:
        sys.exit(f"unknown group(s): {unknown}; choose from {GROUPS}")

    with contextlib.ExitStack() as stack:
        if args.base == "local":
            base = stack.enter_context(local_site())
        else:
            base = PROD if args.base == "prod" else args.base.rstrip("/")
        print(f"Fira e2e against {base} (API {API})")
        p = stack.enter_context(sync_playwright())
        browser = p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required"])
        suite = Suite(browser, base, args.invite)
        failed = 0
        try:
            for group in groups:
                started = time.time()
                try:
                    detail = getattr(suite, "test_" + group)()
                    print(f"PASS {group:<7} {time.time() - started:5.1f}s  {detail}")
                except Check as e:
                    failed += 1
                    print(f"FAIL {group:<7} {time.time() - started:5.1f}s  {e}")
                except Exception as e:
                    failed += 1
                    own = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == __file__]
                    where = f"e2e.py:{own[-1].lineno} `{own[-1].line}`" if own else "outside e2e.py"
                    print(f"FAIL {group:<7} {time.time() - started:5.1f}s  {type(e).__name__}: {str(e).splitlines()[0][:200]} ({where})")
                suite.errors = []
        finally:
            suite.cleanup()
            browser.close()
    print("RESULT:", "all groups passed" if not failed else f"{failed} group(s) failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
