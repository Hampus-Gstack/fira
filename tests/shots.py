#!/usr/bin/env python3
"""Review sheets: one image per theme showing the sealed envelope and every chapter.

Run from the repo root, in the FOREGROUND:

    python tests/shots.py                              # every theme, phone viewport, local site
    python tests/shots.py --themes chateau,toscana
    python tests/shots.py --base prod --desktop        # 1440x900 instead of 430x860
    python tests/shots.py --film                       # also capture three frames of the opening film

Writes <out>/<theme>-<viewport>.png (default out: ../.tmp/shots, override with --out or FIRA_TMP).
Look at the sheets before calling visual work done: a passing e2e run says nothing about how it looks.
"""
import argparse
import contextlib
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from e2e import PROD, REPO, local_site  # noqa: E402


def sheet(frames_dir, out, columns=6, width=300):
    frames = sorted(frames_dir.glob("*.png"))
    ffmpeg = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
    if not Path(ffmpeg).exists():
        print(f"  ffmpeg not found; frames left in {frames_dir}")
        return None
    cols = min(columns, len(frames))
    rows = math.ceil(len(frames) / cols)
    subprocess.run(
        [ffmpeg, "-v", "error", "-y", "-framerate", "1", "-pattern_type", "glob", "-i", str(frames_dir / "*.png"),
         "-vf", f"scale={width}:-1,tile={cols}x{rows}:padding=4:color=white", "-frames:v", "1", str(out)],
        check=True,
    )
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default="local")
    ap.add_argument("--themes", default="")
    ap.add_argument("--desktop", action="store_true")
    ap.add_argument("--film", action="store_true")
    ap.add_argument("--guest", default="Anna & Johan")
    ap.add_argument("--out", default=os.environ.get("FIRA_TMP", str(REPO.parent / ".tmp")) + "/shots")
    args = ap.parse_args()
    viewport = {"width": 1440, "height": 900} if args.desktop else {"width": 430, "height": 860}
    tag = "desktop" if args.desktop else "phone"
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    with contextlib.ExitStack() as stack:
        base = stack.enter_context(local_site()) if args.base == "local" else (PROD if args.base == "prod" else args.base.rstrip("/"))
        p = stack.enter_context(sync_playwright())
        browser = p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required"])
        page = browser.new_page(viewport=viewport)
        page.set_default_timeout(30000)
        page.goto(f"{base}/index.html")
        page.wait_for_function("window.FIRA_TEMPLATES")
        themes = page.evaluate("Object.values(FIRA_TEMPLATES).map(t => ({id: t.id, film: !!(t.opening && t.opening.video)}))")
        wanted = [t.strip() for t in args.themes.split(",") if t.strip()]
        missing = [t for t in wanted if t not in [x["id"] for x in themes]]
        if missing:
            sys.exit(f"unknown theme(s): {missing}")
        from urllib.parse import quote
        for theme in themes:
            if wanted and theme["id"] not in wanted:
                continue
            frames = out / f"_{theme['id']}-{tag}"
            shutil.rmtree(frames, ignore_errors=True)
            frames.mkdir(parents=True)
            n = 0

            def shot(name):
                nonlocal n
                page.screenshot(path=str(frames / f"{n:02d}_{name}.png"))
                n += 1

            page.goto(f"{base}/i.html?demo={theme['id']}&to={quote(args.guest)}")
            page.wait_for_selector(".env4-tap, .env3-seal")
            if theme["film"]:
                page.wait_for_function("document.querySelector('.env4-film').readyState >= 3", timeout=45000)
            page.wait_for_timeout(2800)
            shot("sealed")
            if theme["film"] and args.film:
                page.click(".env4-tap")
                for label, wait in (("film-a", 1800), ("film-b", 2200), ("film-c", 2400)):
                    page.wait_for_timeout(wait)
                    shot(label)
            page.goto(f"{base}/i.html?demo={theme['id']}&embed=1")
            page.wait_for_selector(".story .ch-hero")
            page.wait_for_timeout(3800)
            shot("hero")
            count = page.locator(".ch").count()
            for i in range(1, count):
                page.evaluate("i => document.querySelectorAll('.ch')[i].scrollIntoView({behavior: 'instant'})", i)
                page.wait_for_timeout(1000)
                shot(page.evaluate("i => document.querySelectorAll('.ch')[i].dataset.ch || 'chapter'", i))
            target = sheet(frames, out / f"{theme['id']}-{tag}.png", columns=4 if args.desktop else 6, width=480 if args.desktop else 300)
            if target:
                shutil.rmtree(frames, ignore_errors=True)
                print(f"{theme['id']}: {n} frames -> {target}")
        browser.close()


if __name__ == "__main__":
    main()
