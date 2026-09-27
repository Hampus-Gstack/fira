#!/usr/bin/env python3
"""Fira end-to-end suite: Playwright, headless Chromium, real API.

Run from the repo root with a Python that has Playwright installed, in the FOREGROUND
(the Playwright driver hangs when its process is backgrounded):

    python tests/e2e.py                      # local: serves site/ on 127.0.0.1:8090, talks to the live API
    python tests/e2e.py --base prod          # the deployed site
    python tests/e2e.py --only pages,film    # any of: pages, film, seal, flow

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
GROUPS = ("pages", "film", "seal", "flow")


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


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@contextlib.contextmanager
def local_site():
    base = f"http://127.0.0.1:{PORT}"
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(QuietHandler, directory=str(SITE)))
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
    def __init__(self, browser, base):
        self.browser = browser
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
                     sample: !!FIRA_SAMPLES[t.id] }))"""
            )
            page.close()
            expect(len(self._themes) >= 8, f"expected at least 8 themes, found {len(self._themes)}")
            expect(all(t["sample"] for t in self._themes), "a theme has no sample data")
        return self._themes

    def open_envelope(self, page, film):
        if film:
            page.wait_for_selector(".env4-tap")
            page.wait_for_function("document.querySelector('.env4-film').readyState >= 3", timeout=45000)
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
            broken = page.evaluate(
                "[...document.images].filter(i => !(i.complete && i.naturalWidth > 0)).map(i => i.currentSrc || i.src)"
            )
            expect(not broken, f"{t['id']}: images failed to load: {broken[:3]}")
            page.close()
            self.no_errors(f"story {t['id']}")
        return f"{len(self.themes())} theme stories, 3 site pages"

    def test_film(self):
        films = [t for t in self.themes() if t["film"]]
        expect(films, "no theme has an opening film")
        for t in films:
            page = self.page()
            page.goto(self.url(f"i.html?demo={t['id']}&to=" + urllib.parse.quote("Anna & Johan")))
            page.wait_for_selector(".env4-tap")
            expect("Anna & Johan" in page.inner_text(".env4-addr"), f"{t['id']}: envelope is not addressed to the guest")
            expect(page.is_visible(".env4-sound"), f"{t['id']}: sound hint missing on the sealed envelope")
            expect(page.is_visible(".env4-hint"), f"{t['id']}: tap hint missing")
            page.wait_for_function("document.querySelector('.env4-film').readyState >= 3", timeout=45000)
            expect(page.evaluate("document.querySelector('.env4-film').paused"), f"{t['id']}: film plays before the tap")
            page.click(".env4-tap")
            page.wait_for_timeout(1600)
            state = page.evaluate(
                """(() => { const f = document.querySelector('.env4-film');
                     const o = s => parseFloat(getComputedStyle(document.querySelector(s)).opacity);
                     return { t: f.currentTime, muted: f.muted, addr: o('.env4-addr'), hint: o('.env4-hint'),
                              sound: o('.env4-sound'), toggle: document.querySelector('.snd-toggle').classList.contains('on') }; })()"""
            )
            expect(state["t"] > 0.5, f"{t['id']}: film did not start ({state['t']:.2f}s)")
            expect(not state["muted"] and state["toggle"], f"{t['id']}: film did not start with sound on")
            for key in ("addr", "hint", "sound"):
                expect(state[key] < 0.15, f"{t['id']}: envelope overlay '{key}' still visible during the film (opacity {state[key]:.2f})")
            page.wait_for_function("!document.querySelector('.env4')", timeout=30000)
            page.wait_for_selector(".story .ch-hero")
            if t["heroVideo"]:
                try:
                    page.wait_for_function("(document.querySelector('.hero-video') || {}).currentTime > 0.5", timeout=20000)
                except Exception:
                    state = page.evaluate(
                        """(() => { const v = document.querySelector('.hero-video');
                             return v ? { t: v.currentTime, ready: v.readyState, net: v.networkState, paused: v.paused,
                                          error: v.error && v.error.code, visible: v.getBoundingClientRect().height > 0 } : 'no .hero-video element'; })()"""
                    )
                    raise Check(f"{t['id']}: hero video is not playing: {state}")
            page.wait_for_selector(".cta-pill.show", timeout=8000)
            page.close()
            self.no_errors(f"film {t['id']}")
        return ", ".join(t["id"] for t in films)

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
            guest.wait_for_function("document.querySelector('#rsvp').getBoundingClientRect().top < innerHeight * 0.6", timeout=12000)
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
    args = ap.parse_args()
    groups = [g.strip() for g in args.only.split(",") if g.strip()]
    unknown = [g for g in groups if g not in GROUPS]
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
        suite = Suite(browser, base)
        failed = 0
        try:
            for group in groups:
                started = time.time()
                try:
                    detail = getattr(suite, "test_" + group)()
                    print(f"PASS {group:<6} {time.time() - started:5.1f}s  {detail}")
                except Check as e:
                    failed += 1
                    print(f"FAIL {group:<6} {time.time() - started:5.1f}s  {e}")
                except Exception as e:
                    failed += 1
                    own = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == __file__]
                    where = f"e2e.py:{own[-1].lineno} `{own[-1].line}`" if own else "outside e2e.py"
                    print(f"FAIL {group:<6} {time.time() - started:5.1f}s  {type(e).__name__}: {str(e).splitlines()[0][:200]} ({where})")
                suite.errors = []
        finally:
            suite.cleanup()
            browser.close()
    print("RESULT:", "all groups passed" if not failed else f"{failed} group(s) failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
