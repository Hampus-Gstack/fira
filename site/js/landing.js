/* Fira landing page: theme gallery, reveals, and the opening film tied to scroll.
   Without JavaScript, or with reduced motion, the page reads as written: a still envelope and the captions. */
(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const WIDE = window.matchMedia("(min-width: 981px)");
  const FINE = window.matchMedia("(hover: hover) and (pointer: fine)");
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const ease = (x) => x * x * (3 - 2 * x);

  // A line through the given [x, y] points, flat before the first and after the last.
  function through(points) {
    return (x) => {
      if (x <= points[0][0]) return points[0][1];
      for (let i = 1; i < points.length; i++) {
        const [x1, y1] = points[i], [x0, y0] = points[i - 1];
        if (x < x1) return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
      }
      return points[points.length - 1][1];
    };
  }

  // Write a style only when it changes: the loop below runs on every frame.
  const last = new WeakMap();
  function put(el, name, value) {
    let seen = last.get(el);
    if (!seen) last.set(el, (seen = {}));
    if (seen[name] === value) return;
    seen[name] = value;
    el.style.setProperty(name, value);
  }

  // ------------------------------------------------------------------ gallery
  function gallery() {
    const grid = document.getElementById("tplGrid");
    if (!grid || !window.FIRA_TEMPLATES) return;
    Object.values(window.FIRA_TEMPLATES).forEach((t, i) => {
      const s = window.FIRA_SAMPLES[t.id];
      const a = document.createElement("a");
      a.className = "tpl-card rv";
      a.style.setProperty("--d", (i % 3) * 90 + "ms");
      a.href = "i.html?demo=" + t.id;
      const poster = t.opening && (t.opening.thumb || t.opening.hero);
      a.innerHTML = `
        <div class="tpl-thumb" style="background:${t.swatch[0]};color:${poster ? "#fff" : t.swatch[1]}">
          ${poster ? `<img src="${poster}" alt="" loading="lazy" decoding="async">` : ""}
          <span class="tpl-title" style="font-family:Fraunces,serif;${poster ? "text-shadow:0 2px 14px rgba(0,0,0,0.55)" : ""}">${s.title}</span>
        </div>
        <div class="tpl-meta">
          <div><b>${t.name}</b><br><span>${t.occasion}</span></div>
          <div class="tpl-swatches">${t.swatch.map((c) => `<i style="background:${c}"></i>`).join("")}</div>
        </div>`;
      grid.appendChild(a);
    });
  }

  // ------------------------------------------------------------------ reveals
  function reveals() {
    const items = document.querySelectorAll(".rv");
    const settle = (el) => el.classList.remove("rv", "in");   // back to the element's own transitions (hover)
    if (REDUCED || !("IntersectionObserver" in window)) { items.forEach(settle); return; }
    const seen = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        seen.unobserve(e.target);
        e.target.classList.add("in");
        e.target.addEventListener("transitionend", () => settle(e.target), { once: true });
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach((el) => seen.observe(el));
  }

  // ------------------------------------------------------------------ the opening, tied to scroll
  function story() {
    const root = document.querySelector(".film");
    if (!root) return;
    const phone = root.querySelector(".phone");
    const canvas = root.querySelector(".phone-film");
    const live = root.querySelector(".phone-live");
    const still = root.querySelector(".phone-still");
    const steps = root.querySelector(".film-steps");
    const caps = Array.from(root.querySelectorAll(".film-step"));
    if (REDUCED || !canvas || !canvas.getContext || !window.FiraScrollFilm) return;

    root.classList.add("film-live");
    const film = new window.FiraScrollFilm(canvas, root.dataset.film);

    // Beats: 0 is the top of the page, 1 is the first caption at rest, 2 the second, and so on.
    const FILM = through([[0.05, 0], [1, 0.34], [2, 0.8], [2.6, 1]]);     // how far the film has run
    const FADE = through([[2.6, 0], [3, 1]]);                             // 0 the film, 1 the invitation

    let anchors = [0, 1];
    let rail = { top: 0, height: 1 };
    let vh = window.innerHeight, wide = WIDE.matches;
    let at = 0;          // the beat the scroll is on
    let shown = 0;       // the beat on screen: it trails the scroll a little, which reads as weight
    let active = true, raf = 0;
    let tiltX = 0, tiltY = 0, aimX = 0, aimY = 0;
    const tour = { asked: false, ready: false, replayed: false };

    function measure() {
      const y = window.scrollY;
      vh = window.innerHeight; wide = WIDE.matches;
      anchors = [0];
      caps.forEach((el) => {
        const r = el.getBoundingClientRect();
        // Wide: the caption is centred on screen. Narrow: its card rests at the bottom of the screen.
        const rest = wide ? r.top + y + r.height / 2 - vh / 2 : r.top + y + r.height * 0.6 - vh;
        anchors.push(Math.max(anchors[anchors.length - 1] + 1, rest));
      });
      anchors.push(anchors[anchors.length - 1] + (caps.length ? caps[caps.length - 1].offsetHeight : vh));
      const box = steps.getBoundingClientRect();
      rail = { top: box.top + y, height: Math.max(1, box.height - parseFloat(getComputedStyle(steps).paddingBottom)) };
      film.resize();
    }

    function beat(y) {
      if (y <= 0) return 0;
      for (let i = 1; i < anchors.length; i++) {
        if (y < anchors[i]) return i - 1 + (y - anchors[i - 1]) / (anchors[i] - anchors[i - 1]);
      }
      return anchors.length - 1;
    }

    function scrollFor(b) {                       // the scroll position of a beat
      const i = Math.min(anchors.length - 2, Math.floor(b));
      return anchors[i] + (anchors[i + 1] - anchors[i]) * (b - i);
    }

    // ---- the invitation itself, inside the phone, scrolled by the page
    function askLive() {
      if (tour.asked || !live) return;
      tour.asked = true;
      if (still && still.dataset.src) still.src = still.dataset.src;
      live.src = live.dataset.src;
      // Ready means: the story is drawn and its display font has arrived. Waiting for the frame's load
      // event instead would wait for the hero video too, which takes long on a slow connection.
      let tries = 0;
      const look = () => {
        let doc = null, win = null;
        try { doc = live.contentDocument; win = live.contentWindow; } catch (e) { return; }   // not ours to read: the still stays
        const title = doc && doc.querySelector(".story .ch-hero .inv-title");
        const fonts = doc && doc.querySelector('link[id^="f-"]');
        if (!title || (fonts && !fonts.sheet && tries < 40)) {
          if (tries++ < 240) setTimeout(look, 250);
          return;
        }
        const style = doc.createElement("style");
        style.textContent = "html{scrollbar-width:none}html::-webkit-scrollbar{display:none}" +
          ".cta-pill,.fs-toggle,.snd-toggle,.story-progress{display:none!important}";
        doc.head.appendChild(style);
        ["venue", "rsvp"].forEach((name) => {         // the chapters the tour stops at: fetch their pictures now
          doc.querySelectorAll('.ch[data-ch="' + name + '"] img[loading="lazy"]').forEach((img) => { img.loading = "eager"; });
        });
        let done = false;
        const ready = () => { if (done) return; done = true; tour.ready = true; root.classList.add("live-ready"); };
        const family = win.getComputedStyle(title).fontFamily.split(",")[0];
        if (doc.fonts && doc.fonts.load) doc.fonts.load("40px " + family).then(ready, ready); else ready();
        setTimeout(ready, 4000);
      };
      look();
    }

    function tourTo(s) {
      const doc = live.contentDocument, win = live.contentWindow;
      const h = win.innerHeight;
      const points = [[3.35, 0]];
      const stop = (beatAt, name, shift) => {
        const el = doc.querySelector('.ch[data-ch="' + name + '"]');
        if (!el) return;
        const y = Math.max(0, el.getBoundingClientRect().top + win.scrollY + shift * h);
        if (y >= points[points.length - 1][1]) points.push([beatAt, y]);
      };
      stop(3.85, "countdown", -0.05);   // caption 4: countdown and schedule, then the way there
      stop(4.1, "schedule", -0.25);
      stop(4.4, "venue", 0.47);
      stop(4.72, "rsvp", 0.05);         // caption 5: the reply form
      stop(5.0, "rsvp", 0.3);
      stop(5.4, "rsvp", 0.62);
      win.scrollTo({ top: Math.round(through(points)(s)), behavior: "instant" });
    }

    function replayHero() {                       // let the names arrive again as the light fades
      try {
        const hero = live.contentDocument.querySelector(".ch-hero");
        if (!hero || !hero.getAnimations) return;
        hero.getAnimations({ subtree: true }).forEach((a) => { a.cancel(); a.play(); });
      } catch (e) { /* nothing to replay */ }
    }

    // ---- one frame
    function paint(s) {
      const p = FILM(s), x = FADE(s);
      const index = film.count ? film.draw(p * (film.count - 1)) : -1;
      root.classList.toggle("film-running", index >= 0 && p > 0.002);
      put(root, "--over", (1 - clamp((p - 0.02) / 0.1)).toFixed(3));
      put(root, "--fade", x.toFixed(3));
      const light = index >= 0 ? clamp(((film.luma[index] || 0) - 0.27) / 0.5) : 0;
      put(root, "--glow", (light * (1 - 0.75 * x)).toFixed(3));
      put(steps, "--run", clamp((window.scrollY + vh / 2 - rail.top) / rail.height).toFixed(4));
      // Wide: captions scroll past, so they fade as they near the edge. Narrow: a card rests at the bottom
      // of the screen for three quarters of its beat and is gone before the next one arrives.
      const reach = wide ? 0.62 : 0.42, soft = wide ? 0.2 : 0.1;
      caps.forEach((el, i) => {
        let o = clamp((reach - Math.abs(s - (i + 1))) / soft);
        if (i === caps.length - 1 && s > i + 1) o = 1;          // the last one leaves with the page
        put(el, "--o", o.toFixed(3));
      });

      if (s > 1.1 || (film.count && film.loaded >= film.count * 0.6)) askLive();
      if (tour.ready) {
        if (x > 0.02 && !tour.replayed) { tour.replayed = true; replayHero(); }
        if (s < 2.2) tour.replayed = false;
        if (x > 0) tourTo(s);
      }

      if (wide && FINE.matches) {
        tiltX += (aimX - tiltX) * 0.08; tiltY += (aimY - tiltY) * 0.08;
        put(phone, "--rx", tiltX.toFixed(2) + "deg");
        put(phone, "--ry", tiltY.toFixed(2) + "deg");
      }
    }

    function tick() {
      raf = 0;
      at = beat(window.scrollY);
      const gap = at - shown;
      shown = Math.abs(gap) > 1.6 || Math.abs(gap) < 0.0006 ? at : shown + gap * 0.17;   // a jump lands at once
      paint(shown);
      if (active) raf = requestAnimationFrame(tick);
    }
    const wake = () => { if (active && !raf) raf = requestAnimationFrame(tick); };

    // ---- tap the envelope: the page scrolls itself and the envelope opens
    function glide(to, ms) {
      const from = window.scrollY, began = performance.now();
      const html = document.documentElement;
      let stopped = false;
      const stop = () => { stopped = true; html.style.scrollBehavior = ""; };
      ["wheel", "touchstart", "keydown"].forEach((name) => window.addEventListener(name, stop, { once: true, passive: true }));
      html.style.scrollBehavior = "auto";         // each step below must land at once
      const step = (now) => {
        if (stopped) return;
        const k = clamp((now - began) / ms);
        window.scrollTo(0, from + (to - from) * ease(k));
        if (k < 1) requestAnimationFrame(step); else stop();
      };
      requestAnimationFrame(step);
    }
    const open = (e) => {
      e.preventDefault();
      if (shown > 2.4) return;
      glide(scrollFor(3), 4200 * clamp((3 - shown) / 3, 0.35, 1));
    };
    phone.addEventListener("click", open);
    root.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", open));

    window.addEventListener("pointermove", (e) => {
      aimY = (e.clientX / window.innerWidth - 0.5) * 9;
      aimX = (0.5 - e.clientY / window.innerHeight) * 6;
    }, { passive: true });

    new IntersectionObserver((entries) => {
      active = entries[0].isIntersecting;
      wake();
    }, { rootMargin: "20% 0px 20% 0px" }).observe(root);

    let settle = 0;
    const remeasure = () => { clearTimeout(settle); settle = setTimeout(() => { measure(); wake(); }, 120); };
    window.addEventListener("resize", remeasure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    if (WIDE.addEventListener) WIDE.addEventListener("change", remeasure);

    // The page's own images and fonts go first, the frames of the film right after.
    const start = () => {
      measure();
      film.load().then(() => { measure(); wake(); }).catch(() => root.classList.add("film-failed"));
    };
    if (document.readyState === "complete") start(); else window.addEventListener("load", start);

    measure();
    shown = at = beat(window.scrollY);
    wake();

    window.FiraLanding = { film, beat: () => shown, scrollFor };   // for the test suite
  }

  gallery();
  reveals();
  story();
})();
