// Fira — the words an invitation shows to guests, per language.
//
// A label is resolved in this order, later wins:
//   English base  <  language pack  <  the theme's own wording  <  the invitation's `labels`
// (theme wording = theme.labels for English, theme.i18n[lang] for other languages).
// An invitation chooses its language with `lang`. Add a language by adding a pack here.
window.FIRA_I18N = {
  en: {
    locale: "en-GB",
    // envelope
    for: "For", teaser: "You are invited", tapToOpen: "Tap to open", tapSeal: "Tap the seal to open",
    soundHint: "Turn your sound on", soundWhy: "Turn the volume up before you open", openInvitation: "Open the invitation", opening: "Opening…",
    // chapters
    eyebrow: "You're invited", countdown: "The countdown", details: "When & where", venue: "The venue",
    schedule: "Schedule", dressCode: "Dress code", gifts: "Gifts", giftsDirect: "Prefer to contribute directly?",
    menu: "Menu", accommodation: "Accommodation", faq: "FAQ", contact: "Details", music: "Our music",
    days: "days", hours: "hours", minutes: "minutes", seconds: "seconds", today: "Today is the day ✦",
    // actions
    directions: "Get directions", directionsSub: "Open in Google Maps", calendar: "Add to calendar",
    calendarSub: "Save the date", song: "♪ Our song", viewDetails: "View details ↗", whatsapp: "WhatsApp",
    listen: "Listen", musicHint: "Tap a song to listen", playsOnSpotify: "Plays with Spotify",
    ourSong: "Our song", playsOnYouTube: "Plays with YouTube",
    // RSVP
    rsvp: "RSVP", replyBy: "Please reply by", yourName: "Your name", email: "Email", emailPlaceholder: "your@email.com",
    willAttend: "Will you attend?", yes: "Joyfully accepts", no: "Regretfully declines",
    guests: "Number of guests (including you)", guestN: "Guest {n}", message: "Message to the hosts (optional)",
    send: "Send RSVP", sending: "Sending…", nameMissing: "Please enter your name.",
    previewOnly: "This is a preview. Publish to enable RSVP.", sendFailed: "Could not send. Try again.",
    thanksYes: "See you there,", thanksNo: "Thank you for letting us know,", hostedBy: "",
    fewer: "Fewer", more: "More",
    // chrome
    cta: "Confirm attendance", madeWith: "Made with Ohlala", toggleSound: "Sound on or off", toggleFullscreen: "Full screen on or off",
    replay: "Open again", replayEnd: "Open the invitation again",
  },

  sv: {
    locale: "sv-SE",
    for: "Till", teaser: "Ni är inbjudna", tapToOpen: "Tryck för att öppna", tapSeal: "Tryck på sigillet för att öppna",
    soundHint: "Slå på ljudet", soundWhy: "Höj volymen innan du öppnar", openInvitation: "Öppna inbjudan", opening: "Öppnar…",
    eyebrow: "Ni är inbjudna", countdown: "Nedräkning", details: "Tid & plats", venue: "Platsen",
    schedule: "Program", dressCode: "Klädkod", gifts: "Gåva", giftsDirect: "Vill ni hellre bidra direkt?",
    menu: "Meny", accommodation: "Boende", faq: "Frågor & svar", contact: "Kontakt", music: "Vår musik",
    days: "dagar", hours: "timmar", minutes: "minuter", seconds: "sekunder", today: "Idag är dagen ✦",
    directions: "Hitta hit", directionsSub: "Öppna i Google Maps", calendar: "Lägg till i kalendern",
    calendarSub: "Spara datumet", song: "♪ Vår låt", viewDetails: "Visa mer ↗", whatsapp: "WhatsApp",
    listen: "Lyssna", musicHint: "Tryck på en låt för att lyssna", playsOnSpotify: "Spelas via Spotify",
    ourSong: "Vår låt", playsOnYouTube: "Spelas via YouTube",
    rsvp: "OSA", replyBy: "OSA senast", yourName: "Namn", email: "E-post", emailPlaceholder: "namn@exempel.se",
    willAttend: "Kommer du?", yes: "Kommer", no: "Kommer inte",
    guests: "Antal gäster (inklusive dig)", guestN: "Gäst {n}", message: "Hälsning (valfritt)",
    send: "Skicka svar", sending: "Skickar…", nameMissing: "Skriv ditt namn.",
    previewOnly: "Detta är en förhandsvisning. Publicera för att aktivera OSA.", sendFailed: "Det gick inte att skicka. Försök igen.",
    thanksYes: "Vi ses där,", thanksNo: "Tack för att du hör av dig,", hostedBy: "",
    fewer: "Färre", more: "Fler",
    cta: "OSA här", madeWith: "Skapad med Ohlala", toggleSound: "Ljud av eller på", toggleFullscreen: "Helskärm av eller på",
    replay: "Öppna igen", replayEnd: "Öppna inbjudan igen",
  },
};
