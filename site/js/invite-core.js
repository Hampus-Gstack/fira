// Fira invitation engine — envelope intro, shared invitation skeleton,
// countdown, particles, ICS calendar export. Themes plug in via FIRA_TEMPLATES.
(function () {
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

  function fmtDate(dateStr, lang) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T12:00:00");
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString(lang || "en-GB", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  }

  // ---------- countdown ----------
  function mountCountdown(el, dateStr, timeStr) {
    if (!dateStr) { el.remove(); return; }
    const target = new Date(dateStr + "T" + (timeStr || "00:00"));
    if (isNaN(target)) { el.remove(); return; }
    const units = [["days", 86400000], ["hours", 3600000], ["min", 60000], ["sec", 1000]];
    el.innerHTML = units
      .map(([u]) => `<div class="cd-cell"><span class="cd-num" data-u="${u}">0</span><span class="cd-lbl">${u}</span></div>`)
      .join("");
    function tick() {
      let diff = target - Date.now();
      if (diff < 0) { el.innerHTML = ""; return; }
      for (const [u, ms] of units) {
        const v = Math.floor(diff / ms);
        diff -= v * ms;
        const cell = el.querySelector(`[data-u="${u}"]`);
        if (cell) cell.textContent = v;
      }
      setTimeout(tick, 1000);
    }
    tick();
  }

  // ---------- add to calendar (.ics, generated client-side) ----------
  function icsHref(data) {
    if (!data.date) return null;
    const dt = (data.date || "").replace(/-/g, "");
    const tm = (data.time || "12:00").replace(":", "") + "00";
    const end = data.endTime ? data.endTime.replace(":", "") + "00" : null;
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fira//EN", "BEGIN:VEVENT",
      "UID:" + (data._id || Math.random().toString(36).slice(2)) + "@fira",
      "DTSTART:" + dt + "T" + tm,
      end ? "DTEND:" + dt + "T" + end : "DTEND:" + dt + "T235900",
      "SUMMARY:" + (data.title || "Event").replace(/[,;]/g, " "),
      "LOCATION:" + ((data.venue || "") + " " + (data.address || "")).trim().replace(/[,;]/g, " "),
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean);
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(lines.join("\r\n"));
  }

  // ---------- particle decorations ----------
  function particles(host, kind, count) {
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

  // ---------- envelope intro ----------
  function envelope(host, opts, onOpen) {
    const env = document.createElement("div");
    env.className = "env-stage";
    env.innerHTML = `
      <div class="env" role="button" tabindex="0" aria-label="Open invitation">
        <div class="env-back"></div>
        <div class="env-card"><span>${esc(opts.teaser || "You're invited")}</span></div>
        <div class="env-pocket"></div>
        <div class="env-flap"></div>
        <div class="env-seal"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="28"/><text x="30" y="39" text-anchor="middle">F</text></svg></div>
        <div class="env-hint">${esc(opts.hint || "Tap the seal to open")}</div>
      </div>`;
    host.appendChild(env);
    const open = () => {
      if (env.classList.contains("is-open")) return;
      env.classList.add("is-open");
      setTimeout(() => {
        env.classList.add("is-gone");
        onOpen();
        setTimeout(() => env.remove(), 900);
      }, 1150);
    };
    env.querySelector(".env").addEventListener("click", open);
    env.querySelector(".env").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") open();
    });
  }

  // ---------- RSVP form ----------
  function rsvpBlock(data, opts) {
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
    return `
      <section class="inv-block inv-rsvp reveal">
        <h2 class="inv-h2">RSVP</h2>
        ${deadline}
        <form class="rf" novalidate>
          <label class="rf-field"><span>Your name</span><input type="text" name="guest_name" required maxlength="120"></label>
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

  function wireRsvp(root, data, inviteId) {
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
      const btn = form.querySelector(".rf-send");
      btn.disabled = true;
      status.textContent = "Sending…";
      try {
        if (!inviteId) throw new Error("Preview mode — publishing enables RSVP.");
        await window.FiraAPI.sendRsvp(inviteId, {
          guest_name: name,
          attending: form.attending.value,
          party_size: Math.max(1, parseInt(form.party_size.value || "1", 10)),
          answers,
          message: form.message.value.trim(),
        });
        form.innerHTML = `<p class="rf-done">Thank you, ${esc(name)} — your reply has been sent. ✦</p>`;
      } catch (err) {
        status.textContent = err.message || "Could not send. Try again.";
        btn.disabled = false;
      }
    });
  }

  // ---------- shared invitation skeleton ----------
  function skeleton(data, theme, opts) {
    const schedule = (data.schedule || []).filter((s) => s.label);
    const scheduleHtml = schedule.length
      ? `<section class="inv-block inv-schedule reveal"><h2 class="inv-h2">${esc(theme.labels.schedule)}</h2>
          <ol class="inv-timeline">${schedule
            .map((s) => `<li><span class="tl-time">${esc(s.time || "")}</span><span class="tl-label">${esc(s.label)}</span></li>`)
            .join("")}</ol></section>`
      : "";
    const message = data.message
      ? `<section class="inv-block inv-message reveal"><p>${esc(data.message).replace(/\n/g, "<br>")}</p></section>`
      : "";
    const mapBtn = data.mapUrl
      ? `<a class="inv-btn ghost" href="${esc(data.mapUrl)}" target="_blank" rel="noopener">View map</a>` : "";
    const ics = icsHref(data);
    const calBtn = ics ? `<a class="inv-btn ghost" href="${ics}" download="fira-event.ics">Add to calendar</a>` : "";
    return `
      <div class="inv-scroll">
        <header class="inv-hero">
          <p class="inv-eyebrow reveal">${esc(data.eventType || theme.labels.eyebrow)}</p>
          <h1 class="inv-title reveal">${esc(data.title || "Your names here")}</h1>
          ${data.subtitle ? `<p class="inv-subtitle reveal">${esc(data.subtitle)}</p>` : ""}
          <div class="inv-rule reveal" aria-hidden="true">${theme.ornament || "✦"}</div>
          <p class="inv-date reveal">${esc(fmtDate(data.date, data.lang))}${data.time ? " · " + esc(data.time) : ""}</p>
          ${data.venue ? `<p class="inv-venue reveal">${esc(data.venue)}</p>` : ""}
          ${data.address ? `<p class="inv-address reveal">${esc(data.address)}</p>` : ""}
          <div class="inv-cta reveal">${mapBtn}${calBtn}</div>
        </header>
        <div class="inv-countdown reveal" aria-hidden="true"></div>
        ${message}
        ${scheduleHtml}
        ${rsvpBlock(data, opts)}
        <footer class="inv-foot">
          ${data.hosts ? `<p>${esc(theme.labels.hostedBy)} ${esc(data.hosts)}</p>` : ""}
          <a class="inv-fira" href="${opts.brandHref || "index.html"}" target="_blank" rel="noopener">Made with Fira</a>
        </footer>
      </div>`;
  }

  function revealOnScroll(root) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.15 }
    );
    root.querySelectorAll(".reveal").forEach((el, i) => {
      el.style.setProperty("--stagger", (i % 6) * 90 + "ms");
      io.observe(el);
    });
  }

  // ---------- public render ----------
  // opts: { inviteId, skipEnvelope, noRsvp, brandHref }
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
    if (theme.decorate) theme.decorate(stage, { particles });

    const showInvite = () => {
      const wrap = document.createElement("div");
      wrap.className = "inv-body";
      wrap.innerHTML = skeleton(data, theme, opts);
      stage.appendChild(wrap);
      mountCountdown(wrap.querySelector(".inv-countdown"), data.date, data.time);
      wireRsvp(wrap, data, opts.inviteId);
      revealOnScroll(wrap);
    };

    if (opts.skipEnvelope) showInvite();
    else envelope(stage, { teaser: data.envelopeTeaser || theme.labels.teaser }, showInvite);
  }

  window.FiraInvite = { render, esc, fmtDate };
})();
