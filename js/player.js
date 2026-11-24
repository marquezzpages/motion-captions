/*
 * Previa que toca: usa um <video> por clipe (com o som), pula os trechos cortados e desenha
 * no canvas o mesmo quadro da exportacao (zoom, transicao e legenda).
 */
import { drawFrame } from "./compose.js";
import { segAt } from "./timeline.js";

export class Player {
  constructor(canvas, getR, getSfx) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.getR = getR; // () => R (linha do tempo, legendas, estilo...)
    this.getSfx = getSfx; // id -> Promise<AudioBuffer>
    this.videos = [];
    this.t = 0;
    this.playing = false;
    this.raf = 0;
    this.onTime = null;
    this.ac = null;
    this.events = [];
    this._lastEvT = -1;
    this._loop = this._loop.bind(this);
  }

  setClips(clips) {
    this.videos.forEach(v => { v.pause(); v.removeAttribute("src"); v.load(); });
    this.videos = clips.map(c => {
      const v = document.createElement("video");
      v.playsInline = true; v.preload = "auto"; v.muted = false;
      v.setAttribute("playsinline", "");
      v.src = c.url;
      v.addEventListener("seeked", () => { if (!this.playing) this.draw(); });
      v.addEventListener("loadeddata", () => { if (!this.playing) this.draw(); });
      return v;
    });
  }

  get dur() { const R = this.getR(); return R && R.tl ? R.tl.dur : 0; }

  /** tamanho interno do canvas (ate 1280 px no lado maior, para a previa ficar leve) */
  resize(comp, cssW, cssH) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const k = Math.min(cssW / comp.w, cssH / comp.h);
    const w = Math.max(2, Math.round(comp.w * k)), h = Math.max(2, Math.round(comp.h * k));
    this.canvas.style.width = w + "px"; this.canvas.style.height = h + "px";
    const q = Math.min(dpr * k, 1280 / Math.max(comp.w, comp.h));
    const W = Math.round(comp.w * q), H = Math.round(comp.h * q);
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
    this.draw();
  }

  draw() {
    const R = this.getR();
    if (!R || !R.tl) return;
    const seg = segAt(R.tl, this.t);
    const v = seg ? this.videos[seg.clip] : null;
    const ok = v && v.readyState >= 2;
    drawFrame(this.ctx, R, this.t, ok ? v : null, ok ? v.videoWidth : 0, ok ? v.videoHeight : 0);
    if (this.onTime) this.onTime(this.t);
  }

  seek(t) {
    const R = this.getR();
    if (!R || !R.tl) return;
    this.t = Math.max(0, Math.min(t, Math.max(0, R.tl.dur - 0.01)));
    const seg = segAt(R.tl, this.t);
    if (!seg) return;
    const v = this.videos[seg.clip];
    this.videos.forEach(x => { if (x !== v) x.pause(); });
    const src = seg.s + (this.t - seg.o);
    if (v && Math.abs(v.currentTime - src) > 0.03) v.currentTime = src;
    this._lastEvT = this.t;
    this.draw();
  }

  async play() {
    const R = this.getR();
    if (!R || !R.tl || !R.tl.segs.length) return;
    if (this.t >= R.tl.dur - 0.05) this.seek(0);
    this.playing = true;
    if (!this.ac) { try { this.ac = new AudioContext(); } catch (e) { this.ac = null; } }
    if (this.ac && this.ac.state === "suspended") this.ac.resume();
    this._seg = null;
    this._lastEvT = this.t;
    this._startSeg();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this._loop);
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.videos.forEach(v => v.pause());
    this.draw();
  }

  toggle() { if (this.playing) this.pause(); else this.play(); }

  _startSeg() {
    const R = this.getR();
    const seg = segAt(R.tl, this.t);
    if (!seg) return;
    this._seg = seg;
    const v = this.videos[seg.clip];
    this.videos.forEach(x => { if (x !== v) x.pause(); });
    const src = seg.s + (this.t - seg.o);
    if (Math.abs(v.currentTime - src) > 0.08) v.currentTime = src;
    const p = v.play();
    if (p && p.catch) p.catch(() => { /* sem permissao de tocar: segue sem som */ });
  }

  _loop() {
    if (!this.playing) return;
    const R = this.getR();
    const seg = this._seg;
    if (!R || !seg) { this.pause(); return; }
    const v = this.videos[seg.clip];
    let t = seg.o + (v.currentTime - seg.s);
    if (t < seg.o) t = seg.o;
    if (v.currentTime >= seg.e - 0.015 || v.ended) {
      // fim do trecho: pula para o proximo
      const i = R.tl.segs.indexOf(seg);
      const nx = R.tl.segs[i + 1];
      if (!nx) { this.t = R.tl.dur; this.pause(); return; }
      this.t = nx.o;
      this._startSeg();
    } else this.t = t;
    this._sfx(R);
    this.draw();
    this.raf = requestAnimationFrame(this._loop);
  }

  _sfx(R) {
    if (!this.ac || !R.events) { this._lastEvT = this.t; return; }
    const a = this._lastEvT, b = this.t;
    if (b > a && b - a < 0.5) {
      R.events.forEach(ev => {
        if (ev.t > a && ev.t <= b) this.getSfx(ev.id).then(buf => {
          if (!buf || !this.playing) return;
          const s = this.ac.createBufferSource();
          s.buffer = buf;
          const g = this.ac.createGain();
          g.gain.value = Math.pow(10, (ev.vol == null ? -6 : ev.vol) / 20);
          s.connect(g); g.connect(this.ac.destination);
          s.start();
        });
      });
    }
    this._lastEvT = b;
  }
}
