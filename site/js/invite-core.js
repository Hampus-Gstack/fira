// Fira invitation engine v6.
//
// An invitation is one JSON document. It is shown as a sealed envelope (a film whose first
// frame is the envelope, or a coded envelope for themes without a film) that opens into a
// story made of chapters:
//
//   hero · photo · message · countdown · details · venue · place:<n> · schedule · dresscode
//   gifts · menu · accommodation · faq · contact · music · section:<key> · rsvp
//
// The order comes from the invitation (`chapters`), else the theme, else DEFAULT_ORDER.
// A chapter renders only when the invitation has data for it. Words come from i18n.js.
// Everything a host can type is escaped, and links are limited to http(s), mailto and tel.
(function () {
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const API = () => window.FIRA_CONFIG.API_BASE;

  // ---------- words ----------
  let LBL = {};
  function buildLabels(data, theme) {
    const packs = window.FIRA_I18N || { en: {} };
    const lang = packs[data.lang] ? data.lang : "en";
    const themeWords = lang === "en" ? (theme.labels || {}) : ((theme.i18n || {})[lang] || {});
    LBL = Object.assign({}, packs.en, lang === "en" ? {} : packs[lang], themeWords, data.labels || {});
    LBL._lang = lang;
  }
  const word = (key, fallback) => (LBL[key] != null && LBL[key] !== "" ? LBL[key] : (fallback != null ? fallback : ""));
  const T = (key, fallback) => esc(word(key, fallback));

  // ---------- host-provided values ----------
  function safeUrl(u) {
    const s = String(u == null ? "" : u).trim();
    if (!s) return "";
    if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return "";   // javascript:, data: and every other scheme
    return s.startsWith("//") ? "https:" + s : s;     // a path on this site
  }
  const safeColor = (c) => {
    const s = String(c || "").trim();
    return /^#[0-9a-f]{3,8}$/i.test(s) || /^[a-z]{3,20}$/i.test(s) ? s : "transparent";
  };
  // An uploaded photo is referenced by its id; anything that looks like a path or URL is used as is.
  const photoSrc = (v) => !v ? "" : (/^[A-Za-z0-9_-]+$/.test(v) ? API() + "/photos/" + encodeURIComponent(v) : safeUrl(v));
  const paragraphs = (text, cls) => esc(text).split(/\n+/).filter((l) => l.trim())
    .map((l) => `<p class="${cls} reveal">${l}</p>`).join("");
  const mapsUrl = (query) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);

  // ---------- dates ----------
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  // `inSentence` keeps the language's own casing ("tisdag 15 juni"), for use after other words.
  function fmtDate(dateStr, inSentence) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T12:00:00");
    if (isNaN(d)) return dateStr;
    const text = d.toLocaleDateString(word("locale", "en-GB"), { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    return inSentence ? text : cap(text);
  }
  // A chapter heading. Script typefaces cannot carry a word in capitals ("OSA", "RSVP", "FAQ"),
  // so those are set in the text face instead.
  const h2 = (text) => {
    const t = String(text == null ? "" : text);
    const caps = t.length <= 6 && /[A-ZÅÄÖ]/.test(t) && t === t.toUpperCase();
    return `<h2 class="inv-h2 reveal${caps ? " h-caps" : ""}">${esc(t)}</h2>`;
  };
  function fmtShort(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return y && m && d ? `${d}.${m}.${y.slice(2)}` : dateStr;
  }
  const longDate = (data) => data.dateText || fmtDate(data.date);

  // The moment a wall-clock time happens in a given time zone.
  function zonedToUtc(date, time, zone) {
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    const guess = Date.UTC(y, m - 1, d, hh, mm);
    const parts = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date(guess)).forEach((p) => { parts[p.type] = Number(p.value); });
    const shown = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    return new Date(guess - (shown - guess));
  }
  // When the event starts. With `timezone` it is the same instant for every guest, wherever they are.
  function eventInstant(data) {
    if (!data.date) return null;
    const time = /^\d{1,2}:\d{2}$/.test(data.time || "") ? data.time.padStart(5, "0") : "12:00";
    if (data.timezone) {
      try { return zonedToUtc(data.date, time, data.timezone); } catch (e) { /* unknown zone: fall through */ }
    }
    const d = new Date(data.date + "T" + time);
    return isNaN(d) ? null : d;
  }

  // ---------- countdown ----------
  function countdown(el, data) {
    if (!el) return;
    const target = eventInstant(data);
    if (!target) { el.remove(); return; }
    const units = [["days", 86400000], ["hours", 3600000], ["minutes", 60000], ["seconds", 1000]];
    el.innerHTML = units
      .map(([u], i) => `${i ? '<span class="cd-colon" aria-hidden="true">:</span>' : ""}<div class="cd-cell"><span class="cd-num" data-u="${u}">&nbsp;</span><span class="cd-lbl">${T(u)}</span></div>`)
      .join("");
    function tick() {
      if (!el.isConnected) return;
      let diff = target - Date.now();
      if (diff < 0) { el.innerHTML = `<p class="cd-today">${T("today")}</p>`; return; }
      for (const [u, ms] of units) {
        const v = Math.floor(diff / ms);
        diff -= v * ms;
        const cell = el.querySelector(`[data-u="${u}"]`);
        const txt = u === "days" ? String(v) : String(v).padStart(2, "0");
        if (cell && cell.textContent !== txt) {
          cell.textContent = txt;
          cell.classList.remove("tick");
          void cell.offsetWidth;
          cell.classList.add("tick");
        }
      }
      setTimeout(tick, 1000);
    }
    tick();
  }

  // ---------- calendar file ----------
  function icsHref(data) {
    const start = eventInstant(data);
    if (!start) return null;
    const hours = Number(data.durationHours) > 0 ? Number(data.durationHours) : 6;
    const end = new Date(start.getTime() + hours * 3600000);
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = data.timezone
      ? (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
      : (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const text = (s) => String(s || "").replace(/\s*\r?\n\s*/g, " ").replace(/([\\;,])/g, "\\$1");
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fira//EN", "BEGIN:VEVENT",
      "UID:" + (data._id || Math.random().toString(36).slice(2)) + "@fira",
      "DTSTAMP:" + stamp(new Date()).replace(/Z?$/, "Z"),
      "DTSTART:" + stamp(start), "DTEND:" + stamp(end),
      "SUMMARY:" + text(data.calendarTitle || data.title || "Event"),
      "LOCATION:" + text([data.venue, data.address].filter(Boolean).join(", ")),
      "END:VEVENT", "END:VCALENDAR",
    ];
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(lines.join("\r\n"));
  }

  // ---------- ambient particles ----------
  function particles(host, kind, count) {
    if (REDUCED) return;
    const box = document.createElement("div");
    box.className = "fx-layer fx-" + kind;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("i");
      p.style.setProperty("--x", Math.random() * 100 + "%");
      p.style.setProperty("--d", (6 + Math.random() * 10).toFixed(1) + "s");
      p.style.setProperty("--dl", (-Math.random() * 12).toFixed(1) + "s");
      p.style.setProperty("--s", (0.5 + Math.random()).toFixed(2));
      p.style.setProperty("--r", Math.floor(Math.random() * 360) + "deg");
      p.style.setProperty("--h", Math.floor(Math.random() * 360));
      box.appendChild(p);
    }
    host.appendChild(box);
  }

  // ---------- confetti cannon ----------
  function celebrate(colors, origin) {
    if (REDUCED) return;
    const cv = document.createElement("canvas");
    cv.className = "celebrate-canvas";
    cv.width = innerWidth; cv.height = innerHeight;
    document.body.appendChild(cv);
    const ctx = cv.getContext("2d");
    const ox = (origin && origin.x) || innerWidth / 2;
    const oy = (origin && origin.y) || innerHeight * 0.6;
    const P = [];
    for (let i = 0; i < 140; i++) {
      const a = Math.random() * Math.PI * 2, v = 5 + Math.random() * 11;
      P.push({
        x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6,
        w: 5 + Math.random() * 6, h: 8 + Math.random() * 6,
        c: colors[i % colors.length], r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3, life: 90 + Math.random() * 60,
      });
    }
    let frame = 0;
    (function loop() {
      frame++;
      ctx.clearRect(0, 0, cv.width, cv.height);
      let alive = 0;
      for (const p of P) {
        if (frame > p.life) continue;
        alive++;
        p.vy += 0.22; p.vx *= 0.99;
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - frame / p.life);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.sin(frame / 8 + p.r)));
        ctx.restore();
      }
      if (alive) requestAnimationFrame(loop);
      else cv.remove();
    })();
  }

  // ---------- pointer / gyro parallax (uses the `translate` property; position with margins) ----------
  let parallaxCleanup = null;
  function parallax(stage) {
    if (parallaxCleanup) parallaxCleanup();
    if (REDUCED) return;
    const els = () => stage.querySelectorAll("[data-depth]");
    let tx = 0, ty = 0, cx = 0, cy = 0, running = false;
    function apply() {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      els().forEach((el) => {
        const d = parseFloat(el.dataset.depth) || 1;
        el.style.translate = `${cx * d}px ${cy * d}px`;
      });
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) requestAnimationFrame(apply);
      else running = false;
    }
    function kick() { if (!running) { running = true; requestAnimationFrame(apply); } }
    const point = (e) => {
      tx = (e.clientX / innerWidth - 0.5) * 22;
      ty = (e.clientY / innerHeight - 0.5) * 22;
      kick();
    };
    const tilt = (e) => {
      if (e.gamma == null) return;
      tx = Math.max(-24, Math.min(24, e.gamma)) * 0.9;
      ty = Math.max(-24, Math.min(24, (e.beta || 0) - 40)) * 0.6;
      kick();
    };
    addEventListener("pointermove", point, { passive: true });
    addEventListener("deviceorientation", tilt, { passive: true });
    parallaxCleanup = () => { removeEventListener("pointermove", point); removeEventListener("deviceorientation", tilt); parallaxCleanup = null; };
  }

  // ---------- scroll-story engine ----------
  // Every chapter gets --p (0 entering, 1 leaving). A staged hero gets --pin-p (0 to 1 while it is held
  // in place), every picture gets --ap (0 as it enters at the bottom of the screen, 1 once it has
  // arrived), and the films in both (scrollfilm.js) show the frame that belongs to that number.
  function storyEngine(root) {
    if (window.__firaStoryCleanup) window.__firaStoryCleanup();
    const chapters = [...root.querySelectorAll(".ch")];
    const bar = root.querySelector(".story-progress i");
    const hero = root.querySelector(".ch-hero.hero-staged");
    const heroCanvas = hero && hero.querySelector(".hero-seq-film");
    const heroLoop = hero && hero.querySelector(".hero-video");
    const arts = [...root.querySelectorAll(".venue-art")];
    const Film = REDUCED ? null : window.FiraScrollFilm;
    const films = new Map();
    const clamp = (v) => Math.max(0, Math.min(1, v));
    let ticking = false;
    let slow = false;                            // a film came too late: the line is for pictures and music

    // A number is written to the page only when it has changed: every write makes the browser work
    // out the styles of the chapter again.
    const written = new WeakMap();
    const put = (el, name, value) => {
      let seen = written.get(el);
      if (!seen) written.set(el, (seen = {}));
      if (seen[name] === value) return;
      seen[name] = value;
      el.style.setProperty(name, value);
    };

    // Films follow the scroll with a little weight: each frame of the screen they cover a quarter of
    // what is left. A wheel that turns in steps and a thumb that stops short both end in a glide.
    const aim = new Map(), now = new Map();
    let rolling = false;
    function roll() {
      rolling = false;
      aim.forEach((target, film) => {
        if (!film.count) return;
        let at = now.has(film) ? now.get(film) : target;
        const gap = target - at;
        at = Math.abs(gap) < 0.04 || Math.abs(gap) > film.count * 0.5 ? target : at + gap * 0.25;
        now.set(film, at);
        film.draw(at);
        if (at !== target) rolling = true;
      });
      if (rolling) requestAnimationFrame(roll);
    }
    const follow = (film, target) => {
      aim.set(film, target);
      if (!rolling) { rolling = true; requestAnimationFrame(roll); }
    };
    const rest = (film) => { film.pause(); film.release(); aim.delete(film); now.delete(film); };

    function start(canvas) {                     // fetch a film's frames, once
      if (!canvas || films.has(canvas) || canvas.dataset.late) return;
      const owner = canvas.closest(".venue-art, .ch-hero");
      if (!Film) { owner.classList.add("nofilm"); return; }
      if (slow && canvas !== heroCanvas) { still(owner, canvas); return; }
      // Frames arrive when they arrive: every one of them may be the first that can be shown.
      const film = new Film(canvas, canvas.dataset.seq, { concurrency: 3, onprogress: onScroll });
      films.set(canvas, film);
      film.resize();
      film.load().then(() => { film.resize(); update(); }).catch(() => owner.classList.add("nofilm"));
    }

    // A picture on a slow line: it is shown as a still, and stays one. A picture that turns into a film
    // under the guest's eyes would be worse.
    function still(fig, canvas) {
      const film = films.get(canvas);
      if (film) rest(film);
      films.delete(canvas);
      canvas.dataset.late = "1";
      fig.classList.remove("filming");
      fig.classList.add("nofilm");
    }
    // Called a moment after a picture came on screen. A quarter of its film is enough to follow the
    // scroll, the rest arrives meanwhile. With less than that the line is slow: this picture and every
    // picture that is not ready either are shown as stills, and no more frames are asked for.
    function judge(canvas) {
      const enough = (c) => { const f = films.get(c); return !!(f && f.count && f.loaded * 4 >= f.count); };
      if (enough(canvas)) return;
      slow = true;
      arts.forEach((fig) => {
        const c = fig.querySelector(".art-film");
        if (c && !c.dataset.late && !enough(c)) still(fig, c);
      });
      update();
    }

    function update() {
      ticking = false;
      const vh = innerHeight;
      // Everything is measured first and written afterwards: a write between two measurements makes
      // the browser lay the page out again, once for every chapter.
      const boxes = chapters.map((ch) => ch.getBoundingClientRect());
      const heroBox = hero ? hero.getBoundingClientRect() : null;
      const artBoxes = arts.map((fig) => fig.getBoundingClientRect());
      const max = bar ? document.documentElement.scrollHeight - vh : 0;
      const top = scrollY;
      chapters.forEach((ch, i) => {
        const r = boxes[i];
        put(ch, "--p", clamp((vh - r.top) / (vh + r.height)).toFixed(3));
      });
      if (hero) {
        const r = heroBox;
        const range = r.height - vh;
        const pin = range > 1 ? clamp(-r.top / range) : 0;
        put(hero, "--pin-p", pin.toFixed(4));
        const film = films.get(heroCanvas);
        if (film) { if (r.bottom < -vh * 0.5) rest(film); else film.resume(); }   // left behind: the line is for what is on screen
        if (film && film.count && r.bottom >= -vh * 0.5) {
          follow(film, pin * (film.count - 1));
          const filming = pin > 0.004 && film.drawn >= 0;
          hero.classList.toggle("filming", filming);
          if (heroLoop && heroLoop.dataset.live) {      // the loop rests while the scroll film covers it
            if (filming && !heroLoop.paused) heroLoop.pause();
            else if (!filming && heroLoop.paused) { const p = heroLoop.play(); if (p && p.catch) p.catch(() => {}); }
          }
        }
      }
      arts.forEach((fig, i) => {
        const r = artBoxes[i];
        const canvas = fig.querySelector(".art-film");
        const film = films.get(canvas);
        if (r.bottom < -vh || r.top > vh * 2.5) { if (film) rest(film); return; }
        if (film) film.resume();
        const ap = REDUCED ? 1 : clamp((vh * 0.94 - r.top) / (vh * 0.62));
        put(fig, "--ap", ap.toFixed(3));
        if (canvas && ap > 0.01 && !fig.dataset.judged && !fig.classList.contains("nofilm")) {
          fig.dataset.judged = "1";
          setTimeout(() => judge(canvas), 700);
        }
        if (film && film.count) follow(film, ap * (film.count - 1));
        if (film && film.drawn >= 0) fig.classList.add("drawn");      // its canvas has a picture on it
        fig.classList.toggle("filming", !!film && film.drawn >= 0 && ap < 0.995);
        fig.classList.toggle("done", ap >= 0.995);
      });
      if (bar) put(bar, "width", (max > 0 ? (top / max) * 100 : 0).toFixed(1) + "%");
    }
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    const onResize = () => { films.forEach((film) => film.resize()); update(); };

    // What is fetched, and when. A chapter that comes within a screen and a half gets the class `near`
    // (themes hang the pictures of their chapters on it), and a film its frames. While the envelope is
    // sealed nothing of this starts: the opening film goes first ("fira:fed" says it has arrived).
    const near = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      near.unobserve(e.target);
      if (e.target.classList.contains("ch")) e.target.classList.add("near");
      else start(e.target);
    }), { rootMargin: "150% 0px 150% 0px" });
    const begin = () => {
      chapters.forEach((ch) => near.observe(ch));
      root.querySelectorAll(".art-film").forEach((canvas) => near.observe(canvas));
      root.querySelectorAll(".hero-side[data-bg]").forEach((el) => { el.style.backgroundImage = 'url("' + el.dataset.bg.replace(/["\\]/g, "") + '")'; });
      if (heroCanvas) start(heroCanvas);
    };
    root.querySelectorAll(".title-ink").forEach((ink) => ink.addEventListener("animationend", () => ink.classList.add("written")));
    const sealedHero = root.querySelector(".ch-hero.held");
    if (sealedHero) sealedHero.addEventListener("fira:fed", begin, { once: true });
    else begin();

    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize);
    window.__firaStoryCleanup = () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
      near.disconnect();
      films.forEach((film) => { film.pause(); film.release(); });
      films.clear();
    };
    update();
  }

  // A picture is shown when all of it has arrived. On a slow line it would otherwise be drawn from the
  // top down under the guest's eyes, and a painting that fades into the page would show a hard edge.
  function wholePictures(root) {
    root.querySelectorAll('img[loading="lazy"]').forEach((img) => {
      const owner = img.closest("figure");
      if (img.complete && img.naturalWidth) { if (owner) owner.classList.add("still-in"); return; }
      const here = () => {
        img.classList.remove("arriving");
        img.classList.add("arrived");
        if (owner) owner.classList.add("still-in");
      };
      img.classList.add("arriving");
      img.addEventListener("load", here, { once: true });
      img.addEventListener("error", here, { once: true });
    });
  }

  // Doves that cross a chapter when the guest arrives at it (`theme.flights`). They fly once, and again
  // when the guest has been away and comes back. Every other flight goes the other way.
  // A flight waits for its pictures: they are fetched when the chapter comes near, and doves that fly
  // before their pictures have arrived cross the page unseen (on a slow line the first ones did).
  let flightsCleanup = null;
  function flights(root, theme) {
    if (flightsCleanup) flightsCleanup();
    const f = theme.flights;
    const sheets = f && Array.isArray(f.doves) ? f.doves.map(safeUrl).filter(Boolean).slice(0, 2) : [];
    if (REDUCED || !f || !Array.isArray(f.chapters) || !sheets.length) return;
    const layers = [];
    f.chapters.forEach((name) => {
      const [kind, key] = String(name).split(":");
      const ch = [...root.querySelectorAll(".ch")].find((c) => c.dataset.ch === kind && (key === undefined || c.dataset.key === key));
      if (!ch) return;
      const layer = document.createElement("div");
      layer.className = "flight" + (layers.length % 2 ? " to-left" : "");
      layer.setAttribute("aria-hidden", "true");
      layer.innerHTML = sheets.map((s, i) => `<i class="dove dove-${i ? "b" : "a"}"></i>`).join("");
      ch.appendChild(layer);
      layers.push(layer);
    });
    if (!layers.length) return;
    let arrived = null;                       // the pictures, fetched once for all flights
    const fetched = () => arrived || (arrived = Promise.all(sheets.map((src) => new Promise((done) => {
      const img = new Image();
      img.onload = () => (img.decode ? img.decode().then(() => done(true), () => done(true)) : done(true));
      img.onerror = () => done(false);
      img.src = src;
    }))).then((all) => all.every(Boolean)));
    const state = new WeakMap();              // layer -> { there: in view, ready: its pictures are on it }
    const settle = (layer) => {
      const s = state.get(layer);
      layer.classList.toggle("fly", !!(s.there && s.ready));
    };
    const near = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      near.unobserve(e.target);
      const layer = e.target.querySelector(":scope > .flight");
      fetched().then((ok) => {
        if (!ok) return;                      // no pictures, no flight
        layer.querySelectorAll(".dove").forEach((d, i) => { d.style.backgroundImage = 'url("' + sheets[i].replace(/["\\]/g, "") + '")'; });
        state.get(layer).ready = true;
        layer.classList.add("ready");
        settle(layer);
      });
    }), { rootMargin: "150% 0px 150% 0px" });
    const seen = new IntersectionObserver((entries) => entries.forEach((e) => {
      const layer = e.target.querySelector(":scope > .flight");
      if (!layer) return;
      state.get(layer).there = e.isIntersecting;
      settle(layer);
    }), { rootMargin: "-18% 0px -30% 0px" });
    layers.forEach((layer) => {
      state.set(layer, { there: false, ready: false });
      near.observe(layer.parentElement);
      seen.observe(layer.parentElement);
    });
    flightsCleanup = () => { near.disconnect(); seen.disconnect(); flightsCleanup = null; };
  }

  function revealOnScroll(root) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.1 }
    );
    root.querySelectorAll(".reveal").forEach((el, i) => {
      el.style.setProperty("--stagger", (i % 6) * 90 + "ms");
      io.observe(el);
    });
    if (REDUCED) root.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
  }

  // ---------- scroll to a chapter and stay on target ----------
  // Images above the target may finish loading while the page glides and push it further down,
  // so re-aim until it rests at the top. Any input from the guest cancels the correction.
  function glideTo(el) {
    const behavior = REDUCED ? "auto" : "smooth";
    const atEnd = () => innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    let last = null, calm = 0, tries = 0;
    const stop = () => { clearInterval(timer); ["wheel", "touchstart", "keydown"].forEach((e) => removeEventListener(e, stop)); };
    const timer = setInterval(() => {
      const top = Math.round(el.getBoundingClientRect().top);
      calm = top === last ? calm + 1 : 0;
      last = top;
      if (calm < 2) return;
      if (Math.abs(top) > 6 && tries < 4 && !atEnd()) { tries++; calm = 0; el.scrollIntoView({ behavior, block: "start" }); }
      else stop();
    }, 200);
    ["wheel", "touchstart", "keydown"].forEach((e) => addEventListener(e, stop, { passive: true, once: true }));
    setTimeout(stop, 8000);
    el.scrollIntoView({ behavior, block: "start" });
  }

  // ---------- fullscreen ----------
  function tryFullscreen() {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (fn) { try { fn.call(el).catch(() => {}); } catch (e) {} }
  }
  function exitFullscreen() {
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fn) { try { fn.call(document).catch(() => {}); } catch (e) {} }
  }
  const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  // An iPhone cannot show a page in full screen, and neither can a page inside a frame that was not
  // given the right: there the button would do nothing, so it is not shown.
  const canFullscreen = () => {
    const el = document.documentElement;
    return !!((el.requestFullscreen || el.webkitRequestFullscreen) && (document.fullscreenEnabled || document.webkitFullscreenEnabled));
  };

  // ======================================================================
  // Chapters. Each returns "" when the invitation has nothing for it.
  // Signature: (data, theme, opts, arg) where arg is what follows ":" in the chapter name.
  // ======================================================================
  const frameCorners = () => ["tl", "tr", "bl", "br"].map((c) => `
    <svg class="hf-corner ${c}" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M2,98 V40 C2,18 18,2 40,2 H98" fill="none" stroke="currentColor" stroke-width="1.4"/>
      <path d="M10,98 V46 C10,26 26,10 46,10 H98" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.6"/>
      <path d="M22,22 c8,-6 18,-4 22,4 c-6,2 -12,0 -16,-4 c-4,4 -10,6 -16,4 c4,-8 14,-10 22,-4 z" fill="currentColor" opacity="0.8"/>
      <circle cx="40" cy="40" r="2.4" fill="currentColor"/>
    </svg>`).join("");

  const button = (href, label, sub, cls) => {
    const url = safeUrl(href);
    if (!url) return "";
    const external = /^https?:/i.test(url) ? ' target="_blank" rel="noopener"' : "";
    return `<a class="inv-btn ${cls || "ghost"}" href="${esc(url)}"${external}>${sub ? `<b>${esc(label)}</b><small>${esc(sub)}</small>` : esc(label)}</a>`;
  };
  const calendarButton = (data, withSub) => {
    const ics = icsHref(data);
    if (!ics) return "";
    return `<a class="inv-btn ghost" href="${ics}" download="fira-event.ics">${withSub ? `<b>${T("calendar")}</b><small>${T("calendarSub")}</small>` : T("calendar")}</a>`;
  };

  // A picture in a chapter. With `film` (a folder of frames) it comes alive as the guest scrolls to it;
  // with `reveal` it is uncovered by the scroll. Without either it is a still.
  const artFigure = (src, o = {}) => {
    const url = safeUrl(src);
    if (!url) return "";
    const film = safeUrl(o.film);
    const shape = /^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(o.ratio || "") ? ` style="aspect-ratio:${o.ratio}"` : "";
    const cls = ["venue-art", "reveal", o.cls || "", film ? "has-film" : "", !film && o.reveal ? "art-" + String(o.reveal).replace(/[^a-z]/g, "") : ""];
    return `<figure class="${cls.filter(Boolean).join(" ")}"${shape}><img src="${esc(url)}" alt="" loading="lazy">${
      film ? `<canvas class="art-film" data-seq="${esc(film)}" aria-hidden="true"></canvas>` : ""}</figure>`;
  };

  const CH = {
    // A theme whose opening film lands on the hero picture (`opening.lands`), or whose hero follows the
    // scroll (`opening.heroSeq`), gets a staged hero: one screen high, held in place while the page moves.
    hero(data, theme, opts) {
      const o = theme.opening || {};
      const staged = !!(o.lands || o.heroSeq);
      const held = !!(opts && opts._held);
      let bg = "";
      if (o.heroVideo) {
        // Sealed: the loop and its poster wait (`data-poster`), so that the film is fetched first.
        bg = `<div class="hero-bg"><video class="hero-video" ${held ? `preload="none" data-poster="${esc(o.hero || "")}"` : `autoplay data-live="1" preload="auto" poster="${esc(o.hero || "")}"`} muted loop playsinline><source src="${esc(o.heroVideo)}" type="video/mp4"></video></div>`;
      } else if (o.hero) {
        bg = `<div class="hero-bg"><img src="${esc(o.hero)}" alt=""></div>`;
      }
      const hasBg = !!(o.heroVideo || o.hero);
      const art = theme.art && theme.art.hero && !hasBg ? theme.art.hero(data) : "";
      const split = theme.heroLayout === "split";
      const eyebrow = esc(data.eventType || word("eyebrow"));
      const showTime = data.time && !data.dateText;
      const dateLine = esc(longDate(data)) + (showTime ? " · " + esc(data.time) : "");
      const seq = staged && o.heroSeq && !REDUCED ? `<canvas class="hero-seq-film" data-seq="${esc(o.heroSeq)}" aria-hidden="true"></canvas>` : "";
      const side = (cls, url) => (safeUrl(url) ? `<div class="hero-side ${cls}" data-bg="${esc(safeUrl(url))}"></div>` : "");
      const sides = staged ? side("hs-env", o.poster) + side("hs-pic", o.hero) : "";
      const inside = `
        ${sides}${bg}${seq}${hasBg ? '<div class="hero-scrim"></div>' : ""}
        ${theme.heroFrame ? `<div class="hero-frame" aria-hidden="true">${frameCorners()}</div>` : ""}
        <div class="ch-art">${art}</div>
        <div class="ch-inner">
          ${split ? `<div class="hero-top"><p class="inv-eyebrow hero-seq s1">${eyebrow}</p><p class="inv-date-short hero-seq s1">${esc(fmtShort(data.date))}</p></div>` : `<p class="inv-eyebrow hero-seq s1">${eyebrow}</p>`}
          <h1 class="inv-title hero-seq s2 ${theme.titleCls || ""}" ${theme.titleAttr ? `data-text="${esc(data.title || "")}"` : ""}>${staged ? `<span class="title-ink">${esc(data.title || "")}</span>` : esc(data.title || "")}</h1>
          ${data.subtitle ? `<p class="inv-subtitle hero-seq s3">${esc(data.subtitle)}</p>` : ""}
          <div class="hero-seq s4">${theme.art && theme.art.divider ? theme.art.divider : ""}</div>
          ${split ? "" : `<p class="inv-date hero-seq s5">${dateLine}</p>`}
          ${data.heroNote ? `<p class="inv-hero-note hero-seq s5">${esc(data.heroNote)}</p>` : ""}
        </div>
        <div class="ch-chevron hero-seq s6" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 9l7 7 7-7"/></svg></div>`;
      const pin = seq ? (Number(o.pin) > 0 ? Number(o.pin) : 1.1) : 0;
      const cls = ["ch", "ch-hero", hasBg ? "has-bg" : "", split ? "hero-split" : "", staged ? "hero-staged" : "", held ? "held" : ""];
      return `
      <section class="${cls.filter(Boolean).join(" ")}" data-ch="hero"${staged ? ` style="--pin:${pin}"` : ""}>
        ${staged ? `<div class="hero-stage">${inside}</div>` : inside}
      </section>`;
    },

    photo(data, theme) {
      const src = photoSrc(data.photoId || data.photoUrl);
      if (!src) return "";
      return `
      <section class="ch ch-photo" data-ch="photo">
        <figure class="ph-frame ${theme.photoFrame ? "pf-" + theme.photoFrame : ""} reveal"><img src="${esc(src)}" alt="" loading="lazy"></figure>
        ${data.photoTitle ? `<p class="ph-title reveal">${esc(data.photoTitle)}</p>` : ""}
        ${data.photoCaption ? `<p class="ph-caption reveal">${esc(data.photoCaption)}</p>` : ""}
      </section>`;
    },

    message(data, theme) {
      if (!data.message) return "";
      return `
      <section class="ch ch-message" data-ch="message">
        <div class="ch-inner">
          ${theme.art && theme.art.message ? theme.art.message : ""}
          ${data.messageTitle ? `${h2(data.messageTitle)}` : `<div class="msg-mark reveal" aria-hidden="true">${theme.ornament || "✦"}</div>`}
          ${paragraphs(data.message, "msg-line")}
          ${data.hosts && !data.messageTitle && !data.hideMessageSignature ? `<p class="msg-sig reveal">— ${esc(data.hosts)}</p>` : ""}
        </div>
      </section>`;
    },

    countdown(data) {
      if (!eventInstant(data)) return "";
      return `
      <section class="ch ch-countdown" data-ch="countdown">
        <div class="ch-inner">
          ${h2(word("countdown"))}
          ${word("countdownSub") ? `<p class="inv-sub reveal">${T("countdownSub")}</p>` : ""}
          <div class="inv-countdown reveal"></div>
        </div>
      </section>`;
    },

    details(data, theme) {
      const q = [data.venue, data.address].filter(Boolean).join(", ");
      if (!q && !data.date) return "";
      const map = q && theme.showMap !== false
        ? `<div class="map-card reveal"><iframe title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
             src="https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed"></iframe></div>` : "";
      return `
      <section class="ch ch-details" data-ch="details">
        <div class="ch-inner">
          ${h2(word("details"))}
          <p class="inv-date big reveal">${esc(longDate(data))}</p>
          ${data.time ? `<p class="inv-time reveal">${esc(data.time)}</p>` : ""}
          ${data.venue ? `<p class="inv-venue reveal">${esc(data.venue)}</p>` : ""}
          ${data.address ? `<p class="inv-address reveal">${esc(data.address)}</p>` : ""}
          ${map}
          <div class="inv-cta reveal">${q ? button(data.mapUrl || mapsUrl(q), word("directions")) : ""}${calendarButton(data)}${button(data.songUrl, word("song"))}</div>
          <div class="inv-countdown reveal"></div>
        </div>
      </section>`;
    },

    venue(data, theme) {
      if (!data.venue && !data.address) return "";
      const q = [data.venue, data.address].filter(Boolean).join(", ");
      const own = safeUrl(data.venueImageUrl);
      const assets = theme.assets || {};
      const art = own ? artFigure(own) : artFigure(assets.venue, { film: assets.venueFilm, reveal: assets.venueReveal });
      return `
      <section class="ch ch-venue" data-ch="venue">
        <div class="ch-inner">
          ${art}
          ${h2(word("venue"))}
          ${data.venue ? `<p class="inv-venue reveal">${esc(data.venue)}</p>` : ""}
          ${data.address ? `<p class="inv-address reveal">${esc(data.address)}</p>` : ""}
          ${data.time ? `<p class="inv-time reveal">${esc(longDate(data))} · ${esc(data.time)}</p>` : ""}
          <div class="inv-cta reveal">${button(data.mapUrl || mapsUrl(q), word("directions"), word("directionsSub"))}${calendarButton(data, true)}</div>
          ${theme.showMap ? `<div class="map-card reveal"><iframe title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed"></iframe></div>` : ""}
        </div>
      </section>`;
    },

    // One of several places (ceremony, dinner, ...): `places[n]`, used as "place:<n>".
    place(data, theme, opts, arg) {
      const index = parseInt(arg || "0", 10) || 0;
      const p = (data.places || [])[index];
      if (!p || !(p.name || p.title)) return "";
      const q = p.mapQuery || [p.name, p.address].filter(Boolean).join(", ");
      const image = photoSrc(p.photoId || p.imageUrl);
      const art = image
        ? `<figure class="venue-art reveal"><img src="${esc(image)}" alt="" loading="lazy"></figure>`
        : (theme.art && theme.art.place ? theme.art.place(p, index, artFigure) : "");
      return `
      <section class="ch ch-place place-${index}" data-ch="place">
        <div class="ch-inner">
          ${art}
          ${p.title ? `${h2(p.title)}` : ""}
          ${p.dateText ? `<p class="pl-date reveal">${esc(p.dateText)}</p>` : ""}
          ${p.time ? `<p class="pl-time reveal">${esc(p.time)}</p>` : ""}
          ${p.lead ? `<p class="inv-p pl-lead reveal">${esc(p.lead)}</p>` : ""}
          ${p.name ? `<p class="inv-venue reveal">${esc(p.name)}</p>` : ""}
          ${p.address ? `<p class="inv-address reveal">${esc(p.address)}</p>` : ""}
          ${p.note ? `<p class="inv-p pl-note reveal">${esc(p.note)}</p>` : ""}
          <div class="inv-cta reveal">${q ? button(p.mapUrl || mapsUrl(q), word("directions"), word("directionsSub")) : ""}${p.calendar ? calendarButton(data, true) : ""}</div>
        </div>
      </section>`;
    },

    schedule(data, theme) {
      const schedule = (data.schedule || []).filter((s) => s.label);
      if (!schedule.length) return "";
      return `
      <section class="ch ch-schedule" data-ch="schedule">
        <div class="ch-inner">
          ${h2(word("schedule"))}
          ${word("scheduleSub") ? `<p class="inv-sub reveal">${T("scheduleSub")}</p>` : ""}
          <ol class="inv-timeline ${theme.timelineStyle ? "tl-" + theme.timelineStyle : ""}">
            <i class="tl-line" aria-hidden="true"></i>
            ${theme.timelineCap ? `<i class="tl-cap" aria-hidden="true">${theme.timelineCap}</i>` : ""}
            ${schedule.map((s) => `<li class="reveal">
              <span class="tl-time">${esc(s.time || "")}</span>
              <span class="tl-dot" aria-hidden="true">${s.icon ? esc(s.icon) : ""}</span>
              <span class="tl-body"><span class="tl-label">${esc(s.label)}</span>${s.note ? `<span class="tl-note">${esc(s.note)}</span>` : ""}</span>
            </li>`).join("")}
          </ol>
        </div>
      </section>`;
    },

    dresscode(data) {
      const dc = data.dressCode;
      if (!dc || !(dc.text || dc.lead || (dc.palette || []).length || (dc.images || []).length)) return "";
      const palette = (dc.palette || []).length
        ? `<div class="dc-palette reveal">${dc.palette.map((p) => `<span class="dc-swatch"><i style="background:${safeColor(p.color)}"></i>${p.label ? `<small>${esc(p.label)}</small>` : ""}</span>`).join("")}</div>` : "";
      const images = (dc.images || []).filter((im) => im.photoId || im.url).length
        ? `<div class="dc-images">${dc.images.filter((im) => im.photoId || im.url).map((im) => `<figure class="dc-img reveal"><img src="${esc(photoSrc(im.photoId || im.url))}" alt="" loading="lazy">${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ""}</figure>`).join("")}</div>` : "";
      return `
      <section class="ch ch-dresscode" data-ch="dresscode">
        <div class="ch-inner">
          ${h2(dc.title || word("dressCode"))}
          ${dc.lead ? `<p class="sec-lead reveal">${esc(dc.lead)}</p>` : ""}
          ${dc.text ? paragraphs(dc.text, "inv-p") : ""}
          ${images}
          ${palette && dc.paletteTitle ? `<p class="dc-title reveal">${esc(dc.paletteTitle)}</p>` : ""}
          ${palette}
        </div>
      </section>`;
    },

    gifts(data) {
      const g = data.gifts;
      if (!g || !(g.text || (g.links || []).length)) return "";
      return `
      <section class="ch ch-gifts" data-ch="gifts">
        <div class="ch-inner">
          <div class="gf-icon reveal" aria-hidden="true">🎁</div>
          ${h2(g.title || word("gifts"))}
          ${g.text ? paragraphs(g.text, "inv-p") : ""}
          ${(g.links || []).length ? `<div class="inv-cta reveal">${g.links.map((l) => button(l.url, "🎁 " + (l.label || "") + " ↗", null, "solid")).join("")}</div>` : ""}
          ${g.details ? `<details class="gf-details reveal"><summary>${T("giftsDirect")}</summary><p>${esc(g.details).replace(/\n/g, "<br>")}</p></details>` : ""}
        </div>
      </section>`;
    },

    menu(data, theme) {
      const menu = (data.menu || []).filter((m) => m.name || m.description);
      if (!menu.length && !data.menuText) return "";
      return `
      <section class="ch ch-menu" data-ch="menu">
        <div class="ch-inner">
          ${theme.art && theme.art.menuTop ? theme.art.menuTop : ""}
          ${h2(word("menu"))}
          ${data.menuText ? paragraphs(data.menuText, "inv-p") : ""}
          ${menu.length ? `<div class="menu-list">${menu.map((m) => `
            <div class="menu-item reveal">
              ${m.course ? `<span class="menu-course">— ${esc(m.course)} —</span>` : ""}
              ${m.name ? `<span class="menu-name">${esc(m.name)}</span>` : ""}
              ${m.description ? `<span class="menu-desc">${esc(m.description)}</span>` : ""}
            </div>`).join("")}</div>` : ""}
        </div>
      </section>`;
    },

    accommodation(data) {
      const acc = (data.accommodation || []).filter((a) => a.name);
      if (!acc.length && !data.accommodationText) return "";
      return `
      <section class="ch ch-accommodation" data-ch="accommodation">
        <div class="ch-inner">
          ${h2(word("accommodation"))}
          ${word("accommodationSub") ? `<p class="inv-sub reveal">${T("accommodationSub")}</p>` : ""}
          ${data.accommodationText ? paragraphs(data.accommodationText, "inv-p") : ""}
          ${acc.length ? `<div class="acc-list">${acc.map((a) => `
            <div class="acc-card reveal">
              ${safeUrl(a.imageUrl) ? `<img src="${esc(safeUrl(a.imageUrl))}" alt="" loading="lazy">` : ""}
              <div class="acc-body">
                <b>${esc(a.name)}</b>
                ${a.note ? `<p>${esc(a.note)}</p>` : ""}
                ${a.price ? `<span class="acc-price">${esc(a.price)}</span>` : ""}
                ${button(a.url, word("viewDetails"), null, "ghost sm")}
              </div>
            </div>`).join("")}</div>` : ""}
        </div>
      </section>`;
    },

    faq(data) {
      const faq = (data.faq || []).filter((f) => f.q);
      if (!faq.length) return "";
      return `
      <section class="ch ch-faq" data-ch="faq">
        <div class="ch-inner">
          <div class="gf-icon reveal" aria-hidden="true">?</div>
          ${h2(word("faq"))}
          <div class="faq-list">${faq.map((f) => `
            <details class="faq-item reveal"><summary>${esc(f.q)}</summary><p>${esc(f.a || "").replace(/\n/g, "<br>")}</p></details>`).join("")}</div>
        </div>
      </section>`;
    },

    contact(data) {
      const c = data.contact;
      if (!c || !(c.text || c.name || c.phone || c.giftText)) return "";
      const digits = String(c.phone || "").replace(/[^\d+]/g, "");
      return `
      <section class="ch ch-contact" data-ch="contact">
        <div class="ch-inner">
          ${h2(c.title || word("contact"))}
          ${c.text ? paragraphs(c.text, "inv-p") : ""}
          ${c.name ? `<p class="contact-name reveal">${esc(c.name)}</p>` : ""}
          ${c.phone ? `<p class="contact-phone reveal"><a href="tel:${esc(digits)}">${esc(c.phone)}</a></p>` : ""}
          ${c.whatsapp && digits ? `<div class="inv-cta reveal">${button("https://wa.me/" + digits.replace(/\D/g, ""), word("whatsapp"))}</div>` : ""}
          ${c.giftText ? `<p class="inv-p gift-note reveal">${esc(c.giftText)}</p>` : ""}
        </div>
      </section>`;
    },

    // Songs the hosts picked. Nothing is loaded from the music service until the guest asks for it.
    music(data) {
      const tracks = (data.music || []).filter((m) => m && trackId(m));
      if (!tracks.length) return "";
      return `
      <section class="ch ch-music" data-ch="music">
        <div class="ch-inner">
          <div class="gf-icon reveal" aria-hidden="true">♪</div>
          ${h2(word("music"))}
          ${data.musicText ? paragraphs(data.musicText, "inv-p") : `<p class="inv-sub reveal">${T("musicHint")}</p>`}
          <div class="music-list">${tracks.map((m) => `
            <div class="music-card reveal" data-track="${esc(trackId(m))}">
              <button class="music-play" type="button" aria-label="${T("listen")}: ${esc(m.title || "")}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>
              </button>
              <span class="music-meta"><b>${esc(m.title || "")}</b>${m.artist ? `<small>${esc(m.artist)}</small>` : ""}</span>
            </div>`).join("")}</div>
          <p class="music-note reveal">${T("playsOnSpotify")}</p>
        </div>
      </section>`;
    },

    // One song, in the official player of the service it is on: `song.youtube` is a link or an id.
    // The player is fetched when the chapter comes near, the guest starts it, and the page's own
    // music rests while it plays. The recording stays where its owner published it.
    song(data) {
      const s = data.song || {};
      const id = videoId(s.youtube);
      if (!id) return "";
      return `
      <section class="ch ch-song" data-ch="song">
        <div class="ch-inner">
          ${h2(s.title || word("ourSong"))}
          ${s.text ? paragraphs(s.text, "inv-p") : ""}
          <figure class="song-frame reveal" data-video="${esc(id)}">
            <div class="song-screen"></div>
            ${s.caption ? `<figcaption>${esc(s.caption)}</figcaption>` : ""}
          </figure>
          <p class="music-note reveal">${T("playsOnYouTube")}</p>
        </div>
      </section>`;
    },

    // Free-form content: `sections[]` entries, used as "section:<key>".
    // Each block may have a heading, text, short lines (names), buttons, and a style
    // ("signature" or "quote").
    section(data, theme, opts, arg) {
      const list = data.sections || [];
      const s = list.find((x) => x.key === arg) || list[parseInt(arg, 10)];
      if (!s) return "";
      // A card: a small picture, a name, a line of text. With `url` the whole card is a link.
      const card = (c) => {
        const src = photoSrc(c.photoId || c.imageUrl);
        const url = safeUrl(c.url);
        const inner = `${src ? `<figure class="sc-art"><img src="${esc(src)}" alt="" loading="lazy"></figure>` : ""}
          ${c.title ? `<b class="sc-title">${esc(c.title)}</b>` : ""}
          ${c.text ? `<small class="sc-text">${esc(c.text)}</small>` : ""}
          ${url && c.link ? `<span class="sc-link">${esc(c.link)}</span>` : ""}`;
        return url
          ? `<a class="sec-card reveal" href="${esc(url)}"${/^https?:/i.test(url) ? ' target="_blank" rel="noopener"' : ""}>${inner}</a>`
          : `<div class="sec-card reveal">${inner}</div>`;
      };
      const blocks = (s.blocks || []).map((b) => {
        const cards = (b.cards || []).filter((c) => c && (c.title || c.photoId || c.imageUrl));
        return `
        <div class="sec-block ${b.style ? "sb-" + esc(b.style) : ""}">
          ${b.heading ? `<h3 class="sec-h3 reveal">${esc(b.heading)}</h3>` : ""}
          ${b.text ? paragraphs(b.text, "inv-p") : ""}
          ${(b.lines || []).length ? `<ul class="sec-lines">${b.lines.map((l) => `<li class="reveal">${esc(l)}</li>`).join("")}</ul>` : ""}
          ${cards.length ? `<div class="sec-cards n${Math.min(cards.length, 4)}">${cards.map(card).join("")}</div>` : ""}
          ${(b.buttons || []).length ? `<div class="inv-cta reveal">${b.buttons.map((x) => button(x.url, x.label, x.sub)).join("")}</div>` : ""}
        </div>`;
      }).join("");
      const key = String(s.key || arg || "").replace(/[^a-z0-9-]/gi, "");
      const art = theme.art && theme.art.section ? theme.art.section(s) : "";
      return `
      <section class="ch ch-section sec-${key}" data-ch="section" data-key="${key}">
        <div class="ch-inner">
          ${art}
          ${s.icon ? `<div class="gf-icon reveal" aria-hidden="true">${esc(s.icon)}</div>` : ""}
          ${s.title ? `${h2(s.title)}` : ""}
          ${s.lead ? `<p class="sec-lead reveal">${esc(s.lead)}</p>` : ""}
          ${blocks}
        </div>
      </section>`;
    },

    rsvp(data, theme, opts) {
      if (opts.noRsvp) return "";
      const qs = (data.questions || []).map((q, i) => {
        const opt = (q.options || []).filter(Boolean);
        const label = esc(q.label);
        if (q.perGuest && opt.length) {
          return `<div class="rf-field rf-yes"><span>${label}</span>
            <div class="rf-perguest" data-q="${i}" data-options="${esc(JSON.stringify(opt))}"></div></div>`;
        }
        if (q.type === "choice" && opt.length) {
          return `<label class="rf-field rf-yes"><span>${label}</span>
            <select data-q="${i}">${opt.map((o) => `<option>${esc(o)}</option>`).join("")}</select></label>`;
        }
        if (q.type === "multi" && opt.length) {
          return `<div class="rf-field rf-yes"><span>${label}</span>
            <div class="rf-multi" data-q="${i}">${opt.map((o) => `<label><input type="checkbox" value="${esc(o)}"><i></i>${esc(o)}</label>`).join("")}</div></div>`;
        }
        if (q.type === "radio" && opt.length) {
          return `<div class="rf-field rf-yes"><span>${label}</span>
            <div class="rf-radio" data-q="${i}">${opt.map((o, j) => `<label><input type="radio" name="q${i}" value="${esc(o)}" ${j ? "" : "checked"}><i></i>${esc(o)}</label>`).join("")}</div></div>`;
        }
        return `<label class="rf-field rf-yes"><span>${label}</span><input type="text" data-q="${i}" maxlength="200" placeholder="${esc(q.placeholder || "")}"></label>`;
      }).join("");
      const deadline = data.rsvpDeadlineText || (data.rsvpDeadline ? `${word("replyBy")} ${fmtDate(data.rsvpDeadline, true)}` : "");
      const contacts = (data.rsvpContacts || []).filter((c) => c.name || c.phone).map((c) => {
        const tel = String(c.phoneHref || c.phone || "").replace(/[^\d+]/g, "");
        return `<li>${c.name ? `<b>${esc(c.name)}</b>` : ""}${c.phone ? `<a href="tel:${esc(tel)}">${esc(c.phone)}</a>` : ""}</li>`;
      }).join("");
      const couple = photoSrc(data.photo2Id || data.photo2Url);
      return `
      <section class="ch ch-rsvp" id="rsvp" data-ch="rsvp">
        <div class="ch-inner">
          ${h2(word("rsvp"))}
          ${data.rsvpIntro ? paragraphs(data.rsvpIntro, "inv-p") : ""}
          ${deadline ? `<p class="rf-deadline reveal">${esc(deadline)}</p>` : ""}
          ${contacts ? `<ul class="rf-contacts reveal">${contacts}</ul>` : ""}
          <form class="rf reveal" novalidate>
            <label class="rf-field"><span>${T("yourName")}</span><input type="text" name="guest_name" required maxlength="120" value="${esc(opts.guestName || "")}"></label>
            ${data.collectEmail ? `<label class="rf-field"><span>${T("email")}</span><input type="email" name="email" maxlength="160" placeholder="${T("emailPlaceholder")}"></label>` : ""}
            <div class="rf-field"><span>${T("willAttend")}</span>
              <div class="rf-attend" role="radiogroup">
                <label><input type="radio" name="attending" value="yes" checked><i></i>${T("yes")}</label>
                <label><input type="radio" name="attending" value="no"><i></i>${T("no")}</label>
              </div></div>
            <div class="rf-field rf-yes"><span>${T("guests")}</span>
              <div class="rf-step"><button type="button" data-d="-1" aria-label="${T("fewer")}">−</button><input type="number" name="party_size" min="1" max="20" value="1"><button type="button" data-d="1" aria-label="${T("more")}">+</button></div></div>
            ${qs}
            <label class="rf-field"><span>${T("message")}</span>
              <textarea name="message" rows="2" maxlength="1000"></textarea></label>
            <button type="submit" class="rf-send">${T("send")}</button>
            <p class="rf-status" aria-live="polite"></p>
          </form>
          ${data.closingText ? `<p class="rf-closing reveal">${esc(data.closingText)}</p>` : ""}
          ${data.hosts && !data.hideRsvpHosts ? `<p class="rf-hosts reveal">${T("hostedBy")} ${esc(data.hosts)}</p>` : ""}
          ${couple ? `<figure class="rf-couple reveal"><img src="${esc(couple)}" alt="" loading="lazy"></figure>` : ""}
        </div>
      </section>`;
    },
  };

  const DEFAULT_ORDER = ["hero", "photo", "message", "details", "schedule", "rsvp"];

  function trackId(m) {
    const match = /track[/:]([A-Za-z0-9]{10,40})/.exec(String(m.spotify || ""));
    return match ? match[1] : "";
  }
  // The id of a video, from a link to it or from the id itself. Nothing else of what was typed is used.
  function videoId(v) {
    const text = String(v || "").trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
    const match = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/.exec(text);
    return match ? match[1] : "";
  }

  // ---------- the song: the official player, fetched when its chapter comes near ----------
  const PLAYER = "https://www.youtube-nocookie.com";
  let songCleanup = null;
  function wireSong(root) {
    if (songCleanup) songCleanup();
    const figures = [...root.querySelectorAll(".song-frame[data-video]")];
    if (!figures.length) return;
    const frames = new Set();
    const answered = new WeakSet();          // players that have said something
    const timers = [];
    const heard = (e) => {
      const from = e.origin === PLAYER && [...frames].find((f) => f.contentWindow === e.source);
      if (!from) return;
      answered.add(from);
      let said = e.data;
      if (typeof said === "string") { try { said = JSON.parse(said); } catch (err) { return; } }
      const info = said && said.info;
      const state = info && typeof info === "object" ? info.playerState : (said && said.event === "onStateChange" ? info : undefined);
      if (state === 1 || state === 3) soundState.hush();          // the song plays: the page's music rests
      else if (state === 0 || state === 2) soundState.back();
    };
    addEventListener("message", heard);
    const near = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      near.unobserve(e.target);
      const frame = document.createElement("iframe");
      frame.title = (root.querySelector(".ch-song h2") || {}).textContent || "";
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";
      frame.referrerPolicy = "strict-origin-when-cross-origin";   // the player refuses a page that does not say where it is
      frame.src = PLAYER + "/embed/" + encodeURIComponent(e.target.dataset.video)
        + "?playsinline=1&rel=0&enablejsapi=1&origin=" + encodeURIComponent(location.origin);
      // The player tells what it does only to a page that has greeted it, and a greeting that comes
      // before it listens is lost: the page greets until the player has answered, for a minute at most.
      const hello = () => { if (frame.contentWindow) frame.contentWindow.postMessage(JSON.stringify({ event: "listening", id: "fira-song", channel: "widget" }), PLAYER); };
      frame.addEventListener("load", () => {
        let tries = 0;
        hello();
        const again = setInterval(() => {
          if (answered.has(frame) || ++tries > 40) return clearInterval(again);
          hello();
        }, 1500);
        timers.push(again);
      });
      frames.add(frame);
      e.target.querySelector(".song-screen").appendChild(frame);
    }), { rootMargin: "120% 0px 120% 0px" });
    figures.forEach((f) => near.observe(f));
    songCleanup = () => { removeEventListener("message", heard); near.disconnect(); timers.forEach(clearInterval); songCleanup = null; };
  }

  // ---------- music: the official player, loaded when the guest asks for it ----------
  function wireMusic(root) {
    root.querySelectorAll(".music-card").forEach((card) => {
      card.querySelector(".music-play").addEventListener("click", () => {
        if (card.classList.contains("is-open")) return;
        root.querySelectorAll(".music-card.is-open").forEach((other) => {   // one song at a time
          other.classList.remove("is-open");
          const frame = other.querySelector("iframe");
          if (frame) frame.remove();
        });
        card.classList.add("is-open");
        soundState.hush();
        const frame = document.createElement("iframe");
        frame.className = "music-frame";
        frame.title = card.querySelector(".music-meta b").textContent;
        frame.loading = "eager";
        frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
        frame.src = "https://open.spotify.com/embed/track/" + encodeURIComponent(card.dataset.track) + "?utm_source=fira";
        card.appendChild(frame);
      });
    });
  }

  // ---------- RSVP ----------
  function wireRsvp(root, data, opts, theme) {
    const form = root.querySelector(".rf");
    if (!form) return;
    const size = () => Math.min(20, Math.max(1, parseInt(form.party_size.value || "1", 10) || 1));

    function perGuest() {   // one choice per guest, kept in step with the number of guests
      form.querySelectorAll(".rf-perguest").forEach((box) => {
        const options = JSON.parse(box.dataset.options);
        const chosen = [...box.querySelectorAll("select")].map((s) => s.value);
        const n = size();
        box.innerHTML = Array.from({ length: n }, (_, i) => `
          <label class="rf-guest">${n > 1 ? `<small>${esc(word("guestN").replace("{n}", i + 1))}</small>` : ""}
            <select>${options.map((o) => `<option ${chosen[i] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`).join("");
      });
    }
    form.querySelectorAll(".rf-step button").forEach((b) => b.addEventListener("click", () => {
      form.party_size.value = Math.min(20, Math.max(1, size() + parseInt(b.dataset.d, 10)));
      perGuest();
    }));
    form.party_size.addEventListener("input", perGuest);
    form.querySelectorAll("input[name=attending]").forEach((r) => r.addEventListener("change", () =>
      form.classList.toggle("is-no", form.attending.value === "no")));
    perGuest();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = form.querySelector(".rf-status");
      const name = form.guest_name.value.trim();
      if (!name) { status.textContent = word("nameMissing"); return; }
      const yes = form.attending.value === "yes";
      const answers = {};
      if (form.email && form.email.value.trim()) answers[word("email")] = form.email.value.trim();
      if (yes) {
        (data.questions || []).forEach((q, i) => {
          const multi = form.querySelector(`.rf-multi[data-q="${i}"]`);
          const radio = form.querySelector(`.rf-radio[data-q="${i}"]`);
          const each = form.querySelector(`.rf-perguest[data-q="${i}"]`);
          let value = "";
          if (each) value = [...each.querySelectorAll("select")].map((s) => s.value).join(", ");
          else if (multi) value = [...multi.querySelectorAll("input:checked")].map((c) => c.value).join(", ");
          else if (radio) value = (radio.querySelector("input:checked") || {}).value || "";
          else value = (form.querySelector(`[data-q="${i}"]`) || {}).value || "";
          if (value) answers[q.label] = value;
        });
      }
      const btn = form.querySelector(".rf-send");
      btn.disabled = true;
      status.textContent = word("sending");
      try {
        if (!opts.inviteId) throw new Error(word("previewOnly"));
        await window.FiraAPI.sendRsvp(opts.inviteId, {
          guest_name: name,
          attending: form.attending.value,
          party_size: yes ? size() : 1,
          answers,
          message: form.message.value.trim(),
        });
        const r = btn.getBoundingClientRect();
        form.innerHTML = `<p class="rf-done">${T(yes ? "thanksYes" : "thanksNo")} ${esc(name)}${yes ? "! ✦" : "."}</p>`;
        const pill = document.querySelector(".cta-pill");
        if (pill) pill.remove();
        if (yes) celebrate(theme.swatch.concat(["#FFFFFF"]), { x: r.left + r.width / 2, y: r.top });
      } catch (err) {
        status.textContent = (err && err.message) || word("sendFailed");
        btn.disabled = false;
      }
    });
  }

  // ======================================================================
  // Envelopes
  // ======================================================================
  // "Alma & Theo" -> "A·T"; an explicit sealText wins.
  function monogram(data) {
    if (data.sealText) return String(data.sealText).slice(0, 3);
    const t = (data.title || "").trim();
    const parts = t.split(/\s*(?:&|\+|\band\b|\boch\b)\s*/i).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + "·" + parts[1][0]).toUpperCase();
    return (t[0] || "F").toUpperCase();
  }

  function sealSvg(initials) {
    return `
    <svg viewBox="0 0 120 120" class="seal-svg" aria-hidden="true">
      <defs><radialGradient id="wax" cx="42%" cy="36%" r="72%">
        <stop offset="0%" stop-color="var(--seal-hi)"/><stop offset="55%" stop-color="var(--seal-md)"/><stop offset="100%" stop-color="var(--seal-lo)"/>
      </radialGradient></defs>
      <path class="seal-blob" fill="url(#wax)" d="M60,6 C78,4 94,14 102,28 C110,42 114,58 108,74 C102,90 88,102 72,108 C56,114 38,110 26,100 C14,90 6,74 8,58 C10,42 18,28 30,18 C40,10 48,8 60,6 Z"/>
      <path fill="none" stroke="var(--seal-lo)" stroke-width="1.6" opacity="0.55" d="M60,18 C74,16 86,24 92,35 C98,46 101,58 96,70 C91,82 80,91 68,95 C54,99 40,96 31,88 C22,80 16,68 18,56 C20,44 26,33 36,26 C44,20 50,19 60,18 Z"/>
      <text x="60" y="72" text-anchor="middle" class="seal-mono">${esc(initials)}</text>
      <ellipse cx="42" cy="30" rx="14" ry="7" fill="#fff" opacity="0.18" transform="rotate(-24 42 30)"/>
    </svg>`;
  }

  const REPLAY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 109-9 9.5 9.5 0 00-6.6 2.7L3 8"/><path d="M3 3v5h5"/></svg>`;

  const address = (data, opts) => (opts.guestName
    ? `${T("for")} ${esc(opts.guestName)}`
    : esc(data.envelopeTeaser || word("teaser")));

  // Sound: the opening film, and the music of the invitation (`backgroundMusic`, else the theme's
  // `music`). Browsers allow sound only from inside a tap, so the music starts with the tap that opens
  // the envelope, or with the first tap on the sound button, and loops from there on.
  // A quarter of a second of silence. Played from inside the tap, it earns the player the right to
  // start the music later, when the opening film has arrived and the line is free for it.
  const SILENCE = "data:audio/wav;base64,UklGRhYIAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgATElTVBoAAABJTkZPSVNGVA4AAABMYXZmNjIuMTIuMTAyAGRhdGHQBwAAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=";
  const soundState = {
    on: false, media: [], song: null, started: false, waiting: false, btn: null,
    set(v) {
      this.on = v;
      this.media.forEach((m) => (m.muted = !v));
      if (this.song) {
        this.song.muted = !v;
        if (v && this.started && !this.waiting && this.song.paused) { const p = this.song.play(); if (p && p.catch) p.catch(() => {}); }
      }
      if (this.btn) this.btn.classList.toggle("on", v);
    },
    bind(m) { this.media.push(m); },
    music(stage, src) {
      const song = document.createElement("audio");
      song.className = "inv-song";
      song.preload = "none";
      song.volume = 0.85;          // phones ignore this: the level is set in the file
      song.dataset.src = src;
      stage.appendChild(song);
      this.song = song;
    },
    // Call from inside a tap. `hold`: something else is being fetched that must come first.
    start(muted, hold) {
      if (!this.song || this.started) return;
      this.started = true;
      this.waiting = !!hold;
      this.song.muted = !!muted;
      this.song.loop = !hold;
      this.song.src = hold ? SILENCE : this.song.dataset.src;
      const p = this.song.play();
      if (p && p.catch) p.catch(() => { this.started = false; this.waiting = false; });
    },
    go() {                         // the line is free: the music itself
      if (!this.song || !this.started || !this.waiting) return;
      this.waiting = false;
      this.song.loop = true;
      this.song.src = this.song.dataset.src;
      if (document.hidden) return;
      const p = this.song.play();
      if (p && p.catch) p.catch(() => {});
    },
    hush() { if (this.song && !this.song.paused) this.song.pause(); },   // something else is playing
    back() {                       // it has stopped: the page's music again, if the guest has sound on
      if (!this.song || !this.on || !this.started || this.waiting || document.hidden || !this.song.paused) return;
      const p = this.song.play();
      if (p && p.catch) p.catch(() => {});
    },
    reset() {
      if (this.song) { this.song.pause(); this.song.removeAttribute("src"); }
      this.on = false; this.media = []; this.song = null; this.started = false; this.waiting = false; this.btn = null;
    },
  };
  document.addEventListener("visibilitychange", () => {   // no music from a page nobody is looking at
    const song = soundState.song;
    if (!song || !soundState.started) return;
    if (document.hidden) song.pause();
    else if (soundState.on && !soundState.waiting) { const p = song.play(); if (p && p.catch) p.catch(() => {}); }
  });
  function soundToggle(stage) {
    const b = document.createElement("button");
    b.className = "snd-toggle" + (soundState.on ? " on" : "");
    b.setAttribute("aria-label", word("toggleSound"));
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 5L6 9H3v6h3l5 4V5z"/><path class="w1" d="M15.5 8.5a5 5 0 010 7"/><path class="w2" d="M18.5 5.5a9 9 0 010 13"/><path class="x" d="M16 9l5 6M21 9l-5 6"/></svg>`;
    b.addEventListener("click", () => {
      const on = !soundState.on;
      if (on) soundState.start(false);     // the first sound of a page that opened without a tap
      soundState.set(on);
    });
    soundState.btn = b;
    stage.appendChild(b);
  }

  // The sound hint on a sealed envelope. Guests opened the invitation with their phone turned down and
  // never heard it (Hampus, 2026-09-29), so it is a card of its own, above the words that say "tap".
  const soundHint = () => `
      <p class="env4-sound"><span class="snd-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path class="w1" d="M15.5 8.5a5 5 0 010 7"/><path class="w2" d="M18.5 5.5a9 9 0 010 13"/></svg></span><span class="snd-words"><b>${T("soundHint")}</b><small>${T("soundWhy")}</small></span></p>`;

  // After the tap: play the film, with sound if the browser allows it. While the film is still on its
  // way (a slow connection), the hint says so. `done` is called once: when the film has ended or failed,
  // a while after it should have ended, or when it never started.
  function playFilm(env, film, opts, done) {
    const hint = env.querySelector(".env4-hint");
    if (film.readyState < 3) {
      env.classList.add("waiting");
      if (hint) hint.textContent = word("opening");
    }
    const never = setTimeout(done, 25000);
    film.addEventListener("playing", () => {
      clearTimeout(never);
      env.classList.remove("waiting");
      setTimeout(done, ((film.duration || 8) - film.currentTime) * 1000 + 4000);
    }, { once: true });
    film.addEventListener("ended", done);
    film.addEventListener("error", done);
    film.muted = !!opts.startMuted;
    if (soundState.song) film.volume = 0.7;      // the film's own sound sits under the music
    soundState.start(film.muted);
    soundState.set(!film.muted);
    const p = film.play();
    if (p && p.catch) p.catch(() => { film.muted = true; soundState.set(false); film.play().catch(done); });
  }

  // The film IS the envelope: its first frame is the sealed envelope, a tap plays it with sound.
  function filmEnvelope(mount, data, theme, opts, onOpen) {
    const o = theme.opening;
    const sp = o.sealPos || { x: 50, y: 50 };
    const mono = o.monogram === false ? "" :
      `<div class="env4-mono" style="left:${Number(sp.x) || 50}%;top:${Number(sp.y) || 50}%;--seal-k:${(Number(o.sealSize) || 24) / 100}">${esc(monogram(data))}</div>`;
    const env = document.createElement("div");
    env.className = "env4";
    env.innerHTML = `
      <video class="env4-film" poster="${esc(o.poster)}" preload="auto" playsinline muted></video>
      <div class="env4-scrim"></div>
      <p class="env4-addr">${address(data, opts)}</p>
      ${mono}
      ${soundHint()}
      <p class="env4-hint">${T("tapToOpen")}</p>
      <button class="env4-tap" aria-label="${T("openInvitation")}"></button>`;
    mount.appendChild(env);
    const film = env.querySelector(".env4-film");
    film.src = o.video;
    film.load();

    let opened = false, finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      env.classList.add("lifting"); onOpen();
      setTimeout(() => env.remove(), 1300);
    };
    const open = () => {
      if (opened) return;
      opened = true;
      soundState.start(!!opts.startMuted);
      if (navigator.vibrate) { try { navigator.vibrate(18); } catch (e) {} }
      if (!opts.noFullscreen) tryFullscreen();
      env.classList.add("opening");
      playFilm(env, film, opts, finish);
    };
    env.querySelector(".env4-tap").addEventListener("click", open);
    soundState.bind(film);
    return env;
  }

  // Undoes what a sealed envelope did to the page. render() calls it, so a preview that is drawn again
  // while an envelope is still sealed does not leave the page locked.
  let unseal = null;

  // Which film to play. The full film needs a line that carries 8 Mbit/s: below that the small one
  // (`opening.videoLight`) plays without standing still, and on a phone it looks the same.
  // What the browser says about the line is an estimate and often too kind, so the line is measured:
  // how fast did the picture of the envelope arrive? A picture that came from the cache says nothing,
  // and then the browser's word counts.
  function pickFilm(o) {
    if (!o.videoLight) return Promise.resolve(o.video);
    const c = navigator.connection || {};
    if (c.saveData || (c.downlink > 0 && c.downlink < 8) || /(^|-)(2g|3g)$/.test(c.effectiveType || "")) return Promise.resolve(o.videoLight);
    return new Promise((resolve) => {
      const img = new Image();
      let timer = 0;
      const done = (src) => { clearTimeout(timer); resolve(src); };
      timer = setTimeout(() => done(o.videoLight), 2500);        // still on its way: slow
      img.onload = () => {
        const seen = (performance.getEntriesByName(img.src) || []).filter((e) => e.transferSize > 20000 && e.responseEnd > e.responseStart);
        if (!seen.length) return done(o.video);                  // from the cache: a second visit
        const kbit = Math.min(...seen.map((e) => e.transferSize * 8 / (e.responseEnd - e.responseStart)));
        done(kbit < 8000 ? o.videoLight : o.video);
      };
      img.onerror = () => done(o.video);
      img.src = o.poster;
    });
  }

  // The film lands on the hero: it runs from the sealed envelope to the first picture of the page, so
  // it plays inside the hero itself. The names arrive while it settles (`opening.lands`, in seconds),
  // and when it ends the hero's own loop takes over on the same frame. Nothing is cut or faded across.
  function landingOpening(stage, data, theme, opts, onSettled) {
    const o = theme.opening;
    const hero = stage.querySelector(".ch-hero");
    const heroStage = hero.querySelector(".hero-stage");
    const loop = hero.querySelector(".hero-video");
    const sp = o.sealPos || { x: 50, y: 50 };
    const film = document.createElement("video");
    film.className = "hero-film";
    film.setAttribute("playsinline", "");
    film.playsInline = true;
    film.muted = true;
    film.preload = "auto";
    film.poster = o.poster;
    heroStage.insertBefore(film, heroStage.querySelector(".hero-scrim"));
    let wanted = false;                            // a tap that came before the film was chosen
    pickFilm(o).then((src) => { film.src = src; film.load(); if (wanted) open(); });

    const env = document.createElement("div");
    env.className = "env4 env4-clear";            // no picture of its own: the hero behind it is the envelope
    env.innerHTML = `
      <div class="env4-scrim"></div>
      <p class="env4-addr">${address(data, opts)}</p>
      ${o.monogram === false ? "" : `<div class="env4-mono" style="left:${Number(sp.x) || 50}%;top:${Number(sp.y) || 50}%;--seal-k:${(Number(o.sealSize) || 24) / 100}">${esc(monogram(data))}</div>`}
      ${soundHint()}
      <p class="env4-hint">${T("tapToOpen")}</p>
      <button class="env4-tap" aria-label="${T("openInvitation")}"></button>`;
    stage.appendChild(env);
    const page = document.documentElement;
    page.classList.add("sealed");                  // the page does not scroll until the envelope has opened
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";   // a reload starts at the envelope
    const stay = () => { if (window.scrollY) window.scrollTo(0, 0); };
    addEventListener("scroll", stay, { passive: true });
    stay();
    unseal = () => { removeEventListener("scroll", stay); page.classList.remove("sealed"); unseal = null; };

    // The film goes first. What comes after it (the loop, the frames that follow the scroll) is fetched
    // once the film has arrived in full, or when it has ended.
    let fed = false;
    let pictureIn = !o.hero, leave = null;         // the picture the film lands on, and the film's way out
    const feed = () => {
      if (fed) return;
      fed = true;
      if (o.hero) {
        const picture = new Image();
        picture.onload = picture.onerror = () => { pictureIn = true; if (leave) leave(); };
        picture.src = o.hero;
      }
      if (loop) {
        if (loop.dataset.poster) loop.poster = loop.dataset.poster;
        loop.preload = "auto"; loop.load();
      }
      soundState.go();
      hero.dispatchEvent(new Event("fira:fed"));
    };
    const arrived = () => {
      try {
        const b = film.buffered;
        return film.duration > 0 && b.length > 0 && b.end(b.length - 1) >= film.duration - 0.25;
      } catch (e) { return false; }
    };
    ["progress", "canplaythrough", "suspend"].forEach((name) => film.addEventListener(name, () => { if (arrived()) feed(); }));

    let opened = false, released = false, settled = false;
    const release = () => {                        // the names arrive
      if (released) return;
      released = true;
      hero.classList.remove("held");
    };
    const settle = () => {                         // the film has landed: the page is open
      if (settled) return;
      settled = true;
      release();
      feed();
      if (loop) {
        try { loop.currentTime = 0; } catch (e) { /* not loaded yet: it starts from its poster */ }
        loop.dataset.live = "1";
        const p = loop.play();
        if (p && p.catch) p.catch(() => {});
      }
      // The film rests on its last frame until the picture under it has arrived in full.
      let left = false;
      leave = () => {
        if (left) return;
        left = true;
        film.classList.add("done");
        setTimeout(() => film.remove(), 900);
      };
      if (pictureIn) leave(); else setTimeout(leave, 8000);
      env.remove();
      if (unseal) unseal();
      if (soundState.btn && !soundState.song) soundState.btn.remove();   // the film was the only thing with sound
      onSettled();
    };
    function open(e) {
      if (opened) return;
      if (e && e.isTrusted !== false) soundState.start(!!opts.startMuted, !fed);   // sound is allowed from inside a tap only
      if (!film.getAttribute("src")) { wanted = true; return; }   // it opens as soon as the film is chosen
      opened = true;
      if (navigator.vibrate) { try { navigator.vibrate(18); } catch (e) {} }
      if (!opts.noFullscreen) tryFullscreen();
      env.classList.add("opening");
      playFilm(env, film, opts, settle);
      const watch = () => {
        if (settled) return;
        if (film.currentTime >= Number(o.lands)) release();
        requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    }
    env.querySelector(".env4-tap").addEventListener("click", open);
    soundState.bind(film);
    return env;
  }

  // Coded envelope, for themes without a film.
  function envelope(mount, data, theme, opts, onOpen) {
    const initials = monogram(data);
    const env = document.createElement("div");
    env.className = "env3";
    env.innerHTML = `
      <div class="env3-paper">
        <div class="env3-grain"></div>
        <div class="env3-border"></div>
        <div class="env3-flap"><div class="env3-flap-inner"></div></div>
        <p class="env3-addr">${address(data, opts)}</p>
        <div class="env3-sealwrap">
          <button class="env3-seal" aria-label="${T("openInvitation")}">${sealSvg(initials)}</button>
          <div class="env3-half l" aria-hidden="true">${sealSvg(initials)}</div>
          <div class="env3-half r" aria-hidden="true">${sealSvg(initials)}</div>
        </div>
        <p class="env3-hint">${T("tapSeal")}</p>
      </div>`;
    mount.appendChild(env);
    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      if (navigator.vibrate) { try { navigator.vibrate(18); } catch (e) {} }
      if (!opts.noFullscreen) tryFullscreen();
      env.classList.add("sealing");
      if (soundState.song) { soundState.start(!!opts.startMuted); soundState.set(!opts.startMuted); }
      setTimeout(() => env.classList.add("cracked"), 260);
      setTimeout(() => env.classList.add("unfolding"), 760);
      setTimeout(() => { env.classList.add("lifting"); onOpen(); }, 1500);
      setTimeout(() => env.remove(), 2600);
    };
    env.querySelector(".env3-seal").addEventListener("click", (e) => { e.stopPropagation(); open(); });
    env.addEventListener("click", open);
    return env;
  }

  // ======================================================================
  // render(data, mount, opts)
  // opts: { inviteId, skipEnvelope, noRsvp, guestName, noFullscreen, noFilm, noMusic, startMuted }
  // ======================================================================
  let chromeCleanup = null;
  function render(data, mount, opts = {}) {
    const theme = window.FIRA_TEMPLATES[data.template] || window.FIRA_TEMPLATES.botanical;
    buildLabels(data, theme);
    if (unseal) unseal();
    if (chromeCleanup) chromeCleanup();
    soundState.reset();
    mount.innerHTML = "";
    document.querySelectorAll(".cta-pill, .fs-toggle, .snd-toggle, .replay, .celebrate-canvas").forEach((el) => el.remove());
    mount.className = "inv-root theme-" + theme.id;
    document.documentElement.lang = LBL._lang;
    if (theme.fonts && !document.getElementById("f-" + theme.id)) {
      const l = document.createElement("link");
      l.id = "f-" + theme.id; l.rel = "stylesheet"; l.href = theme.fonts;
      document.head.appendChild(l);
    }
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; document.head.appendChild(meta); }
    meta.content = theme.envTint ? theme.envTint.paper : "#F3EBDD";

    const stage = document.createElement("div");
    stage.className = "inv-stage";
    mount.appendChild(stage);
    const song = data.backgroundMusic === false || opts.noMusic ? "" : safeUrl(data.backgroundMusic || theme.music || "");
    if (song) soundState.music(stage, song);

    const o = theme.opening || {};
    const film = !!(o.video && !opts.noFilm) && !opts.skipEnvelope && !REDUCED;
    const lands = film && Number(o.lands) > 0;      // the film ends on the hero picture and plays inside it

    // Open the invitation again: the sealed envelope as it came, with its film and its music from the
    // start. For a guest who opened it with the sound off, or wants to see it once more.
    const sealedFirst = !opts.skipEnvelope && !REDUCED;
    const replay = () => {
      scrollTo(0, 0);
      render(data, mount, opts);
    };

    // `held`: the story is built behind the sealed envelope and waits there until the film has landed.
    const showStory = (held) => {
      if (stage.querySelector(".story")) return () => {};
      if (theme.decorate) theme.decorate(stage, U);
      parallax(stage);
      const wrap = document.createElement("div");
      wrap.className = "story";
      const order = (Array.isArray(data.chapters) && data.chapters.length ? data.chapters : theme.chapters) || DEFAULT_ORDER;
      const chapterOpts = Object.assign({}, opts, { _held: !!held });
      wrap.innerHTML = `
        ${theme.storyBg ? `<div class="story-bg" aria-hidden="true"><img src="${esc(theme.storyBg)}" alt=""></div>` : ""}
        <div class="story-progress" aria-hidden="true"><i></i></div>
        ${order.map((name) => {
          const [kind, arg] = String(name).split(":");
          return CH[kind] ? CH[kind](data, theme, chapterOpts, arg) : "";
        }).join("")}
        <footer class="story-foot">
          ${sealedFirst ? `<button class="replay-end" type="button">${REPLAY_ICON}<span>${T("replayEnd")}</span></button>` : ""}
          <a class="inv-fira" href="index.html" target="_blank" rel="noopener">${T("madeWith")}</a>
        </footer>`;
      stage.appendChild(wrap);
      const again = wrap.querySelector(".replay-end");
      if (again) again.addEventListener("click", replay);
      wrap.querySelectorAll(".ch:not(.ch-hero)").forEach((ch, i) => ch.classList.add(i % 2 ? "band-b" : "band-a"));
      wrap.querySelectorAll(".inv-countdown").forEach((el) => countdown(el, data));
      wireRsvp(wrap, data, opts, theme);
      wireMusic(wrap);
      wireSong(wrap);
      wholePictures(wrap);
      flights(wrap, theme);
      revealOnScroll(wrap);
      storyEngine(wrap);
      if (theme.after) theme.after(wrap, data, opts, U);
      const chrome = () => addChrome(wrap);
      if (!held) chrome();
      return chrome;
    };

    // The reply shortcut, "open again" and the full-screen button: they belong to the open page.
    const addChrome = (wrap) => {
      if (sealedFirst) {                              // at the top of the page; it steps aside while the guest reads
        const again = document.createElement("button");
        again.type = "button";
        again.className = "replay";
        again.innerHTML = `${REPLAY_ICON}<span>${T("replay")}</span>`;
        again.addEventListener("click", replay);
        stage.appendChild(again);
        const away = () => again.classList.toggle("away", scrollY > innerHeight * 0.3);
        addEventListener("scroll", away, { passive: true });
        chromeCleanup = () => { removeEventListener("scroll", away); chromeCleanup = null; };
        away();
        setTimeout(() => again.classList.add("show"), 1600);
      }
      if (!opts.noRsvp && wrap.querySelector("#rsvp")) {
        const pill = document.createElement("button");
        pill.className = "cta-pill" + (theme.ctaStyle === "scroll" ? " cta-scroll" : "");
        pill.innerHTML = theme.ctaStyle === "scroll"
          ? `<span>${T("cta")}</span><i class="mouse" aria-hidden="true"></i>`
          : T("cta");
        pill.addEventListener("click", () => glideTo(wrap.querySelector("#rsvp")));
        stage.appendChild(pill);
        setTimeout(() => pill.classList.add("show"), 2400);
        // It steps aside at the reply form and at the end of the story, where "open again" is.
        const inView = new Set();
        const io = new IntersectionObserver((es) => {
          es.forEach((e) => (e.isIntersecting ? inView.add(e.target) : inView.delete(e.target)));
          pill.classList.toggle("hide", inView.size > 0);
        }, { threshold: 0.2 });
        io.observe(wrap.querySelector("#rsvp"));
        io.observe(wrap.querySelector(".story-foot"));
      }
      if (!opts.skipEnvelope && !opts.noFullscreen && canFullscreen()) {
        const fs = document.createElement("button");
        fs.className = "fs-toggle";
        fs.setAttribute("aria-label", word("toggleFullscreen"));
        fs.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`;
        fs.addEventListener("click", () => (isFullscreen() ? exitFullscreen() : tryFullscreen()));
        stage.appendChild(fs);
      }
    };

    if (opts.skipEnvelope || REDUCED) {
      showStory(false);
      if (soundState.song) soundToggle(stage);
      return;
    }
    if (lands) {
      const chrome = showStory(true);
      landingOpening(stage, data, theme, opts, chrome);
      soundToggle(stage);
    } else if (film) {
      filmEnvelope(stage, data, theme, opts, () => showStory(false));
      soundToggle(stage);
    } else {
      envelope(stage, data, theme, opts, () => showStory(false));
      if (soundState.song) soundToggle(stage);
    }
  }

  const U = { esc, fmtDate, icsHref, particles, celebrate, parallax, countdown, photoSrc, safeUrl, word, reduced: REDUCED };
  window.FiraInvite = { render, esc, fmtDate, chapters: CH, eventInstant, safeUrl };
})();
