// Fira theme registry v6 — identities, wording, chapter order, art hooks, media.
// The story mechanics live in invite-core. All artwork original.
(function () {
  const G = "https://fonts.googleapis.com/css2?";
  const M = "media/";  // theme media is served by the site itself (relative to the page)

  const branchArt = (flip) => `
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

  const decoCorner = (cls) => `<svg class="nr-corner ${cls}" viewBox="0 0 80 80" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="1.4">
      <path d="M2,78 V22 Q2,2 22,2 H78"/><path d="M12,78 V30 Q12,12 30,12 H78" opacity="0.5"/>
      <circle cx="22" cy="22" r="4" fill="currentColor" stroke="none"/>
    </g></svg>`;

  const balloonArt = (cls, hue, depth) => `
    <svg class="cf-balloon ${cls}" viewBox="0 0 60 90" aria-hidden="true" data-depth="${depth}">
      <path d="M30,4 C46,4 56,17 56,33 C56,50 42,62 30,62 C18,62 4,50 4,33 C4,17 14,4 30,4 Z" fill="hsl(${hue},75%,64%)"/>
      <path d="M27,62 L33,62 L30,70 Z" fill="hsl(${hue},60%,50%)"/>
      <path d="M30,70 C28,78 34,82 30,89" stroke="hsl(${hue},30%,40%)" fill="none" stroke-width="1.4"/>
      <ellipse cx="20" cy="20" rx="6" ry="10" fill="#fff" opacity="0.28" transform="rotate(-18 20 20)"/>
    </svg>`;

  const ribbonBow = `<svg class="menu-bow reveal" viewBox="0 0 200 70" aria-hidden="true">
    <path d="M100,34 C80,10 40,4 30,24 C22,40 50,50 100,34 Z" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M100,34 C120,10 160,4 170,24 C178,40 150,50 100,34 Z" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M100,34 C90,46 84,58 72,68 M100,34 C110,46 116,58 128,68" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <circle cx="100" cy="34" r="5" fill="currentColor"/>
  </svg>`;


  // ---- Agápi: line art drawn in code -------------------------------------------------
  // A church chandelier in line art: a crown on a chain, two tiers of candles on scrolled arms,
  // and below them the wide ring of candles that hangs in Orthodox churches, held by chains,
  // with pendants underneath. The strokes draw themselves, then the candles light tier by tier.
  function chandelierArt() {
    const cx = 160;
    let arms = "", hubs = "", candles = "", flames = "", count = 0;
    const candle = (x, cup, tier) => {
      candles += `<rect x="${(x - 2.4).toFixed(1)}" y="${(cup - 20).toFixed(1)}" width="4.8" height="20" rx="1"/>`;
      flames += `<path class="flame" style="--t:${tier};--d:${((count++ * 0.37) % 1.9).toFixed(2)}s" d="M${x.toFixed(1)},${(cup - 33).toFixed(1)} c3.6,4.8 4.2,7.8 0,11.4 c-4.2,-3.6 -3.6,-6.6 0,-11.4 z"/>`;
    };
    [{ y: 128, reach: 50, n: 2 }, { y: 180, reach: 92, n: 3 }].forEach((t, ti) => {
      hubs += `<ellipse cx="${cx}" cy="${t.y}" rx="${9 + ti * 3}" ry="${5 + ti}"/>`;
      hubs += `<path class="draw" style="--i:${ti}" d="M${cx},${t.y + 14} c-11,-3 -18,5 -12,12 c4,4 10,1 8,-4 M${cx},${t.y + 14} c11,-3 18,5 12,12 c-4,4 -10,1 -8,-4"/>`;
      [-1, 1].forEach((side) => {
        for (let j = 1; j <= t.n; j++) {
          const x = cx + side * Math.round((t.reach * j) / t.n);
          const cup = t.y - 8 - j * 2;
          const dip = t.y + 24 + j * 4;
          arms += `<path class="draw" style="--i:${ti}" d="M${cx},${t.y} C${cx + side * 16},${dip} ${x - side * 12},${dip} ${x},${cup}"/>`;
          arms += `<path d="M${x - 8},${cup} q8,7 16,0"/>`;
          candle(x, cup, ti);
        }
      });
    });
    // the ring
    const ring = { y: 254, rx: 138, ry: 15 };
    let pendants = "";
    for (let k = 0; k <= 8; k++) {
      const a = (Math.PI * k) / 8;
      const x = cx + ring.rx * Math.cos(a), y = ring.y + ring.ry * Math.sin(a);
      arms += `<path d="M${(x - 7).toFixed(1)},${(y - 3).toFixed(1)} q7,6 14,0"/>`;
      candle(x, y - 3, 2);
      if (k % 2 === 1) {
        const px = cx + ring.rx * Math.cos(a), py = ring.y + ring.ry * Math.sin(a);
        pendants += `<path d="M${px.toFixed(1)},${(py + 2).toFixed(1)} v10"/><path d="M${px.toFixed(1)},${(py + 12).toFixed(1)} c3.4,4.6 3.4,8 0,11 c-3.4,-3 -3.4,-6.4 0,-11 z"/>`;
      }
    }
    return `
    <svg class="ag-chandelier" viewBox="0 0 320 370" aria-hidden="true">
      <defs><radialGradient id="agGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFE3A0" stop-opacity="0.62"/><stop offset="55%" stop-color="#FFE3A0" stop-opacity="0.15"/><stop offset="100%" stop-color="#FFE3A0" stop-opacity="0"/>
      </radialGradient></defs>
      <ellipse class="ag-glow" cx="160" cy="200" rx="176" ry="160" fill="url(#agGlow)"/>
      <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M160,0 V56" stroke-dasharray="2 6"/>
        <circle cx="160" cy="61" r="4.5"/>
        <path d="M143,84 q17,-30 34,0 z"/><path d="M138,84 H182"/>
        <g class="ag-chains" stroke-width="1" stroke-dasharray="1.5 4.5">
          <path d="M146,84 L${cx - ring.rx},${ring.y}"/><path d="M174,84 L${cx + ring.rx},${ring.y}"/>
          <path d="M152,84 L${cx - 72},${ring.y + 13}"/><path d="M168,84 L${cx + 72},${ring.y + 13}"/>
        </g>
        <path class="draw" style="--i:0" d="M160,84 V292"/>
        ${hubs}
        <path class="draw" style="--i:2" d="M160,236 C122,272 66,268 ${cx - ring.rx},${ring.y}"/>
        <path class="draw" style="--i:2" d="M160,236 C198,272 254,268 ${cx + ring.rx},${ring.y}"/>
        <ellipse cx="160" cy="${ring.y}" rx="${ring.rx}" ry="${ring.ry}" opacity="0.45"/>
        <path d="M${cx - ring.rx},${ring.y} A${ring.rx},${ring.ry} 0 0 0 ${cx + ring.rx},${ring.y}" stroke-width="1.9"/>
        ${arms}
        <g stroke-width="1.1">${pendants}</g>
        <circle cx="160" cy="306" r="15"/>
        <path d="M147,300 q13,11 26,0 M147,312 q13,-11 26,0 M160,291 v30" opacity="0.8"/>
        <path d="M160,321 c6,9 6,18 0,30 c-6,-12 -6,-21 0,-30 z"/>
      </g>
      <g class="ag-candles">${candles}</g>
      <g class="ag-flames">${flames}</g>
    </svg>`;
  }

  // An olive branch: a curved stem, leaves alternating on both sides, a few olives.
  function oliveArt(cls) {
    const pt = (t) => {   // quadratic curve from (8,112) over (110,96) to (212,16)
      const a = 1 - t;
      return [a * a * 8 + 2 * a * t * 110 + t * t * 212, a * a * 112 + 2 * a * t * 96 + t * t * 16];
    };
    let leaves = "", olives = "";
    for (let k = 0; k < 9; k++) {
      const t = 0.1 + k * 0.1;
      const [x, y] = pt(t), [x2, y2] = pt(t + 0.02);
      const along = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
      const side = k % 2 ? 1 : -1;
      const rot = along + side * 38;
      const rad = (rot * Math.PI) / 180;
      const lx = x + Math.cos(rad) * 15, ly = y + Math.sin(rad) * 15;
      leaves += `<ellipse cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" rx="15" ry="4.4" transform="rotate(${rot.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})" opacity="${k % 2 ? 0.6 : 0.82}"/>`;
      if (k === 2 || k === 5 || k === 7) olives += `<ellipse cx="${(x + 3).toFixed(1)}" cy="${(y + 11).toFixed(1)}" rx="4.6" ry="6.2"/>`;
    }
    return `<svg class="ag-olive ${cls || ""}" viewBox="0 0 220 124" aria-hidden="true">
      <path d="M8,112 Q110,96 212,16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <g fill="currentColor">${leaves}</g><g class="ag-olives">${olives}</g></svg>`;
  }

  // A Byzantine church in line art: dome on a drum, tiled roofs, bell tower, arched door.
  const churchArt = () => `
    <svg class="ag-church reveal" viewBox="0 0 320 232" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">
      <path d="M8,214 H312" opacity="0.5"/>
      <path d="M40,214 V92 H80 V214"/>
      <path class="roof" d="M35,92 H85 L60,60 Z"/>
      <path d="M60,60 V44 M54,50 H66"/>
      <path d="M51,130 V112 Q60,101 69,112 V130 Z M51,172 V154 Q60,143 69,154 V172 Z"/>
      <path d="M80,214 V136 H256 V214"/>
      <path class="roof" d="M72,136 H264 L240,110 H96 Z"/>
      <path d="M122,110 V88 H214 V110"/>
      <path class="roof" d="M114,88 H222 L202,70 H134 Z"/>
      <path d="M146,70 V52 H190 V70"/>
      <path class="roof" d="M141,52 Q168,14 195,52 Z"/>
      <path d="M168,30 V14 M162,20 H174"/>
      <path d="M153,68 V60 Q157,55 161,60 V68 M164,68 V60 Q168,55 172,60 V68 M175,68 V60 Q179,55 183,60 V68"/>
      <path d="M152,214 V178 Q168,158 184,178 V214"/>
      <path d="M168,160 V214" opacity="0.5"/>
      <path d="M98,196 V172 Q106,162 114,172 V196 Z M124,196 V172 Q132,162 140,172 V196 Z M196,196 V172 Q204,162 212,172 V196 Z M222,196 V172 Q230,162 238,172 V196 Z"/>
      <path d="M140,106 V98 Q145,92 150,98 V106 Z M186,106 V98 Q191,92 196,98 V106 Z M163,106 V96 Q168,90 173,96 V106 Z"/>
      <path d="M256,214 V158 H288 V214"/>
      <path class="roof" d="M251,158 H293 L282,144 H256 Z"/>
      <path d="M266,196 V178 Q272,171 278,178 V196 Z"/>
    </svg>`;

  // Two olive sprigs meeting: a small mark for the celebration after the ceremony.
  const sprigArt = () => `<div class="ag-sprigs reveal" aria-hidden="true">${oliveArt("l")}${oliveArt("r")}</div>`;

  const commonRsvp = {
    yourName: "Your name", willAttend: "Will you attend?", guests: "Number of guests (including you)",
    message: "Message to the hosts (optional)", send: "Send RSVP",
  };

  window.FIRA_TEMPLATES = {

    // ---------------------------------------------------------------- chateau
    chateau: {
      id: "chateau", name: "Château", occasion: "Wedding · classic romance",
      swatch: ["#4A1A24", "#FBF7F2", "#B8202E"],
      fonts: G + "family=Great+Vibes&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap",
      ornament: "❦",
      envTint: { paper: "#4A1A24", flap: "#3E141D", seal: "#F3EEE6" },
      opening: {
        poster: M + "env-chateau.jpg", video: M + "open-chateau.mp4",
        hero: M + "hero-chateau.jpg", thumb: M + "thumb-chateau.webp", heroVideo: M + "hero-chateau.mp4",
        sealPos: { x: 50, y: 50 }, sealSize: 22,
      },
      assets: { venue: M + "venue-chateau.jpg" },
      heroLayout: "split", timelineCap: "✿", photoFrame: "gold",
      chapters: ["hero", "message", "countdown", "schedule", "venue", "dresscode", "contact", "rsvp"],
      labels: Object.assign({}, commonRsvp, {
        eyebrow: "Wedding Day", teaser: "With love", for: "For",
        countdown: "The Celebration Begins In", schedule: "Schedule of Events", venue: "Location",
        dressCode: "Dress Code", contact: "Details", rsvp: "Confirm Your Attendance",
        yes: "Yes, I will attend", no: "No, I can't attend", hostedBy: "", cta: "Confirm attendance",
        thanksYes: "We can't wait to celebrate with you,", thanksNo: "Thank you for letting us know,",
      }),
    },

    // ---------------------------------------------------------------- toscana
    toscana: {
      id: "toscana", name: "Toscana", occasion: "Wedding · watercolor",
      swatch: ["#F6EBD9", "#7A2E3A", "#E7A9A4"],
      fonts: G + "family=Pinyon+Script&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap",
      ornament: "❀",
      envTint: { paper: "#F3E9D7", flap: "#EBE0CB", seal: "#E9DFC8" },
      opening: {
        poster: M + "env-toscana.jpg", video: M + "open-toscana.mp4",
        hero: M + "hero-toscana.jpg", thumb: M + "thumb-toscana.webp", heroVideo: M + "hero-toscana.mp4",
        monogram: false,   // this seal carries its own crest
      },
      storyBg: M + "bg-toscana.jpg",
      assets: { venue: M + "venue-toscana.jpg" },
      heroFrame: true, timelineStyle: "icons", photoFrame: "oval", ctaStyle: "scroll",
      chapters: ["hero", "countdown", "venue", "schedule", "dresscode", "gifts", "menu", "photo", "accommodation", "faq", "rsvp"],
      labels: Object.assign({}, commonRsvp, {
        eyebrow: "Finally, we do", teaser: "You are invited", for: "For",
        countdown: "Countdown", countdownSub: "We can't wait for this moment",
        venue: "The Venue", schedule: "What we have planned for you",
        dressCode: "Dress code", gifts: "Gifts", giftsDirect: "Prefer to contribute directly?",
        menu: "Menu", accommodation: "Accommodation", accommodationSub: "Recommendations for your stay",
        faq: "FAQ", rsvp: "RSVP", replyBy: "Kindly reply by",
        yes: "Yes, I will attend", no: "No, I can't attend", hostedBy: "With love,", cta: "Scroll to RSVP",
        thanksYes: "Grazie mille,", thanksNo: "Thank you for letting us know,",
      }),
      after(wrap, data, opts, U) {
        const g = wrap.querySelector(".ch-gifts");
        if (!g || U.reduced) return;
        new IntersectionObserver((es, io) => es.forEach((e) => {
          if (e.isIntersecting) { U.particles(g, "confetti", 26); io.disconnect(); }
        }), { threshold: 0.3 }).observe(g);
      },
      art: { menuTop: ribbonBow },
    },

    // ------------------------------------------------------------------ agapi
    agapi: {
      id: "agapi", name: "Agápi", occasion: "Wedding · Greek",
      swatch: ["#FBF7EE", "#1F3559", "#B8923A"],
      fonts: G + "family=Great+Vibes&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap",
      ornament: "✦",
      envTint: { paper: "#F3E9D7", flap: "#EBE0CB", seal: "#E9DFC8" },
      // The light embossed envelope. A film of its own is a drop-in replacement for these two files.
      opening: { poster: M + "env-toscana.jpg", video: M + "open-toscana.mp4", monogram: false },   // this seal carries its own crest
      photoFrame: "arch",
      chapters: ["hero", "message", "countdown", "place:0", "section:family", "place:1", "section:dinner", "section:stay",
                 "section:dress", "section:gift", "section:speeches", "music", "photo", "rsvp", "section:closing"],
      labels: Object.assign({}, commonRsvp, {
        eyebrow: "We are getting married", teaser: "With love", countdown: "Not long now",
        yes: "Yes, I will attend", no: "No, I can't attend", cta: "RSVP",
        thanksYes: "Wonderful! See you there,",
      }),
      i18n: {
        sv: { eyebrow: "Vi gifter oss", teaser: "Välkommen till vårt bröllop", countdown: "Snart är det dags", thanksYes: "Vad roligt! Vi ses där," },
      },
      art: {
        hero: () => chandelierArt() + oliveArt("l") + oliveArt("r"),
        divider: `<div class="ag-key" aria-hidden="true"></div>`,
        place: (p, index) => (index === 0 ? churchArt() : sprigArt()),
      },
    },

    // -------------------------------------------------------------- botanical
    botanical: {
      id: "botanical", name: "Botanical", occasion: "Wedding · Scandinavian",
      swatch: ["#F7F3EA", "#31473A", "#A98B5D"],
      fonts: G + "family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Karla:wght@400;600&display=swap",
      ornament: "❦",
      envTint: { paper: "#F1EADC", flap: "#E7DFCE", seal: "#7C1F2E" },
      opening: {
        poster: M + "poster-botanical.jpg", video: M + "open-botanical-v2.mp4", hero: M + "hero-botanical.jpg", thumb: M + "thumb-botanical.webp",
        monogram: false,
      },
      labels: Object.assign({}, commonRsvp, {
        eyebrow: "Together with their families", teaser: "You are warmly invited",
        schedule: "The day", details: "When & where", hostedBy: "With love,",
        song: "♪ Our song", cta: "Confirm attendance",
      }),
      decorate(stage, U) { U.particles(stage, "leaves", 12); },
      art: {
        hero: () => branchArt(false) + branchArt(true),
        divider: `<div class="bt-rule" aria-hidden="true"><svg viewBox="0 0 120 12"><path d="M2,6 H46 M74,6 H118" stroke="currentColor" stroke-width="1"/><path d="M60,1 C64,4 64,8 60,11 C56,8 56,4 60,1 Z" fill="currentColor"/></svg></div>`,
      },
    },

    noir: {
      id: "noir", name: "Noir", occasion: "Gala / Modern wedding",
      swatch: ["#101014", "#E8E2D6", "#C9A24B"],
      fonts: G + "family=Marcellus&family=Jost:wght@300;500&display=swap",
      ornament: "◆", titleCls: "nr-shimmer",
      envTint: { paper: "#17161D", flap: "#100F15", seal: "#C9A24B" },
      labels: Object.assign({}, commonRsvp, {
        eyebrow: "An evening to remember", teaser: "Your presence is requested",
        schedule: "Programme", details: "The particulars", hostedBy: "Hosted by",
        song: "♪ The soundtrack", cta: "Reserve your place",
      }),
      decorate(stage, U) { U.particles(stage, "bokeh", 16); },
      art: {
        hero: () => `<div class="nr-frame" aria-hidden="true">${decoCorner("tl")}${decoCorner("tr")}${decoCorner("bl")}${decoCorner("br")}</div>`,
        divider: `<div class="nr-div" aria-hidden="true"><svg viewBox="0 0 160 14"><path d="M0,7 H62 M98,7 H160" stroke="currentColor" stroke-width="1"/><path d="M80,0 L87,7 L80,14 L73,7 Z" fill="currentColor"/></svg></div>`,
      },
    },

    confetti: {
      id: "confetti", name: "Confetti", occasion: "Birthday",
      swatch: ["#F25C54", "#F4A259", "#4E89AE", "#8CB369"],
      fonts: G + "family=Fraunces:opsz,wght@9..144,600;9..144,900&family=Instrument+Sans:wght@400;600&display=swap",
      ornament: "★", titleCls: "cf-title",
      envTint: { paper: "#FFEFD8", flap: "#FFE3C2", seal: "#F25C54" },
      labels: Object.assign({}, commonRsvp, {
        eyebrow: "It's a party", teaser: "Surprise inside!",
        schedule: "The plan", details: "Where the fun happens", hostedBy: "Thrown by",
        song: "♪ The anthem", cta: "Count me in!",
      }),
      decorate(stage, U) { U.particles(stage, "confetti", 34); },
      after(wrap, data, opts, U) {
        setTimeout(() => U.celebrate(["#F25C54", "#F4A259", "#4E89AE", "#8CB369", "#FFD166"], { x: innerWidth / 2, y: innerHeight * 0.35 }), 900);
      },
      art: {
        hero: () => balloonArt("b1", 4, 1.6) + balloonArt("b2", 205, 1.1) + balloonArt("b3", 95, 2),
        divider: `<div class="cf-wave" aria-hidden="true"><svg viewBox="0 0 200 16"><path d="M0,8 Q12,0 25,8 T50,8 T75,8 T100,8 T125,8 T150,8 T175,8 T200,8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></div>`,
      },
    },

    bloom: {
      id: "bloom", name: "Bloom", occasion: "Baby shower",
      swatch: ["#FDF7F4", "#6B5B62", "#E8A9A0"],
      fonts: G + "family=Gantari:wght@300;500&family=Lora:ital@0;1&display=swap",
      ornament: "✿",
      envTint: { paper: "#F7E9E4", flap: "#F4E3DE", seal: "#C97B70" },
      labels: Object.assign({}, commonRsvp, {
        eyebrow: "A little one is on the way", teaser: "Something sweet awaits",
        schedule: "The afternoon", details: "When & where", hostedBy: "Celebrating with",
        song: "♪ Lullaby", cta: "Let them know",
      }),
      decorate(stage, U) { U.particles(stage, "bubbles", 14); },
      art: {
        hero: () => `
          <svg class="bl-mobile" viewBox="0 0 200 120" aria-hidden="true" data-depth="0.5">
            <path d="M40,6 Q100,-8 160,6" fill="none" stroke="currentColor" stroke-width="1.4"/>
            <g class="swing s1"><line x1="60" y1="4" x2="60" y2="44" stroke="currentColor" stroke-width="1"/><path d="M60,39 l6,10 h-12 Z M60,59 l6,-10 h-12 Z" fill="#F0D8A8"/></g>
            <g class="swing s2"><line x1="100" y1="1" x2="100" y2="60" stroke="currentColor" stroke-width="1"/><path d="M108,66 A9,9 0 1 1 104,50 A7,7 0 1 0 108,66 Z" fill="#E8A9A0"/></g>
            <g class="swing s3"><line x1="140" y1="4" x2="140" y2="38" stroke="currentColor" stroke-width="1"/><circle cx="140" cy="46" r="8" fill="#B9C4E0"/></g>
          </svg>`,
        divider: "",
      },
    },

    neon: {
      id: "neon", name: "Neon", occasion: "Party / Club night",
      swatch: ["#39F0C3", "#FF5E8A", "#7B61FF"],
      fonts: G + "family=Syne:wght@600;800&family=Space+Mono&display=swap",
      ornament: "⚡", titleCls: "nx-glitch", titleAttr: true,
      envTint: { paper: "#101018", flap: "#0A0A10", seal: "#39F0C3" },
      labels: Object.assign({}, commonRsvp, {
        eyebrow: "One night only", teaser: "Access granted",
        schedule: "Lineup", details: "Coordinates", hostedBy: "Presented by",
        song: "♪ Preview the sound", cta: "Claim your spot",
      }),
      decorate(stage, U) { U.particles(stage, "sparks", 22); },
      art: {
        hero: () => `<div class="nx-eq" aria-hidden="true">${Array.from({ length: 24 }, (_, i) =>
          `<i style="--i:${i};--h:${(0.25 + 0.75 * Math.abs(Math.sin(i * 1.7))).toFixed(2)}"></i>`).join("")}</div>`,
        divider: "",
      },
    },

    midsommar: {
      id: "midsommar", name: "Midsommar", occasion: "Garden / Summer party",
      swatch: ["#F4F8EF", "#2F4C39", "#D96C4F"],
      fonts: G + "family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Karla:wght@400;600&display=swap",
      ornament: "❀",
      envTint: { paper: "#EDF3E4", flap: "#E4EDDA", seal: "#B5502F" },
      labels: Object.assign({}, commonRsvp, {
        eyebrow: "Under the open sky", teaser: "Summer is calling",
        schedule: "The evening", details: "Find your way", hostedBy: "Skål from",
        song: "♪ The playlist", cta: "Join the party",
      }),
      decorate(stage, U) { U.particles(stage, "petals", 18); },
      art: {
        hero: () => `
          <div class="ms-rays" aria-hidden="true" data-depth="0.3"></div>
          <svg class="ms-ribbons" viewBox="0 0 300 160" aria-hidden="true" data-depth="0.7">
            <line x1="150" y1="6" x2="150" y2="150" stroke="#8A6B4F" stroke-width="4"/><circle cx="150" cy="8" r="7" fill="#E9B44C"/>
            <path class="rb r1" d="M150,14 C110,60 60,80 20,150" fill="none" stroke="#D96C4F" stroke-width="5" stroke-linecap="round"/>
            <path class="rb r2" d="M150,14 C190,60 240,80 280,150" fill="none" stroke="#E9B44C" stroke-width="5" stroke-linecap="round"/>
            <path class="rb r3" d="M150,14 C130,70 100,100 70,152" fill="none" stroke="#7A9E7E" stroke-width="5" stroke-linecap="round"/>
            <path class="rb r4" d="M150,14 C170,70 200,100 230,152" fill="none" stroke="#B9C4E0" stroke-width="5" stroke-linecap="round"/>
          </svg>`,
        divider: `<div class="ms-daisy" aria-hidden="true"><svg viewBox="0 0 40 40">${Array.from({ length: 8 }, (_, i) =>
          `<ellipse cx="20" cy="9" rx="4" ry="8" fill="#FFF" stroke="#2F4C39" stroke-width="1" transform="rotate(${i * 45} 20 20)"/>`).join("")}<circle cx="20" cy="20" r="4.5" fill="#E9B44C"/></svg></div>`,
      },
    },
  };

  // ======================================================================
  // Sample data (landing gallery demos + editor defaults)
  // ======================================================================
  window.FIRA_SAMPLES = {
    chateau: {
      template: "chateau", eventType: "Wedding Day",
      title: "Sofia & Marcus", subtitle: "",
      date: "2027-07-05", time: "16:00",
      venue: "Château de Valmont", address: "12 Chemin des Vignes, 13200 Arles, France",
      messageTitle: "Dear Friends and Family,",
      message: "As we get ready to say \"I do\", we feel grateful for the wonderful people in our lives.\nYour support means the world to us, and we would be honored to have you with us as we begin our life together.",
      schedule: [
        { time: "16:00", label: "Wedding Ceremony" },
        { time: "17:00", label: "Cocktail Hour" },
        { time: "19:00", label: "Dinner" },
        { time: "21:00", label: "Party" },
      ],
      dressCode: {
        text: "We kindly invite you to dress in elegant attire that reflects the style and spirit of our special day.",
        palette: [{ color: "#7A9E7E" }, { color: "#4A1A24" }, { color: "#3C3540" }, { color: "#F5EFE6" }],
        images: [{ url: M + "attire-chateau.jpg", caption: "Gentlemen: well-tailored suits with classic shoes. Ladies: long evening gowns in the palette." }],
      },
      contact: {
        text: "For additional information or questions, please contact the wedding organizers.",
        name: "Amelie", phone: "+33 6 84 59 65 88",
        giftText: "Your presence is the greatest gift to us. However, if you wish to honor us with a present, a contribution toward our future would be sincerely appreciated.",
      },
      rsvpIntro: "To help us prepare for a joyful celebration, kindly confirm your attendance.",
      closingText: "Hope to see you there!",
      hosts: "Sofia and Marcus", rsvpDeadline: "2027-06-01",
      photo2Url: M + "couple-chateau.jpg",
      questions: [{ type: "choice", label: "Dinner preference", options: ["Meat", "Fish", "Vegetarian"] }],
      sealText: "S·M",
    },

    toscana: {
      template: "toscana", eventType: "Finally, we do",
      title: "Elena & Matteo", subtitle: "",
      date: "2027-05-22", time: "14:00",
      venue: "Villa Le Corti", address: "Via di Corti 12, 50026 San Casciano, Tuscany, Italy",
      schedule: [
        { time: "14:00", label: "Start", note: "We look forward to welcoming everybody with a drink", icon: "🥂" },
        { time: "15:00", label: "Surprise lunch", icon: "🍽" },
        { time: "17:00", label: "Ceremony in the olive grove", icon: "💍" },
        { time: "20:00", label: "Dinner under the lights", icon: "🕯" },
        { time: "23:00", label: "Dance till the stars fade", icon: "✨" },
      ],
      dressCode: {
        title: "Casual Attire",
        text: "Relaxed summer elegance — linen, flowing dresses, comfortable shoes for the terrace.",
        palette: [{ color: "#8A7A6A", label: "Sand" }, { color: "#FFFFFF", label: "White" }, { color: "#B9A8D9", label: "Lavender" }, { color: "#E7A9A4", label: "Rose gold" }, { color: "#8FA8D9", label: "Sky" }],
        images: [{ url: M + "attire-toscana.jpg", caption: "Casual wear" }],
      },
      gifts: {
        text: "Your presence is your gift, but all contributions can go to the bank details below.\nThank you",
        links: [{ label: "Our wishlist", url: "https://example.com/wishlist" }],
        details: "IBAN IT60 X054 2811 1010 0000 0123 456 · Elena & Matteo",
      },
      menu: [
        { course: "Starter", name: "Burrata & Heirloom Tomato Medley", description: "Creamy Italian burrata paired with sun-ripened heirloom tomatoes" },
        { course: "Main", name: "Miso-Glazed Beef Tenderloin", description: "Prime cut, pan-seared and served over a silky parsnip purée" },
        { course: "Dessert", name: "Velvet White Chocolate & Raspberry Mousse", description: "Light-as-air white chocolate mousse with raspberry coulis" },
      ],
      photoUrl: M + "couple-toscana.jpg",
      accommodation: [
        { name: "Hotel Sophia", note: "You can book directly with the link below for a discount", price: "from €140 / night", url: "https://example.com/hotel", imageUrl: M + "hotel-toscana.jpg" },
        { name: "Agriturismo La Quercia", note: "Ten minutes from the villa, family-run, superb breakfast", price: "from €95 / night", url: "https://example.com/agriturismo" },
      ],
      faq: [
        { q: "Can I bring a plus one?", a: "Of course — just add them to your RSVP." },
        { q: "Can I bring my parents?", a: "Yes! Let us know their names in the message." },
        { q: "Can I bring my child?", a: "Heeeeell nooo. (It's an adults-only party — sorry!)" },
      ],
      collectEmail: true,
      questions: [
        { type: "multi", label: "Food allergies and intolerances", options: ["Gluten-free / Celiac", "Lactose-free", "Vegetarian", "Vegan", "Nut allergy", "Seafood allergy"] },
        { type: "text", label: "Other allergies or restrictions", placeholder: "E.g. egg allergy, fructose intolerance" },
        { type: "radio", label: "Main", options: ["Meat", "Fish", "Vegetarian"] },
        { type: "text", label: "Song request for the party", placeholder: "Artist – song" },
      ],
      hosts: "Elena & Matteo", rsvpDeadline: "2027-04-15", sealText: "E·M",
    },

    agapi: {
      template: "agapi", lang: "sv", eventType: "Vi gifter oss",
      title: "Eleni & Markus", dateText: "Lördagen den 21 augusti 2027", heroNote: "Nafplio, Grekland",
      date: "2027-08-21", time: "18:00", timezone: "Europe/Athens", durationHours: 8,
      venue: "Agios Spyridon", address: "Kapodistriou, Nafplio 211 00, Grekland",
      envelopeTeaser: "Välkommen till vårt bröllop", sealText: "E·M",
      message: "Vi har längtat efter att få samla alla vi tycker om på en och samma plats.\nNu är det äntligen dags, och vi hoppas att ni vill fira med oss vid havet i Nafplio.",
      places: [
        { title: "Vigsel", dateText: "Lördagen den 21 augusti 2027", time: "Kl. 18.00", name: "Agios Spyridon",
          address: "Kapodistriou, Nafplio 211 00, Grekland", note: "Ceremonin hålls på grekiska och tar ungefär en timme.", calendar: true },
        { title: "Efter vigseln", lead: "Kvällen fortsätter med middag och dans på", name: "Ktima Elaia",
          address: "Nafplio, Grekland" },
      ],
      sections: [
        { key: "family", blocks: [
          { heading: "Våra föräldrar", lines: ["Dimitris & Sofia Papas", "Anders & Karin Lind"] },
          { heading: "Våra vigselvittnen", lines: ["Nikos Papas & Maria Lind"] } ] },
        { key: "dinner", title: "Middag", blocks: [
          { text: "Maten serveras på stora fat mitt på borden, så att alla får smaka av allt.\nBerätta gärna om matval och allergier när ni svarar." } ] },
        { key: "stay", title: "Boende", blocks: [
          { text: "Det finns flera fina hotell i gamla stan, på gångavstånd från kyrkan.",
            buttons: [{ label: "Hotell i Nafplio", url: "https://www.google.com/maps/search/?api=1&query=hotels+Nafplio" }] } ] },
        { key: "dress", title: "Klädkod", lead: "Sommarfin", blocks: [{ text: "Luftigt och festligt. Kvällarna är varma." }] },
        { key: "gift", title: "Gåva", blocks: [{ text: "Att ni kommer är gåva nog.\nVill ni ändå ge något blir vi glada för ett bidrag till vår bröllopsresa." }] },
        { key: "speeches", title: "Tal & hälsningar", blocks: [
          { text: "Vill ni hålla tal eller sjunga något under kvällen? Hör av er till vår toastmaster i god tid." } ] },
        { key: "closing", blocks: [
          { text: "Vi längtar efter att få skratta, äta och dansa med er." },
          { style: "signature", lines: ["Eleni & Markus"] } ] },
      ],
      music: [
        { title: "Extraordinary Moment", artist: "ChillØut, Soul Frequency, D'Michel Leb", spotify: "https://open.spotify.com/track/3F42efYjs67eHIFhgz2r6S" },
        { title: "Orchestra Love Story", artist: "Syed Saiful Mujtahid", spotify: "https://open.spotify.com/track/1Y5nb9F1LvIA6j90oqjDsa" },
      ],
      photoUrl: M + "couple-toscana.jpg",
      rsvpIntro: "Vi vill gärna veta om ni kommer.", rsvpDeadline: "2027-06-15",
      questions: [
        { type: "choice", perGuest: true, label: "Matval", options: ["Kött", "Kyckling", "Vegetariskt", "Veganskt"] },
        { type: "text", label: "Allergier eller specialkost" },
      ],
      hosts: "Eleni & Markus", hideRsvpHosts: true,
    },

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
      questions: [], rsvpDeadline: "2026-12-15", hosts: "The Lindqvist Family", sealText: "M",
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
      rsvpDeadline: "2026-10-10", hosts: "Vera", sealText: "30",
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
      rsvpDeadline: "2026-11-01", hosts: "Sara & Mika", sealText: "❀",
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
      questions: [], rsvpDeadline: "", hosts: "KRETS Collective", sealText: "SO",
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
      rsvpDeadline: "2027-06-15", hosts: "Familjen Berg", sealText: "☀",
    },
  };
})();
