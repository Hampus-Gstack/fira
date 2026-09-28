/* Fira scroll film: a film cut into frames (theme-assets skill, `encode.py frames`), drawn on a canvas
   at the position the page asks for. No dependencies.

   Frames arrive coarse to fine, so the film can be scrubbed long before all of it has loaded.
   They are kept as they arrived (small), and unpacked away from the page's own thread: the frames
   around the position, and every eighth frame of the film so that a jump always has something to
   show. A frame that is unpacked while it is drawn costs the scroll a beat, and all frames unpacked
   at once cost a phone its memory.
   Between two frames the film shows a mix of both, so it moves in steps smaller than its frames.
   A film that is far from the screen can be told to pause its fetching and to let go of what it
   has unpacked. */
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

  const BITMAPS = typeof createImageBitmap === "function";
  const KEY = 8;             // every eighth frame stays unpacked

  function ScrollFilm(canvas, base, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.base = String(base).replace(/\/?$/, "/");
    this.options = Object.assign({ concurrency: 4, maxDpr: 2, keep: 6, blend: true, onprogress: null }, options);
    this.count = 0;        // frames in the film
    this.loaded = 0;       // frames that have arrived
    this.luma = [];        // brightness of each frame, 0 to 1
    this.width = 0;        // of a frame
    this.height = 0;
    this.data = [];        // the frames as they arrived
    this.ready = null;     // 1 for a frame that has arrived
    this.shown = new Map();      // unpacked frames: index -> picture
    this.unpacking = new Set();
    this.drawn = -1;       // the frame on screen (of a mix, the nearer one)
    this.position = 0;     // the position that was asked for
    this.paused = false;   // no new frames are asked for while this is true
    this.active = 0;       // frames on their way
    this._pump = null;
    this._last = "";
  }

  ScrollFilm.prototype.load = function () {
    if (this._loading) return this._loading;
    const self = this;
    this._loading = fetch(this.base + "manifest.json")
      .then((r) => { if (!r.ok) throw new Error("manifest " + r.status); return r.json(); })
      .then((m) => {
        self.count = m.count;
        self.luma = m.luma || [];
        self.width = m.width || 0;
        self.height = m.height || 0;
        self.data = new Array(m.count);
        self.ready = new Uint8Array(m.count);
        const queue = loadOrder(m.count);
        const name = (i) => self.base + String(i).padStart(m.pad || 3, "0") + "." + (m.ext || "webp");
        const one = (i, again) => {
          const over = () => { self.active--; self._pump(); };
          fetch(name(i) + (again ? "?retry" : ""))
            .then((r) => { if (!r.ok) throw new Error("frame " + r.status); return r.blob(); })
            .then((blob) => {
              self.data[i] = blob; self.ready[i] = 1; self.loaded++;
              if (self._near(i)) self._unpack(i);
              if (self.options.onprogress) self.options.onprogress(self.loaded, self.count);
              over();
            })
            .catch(() => {
              if (again) return over();   // the neighbours stand in for a frame that never arrives
              setTimeout(() => one(i, true), 1500);
            });
        };
        self._pump = () => {
          while (!self.paused && self.active < self.options.concurrency && queue.length) {
            self.active++;
            one(queue.shift());
          }
        };
        self.resize();
        self._pump();
        return m;
      });
    return this._loading;
  };

  // Stop asking for frames (those on their way still arrive), and ask again.
  ScrollFilm.prototype.pause = function () { this.paused = true; };
  ScrollFilm.prototype.resume = function () {
    if (!this.paused) return;
    this.paused = false;
    if (this._pump) this._pump();
    this._reach();
  };

  // Let go of every unpacked frame. They are unpacked again when the film is drawn.
  ScrollFilm.prototype.release = function () {
    this.shown.forEach((picture) => { if (picture.close) picture.close(); });
    this.shown.clear();
    this._last = "";
  };

  ScrollFilm.prototype._key = function (i) { return i % KEY === 0 || i === this.count - 1; };
  ScrollFilm.prototype._near = function (i) {
    return !this.paused && (this._key(i) || Math.abs(i - this.position) <= this.options.keep);
  };

  ScrollFilm.prototype._unpack = function (i) {
    if (i < 0 || i >= this.count || !this.ready[i] || this.shown.has(i) || this.unpacking.has(i)) return;
    const self = this;
    this.unpacking.add(i);
    const done = (picture) => {
      self.unpacking.delete(i);
      if (!picture) return;
      if (!self._near(i)) { if (picture.close) picture.close(); return; }   // the scroll has moved on meanwhile
      self.shown.set(i, picture);
      self.draw(self.position, true);
      if (self.options.onprogress) self.options.onprogress(self.loaded, self.count);
    };
    if (BITMAPS) {
      createImageBitmap(this.data[i]).then(done, () => done(null));
    } else {
      const img = new Image(), url = URL.createObjectURL(this.data[i]);
      img.onload = () => { URL.revokeObjectURL(url); done(img); };
      img.onerror = () => { URL.revokeObjectURL(url); done(null); };
      img.src = url;
    }
  };

  // Unpack what is near the position, and let go of what is far from it.
  ScrollFilm.prototype._reach = function () {
    if (!this.ready || this.paused) return;
    const keep = this.options.keep, at = Math.round(this.position);
    for (let d = 0; d <= keep; d++) { this._unpack(at + d); if (d) this._unpack(at - d); }
    for (let i = 0; i < this.count; i += KEY) this._unpack(i);
    this._unpack(this.count - 1);
    if (this.shown.size > keep * 2 + 4 + Math.ceil(this.count / KEY)) {
      this.shown.forEach((picture, i) => {
        if (this._key(i) || Math.abs(i - this.position) <= keep + 2) return;
        if (picture.close) picture.close();
        this.shown.delete(i);
      });
    }
  };

  // The nearest frame that can be shown, or -1.
  ScrollFilm.prototype.nearest = function (i) {
    i = Math.max(0, Math.min(this.count - 1, Math.round(i)));
    for (let d = 0; d < this.count; d++) {
      if (i - d >= 0 && this.shown.has(i - d)) return i - d;
      if (i + d < this.count && this.shown.has(i + d)) return i + d;
    }
    return -1;
  };

  // Match the canvas to its box on screen, with no more pixels than a frame has.
  // Call on load and whenever the layout changes.
  ScrollFilm.prototype.resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, this.options.maxDpr);
    let w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
    if (!w || !h) return;
    if (this.width && this.height) {
      const over = Math.max(w / this.width, h / this.height);     // how far a frame would be enlarged
      if (over > 1) { w = Math.round(w / over); h = Math.round(h / over); }
    }
    if (w === this.canvas.width && h === this.canvas.height) return;
    this.canvas.width = w; this.canvas.height = h;
    this.draw(this.position, true);
  };

  ScrollFilm.prototype._paint = function (i, alpha) {
    const picture = this.shown.get(i), c = this.canvas;
    const pw = picture.width || picture.naturalWidth, ph = picture.height || picture.naturalHeight;
    const scale = Math.max(c.width / pw, c.height / ph);        // cover
    const w = pw * scale, h = ph * scale;
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(picture, (c.width - w) / 2, (c.height - h) / 2, w, h);
    this.ctx.globalAlpha = 1;
  };

  // position: 0 to count - 1, whole or between two frames.
  // Returns the frame that is on screen now, or -1 before the first can be shown.
  ScrollFilm.prototype.draw = function (position, force) {
    if (!this.count) { this.position = position; return -1; }
    position = Math.max(0, Math.min(this.count - 1, position));
    this.position = position;
    this._reach();
    let below = -1, above = -1;
    for (let i = Math.floor(position); i >= 0; i--) if (this.shown.has(i)) { below = i; break; }
    for (let i = Math.ceil(position); i < this.count; i++) if (this.shown.has(i)) { above = i; break; }
    if (below < 0 && above < 0) return this.drawn;
    if (below < 0) below = above;
    if (above < 0) above = below;
    let mix = above === below ? 0 : (position - below) / (above - below);
    if (!this.options.blend) mix = mix < 0.5 ? 0 : 1;
    mix = Math.round(mix * 32) / 32;
    const what = below + ":" + above + ":" + mix + ":" + this.canvas.width;
    if (what === this._last && !force) return this.drawn;
    this._last = what;
    if (mix >= 1) this._paint(above, 1);
    else {
      this._paint(below, 1);
      if (mix > 0) this._paint(above, mix);
    }
    this.drawn = mix < 0.5 ? below : above;
    return this.drawn;
  };

  window.FiraScrollFilm = ScrollFilm;
})();
