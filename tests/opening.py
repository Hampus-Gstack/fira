#!/usr/bin/env python3
"""Look at an opening: one sheet of screenshots per run.

Run from the repo root, in the FOREGROUND:

    python tests/opening.py chateau                       # sealed, the film second by second, the landing,
                                                          # the hero under the scroll, every picture under the scroll
    python tests/opening.py chateau --handover            # the seconds around the hand-over from film to loop
    python tests/opening.py agapi --engine webkit         # chromium (default), webkit or firefox
    python tests/opening.py agapi --desktop               # 1440x900 instead of 430x860
    python tests/opening.py agapi --query "id=<invite>"   # a published invitation instead of the theme's sample
    python tests/opening.py agapi --file ../customers/x/invitation.json   # an invitation that is not published yet
    python tests/opening.py agapi --story                 # every chapter of the story instead of the opening
    python tests/opening.py agapi --base prod

--file shows an invitation from its file, on the local site only. Its pictures (keys ending in "File") are
copied to site/_preview/, which git ignores, and removed again afterwards.

Nothing is sent: it opens, watches and scrolls. Writes <out>/<theme>-<engine>-<view>[-handover].png
(default out: ../.tmp/opening). A passing e2e run says nothing about how an opening looks: read the sheet.
"""
import argparse
import contextlib
import math
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from e2e import PROD, REPO, local_site  # noqa: E402

FILM = "document.querySelector('.hero-film, .env4-film')"
PREVIEW = REPO / "site" / "_preview"


def from_file(path):
    """The invitation in a file, with its local pictures made reachable for the local site."""
    import json
    path = Path(path).resolve()
    data = json.loads(path.read_text())
    shutil.rmtree(PREVIEW, ignore_errors=True)
    PREVIEW.mkdir(parents=True)
    count = [0]

    def walk(node, top):
        if isinstance(node, dict):
            for key in list(node):
                value = node[key]
                if key.endswith("File") and isinstance(value, str):
                    count[0] += 1
                    name = f"{count[0]:02d}{Path(value).suffix}"
                    shutil.copyfile(path.parent / value, PREVIEW / name)
                    del node[key]
                    stem = key[:-4]                       # photo, photo2
                    target = (stem + "Url") if top else ("url" if "caption" in node or stem != "photo" else "imageUrl")
                    node[target] = "_preview/" + name
                else:
                    walk(value, False)
        elif isinstance(node, list):
            for value in node:
                walk(value, False)

    walk(data, True)
    return data


def sheet(frames, out, columns, width):
    count = len(list(frames.glob("*.png")))
    ffmpeg = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
    subprocess.run(
        [ffmpeg, "-v", "error", "-y", "-framerate", "1", "-pattern_type", "glob", "-i", str(frames / "*.png"),
         "-vf", f"scale={width}:-1,tile={columns}x{math.ceil(count / columns)}:padding=4:color=white", "-frames:v", "1", str(out)],
        check=True,
    )
    shutil.rmtree(frames, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("theme")
    ap.add_argument("--engine", default="chromium", choices=["chromium", "webkit", "firefox"])
    ap.add_argument("--desktop", action="store_true")
    ap.add_argument("--handover", action="store_true")
    ap.add_argument("--query", default="")
    ap.add_argument("--file", default="")
    ap.add_argument("--story", action="store_true")
    ap.add_argument("--base", default="local")
    ap.add_argument("--guest", default="Anna & Johan")
    ap.add_argument("--out", default=os.environ.get("FIRA_TMP", str(REPO.parent / ".tmp")) + "/opening")
    a = ap.parse_args()
    view = "desktop" if a.desktop else "phone"
    viewport = {"width": 1440, "height": 900} if a.desktop else {"width": 430, "height": 860}
    query = a.query or f"demo={a.theme}"
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    name = f"{a.theme}-{a.engine}-{view}" + ("-handover" if a.handover else "-story" if a.story else "")
    data = from_file(a.file) if a.file else None
    if data is not None and a.base != "local":
        sys.exit("--file works on the local site only")
    frames = out / ("_" + name)
    shutil.rmtree(frames, ignore_errors=True)
    frames.mkdir(parents=True)

    with contextlib.ExitStack() as stack:
        base = stack.enter_context(local_site()) if a.base == "local" else (PROD if a.base == "prod" else a.base.rstrip("/"))
        p = stack.enter_context(sync_playwright())
        args = ["--autoplay-policy=no-user-gesture-required"] if a.engine == "chromium" else []
        browser = getattr(p, a.engine).launch(headless=True, args=args)
        page = browser.new_context(viewport=viewport, device_scale_factor=1 if (a.desktop or a.handover) else 2).new_page()
        errors, notes = [], []
        page.on("pageerror", lambda e: errors.append(str(e)[:200]))
        page.on("console", lambda m: errors.append(m.text[:200]) if m.type == "error" else None)

        def shot(note):
            page.screenshot(path=str(frames / f"{len(notes):02d}.png"))
            notes.append(note)

        def show(envelope):
            if data is None:
                page.goto(f"{base}/i.html?{query}&to=" + quote(a.guest) + ("" if envelope else "&embed=1"))
                return
            page.goto(f"{base}/i.html?demo={a.theme}&embed=1")
            page.wait_for_selector(".story .ch-hero")
            page.evaluate("([d, guest, envelope]) => FiraInvite.render(d, document.getElementById('mount'), { guestName: guest, skipEnvelope: !envelope })",
                          [data, a.guest, envelope])

        if a.story:
            show(False)
            page.wait_for_selector(".story .ch-hero")
            page.wait_for_timeout(4500)
            shot("hero")
            hold = page.evaluate("(() => { const h = document.querySelector('.ch-hero'); return Math.max(0, Math.round(h.getBoundingClientRect().height - innerHeight)); })()")
            tops = page.evaluate("[...document.querySelectorAll('.ch')].slice(1).map(c => ({ top: Math.round(c.getBoundingClientRect().top + scrollY), height: Math.round(c.getBoundingClientRect().height), name: (c.dataset.ch || '') + (c.dataset.key ? ':' + c.dataset.key : '') }))")
            for c in tops:
                steps = max(1, math.ceil(c["height"] / (viewport["height"] * 0.8)))
                for k in range(steps):
                    page.evaluate("y => scrollTo({top: y, behavior: 'instant'})", c["top"] + k * viewport["height"] * 0.8)
                    page.wait_for_timeout(1300)
                    shot(c["name"] + (f" ({k + 1}/{steps})" if steps > 1 else ""))
            browser.close()
            target = out / f"{name}.png"
            sheet(frames, target, 4 if a.desktop else 8, 500 if a.desktop else 250)
            for i, note in enumerate(notes):
                print(f"{i:2d}  {note}")
            print("errors:", errors[:5] if errors else "none")
            print(f"sheet: {target}")
            shutil.rmtree(PREVIEW, ignore_errors=True)
            return

        show(True)
        page.wait_for_selector(".env4-tap")
        page.wait_for_function(f"!!({FILM} || {{}}).currentSrc", timeout=30000)
        page.wait_for_function(f"({FILM} || {{}}).readyState >= 3", timeout=60000)
        page.wait_for_timeout(2500)
        played = page.evaluate(f"{FILM}.currentSrc.split('/').pop()")
        state = """() => { const f = document.querySelector('.hero-film, .env4-film'), v = document.querySelector('.hero-video'), h = document.querySelector('.ch-hero');
                     return 'film ' + (f ? f.currentTime.toFixed(2) + ' opacity ' + getComputedStyle(f).opacity : 'gone')
                          + (v ? ', loop ' + v.currentTime.toFixed(2) + (v.paused ? ' paused' : '') : '')
                          + (h && h.classList.contains('held') ? ', names held' : '')
                          + (document.documentElement.classList.contains('sealed') ? ', page sealed' : ''); }"""

        if a.handover:
            page.click(".env4-tap")
            started = time.time()
            while time.time() - started < 11.5:
                if time.time() - started < 5.4:
                    page.wait_for_timeout(100)
                    continue
                shot(f"{time.time() - started:5.2f} s  " + page.evaluate(state))
                page.wait_for_timeout(180)
        else:
            shot("sealed")
            page.click(".env4-tap")
            started = time.time()
            for at in (0.8, 1.8, 2.8, 3.6, 4.4, 5.2, 6.0, 6.8, 7.6, 8.6, 10.5):
                wait = at - (time.time() - started)
                if wait > 0:
                    page.wait_for_timeout(int(wait * 1000))
                shot(f"{at:4.1f} s  " + page.evaluate(state))
            hero = page.evaluate(
                """() => { const h = document.querySelector('.ch-hero'); return { staged: h.classList.contains('hero-staged'),
                           range: Math.round(h.getBoundingClientRect().height - innerHeight) }; }"""
            )
            if hero["staged"] and hero["range"] > 10:
                with contextlib.suppress(Exception):
                    page.wait_for_function("(() => { const c = document.querySelector('.hero-seq-film'); return !c || c.width > 0; })()", timeout=20000)
                page.wait_for_timeout(2500)
                # a hero that is held for long tells a story of its own: look at more of it
                long = hero["range"] > viewport["height"] * 1.5
                parts = (0.05, 0.15, 0.25, 0.33, 0.4, 0.44, 0.48, 0.52, 0.58, 0.66, 0.76, 0.86, 0.94, 1.0) if long else (0.12, 0.3, 0.5, 0.7, 0.9, 1.0)
                for part in parts:
                    page.evaluate("y => scrollTo({top: y, behavior: 'instant'})", hero["range"] * part)
                    page.wait_for_timeout(900)
                    shot(f"hero held, {int(part * 100)} % of its scroll")
            figures = page.evaluate("[...document.querySelectorAll('.venue-art')].map(f => Math.round(f.getBoundingClientRect().top + scrollY))")
            for i, top in enumerate(figures):
                for part in (0.0, 0.35, 0.7, 1.0):
                    page.evaluate("y => scrollTo({top: y, behavior: 'instant'})", max(0, top - viewport["height"] * 0.94 + part * viewport["height"] * 0.62))
                    page.wait_for_timeout(1500 if part == 0 else 800)
                    shot(f"picture {i + 1} at {int(part * 100)} %: " + page.evaluate(
                        "i => document.querySelectorAll('.venue-art')[i].className.replace('venue-art', '').replace('reveal', '').trim()", i))
        browser.close()
    shutil.rmtree(PREVIEW, ignore_errors=True)

    target = out / f"{name}.png"
    columns = (5 if a.desktop else 10) if a.handover else (4 if a.desktop else 8)
    width = (400 if a.desktop else 200) if a.handover else (500 if a.desktop else 250)
    sheet(frames, target, columns, width)
    print(f"film played: {played}")
    for i, note in enumerate(notes):
        print(f"{i:2d}  {note}")
    print("errors:", errors[:5] if errors else "none")
    print(f"sheet: {target}")


if __name__ == "__main__":
    main()
