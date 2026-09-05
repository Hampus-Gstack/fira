// Fira invitation engine v5 — film envelope (video is the envelope), hero
// video loops, and a composable chapter system: hero · photo · message ·
// countdown · details · venue · schedule · dresscode · gifts · menu ·
// accommodation · faq · contact · rsvp. Themes pick their chapter order and
// bring identity + generated art; the mechanics live here.
(function () {
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const API = () => window.FIRA_CONFIG.API_BASE;

  function fmtDate(dateStr, lang) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T12:00:00");
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString(lang || "en-GB", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  }
  function fmtShort(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return y && m && d ? `${d}.${m}.${y.slice(2)}` : dateStr;
  }

  // "Alma & Theo" -> "A·T"; explicit sealText wins.
  function monogram(data) {
    if (data.sealText) return String(data.sealText).slice(0, 3);
    const t = (data.title || "").trim();
    const parts = t.split(/\s*(?:&|\+|and|och)\s*/i).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + "·" + parts[1][0]).toUpperCase();
    return (t[0] || "F").toUpperCase();
  }

  const photoSrc = (v) => !v ? "" : (/^https?:\/\//.test(v) ? v : API() + "/photos/" + encodeURIComponent(v));
  const L = (theme, key, fallback) => esc(((theme.labels || {})[key]) || fallback);

  // ---------- countdown ----------
  function countdown(el, dateStr, timeStr) {
    if (!el) return;
    if (!dateStr) { el.remove(); return; }
    const target = new Date(dateStr + "T" + (timeStr || "00:00"));
    if (isNaN(target)) { el.remove(); return; }
    const units = [["days", 86400000], ["hours", 3600000], ["minutes", 60000], ["seconds", 1000]];
    el.innerHTML = units
      .map(([u], i) => `${i ? '<span class="cd-colon" aria-hidden="true">:</span>' : ""}<div class="cd-cell"><span class="cd-num" data-u="${u}">&nbsp;</span><span class="cd-lbl">${u}</span></div>`)
      .join("");
    function tick() {
      let diff = target - Date.now();
      if (diff < 0) { el.innerHTML = `<p class="cd-today">Today is the day ✦</p>`; return; }
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

  // ---------- .ics ----------
  function icsHref(data) {
    if (!data.date) return null;
    const dt = (data.date || "").replace(/-/g, "");
    const tm = (data.time || "12:00").replace(":", "") + "00";
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fira//EN", "BEGIN:VEVENT",
      "UID:" + (data._id || Math.random().toString(36).slice(2)) + "@fira",
      "DTSTART:" + dt + "T" + tm, "DTEND:" + dt + "T235900",
      "SUMMARY:" + (data.title || "Event").replace(/[,;]/g, " "),
      "LOCATION:" + ((data.venue || "") + " " + (data.address || "")).trim().replace(/[,;]/g, " "),
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

  // ---------- pointer / gyro parallax ----------
  function parallax(stage) {
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
    addEventListener("pointermove", (e) => {
      tx = (e.clientX / innerWidth - 0.5) * 22;
      ty = (e.clientY / innerHeight - 0.5) * 22;
      kick();
    }, { passive: true });
    addEventListener("deviceorientation", (e) => {
      if (e.gamma == null) return;
      tx = Math.max(-24, Math.min(24, e.gamma)) * 0.9;
      ty = Math.max(-24, Math.min(24, (e.beta || 0) - 40)) * 0.6;
      kick();
    }, { passive: true });
  }

  // ---------- scroll-story engine ----------
  function storyEngine(root) {
    if (window.__firaStoryCleanup) window.__firaStoryCleanup();
    const chapters = [...root.querySelectorAll(".ch")];
    const bar = root.querySelector(".story-progress i");
    let ticking = false;
    function update() {
      ticking = false;
      const vh = innerHeight;
      for (const ch of chapters) {
        const r = ch.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
        ch.style.setProperty("--p", p.toFixed(4));
      }
      if (bar) {
        const max = document.documentElement.scrollHeight - vh;
        bar.style.width = (max > 0 ? (scrollY / max) * 100 : 0).toFixed(2) + "%";
      }
    }
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", update);
    window.__firaStoryCleanup = () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", update);
    };
    update();
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
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  // ======================================================================
  // Chapters. Each returns "" when its data is absent.
  // ======================================================================
  const frameCorners = () => ["tl", "tr", "bl", "br"].map((c) => `
    <svg class="hf-corner ${c}" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M2,98 V40 C2,18 18,2 40,2 H98" fill="none" stroke="currentColor" stroke-width="1.4"/>
      <path d="M10,98 V46 C10,26 26,10 46,10 H98" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.6"/>
      <path d="M22,22 c8,-6 18,-4 22,4 c-6,2 -12,0 -16,-4 c-4,4 -10,6 -16,4 c4,-8 14,-10 22,-4 z" fill="currentColor" opacity="0.8"/>
      <circle cx="40" cy="40" r="2.4" fill="currentColor"/>
    </svg>`).join("");

  const CH = {
    hero(data, theme) {
      const o = theme.opening || {};
      let bg = "";
      if (o.heroVideo) {
        bg = `<div class="hero-bg"><video class="hero-video" autoplay muted loop playsinline poster="${esc(o.hero || "")}"><source src="${esc(o.heroVideo)}" type="video/mp4"></video></div>`;
      } else if (o.hero) {
        bg = `<div class="hero-bg"><img src="${esc(o.hero)}" alt=""></div>`;
      }
      const hasBg = !!(o.heroVideo || o.hero);
      const art = theme.art && theme.art.hero && !hasBg ? theme.art.hero(data) : "";
      const split = theme.heroLayout === "split";
      const eyebrow = esc(data.eventType || theme.labels.eyebrow || "You're invited");
      const dateLong = esc(fmtDate(data.date, data.lang)) + (data.time ? " · " + esc(data.time) : "");
      return `
      <section class="ch ch-hero ${hasBg ? "has-bg" : ""} ${split ? "hero-split" : ""}" data-ch="hero">
        ${bg}${hasBg ? '<div class="hero-scrim"></div>' : ""}
        ${theme.heroFrame ? `<div class="hero-frame" aria-hidden="true">${frameCorners()}</div>` : ""}
        <div class="ch-art">${art}</div>
        <div class="ch-inner">
          ${split ? `<div class="hero-top"><p class="inv-eyebrow hero-seq s1">${eyebrow}</p><p class="inv-date-short hero-seq s1">${esc(fmtShort(data.date))}</p></div>` : `<p class="inv-eyebrow hero-seq s1">${eyebrow}</p>`}
          <h1 class="inv-title hero-seq s2 ${theme.titleCls || ""}" ${theme.titleAttr ? `data-text="${esc(data.title || "")}"` : ""}>${esc(data.title || "Your names")}</h1>
          ${data.subtitle ? `<p class="inv-subtitle hero-seq s3">${esc(data.subtitle)}</p>` : ""}
          <div class="hero-seq s4">${theme.art && theme.art.divider ? theme.art.divider : ""}</div>
          ${split ? "" : `<p class="inv-date hero-seq s5">${dateLong}</p>`}
        </div>
        <div class="ch-chevron hero-seq s6" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 9l7 7 7-7"/></svg></div>
      </section>`;
    },

    photo(data, theme) {
      const src = photoSrc(data.photoUrl || data.photoId);
      if (!src) return "";
      return `
      <section class="ch ch-photo" data-ch="photo">
        <figure class="ph-frame ${theme.photoFrame ? "pf-" + theme.photoFrame : ""}"><img src="${esc(src)}" alt=""></figure>
      </section>`;
    },

    message(data, theme) {
      if (!data.message) return "";
      const lines = esc(data.message).split("\n").filter(Boolean)
        .map((l) => `<p class="msg-line reveal">${l}</p>`).join("");
      return `
      <section class="ch ch-message" data-ch="message">
        <div class="ch-inner">
          ${data.messageTitle ? `<h2 class="inv-h2 reveal">${esc(data.messageTitle)}</h2>` : `<div class="msg-mark reveal" aria-hidden="true">${theme.ornament || "✦"}</div>`}
          ${lines}
          ${data.hosts && !data.messageTitle ? `<p class="msg-sig reveal">— ${esc(data.hosts)}</p>` : ""}
        </div>
      </section>`;
    },

    countdown(data, theme) {
      if (!data.date) return "";
      return `
      <section class="ch ch-countdown" data-ch="countdown">
        <div class="ch-inner">
          <h2 class="inv-h2 reveal">${L(theme, "countdown", "The countdown")}</h2>
          ${theme.labels.countdownSub ? `<p class="inv-sub reveal">${esc(theme.labels.countdownSub)}</p>` : ""}
          <div class="inv-countdown reveal"></div>
        </div>
      </section>`;
    },

    details(data, theme) {
      const q = [data.venue, data.address].filter(Boolean).join(", ");
      const map = q && theme.showMap !== false
        ? `<div class="map-card reveal"><iframe title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
             src="https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed"></iframe></div>` : "";
      const mapBtn = (data.mapUrl || q)
        ? `<a class="inv-btn ghost" href="${esc(data.mapUrl || "https://maps.google.com/?q=" + encodeURIComponent(q))}" target="_blank" rel="noopener">Get directions</a>` : "";
      const ics = icsHref(data);
      const calBtn = ics ? `<a class="inv-btn ghost" href="${ics}" download="fira-event.ics">Add to calendar</a>` : "";
      const songBtn = data.songUrl
        ? `<a class="inv-btn ghost" href="${esc(data.songUrl)}" target="_blank" rel="noopener">${L(theme, "song", "♪ Our song")}</a>` : "";
      return `
      <section class="ch ch-details" data-ch="details">
        <div class="ch-inner">
          <h2 class="inv-h2 reveal">${L(theme, "details", "When & where")}</h2>
          <p class="inv-date big reveal">${esc(fmtDate(data.date, data.lang))}</p>
          ${data.time ? `<p class="inv-time reveal">${esc(data.time)}</p>` : ""}
          ${data.venue ? `<p class="inv-venue reveal">${esc(data.venue)}</p>` : ""}
          ${data.address ? `<p class="inv-address reveal">${esc(data.address)}</p>` : ""}
          ${map}
          <div class="inv-cta reveal">${mapBtn}${calBtn}${songBtn}</div>
          <div class="inv-countdown reveal"></div>
        </div>
      </section>`;
    },

    venue(data, theme) {
      if (!data.venue && !data.address) return "";
      const q = [data.venue, data.address].filter(Boolean).join(", ");
      const art = data.venueImageUrl || (theme.assets && theme.assets.venue);
      const ics = icsHref(data);
      return `
      <section class="ch ch-venue" data-ch="venue">
        <div class="ch-inner">
          ${art ? `<figure class="venue-art reveal"><img src="${esc(art)}" alt="" loading="lazy"></figure>` : ""}
          <h2 class="inv-h2 reveal">${L(theme, "venue", "The venue")}</h2>
          ${data.venue ? `<p class="inv-venue reveal">${esc(data.venue)}</p>` : ""}
          ${data.address ? `<p class="inv-address reveal">${esc(data.address)}</p>` : ""}
          ${data.time ? `<p class="inv-time reveal">${esc(fmtDate(data.date, data.lang))} · ${esc(data.time)}</p>` : ""}
          <div class="inv-cta reveal">
            <a class="inv-btn ghost" href="${esc(data.mapUrl || "https://maps.google.com/?q=" + encodeURIComponent(q))}" target="_blank" rel="noopener"><b>Get directions</b><small>Open in Google Maps</small></a>
            ${ics ? `<a class="inv-btn ghost" href="${ics}" download="fira-event.ics"><b>Add to calendar</b><small>Save the date</small></a>` : ""}
          </div>
          ${theme.showMap ? `<div class="map-card reveal"><iframe title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed"></iframe></div>` : ""}
        </div>
      </section>`;
    },

    schedule(data, theme) {
      const schedule = (data.schedule || []).filter((s) => s.label);
      if (!schedule.length) return "";
      return `
      <section class="ch ch-schedule" data-ch="schedule">
        <div class="ch-inner">
          <h2 class="inv-h2 reveal">${L(theme, "schedule", "Schedule")}</h2>
          ${theme.labels.scheduleSub ? `<p class="inv-sub reveal">${esc(theme.labels.scheduleSub)}</p>` : ""}
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

    dresscode(data, theme) {
      const dc = data.dressCode;
      if (!dc || !(dc.text || (dc.palette || []).length || (dc.images || []).length)) return "";
      const palette = (dc.palette || []).length
        ? `<div class="dc-palette reveal">${dc.palette.map((p) => `<span class="dc-swatch"><i style="background:${esc(p.color)}"></i>${p.label ? `<small>${esc(p.label)}</small>` : ""}</span>`).join("")}</div>` : "";
      const images = (dc.images || []).length
        ? `<div class="dc-images">${dc.images.map((im) => `<figure class="dc-img reveal"><img src="${esc(photoSrc(im.url || im.photoId))}" alt="" loading="lazy">${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ""}</figure>`).join("")}</div>` : "";
      return `
      <section class="ch ch-dresscode" data-ch="dresscode">
        <div class="ch-inner">
          <h2 class="inv-h2 reveal">${esc(dc.title || (theme.labels.dressCode || "Dress code"))}</h2>
          ${dc.text ? `<p class="inv-p reveal">${esc(dc.text).replace(/\n/g, "<br>")}</p>` : ""}
          ${palette}${images}
        </div>
      </section>`;
    },

    gifts(data, theme) {
      const g = data.gifts;
      if (!g || !(g.text || (g.links || []).length)) return "";
      return `
      <section class="ch ch-gifts" data-ch="gifts">
        <div class="ch-inner">
          <div class="gf-icon reveal" aria-hidden="true">🎁</div>
          <h2 class="inv-h2 reveal">${L(theme, "gifts", "Gifts")}</h2>
          ${g.text ? `<p class="inv-p reveal">${esc(g.text).replace(/\n/g, "<br>")}</p>` : ""}
          ${(g.links || []).length ? `<div class="inv-cta reveal">${g.links.map((l) => `<a class="inv-btn solid" href="${esc(l.url)}" target="_blank" rel="noopener">🎁 ${esc(l.label)} ↗</a>`).join("")}</div>` : ""}
          ${g.details ? `<details class="gf-details reveal"><summary>${L(theme, "giftsDirect", "Prefer to contribute directly?")}</summary><p>${esc(g.details).replace(/\n/g, "<br>")}</p></details>` : ""}
        </div>
      </section>`;
    },

    menu(data, theme) {
      const menu = (data.menu || []).filter((m) => m.name || m.description);
      if (!menu.length) return "";
      return `
      <section class="ch ch-menu" data-ch="menu">
        <div class="ch-inner">
          ${theme.art && theme.art.menuTop ? theme.art.menuTop : ""}
          <h2 class="inv-h2 reveal">${L(theme, "menu", "Menu")}</h2>
          <div class="menu-list">${menu.map((m) => `
            <div class="menu-item reveal">
              ${m.course ? `<span class="menu-course">— ${esc(m.course)} —</span>` : ""}
              ${m.name ? `<span class="menu-name">${esc(m.name)}</span>` : ""}
              ${m.description ? `<span class="menu-desc">${esc(m.description)}</span>` : ""}
            </div>`).join("")}</div>
        </div>
      </section>`;
    },

    accommodation(data, theme) {
      const acc = (data.accommodation || []).filter((a) => a.name);
      if (!acc.length) return "";
      return `
      <section class="ch ch-accommodation" data-ch="accommodation">
        <div class="ch-inner">
          <h2 class="inv-h2 reveal">${L(theme, "accommodation", "Accommodation")}</h2>
          ${theme.labels.accommodationSub ? `<p class="inv-sub reveal">${esc(theme.labels.accommodationSub)}</p>` : ""}
          <div class="acc-list">${acc.map((a) => `
            <div class="acc-card reveal">
              ${a.imageUrl ? `<img src="${esc(a.imageUrl)}" alt="" loading="lazy">` : ""}
              <div class="acc-body">
                <b>${esc(a.name)}</b>
                ${a.note ? `<p>${esc(a.note)}</p>` : ""}
                ${a.price ? `<span class="acc-price">${esc(a.price)}</span>` : ""}
                ${a.url ? `<a class="inv-btn ghost sm" href="${esc(a.url)}" target="_blank" rel="noopener">View details ↗</a>` : ""}
              </div>
            </div>`).join("")}</div>
        </div>
      </section>`;
    },

    faq(data, theme) {
      const faq = (data.faq || []).filter((f) => f.q);
      if (!faq.length) return "";
      return `
      <section class="ch ch-faq" data-ch="faq">
        <div class="ch-inner">
          <div class="gf-icon reveal" aria-hidden="true">?</div>
          <h2 class="inv-h2 reveal">${L(theme, "faq", "FAQ")}</h2>
          <div class="faq-list">${faq.map((f) => `
            <details class="faq-item reveal"><summary>${esc(f.q)}</summary><p>${esc(f.a || "").replace(/\n/g, "<br>")}</p></details>`).join("")}</div>
        </div>
      </section>`;
    },

    contact(data, theme) {
      const c = data.contact;
      if (!c || !(c.text || c.name || c.phone || c.giftText)) return "";
      return `
      <section class="ch ch-contact" data-ch="contact">
        <div class="ch-inner">
          <h2 class="inv-h2 reveal">${L(theme, "contact", "Details")}</h2>
          ${c.text ? `<p class="inv-p reveal">${esc(c.text)}</p>` : ""}
          ${c.name ? `<p class="contact-name reveal">${esc(c.name)}</p>` : ""}
          ${c.phone ? `<p class="contact-phone reveal"><a href="tel:${esc(c.phone.replace(/\s+/g, ""))}">${esc(c.phone)}</a></p>` : ""}
          ${c.giftText ? `<p class="inv-p gift-note reveal">${esc(c.giftText)}</p>` : ""}
        </div>
      </section>`;
    },

    rsvp(data, theme, opts) {
      if (opts.noRsvp) return "";
      const qs = (data.questions || []).map((q, i) => {
        const opt = (q.options || []).filter(Boolean);
        if (q.type === "choice" && opt.length) {
          return `<label class="rf-field"><span>${esc(q.label)}</span>
            <select data-q="${i}">${opt.map((o) => `<option>${esc(o)}</option>`).join("")}</select></label>`;
        }
        if (q.type === "multi" && opt.length) {
          return `<div class="rf-field"><span>${esc(q.label)}</span>
            <div class="rf-multi" data-q="${i}">${opt.map((o) => `<label><input type="checkbox" value="${esc(o)}"><i></i>${esc(o)}</label>`).join("")}</div></div>`;
        }
        if (q.type === "radio" && opt.length) {
          return `<div class="rf-field"><span>${esc(q.label)}</span>
            <div class="rf-radio" data-q="${i}">${opt.map((o, j) => `<label><input type="radio" name="q${i}" value="${esc(o)}" ${j ? "" : "checked"}><i></i>${esc(o)}</label>`).join("")}</div></div>`;
        }
        return `<label class="rf-field"><span>${esc(q.label)}</span><input type="text" data-q="${i}" maxlength="200" placeholder="${esc(q.placeholder || "")}"></label>`;
      }).join("");
      const deadline = data.rsvpDeadline
        ? `<p class="rf-deadline reveal">${L(theme, "replyBy", "Please reply by")} ${esc(fmtDate(data.rsvpDeadline, data.lang))}</p>` : "";
      const guest = opts.guestName ? esc(opts.guestName) : "";
      const couple = photoSrc(data.photo2Url || data.photo2Id);
      return `
      <section class="ch ch-rsvp" id="rsvp" data-ch="rsvp">
        <div class="ch-inner">
          <h2 class="inv-h2 reveal">${L(theme, "rsvp", "RSVP")}</h2>
          ${data.rsvpIntro ? `<p class="inv-p reveal">${esc(data.rsvpIntro)}</p>` : ""}
          ${deadline}
          <form class="rf reveal" novalidate>
            <label class="rf-field"><span>${L(theme, "yourName", "Your name")}</span><input type="text" name="guest_name" required maxlength="120" value="${guest}"></label>
            ${data.collectEmail ? `<label class="rf-field"><span>Email</span><input type="email" name="email" maxlength="160" placeholder="your@email.com"></label>` : ""}
            <div class="rf-field"><span>${L(theme, "willAttend", "Will you attend?")}</span>
              <div class="rf-attend" role="radiogroup">
                <label><input type="radio" name="attending" value="yes" checked><i></i>${L(theme, "yes", "Joyfully accepts")}</label>
                <label><input type="radio" name="attending" value="no"><i></i>${L(theme, "no", "Regretfully declines")}</label>
              </div></div>
            <div class="rf-field"><span>${L(theme, "guests", "Number of guests (including you)")}</span>
              <div class="rf-step"><button type="button" data-d="-1" aria-label="Fewer">−</button><input type="number" name="party_size" min="1" max="20" value="1"><button type="button" data-d="1" aria-label="More">+</button></div></div>
            ${qs}
            <label class="rf-field"><span>${L(theme, "message", "Message to the hosts (optional)")}</span>
              <textarea name="message" rows="2" maxlength="1000"></textarea></label>
            <button type="submit" class="rf-send">${L(theme, "send", "Send RSVP")}</button>
            <p class="rf-status" aria-live="polite"></p>
          </form>
          ${data.closingText ? `<p class="rf-closing reveal">${esc(data.closingText)}</p>` : ""}
          ${data.hosts ? `<p class="rf-hosts reveal">${L(theme, "hostedBy", "")} ${esc(data.hosts)}</p>` : ""}
          ${couple ? `<figure class="rf-couple reveal"><img src="${esc(couple)}" alt="" loading="lazy"></figure>` : ""}
          <footer class="inv-foot">
            <a class="inv-fira" href="${opts.brandHref || "index.html"}" target="_blank" rel="noopener">Made with Fira</a>
          </footer>
        </div>
      </section>`;
    },
  };

  const DEFAULT_ORDER = ["hero", "photo", "message", "details", "schedule", "rsvp"];

  function wireRsvp(root, data, opts, theme) {
    const form = root.querySelector(".rf");
    if (!form) return;
    form.querySelectorAll(".rf-step button").forEach((b) => b.addEventListener("click", () => {
      const inp = form.party_size;
      inp.value = Math.min(20, Math.max(1, (parseInt(inp.value || "1", 10) || 1) + parseInt(b.dataset.d, 10)));
    }));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = form.querySelector(".rf-status");
      const name = form.guest_name.value.trim();
      if (!name) { status.textContent = "Please enter your name."; return; }
      const answers = {};
      if (form.email && form.email.value.trim()) answers["Email"] = form.email.value.trim();
      (data.questions || []).forEach((q, i) => {
        const multi = form.querySelector(`.rf-multi[data-q="${i}"]`);
        const radio = form.querySelector(`.rf-radio[data-q="${i}"]`);
        if (multi) {
          const v = [...multi.querySelectorAll("input:checked")].map((c) => c.value);
          if (v.length) answers[q.label] = v.join(", ");
        } else if (radio) {
          const r = radio.querySelector("input:checked");
          if (r) answers[q.label] = r.value;
        } else {
          const el = form.querySelector(`[data-q="${i}"]`);
          if (el && el.value) answers[q.label] = el.value;
        }
      });
      const yes = form.attending.value === "yes";
      const btn = form.querySelector(".rf-send");
      btn.disabled = true;
      status.textContent = "Sending…";
      try {
        if (!opts.inviteId) throw new Error("This is a preview — publish to enable RSVP.");
        await window.FiraAPI.sendRsvp(opts.inviteId, {
          guest_name: name,
          attending: form.attending.value,
          party_size: Math.max(1, parseInt(form.party_size.value || "1", 10)),
          answers,
          message: form.message.value.trim(),
        });
        const r = btn.getBoundingClientRect();
        form.innerHTML = yes
          ? `<p class="rf-done">${L(theme, "thanksYes", "See you there,")} ${esc(name)}! ✦</p>`
          : `<p class="rf-done">${L(theme, "thanksNo", "Thank you for letting us know,")} ${esc(name)}.</p>`;
        document.querySelector(".cta-pill")?.remove();
        if (yes) celebrate(theme.swatch.concat(["#FFFFFF"]), { x: r.left + r.width / 2, y: r.top });
      } catch (err) {
        status.textContent = err.message || "Could not send. Try again.";
        btn.disabled = false;
      }
    });
  }

  // ======================================================================
  // Envelopes
  // ======================================================================
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

  // Shared sound state — the opening film now, ambient loops later.
  const soundState = {
    on: false, media: [], btn: null,
    set(v) { this.on = v; this.media.forEach((m) => (m.muted = !v)); if (this.btn) this.btn.classList.toggle("on", v); },
    bind(m) { this.media.push(m); },
    reset() { this.on = false; this.media = []; this.btn = null; },
  };
  function soundToggle(stage) {
    const b = document.createElement("button");
    b.className = "snd-toggle" + (soundState.on ? " on" : "");
    b.setAttribute("aria-label", "Toggle sound");
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 5L6 9H3v6h3l5 4V5z"/><path class="w1" d="M15.5 8.5a5 5 0 010 7"/><path class="w2" d="M18.5 5.5a9 9 0 010 13"/><path class="x" d="M16 9l5 6M21 9l-5 6"/></svg>`;
    b.addEventListener("click", () => soundState.set(!soundState.on));
    soundState.btn = b;
    stage.appendChild(b);
  }

  // The video IS the envelope: poster = frame 0, tap = unmuted play.
  function filmEnvelope(mount, data, theme, opts, onOpen) {
    const o = theme.opening;
    const addr = opts.guestName
      ? `${L(theme, "for", "For")} ${esc(opts.guestName)}`
      : esc(data.envelopeTeaser || theme.labels.teaser || "You are invited");
    const sp = o.sealPos || { x: 50, y: 50 };
    const mono = o.monogram === false ? "" :
      `<div class="env4-mono" style="left:${sp.x}%;top:${sp.y}%;--seal-w:${o.sealSize || 24}vw">${esc(monogram(data))}</div>`;
    const env = document.createElement("div");
    env.className = "env4";
    env.innerHTML = `
      <video class="env4-film" poster="${esc(o.poster)}" preload="auto" playsinline muted></video>
      <div class="env4-scrim"></div>
      <p class="env4-addr">${addr}</p>
      ${mono}
      <p class="env4-hint">${L(theme, "tapToOpen", "Tap to open")}</p>
      <button class="env4-tap" aria-label="Open the invitation"></button>`;
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
      if (navigator.vibrate) { try { navigator.vibrate(18); } catch (e) {} }
      if (!opts.noFullscreen) tryFullscreen();
      env.classList.add("opening");
      film.muted = !!opts.startMuted;
      soundState.set(!film.muted);
      const p = film.play();
      if (p && p.catch) p.catch(() => { film.muted = true; soundState.set(false); film.play().catch(finish); });
      film.addEventListener("ended", finish);
      film.addEventListener("error", finish);
      setTimeout(finish, 12000);
    };
    env.querySelector(".env4-tap").addEventListener("click", open);
    soundState.bind(film);
    return env;
  }

  // Coded envelope (themes without a generated film).
  function envelope(mount, data, theme, opts, onOpen) {
    const initials = monogram(data);
    const addr = opts.guestName
      ? `For ${esc(opts.guestName)}`
      : esc(data.envelopeTeaser || theme.labels.teaser || "You are invited");
    const env = document.createElement("div");
    env.className = "env3";
    env.innerHTML = `
      <div class="env3-paper">
        <div class="env3-grain"></div>
        <div class="env3-border"></div>
        <div class="env3-flap"><div class="env3-flap-inner"></div></div>
        <p class="env3-addr">${addr}</p>
        <div class="env3-sealwrap">
          <button class="env3-seal" aria-label="Break the seal and open the invitation">${sealSvg(initials)}</button>
          <div class="env3-half l" aria-hidden="true">${sealSvg(initials)}</div>
          <div class="env3-half r" aria-hidden="true">${sealSvg(initials)}</div>
        </div>
        <p class="env3-hint">Tap the seal to open</p>
      </div>`;
    mount.appendChild(env);
    let film = null;
    if (theme.openingVideo && !opts.noFilm) {
      film = document.createElement("video");
      film.className = "env3-film";
      film.muted = true; film.playsInline = true; film.preload = "auto";
      film.setAttribute("muted", ""); film.setAttribute("playsinline", "");
      film.src = theme.openingVideo;
      env.appendChild(film);
    }
    const filmReady = () => film && film.readyState >= 3 && !film.error;
    let opened = false;
    const cssSequence = () => {
      setTimeout(() => env.classList.add("cracked"), 260);
      setTimeout(() => env.classList.add("unfolding"), 760);
      setTimeout(() => { env.classList.add("lifting"); onOpen(); }, 1500);
      setTimeout(() => env.remove(), 2600);
    };
    const filmSequence = () => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        env.classList.add("lifting"); onOpen();
        setTimeout(() => env.remove(), 1100);
      };
      setTimeout(() => {
        env.classList.add("filming");
        film.play().catch(() => { env.classList.remove("filming"); cssSequence(); });
        film.addEventListener("ended", finish);
        film.addEventListener("error", finish);
        setTimeout(finish, 9000);
      }, 220);
    };
    const open = () => {
      if (opened) return;
      opened = true;
      if (navigator.vibrate) { try { navigator.vibrate(18); } catch (e) {} }
      if (!opts.noFullscreen) tryFullscreen();
      env.classList.add("sealing");
      if (filmReady()) filmSequence(); else cssSequence();
    };
    env.querySelector(".env3-seal").addEventListener("click", (e) => { e.stopPropagation(); open(); });
    env.addEventListener("click", open);
    return env;
  }

  // ======================================================================
  // render(data, mount, opts)
  // opts: { inviteId, skipEnvelope, noRsvp, brandHref, guestName, noFullscreen, noFilm }
  // ======================================================================
  function render(data, mount, opts = {}) {
    const theme = window.FIRA_TEMPLATES[data.template] || window.FIRA_TEMPLATES.botanical;
    mount.innerHTML = "";
    document.querySelectorAll(".cta-pill, .fs-toggle, .snd-toggle, .celebrate-canvas").forEach((el) => el.remove());
    soundState.reset();
    mount.className = "inv-root theme-" + theme.id;
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

    const showStory = () => {
      if (stage.querySelector(".story")) return;
      if (theme.decorate) theme.decorate(stage, U);
      parallax(stage);
      const wrap = document.createElement("div");
      wrap.className = "story";
      const order = theme.chapters || DEFAULT_ORDER;
      wrap.innerHTML = `
        ${theme.storyBg ? `<div class="story-bg" aria-hidden="true"><img src="${esc(theme.storyBg)}" alt=""></div>` : ""}
        <div class="story-progress" aria-hidden="true"><i></i></div>
        ${order.map((k) => CH[k] ? CH[k](data, theme, opts) : "").join("")}`;
      stage.appendChild(wrap);
      wrap.querySelectorAll(".ch:not(.ch-hero)").forEach((ch, i) => ch.classList.add(i % 2 ? "band-b" : "band-a"));
      wrap.querySelectorAll(".inv-countdown").forEach((el) => countdown(el, data.date, data.time));
      wireRsvp(wrap, data, opts, theme);
      revealOnScroll(wrap);
      storyEngine(wrap);
      if (theme.after) theme.after(wrap, data, opts, U);

      if (!opts.noRsvp && wrap.querySelector("#rsvp")) {
        const pill = document.createElement("button");
        pill.className = "cta-pill" + (theme.ctaStyle === "scroll" ? " cta-scroll" : "");
        pill.innerHTML = theme.ctaStyle === "scroll"
          ? `<span>${L(theme, "cta", "Scroll to RSVP")}</span><i class="mouse" aria-hidden="true"></i>`
          : esc(theme.labels.cta || "Confirm attendance");
        pill.addEventListener("click", () =>
          wrap.querySelector("#rsvp").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" }));
        stage.appendChild(pill);
        setTimeout(() => pill.classList.add("show"), 2400);
        new IntersectionObserver((es) =>
          es.forEach((e) => pill.classList.toggle("hide", e.isIntersecting)),
          { threshold: 0.2 }
        ).observe(wrap.querySelector("#rsvp"));
      }
      if (!opts.skipEnvelope && !opts.noFullscreen) {
        const fs = document.createElement("button");
        fs.className = "fs-toggle";
        fs.setAttribute("aria-label", "Toggle fullscreen");
        fs.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`;
        fs.addEventListener("click", () => (isFullscreen() ? exitFullscreen() : tryFullscreen()));
        stage.appendChild(fs);
      }
    };

    if (opts.skipEnvelope || REDUCED) { showStory(); return; }
    if (theme.opening && theme.opening.video && !opts.noFilm) {
      filmEnvelope(stage, data, theme, opts, showStory);
      soundToggle(stage);
    } else {
      envelope(stage, data, theme, opts, showStory);
    }
  }

  const U = { esc, fmtDate, icsHref, particles, celebrate, parallax, countdown, photoSrc, reduced: REDUCED };
  window.FiraInvite = { render, esc, fmtDate, chapters: CH };
})();
