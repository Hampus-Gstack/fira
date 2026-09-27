/* Fira scroll film: a film cut into frames (theme-assets skill, `encode.py frames`), drawn on a canvas
   at the position the page asks for. Frames arrive coarse to fine, so the film can be scrubbed long
   before all of it has loaded. No dependencies. */
(function () {
  "use strict";

  // First and last frame, then every 16th, 8th, 4th, 2nd, and finally every frame.
  function loadOrder(count) {
    const seen = new Uint8Array(count), out = [];
    const add = (i) => { if (i >= 0 && i < count && !seen[i]) { seen[i] = 1; out.push(i); } };
    add(0); add(count - 1);
    let step = 1;
    while (step * 2 < count) step *= 2;
    for (; step >= 1; step /= 2) for (let i = 0; i < count; i += step) add(i);
    return out;
  }

  function ScrollFilm(canvas, base, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.base = String(base).replace(/\/?$/, "/");
    this.options = Object.assign({ concurrency: 4, maxDpr: 2, onprogress: null }, options);
    this.count = 0;        // frames in the film
    this.loaded = 0;       // frames that have arrived
    this.luma = [];        // brightness of each frame, 0 to 1
    this.frames = [];
    this.ready = null;
    this.drawn = -1;       // the frame on screen
    this.position = 0;     // the frame that was asked for
  }

  ScrollFilm.prototype.load = function () {
    if (this._loading) return this._loading;
    const self = this;
    this._loading = fetch(this.base + "manifest.json")
      .then((r) => { if (!r.ok) throw new Error("manifest " + r.status); return r.json(); })
      .then((m) => {
        self.count = m.count;
        self.luma = m.luma || [];
        self.frames = new Array(m.count);
        self.ready = new Uint8Array(m.count);
        const queue = loadOrder(m.count);
        const name = (i) => self.base + String(i).padStart(m.pad || 3, "0") + "." + (m.ext || "webp");
        const next = () => {
          const i = queue.shift();
          if (i === undefined) return;
          const img = new Image();
          let retried = false;
          img.decoding = "async";
          img.onload = () => {
            self.frames[i] = img; self.ready[i] = 1; self.loaded++;
            const closer = self.drawn < 0 || Math.abs(i - self.position) < Math.abs(self.drawn - self.position);
            if (closer) self.draw(self.position, true);
            if (self.options.onprogress) self.options.onprogress(self.loaded, self.count);
            next();
          };
          img.onerror = () => {
            if (retried) return next();   // the neighbours stand in for a frame that never arrives
            retried = true;
            setTimeout(() => { img.src = name(i) + "?retry"; }, 1500);
          };
          img.src = name(i);
        };
        for (let k = 0; k < self.options.concurrency; k++) next();
        return m;
      });
    return this._loading;
  };

  ScrollFilm.prototype.nearest = function (i) {
    if (!this.ready) return -1;
    i = Math.max(0, Math.min(this.count - 1, Math.round(i)));
    for (let d = 0; d < this.count; d++) {
      if (i - d >= 0 && this.ready[i - d]) return i - d;
      if (i + d < this.count && this.ready[i + d]) return i + d;
    }
    return -1;
  };

  // Match the canvas to its box on screen. Call on load and whenever the layout changes.
  ScrollFilm.prototype.resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, this.options.maxDpr);
    const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
    if (!w || !h || (w === this.canvas.width && h === this.canvas.height)) return;
    this.canvas.width = w; this.canvas.height = h;
    this.draw(this.position, true);
  };

  // position: 0 to count - 1. Returns the frame that is on screen now, or -1 before the first has arrived.
  ScrollFilm.prototype.draw = function (position, force) {
    this.position = position;
    const i = this.nearest(position);
    if (i < 0 || (i === this.drawn && !force)) return this.drawn;
    const img = this.frames[i], c = this.canvas;
    const scale = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight);   // cover
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    this.ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
    this.drawn = i;
    return i;
  };

  window.FiraScrollFilm = ScrollFilm;
})();
