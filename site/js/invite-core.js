// Fira invitation engine v2 — cinematic per-theme intros and bespoke scenes.
// Themes (FIRA_TEMPLATES) implement: intro(stage, data, done, U),
// scenes(data, opts, U) -> html, optional decorate(stage, U) and
// after(wrap, data, opts, U). Shared craft lives here.
(function () {
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fmtDate(dateStr, lang) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T12:00:00");
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString(lang || "en-GB", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  }

  // ---------- countdown ----------
  function countdown(el, dateStr, timeStr) {
    if (!el) return;
    if (!dateStr) { el.remove(); return; }
    const target = new Date(dateStr + "T" + (timeStr || "00:00"));
    if (isNaN(target)) { el.remove(); return; }
    const units = [["days", 86400000], ["hours", 3600000], ["min", 60000], ["sec", 1000]];
    el.innerHTML = units
      .map(([u]) => `<div class="cd-cell"><span class="cd-num" data-u="${u}">&nbsp;</span><span class="cd-lbl">${u}</span></div>`)
      .join("");
    function tick() {
      let diff = target - Date.now();
      if (diff < 0) { el.innerHTML = `<p class="cd-today">Today is the day ✦</p>`; return; }
      for (const [u, ms] of units) {
        const v = Math.floor(diff / ms);
        diff -= v * ms;
        const cell = el.querySelector(`[data-u="${u}"]`);
        if (cell && cell.textContent !== String(v)) {
          cell.textContent = v;
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

  // ---------- confetti cannon (canvas) ----------
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

  // ---------- pointer / gyro parallax on [data-depth] ----------
  function parallax(stage) {
    if (REDUCED) return;
    const els = () => stage.querySelectorAll("[data-depth]");
    let tx = 0, ty = 0, cx = 0, cy = 0, running = false;
    function apply() {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      els().forEach((el) => {
        const d = parseFloat(el.dataset.depth) || 1;
        el.style.transform = `translate3d(${cx * d}px, ${cy * d}px, 0)`;
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

  // ---------- typewriter ----------
  function typewriter(el, lines, speed, done) {
    let li = 0, ci = 0;
    (function step() {
      if (li >= lines.length) { done && done(); return; }
      const line = lines[li];
      if (ci === 0) {
        el.insertAdjacentHTML("beforeend", `<div class="tw-line"></div>`);
      }
      const row = el.lastElementChild;
      if (ci < line.length) {
        row.textContent = line.slice(0, ++ci);
        setTimeout(step, speed + Math.random() * 24);
      } else {
        li++; ci = 0;
        setTimeout(step, 260);
      }
    })();
  }

  // ---------- shared partials (themes compose these) ----------
  function photoHtml(data, cls) {
    if (!data.photoId) return "";
    const src = window.FIRA_CONFIG.API_BASE + "/photos/" + encodeURIComponent(data.photoId);
    return `<figure class="inv-photo ${cls || ""} reveal"><img src="${esc(src)}" alt=""></figure>`;
  }

  function detailsHtml(data, theme) {
    const mapBtn = data.mapUrl
      ? `<a class="inv-btn ghost" href="${esc(data.mapUrl)}" target="_blank" rel="noopener">View map</a>` : "";
    const ics = icsHref(data);
    const calBtn = ics ? `<a class="inv-btn ghost" href="${ics}" download="fira-event.ics">Add to calendar</a>` : "";
    const songBtn = data.songUrl
      ? `<a class="inv-btn ghost" href="${esc(data.songUrl)}" target="_blank" rel="noopener">${esc(theme.labels.song || "♪ Our song")}</a>` : "";
    return `
      <p class="inv-date reveal">${esc(fmtDate(data.date, data.lang))}${data.time ? " · " + esc(data.time) : ""}</p>
      ${data.venue ? `<p class="inv-venue reveal">${esc(data.venue)}</p>` : ""}
      ${data.address ? `<p class="inv-address reveal">${esc(data.address)}</p>` : ""}
      <div class="inv-cta reveal">${mapBtn}${calBtn}${songBtn}</div>`;
  }

  function scheduleHtml(data, theme) {
    const schedule = (data.schedule || []).filter((s) => s.label);
    if (!schedule.length) return "";
    return `<section class="inv-block inv-schedule reveal"><h2 class="inv-h2">${esc(theme.labels.schedule)}</h2>
      <ol class="inv-timeline">${schedule
        .map((s) => `<li class="reveal"><span class="tl-time">${esc(s.time || "")}</span><span class="tl-dot" aria-hidden="true"></span><span class="tl-label">${esc(s.label)}</span></li>`)
        .join("")}</ol></section>`;
  }

  function messageHtml(data) {
    return data.message
      ? `<section class="inv-block inv-message reveal"><p>${esc(data.message).replace(/\n/g, "<br>")}</p></section>` : "";
  }

  function footHtml(data, theme, opts) {
    return `<footer class="inv-foot">
      ${data.hosts ? `<p class="reveal">${esc(theme.labels.hostedBy)} ${esc(data.hosts)}</p>` : ""}
      <a class="inv-fira" href="${opts.brandHref || "index.html"}" target="_blank" rel="noopener">Made with Fira</a>
    </footer>`;
  }

  // ---------- RSVP ----------
  function rsvpHtml(data, opts) {
    if (opts.noRsvp) return "";
    const qs = (data.questions || [])
      .map((q, i) => {
        if (q.type === "choice" && (q.options || []).length) {
          return `<label class="rf-field"><span>${esc(q.label)}</span>
            <select data-q="${i}">${(q.options || []).map((o) => `<option>${esc(o)}</option>`).join("")}</select></label>`;
        }
        return `<label class="rf-field"><span>${esc(q.label)}</span><input type="text" data-q="${i}" maxlength="200"></label>`;
      })
      .join("");
    const deadline = data.rsvpDeadline
      ? `<p class="rf-deadline">Please reply by ${esc(fmtDate(data.rsvpDeadline, data.lang))}</p>` : "";
    const guest = opts.guestName ? esc(opts.guestName) : "";
    return `
      <section class="inv-block inv-rsvp reveal">
        <h2 class="inv-h2">RSVP</h2>
        ${deadline}
        <form class="rf" novalidate>
          <label class="rf-field"><span>Your name</span><input type="text" name="guest_name" required maxlength="120" value="${guest}"></label>
          <div class="rf-attend" role="radiogroup">
            <label><input type="radio" name="attending" value="yes" checked><i></i>Joyfully accepts</label>
            <label><input type="radio" name="attending" value="no"><i></i>Regretfully declines</label>
          </div>
          <label class="rf-field"><span>Number of guests (including you)</span>
            <input type="number" name="party_size" min="1" max="20" value="1"></label>
          ${qs}
          <label class="rf-field"><span>Message to the hosts (optional)</span>
            <textarea name="message" rows="2" maxlength="1000"></textarea></label>
          <button type="submit" class="rf-send">Send RSVP</button>
          <p class="rf-status" aria-live="polite"></p>
        </form>
      </section>`;
  }

  function wireRsvp(root, data, opts, theme) {
    const form = root.querySelector(".rf");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = form.querySelector(".rf-status");
      const name = form.guest_name.value.trim();
      if (!name) { status.textContent = "Please enter your name."; return; }
      const answers = {};
      (data.questions || []).forEach((q, i) => {
        const el = form.querySelector(`[data-q="${i}"]`);
        if (el && el.value) answers[q.label] = el.value;
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
          ? `<p class="rf-done">See you there, ${esc(name)}! ✦</p>`
          : `<p class="rf-done">Thank you for letting us know, ${esc(name)}. You'll be missed.</p>`;
        if (yes) celebrate(theme.swatch.concat(["#FFFFFF"]), { x: r.left + r.width / 2, y: r.top });
      } catch (err) {
        status.textContent = err.message || "Could not send. Try again.";
        btn.disabled = false;
      }
    });
  }

  function revealOnScroll(root) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.12 }
    );
    root.querySelectorAll(".reveal").forEach((el, i) => {
      el.style.setProperty("--stagger", (i % 6) * 90 + "ms");
      io.observe(el);
    });
    if (REDUCED) root.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
  }

  // Utility belt handed to every theme hook.
  const U = {
    esc, fmtDate, icsHref, particles, celebrate, parallax, typewriter, countdown,
    photoHtml, detailsHtml, scheduleHtml, messageHtml, footHtml, rsvpHtml,
    reduced: REDUCED,
  };

  // ---------- public render ----------
  // opts: { inviteId, skipEnvelope, noRsvp, brandHref, guestName }
  function render(data, mount, opts = {}) {
    const theme = window.FIRA_TEMPLATES[data.template] || window.FIRA_TEMPLATES.botanical;
    mount.innerHTML = "";
    mount.className = "inv-root theme-" + theme.id;
    if (theme.fonts && !document.getElementById("f-" + theme.id)) {
      const l = document.createElement("link");
      l.id = "f-" + theme.id; l.rel = "stylesheet"; l.href = theme.fonts;
      document.head.appendChild(l);
    }
    const stage = document.createElement("div");
    stage.className = "inv-stage";
    mount.appendChild(stage);

    const showInvite = () => {
      if (stage.querySelector(".inv-body")) return;
      if (theme.decorate) theme.decorate(stage, U);
      parallax(stage);
      const wrap = document.createElement("div");
      wrap.className = "inv-body";
      wrap.innerHTML = theme.scenes(data, opts, U);
      stage.appendChild(wrap);
      countdown(wrap.querySelector(".inv-countdown"), data.date, data.time);
      wireRsvp(wrap, data, opts, theme);
      revealOnScroll(wrap);
      if (theme.after) theme.after(wrap, data, opts, U);
    };

    if (opts.skipEnvelope || REDUCED) showInvite();
    else theme.intro(stage, data, showInvite, Object.assign({ guestName: opts.guestName }, U));
  }

  window.FiraInvite = { render, esc, fmtDate };
})();
