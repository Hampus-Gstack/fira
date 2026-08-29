// Fira theme registry v2 — six bespoke cinematic themes. Original artwork,
// drawn in code. Each theme implements intro/scenes and composes shared
// partials from FiraInvite's utility belt (U).
(function () {
  const G = "https://fonts.googleapis.com/css2?";

  // ---- intro shell: fixed overlay, click-to-skip, idempotent finish ----
  function introShell(stage, cls, html, done, autoMs) {
    const el = document.createElement("div");
    el.className = "intro-stage " + cls;
    el.innerHTML = html;
    stage.appendChild(el);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      el.classList.add("is-gone");
      done();
      setTimeout(() => el.remove(), 950);
    };
    el.addEventListener("click", finish);
    if (autoMs) setTimeout(finish, autoMs);
    return { el, finish };
  }

  // ---- envelope intro (botanical + bloom), personalized ----
  function envelopeIntro(stage, data, done, U, cls) {
    const guestLine = U.guestName
      ? `For ${U.esc(U.guestName)}`
      : (data.envelopeTeaser || "You are warmly invited");
    const { el, finish } = introShell(stage, "intro-env " + cls, `
      <div class="env" role="button" tabindex="0" aria-label="Open invitation">
        <div class="env-back"></div>
        <div class="env-card"><span>${U.esc(guestLine)}</span></div>
        <div class="env-pocket"></div>
        <div class="env-flap"></div>
        <div class="env-seal"><svg viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="28"/>
          <circle cx="30" cy="30" r="23" fill="none" stroke-width="1" opacity="0.5" stroke="currentColor"/>
          <text x="30" y="39" text-anchor="middle">F</text></svg></div>
        <div class="env-hint">Tap the seal to open</div>
      </div>`, done, 0);
    const env = el.querySelector(".env");
    const open = (e) => {
      e.stopPropagation();
      if (el.classList.contains("is-open")) return;
      el.classList.add("is-open");
      setTimeout(finish, 1200);
    };
    env.addEventListener("click", open);
    env.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") open(e); });
  }

  // =====================================================================
  window.FIRA_TEMPLATES = {

    // ----------------------------------------------------------- botanical
    botanical: {
      id: "botanical", name: "Botanical", occasion: "Wedding",
      swatch: ["#F7F3EA", "#31473A", "#A98B5D"],
      fonts: G + "family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Karla:wght@400;600&display=swap",
      labels: { schedule: "The day", hostedBy: "With love,", song: "♪ Our song" },
      intro(stage, data, done, U) { envelopeIntro(stage, data, done, U, "env-botanical"); },
      decorate(stage, U) { U.particles(stage, "leaves", 12); },
      scenes(data, opts, U) {
        const branch = (flip) => `
          <svg class="bt-branch ${flip ? "flip" : ""}" viewBox="0 0 320 200" aria-hidden="true" data-depth="0.6">
            <g fill="none" stroke="currentColor" stroke-width="1.6">
              <path class="draw" d="M6,196 C60,150 90,120 120,70 C138,40 150,26 168,14"/>
              <path class="draw d2" d="M84,132 C110,124 132,126 158,138"/>
              <path class="draw d3" d="M120,70 C144,72 160,84 172,102"/>
            </g>
            <g class="bt-leaves" fill="currentColor" opacity="0.85">
              <ellipse class="pop" cx="158" cy="138" rx="9" ry="4" transform="rotate(24 158 138)"/>
              <ellipse class="pop p2" cx="172" cy="102" rx="9" ry="4" transform="rotate(-18 172 102)"/>
              <ellipse class="pop p3" cx="168" cy="14" rx="10" ry="4.5" transform="rotate(-40 168 14)"/>
              <ellipse class="pop p4" cx="120" cy="70" rx="8" ry="3.6" transform="rotate(30 120 70)"/>
              <circle class="pop p5" cx="100" cy="108" r="3"/>
              <circle class="pop p2" cx="140" cy="52" r="2.5"/>
            </g>
          </svg>`;
        return `
        <div class="inv-scroll">
          ${branch(false)}${branch(true)}
          <header class="inv-hero">
            <p class="inv-eyebrow reveal">${U.esc(data.eventType || "Together with their families")}</p>
            <h1 class="inv-title reveal">${U.esc(data.title || "Your names")}</h1>
            ${data.subtitle ? `<p class="inv-subtitle reveal">${U.esc(data.subtitle)}</p>` : ""}
            <div class="bt-rule reveal" aria-hidden="true"><svg viewBox="0 0 120 12"><path d="M2,6 H46 M74,6 H118" stroke="currentColor" stroke-width="1"/><path d="M60,1 C64,4 64,8 60,11 C56,8 56,4 60,1 Z" fill="currentColor"/></svg></div>
            ${U.detailsHtml(data, this)}
          </header>
          ${U.photoHtml(data, "photo-oval")}
          <div class="inv-countdown reveal"></div>
          ${U.messageHtml(data)}
          ${U.scheduleHtml(data, this)}
          ${U.rsvpHtml(data, opts)}
          ${U.footHtml(data, this, opts)}
        </div>`;
      },
    },

    // ---------------------------------------------------------------- noir
    noir: {
      id: "noir", name: "Noir", occasion: "Gala / Modern wedding",
      swatch: ["#101014", "#E8E2D6", "#C9A24B"],
      fonts: G + "family=Marcellus&family=Jost:wght@300;500&display=swap",
      labels: { schedule: "Programme", hostedBy: "Hosted by", song: "♪ The soundtrack" },
      intro(stage, data, done, U) {
        const { el, finish } = introShell(stage, "intro-noir", `
          <div class="nr-spot"></div>
          <div class="nr-mono">${U.esc(U.guestName ? "Reserved for " + U.guestName : (data.envelopeTeaser || "Your presence is requested"))}</div>
          <div class="nr-curtain left"></div><div class="nr-curtain right"></div>
          <div class="intro-skip">tap to enter</div>`, done, 5200);
        setTimeout(() => el.classList.add("ph-spot"), 100);
        setTimeout(() => el.classList.add("ph-text"), 1100);
        setTimeout(() => el.classList.add("ph-part"), 3300);
      },
      decorate(stage, U) { U.particles(stage, "bokeh", 16); },
      scenes(data, opts, U) {
        const corner = (cls) => `<svg class="nr-corner ${cls}" viewBox="0 0 80 80" aria-hidden="true">
          <g fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M2,78 V22 Q2,2 22,2 H78"/>
            <path d="M12,78 V30 Q12,12 30,12 H78" opacity="0.5"/>
            <circle cx="22" cy="22" r="4" fill="currentColor" stroke="none"/>
          </g></svg>`;
        return `
        <div class="inv-scroll">
          <div class="nr-frame" aria-hidden="true">${corner("tl")}${corner("tr")}${corner("bl")}${corner("br")}</div>
          <header class="inv-hero">
            <p class="inv-eyebrow reveal">${U.esc(data.eventType || "An evening to remember")}</p>
            <h1 class="inv-title reveal nr-shimmer">${U.esc(data.title || "The Event")}</h1>
            ${data.subtitle ? `<p class="inv-subtitle reveal">${U.esc(data.subtitle)}</p>` : ""}
            <div class="nr-div reveal" aria-hidden="true"><svg viewBox="0 0 160 14"><path d="M0,7 H62 M98,7 H160" stroke="currentColor" stroke-width="1"/><path d="M80,0 L87,7 L80,14 L73,7 Z" fill="currentColor"/></svg></div>
            ${U.detailsHtml(data, this)}
          </header>
          ${U.photoHtml(data, "photo-deco")}
          <div class="inv-countdown reveal"></div>
          ${U.messageHtml(data)}
          ${U.scheduleHtml(data, this)}
          ${U.rsvpHtml(data, opts)}
          ${U.footHtml(data, this, opts)}
        </div>`;
      },
    },

    // ------------------------------------------------------------ confetti
    confetti: {
      id: "confetti", name: "Confetti", occasion: "Birthday",
      swatch: ["#F25C54", "#F4A259", "#4E89AE", "#8CB369"],
      fonts: G + "family=Fraunces:opsz,wght@9..144,600;9..144,900&family=Instrument+Sans:wght@400;600&display=swap",
      labels: { schedule: "The plan", hostedBy: "Thrown by", song: "♪ The anthem" },
      intro(stage, data, done, U) {
        const { el, finish } = introShell(stage, "intro-confetti", `
          <div class="cf-count" aria-hidden="true"></div>
          <div class="intro-skip">tap to skip</div>`, done, 4600);
        const box = el.querySelector(".cf-count");
        ["3", "2", "1"].forEach((n, i) => {
          setTimeout(() => { box.innerHTML = `<span class="cf-num">${n}</span>`; }, 300 + i * 900);
        });
        setTimeout(() => {
          box.innerHTML = `<span class="cf-go">${U.esc(U.guestName ? U.guestName + "!" : "Party time!")}</span>`;
          U.celebrate(["#F25C54", "#F4A259", "#4E89AE", "#8CB369", "#FFD166"]);
          setTimeout(finish, 1300);
        }, 300 + 3 * 900);
      },
      decorate(stage, U) { U.particles(stage, "confetti", 34); },
      scenes(data, opts, U) {
        const balloon = (cls, hue, depth) => `
          <svg class="cf-balloon ${cls}" viewBox="0 0 60 90" aria-hidden="true" data-depth="${depth}">
            <path d="M30,4 C46,4 56,17 56,33 C56,50 42,62 30,62 C18,62 4,50 4,33 C4,17 14,4 30,4 Z" fill="hsl(${hue},75%,64%)"/>
            <path d="M27,62 L33,62 L30,70 Z" fill="hsl(${hue},60%,50%)"/>
            <path d="M30,70 C28,78 34,82 30,89" stroke="hsl(${hue},30%,40%)" fill="none" stroke-width="1.4"/>
            <ellipse cx="20" cy="20" rx="6" ry="10" fill="#fff" opacity="0.28" transform="rotate(-18 20 20)"/>
          </svg>`;
        return `
        <div class="inv-scroll">
          ${balloon("b1", 4, 1.6)}${balloon("b2", 205, 1.1)}${balloon("b3", 95, 2)}
          <header class="inv-hero">
            <p class="inv-eyebrow reveal">${U.esc(data.eventType || "It's a party")}</p>
            <h1 class="inv-title reveal cf-title">${U.esc(data.title || "Big day!")}</h1>
            ${data.subtitle ? `<p class="inv-subtitle reveal">${U.esc(data.subtitle)}</p>` : ""}
            <div class="cf-wave reveal" aria-hidden="true"><svg viewBox="0 0 200 16"><path d="M0,8 Q12,0 25,8 T50,8 T75,8 T100,8 T125,8 T150,8 T175,8 T200,8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></div>
            ${U.detailsHtml(data, this)}
          </header>
          ${U.photoHtml(data, "photo-polaroid")}
          <div class="inv-countdown reveal"></div>
          ${U.messageHtml(data)}
          ${U.scheduleHtml(data, this)}
          ${U.rsvpHtml(data, opts)}
          ${U.footHtml(data, this, opts)}
        </div>`;
      },
    },

    // --------------------------------------------------------------- bloom
    bloom: {
      id: "bloom", name: "Bloom", occasion: "Baby shower",
      swatch: ["#FDF7F4", "#6B5B62", "#E8A9A0"],
      fonts: G + "family=Gantari:wght@300;500&family=Lora:ital@0;1&display=swap",
      labels: { schedule: "The afternoon", hostedBy: "Celebrating with", song: "♪ Lullaby" },
      intro(stage, data, done, U) {
        introShell(stage, "intro-bloom", `
          <div class="bl-blob b1"></div><div class="bl-blob b2"></div><div class="bl-blob b3"></div>
          <svg class="bl-moon" viewBox="0 0 100 100" aria-hidden="true">
            <path d="M62,8 A42,42 0 1 0 92,62 A34,34 0 1 1 62,8 Z" fill="#F0D8A8"/>
            <circle cx="26" cy="30" r="2.4" fill="#E8A9A0" class="tw"/>
            <circle cx="14" cy="58" r="1.8" fill="#B9C4E0" class="tw t2"/>
            <circle cx="34" cy="74" r="2" fill="#E8A9A0" class="tw t3"/>
          </svg>
          <p class="bl-word">${U.esc(U.guestName ? "For " + U.guestName : (data.envelopeTeaser || "Something sweet is coming"))}</p>
          <div class="intro-skip">tap to continue</div>`, done, 3800);
      },
      decorate(stage, U) { U.particles(stage, "bubbles", 14); },
      scenes(data, opts, U) {
        return `
        <div class="inv-scroll">
          <svg class="bl-mobile" viewBox="0 0 200 120" aria-hidden="true" data-depth="0.5">
            <path d="M40,6 Q100,-8 160,6" fill="none" stroke="currentColor" stroke-width="1.4"/>
            <g class="swing s1"><line x1="60" y1="4" x2="60" y2="44" stroke="currentColor" stroke-width="1"/>
              <path d="M60,44 l6,10 h-12 Z M60,64 l6,-10 h-12 Z" fill="#F0D8A8" transform="translate(0,-5)"/></g>
            <g class="swing s2"><line x1="100" y1="1" x2="100" y2="60" stroke="currentColor" stroke-width="1"/>
              <path d="M108,66 A9,9 0 1 1 104,50 A7,7 0 1 0 108,66 Z" fill="#E8A9A0"/></g>
            <g class="swing s3"><line x1="140" y1="4" x2="140" y2="38" stroke="currentColor" stroke-width="1"/>
              <circle cx="140" cy="46" r="8" fill="#B9C4E0"/></g>
          </svg>
          <header class="inv-hero">
            <p class="inv-eyebrow reveal">${U.esc(data.eventType || "A little one is on the way")}</p>
            <h1 class="inv-title reveal">${U.esc(data.title || "Baby shower")}</h1>
            ${data.subtitle ? `<p class="inv-subtitle reveal">${U.esc(data.subtitle)}</p>` : ""}
            ${U.detailsHtml(data, this)}
          </header>
          ${U.photoHtml(data, "photo-arch")}
          <div class="inv-countdown reveal"></div>
          ${U.messageHtml(data)}
          ${U.scheduleHtml(data, this)}
          ${U.rsvpHtml(data, opts)}
          ${U.footHtml(data, this, opts)}
        </div>`;
      },
    },

    // ---------------------------------------------------------------- neon
    neon: {
      id: "neon", name: "Neon", occasion: "Party / Club night",
      swatch: ["#39F0C3", "#FF5E8A", "#7B61FF"],
      fonts: G + "family=Syne:wght@600;800&family=Space+Mono&display=swap",
      labels: { schedule: "Lineup", hostedBy: "Presented by", song: "♪ Preview the sound" },
      intro(stage, data, done, U) {
        const { el, finish } = introShell(stage, "intro-neon", `
          <div class="nx-crt"><div class="nx-lines"></div></div>
          <div class="intro-skip">tap to skip</div>`, done, 0);
        const crt = el.querySelector(".nx-crt");
        const term = document.createElement("div");
        term.className = "nx-term";
        crt.appendChild(term);
        U.typewriter(term, [
          "> incoming transmission…",
          "> decrypting invite…",
          U.guestName ? "> guest: " + U.guestName : "> guest: verified",
        ], 34, () => {
          setTimeout(() => {
            crt.insertAdjacentHTML("beforeend", `<div class="nx-grant">ACCESS GRANTED</div>`);
            setTimeout(finish, 1100);
          }, 350);
        });
      },
      decorate(stage, U) { U.particles(stage, "sparks", 22); },
      scenes(data, opts, U) {
        const eq = `<div class="nx-eq reveal" aria-hidden="true">${Array.from({ length: 24 }, (_, i) =>
          `<i style="--i:${i};--h:${(0.25 + 0.75 * Math.abs(Math.sin(i * 1.7))).toFixed(2)}"></i>`).join("")}</div>`;
        const t = U.esc(data.title || "THE NIGHT");
        return `
        <div class="inv-scroll">
          <header class="inv-hero">
            <p class="inv-eyebrow reveal">${U.esc(data.eventType || "One night only")}</p>
            <h1 class="inv-title reveal nx-glitch" data-text="${t}">${t}</h1>
            ${data.subtitle ? `<p class="inv-subtitle reveal">${U.esc(data.subtitle)}</p>` : ""}
            ${eq}
            ${U.detailsHtml(data, this)}
          </header>
          ${U.photoHtml(data, "photo-duotone")}
          <div class="inv-countdown reveal"></div>
          ${U.messageHtml(data)}
          ${U.scheduleHtml(data, this)}
          ${U.rsvpHtml(data, opts)}
          ${U.footHtml(data, this, opts)}
        </div>`;
      },
    },

    // ----------------------------------------------------------- midsommar
    midsommar: {
      id: "midsommar", name: "Midsommar", occasion: "Garden / Summer party",
      swatch: ["#F4F8EF", "#2F4C39", "#D96C4F"],
      fonts: G + "family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Karla:wght@400;600&display=swap",
      labels: { schedule: "The evening", hostedBy: "Skål from", song: "♪ The playlist" },
      intro(stage, data, done, U) {
        const petals = Array.from({ length: 8 }, (_, i) => {
          const a = i * 45;
          return `<g transform="rotate(${a} 100 100)"><ellipse class="ms-petal" style="--i:${i}" cx="100" cy="52" rx="10" ry="20" fill="#FFF" stroke="#D96C4F" stroke-width="1.2"/></g>`;
        }).join("");
        introShell(stage, "intro-midsommar", `
          <div class="ms-sky"></div>
          <div class="ms-sun"></div>
          <svg class="ms-wreath" viewBox="0 0 200 200" aria-hidden="true">
            <circle class="ms-ring" cx="100" cy="100" r="64" fill="none" stroke="#2F4C39" stroke-width="2.2"/>
            ${petals}
            <circle cx="100" cy="100" r="8" fill="#E9B44C"/>
          </svg>
          <p class="ms-word">${U.esc(U.guestName ? "Välkommen, " + U.guestName : (data.envelopeTeaser || "Summer is calling"))}</p>
          <div class="intro-skip">tap to continue</div>`, done, 4300);
      },
      decorate(stage, U) { U.particles(stage, "petals", 18); },
      scenes(data, opts, U) {
        const ribbons = `<svg class="ms-ribbons" viewBox="0 0 300 160" aria-hidden="true" data-depth="0.7">
          <line x1="150" y1="6" x2="150" y2="150" stroke="#8A6B4F" stroke-width="4"/>
          <circle cx="150" cy="8" r="7" fill="#E9B44C"/>
          <path class="rb r1" d="M150,14 C110,60 60,80 20,150" fill="none" stroke="#D96C4F" stroke-width="5" stroke-linecap="round"/>
          <path class="rb r2" d="M150,14 C190,60 240,80 280,150" fill="none" stroke="#E9B44C" stroke-width="5" stroke-linecap="round"/>
          <path class="rb r3" d="M150,14 C130,70 100,100 70,152" fill="none" stroke="#7A9E7E" stroke-width="5" stroke-linecap="round"/>
          <path class="rb r4" d="M150,14 C170,70 200,100 230,152" fill="none" stroke="#B9C4E0" stroke-width="5" stroke-linecap="round"/>
        </svg>`;
        return `
        <div class="inv-scroll">
          <div class="ms-rays" aria-hidden="true" data-depth="0.3"></div>
          <header class="inv-hero">
            <p class="inv-eyebrow reveal">${U.esc(data.eventType || "Under the open sky")}</p>
            <h1 class="inv-title reveal">${U.esc(data.title || "Midsommar")}</h1>
            ${data.subtitle ? `<p class="inv-subtitle reveal">${U.esc(data.subtitle)}</p>` : ""}
            <div class="ms-daisy reveal" aria-hidden="true"><svg viewBox="0 0 40 40">${Array.from({ length: 8 }, (_, i) =>
              `<ellipse cx="20" cy="9" rx="4" ry="8" fill="#FFF" stroke="#2F4C39" stroke-width="1" transform="rotate(${i * 45} 20 20)"/>`).join("")}<circle cx="20" cy="20" r="4.5" fill="#E9B44C"/></svg></div>
            ${U.detailsHtml(data, this)}
          </header>
          ${ribbons}
          ${U.photoHtml(data, "photo-wreath")}
          <div class="inv-countdown reveal"></div>
          ${U.messageHtml(data)}
          ${U.scheduleHtml(data, this)}
          ${U.rsvpHtml(data, opts)}
          ${U.footHtml(data, this, opts)}
        </div>`;
      },
    },
  };

  // ---- sample data (landing gallery + editor defaults) ----
  window.FIRA_SAMPLES = {
    botanical: {
      template: "botanical", eventType: "Wedding",
      title: "Alma & Theo", subtitle: "are getting married",
      date: "2027-06-19", time: "15:00",
      venue: "Rosendal Orangery", address: "Rosendalsvägen 38, Stockholm",
      mapUrl: "https://maps.google.com/?q=Rosendals+Tradgard",
      message: "After eight summers together we are finally making it official.\nJoin us for vows in the orangery, dinner under the vines, and dancing until the candles burn down.",
      schedule: [
        { time: "15:00", label: "Ceremony in the orangery" },
        { time: "16:00", label: "Bubbles in the garden" },
        { time: "18:00", label: "Dinner is served" },
        { time: "22:00", label: "First dance & party" },
      ],
      questions: [{ type: "choice", label: "Dinner preference", options: ["Fish", "Meat", "Vegetarian", "Vegan"] }],
      rsvpDeadline: "2027-05-15", hosts: "Alma & Theo",
    },
    noir: {
      template: "noir", eventType: "New Year's Eve Gala",
      title: "The Midnight Ball", subtitle: "Black tie · Champagne at twelve",
      date: "2026-12-31", time: "20:00",
      venue: "Grand Hall, Hotel Continental", address: "Vasagatan 22, Stockholm",
      message: "One night. One orchestra. One unforgettable countdown.",
      schedule: [
        { time: "20:00", label: "Doors & aperitif" },
        { time: "21:00", label: "Dinner" },
        { time: "23:30", label: "Countdown on the terrace" },
      ],
      questions: [], rsvpDeadline: "2026-12-15", hosts: "The Lindqvist Family",
    },
    confetti: {
      template: "confetti", eventType: "Birthday party",
      title: "Vera turns 30!", subtitle: "and refuses to be quiet about it",
      date: "2026-10-17", time: "18:30",
      venue: "Studio Karma", address: "Hornsgatan 12, Stockholm",
      message: "Tacos, tunes and a dangerously large cake. Costumes encouraged. Gifts forbidden — bring stories instead.",
      schedule: [
        { time: "18:30", label: "Drinks & tacos" },
        { time: "20:00", label: "The Great Cake Moment" },
        { time: "21:00", label: "Dance floor opens" },
      ],
      questions: [{ type: "text", label: "Song you MUST hear on the dance floor" }],
      rsvpDeadline: "2026-10-10", hosts: "Vera",
    },
    bloom: {
      template: "bloom", eventType: "Baby shower",
      title: "A tiny guest is coming", subtitle: "Shower for Elin & the bump",
      date: "2026-11-08", time: "14:00",
      venue: "Café Blomster", address: "Parkgatan 4, Göteborg",
      message: "Cake, guessing games and far too many tiny socks. Come celebrate before the sleepless nights begin.",
      schedule: [
        { time: "14:00", label: "Fika & mingle" },
        { time: "15:00", label: "Games & predictions" },
      ],
      questions: [{ type: "choice", label: "Team guess", options: ["Team girl", "Team boy", "Team surprise"] }],
      rsvpDeadline: "2026-11-01", hosts: "Sara & Mika",
    },
    neon: {
      template: "neon", eventType: "Warehouse party",
      title: "SYSTEM // OVERLOAD", subtitle: "One night only",
      date: "2026-09-26", time: "23:00",
      venue: "Dock 9", address: "Frihamnen, Stockholm",
      message: "Three rooms. Two sound systems. Zero phones on the floor. Location drops 24h before doors.",
      schedule: [
        { time: "23:00", label: "Doors" },
        { time: "00:00", label: "Main room ignites" },
        { time: "04:00", label: "Sunrise set" },
      ],
      questions: [], rsvpDeadline: "", hosts: "KRETS Collective",
    },
    midsommar: {
      template: "midsommar", eventType: "Midsummer party",
      title: "Midsommar at the Lake", subtitle: "Flowers in your hair, please",
      date: "2027-06-25", time: "13:00",
      venue: "Villa Solvik", address: "Solviksvägen 3, Dalarö",
      message: "Herring, new potatoes, strawberries and at least one questionable dance around the pole. Bring swimwear — the jetty is open all night.",
      schedule: [
        { time: "13:00", label: "Wreath-making & welcome drinks" },
        { time: "15:00", label: "Lunch & snaps songs" },
        { time: "17:00", label: "Games on the lawn" },
        { time: "21:00", label: "Midnight swim" },
      ],
      questions: [{ type: "choice", label: "Are you brave enough for the midnight swim?", options: ["Obviously", "Watching from the jetty"] }],
      rsvpDeadline: "2027-06-15", hosts: "Familjen Berg",
    },
  };
})();
