// Fira theme registry v5 — identities + art hooks + generated assets.
// The story mechanics live in invite-core. All artwork original.
(function () {
  const G = "https://fonts.googleapis.com/css2?";
  const M = "https://fira.cursuscapital.co/media/";

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
        hero: M + "hero-chateau.jpg", heroVideo: M + "hero-chateau.mp4",
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
        hero: M + "hero-toscana.jpg", heroVideo: M + "hero-toscana.mp4",
        sealPos: { x: 50, y: 50 }, sealSize: 20,
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

    // -------------------------------------------------------------- botanical
    botanical: {
      id: "botanical", name: "Botanical", occasion: "Wedding · Scandinavian",
      swatch: ["#F7F3EA", "#31473A", "#A98B5D"],
      fonts: G + "family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Karla:wght@400;600&display=swap",
      ornament: "❦",
      envTint: { paper: "#F1EADC", flap: "#E7DFCE", seal: "#7C1F2E" },
      opening: {
        poster: M + "poster-botanical.jpg", video: M + "open-botanical-v2.mp4", hero: M + "hero-botanical.jpg",
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
