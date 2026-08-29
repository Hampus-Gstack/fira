// Fira theme registry — six original animated themes.
// Each theme: id, name, occasion, fonts (Google Fonts URL), labels, ornament,
// decorate(stage, {particles}) for ambient animation. Visual identity lives in
// css/invite.css under .theme-<id>.
(function () {
  const G = "https://fonts.googleapis.com/css2?";

  window.FIRA_TEMPLATES = {
    botanical: {
      id: "botanical",
      name: "Botanical",
      occasion: "Wedding",
      swatch: ["#F7F3EA", "#31473A", "#A98B5D"],
      fonts: G + "family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Karla:wght@400;600&display=swap",
      ornament: "❦",
      labels: { eyebrow: "Together with their families", teaser: "You are warmly invited",
                schedule: "The day", hostedBy: "With love," },
      decorate(stage, fx) { fx.particles(stage, "leaves", 14); },
    },

    noir: {
      id: "noir",
      name: "Noir",
      occasion: "Gala / Modern wedding",
      swatch: ["#101014", "#E8E2D6", "#C9A24B"],
      fonts: G + "family=Marcellus&family=Jost:wght@300;500&display=swap",
      ornament: "◆",
      labels: { eyebrow: "An evening to remember", teaser: "Your presence is requested",
                schedule: "Programme", hostedBy: "Hosted by" },
      decorate(stage, fx) { fx.particles(stage, "bokeh", 18); },
    },

    confetti: {
      id: "confetti",
      name: "Confetti",
      occasion: "Birthday",
      swatch: ["#FFF6E9", "#22223A", "#F25C54"],
      fonts: G + "family=Fraunces:opsz,wght@9..144,600;9..144,900&family=Instrument+Sans:wght@400;600&display=swap",
      ornament: "★",
      labels: { eyebrow: "It's a party", teaser: "Surprise inside!",
                schedule: "The plan", hostedBy: "Thrown by" },
      decorate(stage, fx) { fx.particles(stage, "confetti", 40); },
    },

    bloom: {
      id: "bloom",
      name: "Bloom",
      occasion: "Baby shower",
      swatch: ["#FDF7F4", "#6B5B62", "#E8A9A0"],
      fonts: G + "family=Gantari:wght@300;500&family=Lora:ital@0;1&display=swap",
      ornament: "✿",
      labels: { eyebrow: "A little one is on the way", teaser: "Something sweet awaits",
                schedule: "The afternoon", hostedBy: "Celebrating with" },
      decorate(stage, fx) { fx.particles(stage, "petals", 16); },
    },

    neon: {
      id: "neon",
      name: "Neon",
      occasion: "Party / Club night",
      swatch: ["#0B0B12", "#EAF6FF", "#39F0C3"],
      fonts: G + "family=Syne:wght@600;800&family=Space+Mono&display=swap",
      ornament: "⚡",
      labels: { eyebrow: "Doors open late", teaser: "Access granted",
                schedule: "Lineup", hostedBy: "Presented by" },
      decorate(stage, fx) { fx.particles(stage, "sparks", 24); },
    },

    midsommar: {
      id: "midsommar",
      name: "Midsommar",
      occasion: "Garden / Summer party",
      swatch: ["#F4F8EF", "#2F4C39", "#D96C4F"],
      fonts: G + "family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Karla:wght@400;600&display=swap",
      ornament: "❀",
      labels: { eyebrow: "Under the open sky", teaser: "Summer is calling",
                schedule: "The evening", hostedBy: "Skål from" },
      decorate(stage, fx) { fx.particles(stage, "petals", 20); },
    },
  };

  // Demo/sample data per theme, used by the landing gallery and editor defaults.
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
