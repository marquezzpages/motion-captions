/*
 * Linha do tempo: trechos que ficam (cortes), zoom de cada trecho, transicoes, sons e legendas
 * no tempo do video final. Tempo "G" = tempo dos clipes em sequencia, sem cortes (o da transcricao).
 */
const MCP = window.MCP;
const P = MCP.presets, SEG = MCP.seg;

export const FORMATS = [
  { fmt: "9:16", W: 1080, H: 1920, nome: "Vertical 9:16", y: 74 },
  { fmt: "4:5", W: 1080, H: 1350, nome: "Retrato 4:5", y: 78 },
  { fmt: "1:1", W: 1080, H: 1080, nome: "Quadrado 1:1", y: 80 },
  { fmt: "16:9", W: 1920, H: 1080, nome: "Horizontal 16:9", y: 85 }
];
export function frameFor(w, h) {
  const r = Math.log((+w || 1080) / (+h || 1920));
  let best = FORMATS[0];
  FORMATS.forEach(F => { if (Math.abs(Math.log(F.W / F.H) - r) < Math.abs(Math.log(best.W / best.H) - r)) best = F; });
  return best;
}
export function fmtOf(id) { return FORMATS.find(F => F.fmt === id) || FORMATS[0]; }

export const TRANSITIONS = [
  { id: "whip", nome: "Chicote" },
  { id: "whipV", nome: "Chicote ↕" },
  { id: "zoom", nome: "Zoom" },
  { id: "flash", nome: "Flash" },
  { id: "fade", nome: "Escurecer" },
  { id: "glitch", nome: "Glitch" },
  { id: "spin", nome: "Giro" }
];
const AUTO_POOL = ["whip", "zoom", "flash", "whipV", "glitch"];

/** hash fixo (mesmo projeto = mesmo sorteio) */
function hash(i, salt) { return MCP.ease.hash(i, salt || 0); }

/**
 * Monta a linha do tempo. S = estado do app. Retorna
 * { segs:[{clip, s, e, gs, ge, o, len, zoom, push, tIn, tOut}], dur, cuts:[{t, type, ms, between}] }
 */
export function build(S) {
  const segs = [];
  let o = 0, gOff = 0;
  S.clips.forEach((c, ci) => {
    const tIn = c.trimIn || 0, tOut = c.trimOut == null ? c.dur : c.trimOut;
    let ks = S.cut.on && c.keeps ? c.keeps : [[0, c.dur]];
    ks = ks.map(k => [Math.max(k[0], tIn), Math.min(k[1], tOut)]).filter(k => k[1] - k[0] > 0.05);
    ks.forEach((k, ki) => {
      const key = c.id + ":" + ki;
      if (S.removed && S.removed[key]) return;
      segs.push({ clip: ci, key, s: k[0], e: k[1], gs: gOff + k[0], ge: gOff + k[1], o, len: k[1] - k[0] });
      o += k[1] - k[0];
    });
    gOff += c.dur;
  });
  // zoom: alterna o enquadramento a cada corte, com aproximacao lenta opcional
  const Z = S.zoom;
  segs.forEach((g, i) => {
    const ov = (S.segZoom || {})[g.key];
    let z = 1;
    if (Z.mode === "alterna") z = i % 2 ? 1 + Z.amount / 100 : 1;
    else if (Z.mode === "sempre") z = 1 + Z.amount / 100;
    if (ov != null) z = ov;
    g.zoom = z;
    g.push = Z.slow ? 0.04 : 0;
  });
  // transicoes nos cortes
  const cuts = [];
  for (let i = 1; i < segs.length; i++) {
    const a = segs[i - 1], b = segs[i];
    const between = a.clip !== b.clip;
    const key = a.key + ">" + b.key;
    let type = null;
    const ov = (S.segTrans || {})[key];
    if (ov !== undefined) type = ov;
    else if (S.trans.where === "all" || (S.trans.where === "clips" && between)) type = S.trans.type;
    if (type === "auto") type = AUTO_POOL[Math.floor(hash(i, 5) * AUTO_POOL.length) % AUTO_POOL.length];
    cuts.push({ t: b.o, i, key, type: type || null, ms: S.trans.ms || 300, between });
  }
  return { segs, dur: o, cuts };
}

/** tempo G -> tempo do video final (ou null se foi cortado) */
export function mapG(tl, g) {
  for (const s of tl.segs) if (g >= s.gs - 1e-6 && g <= s.ge + 1e-6) return s.o + (g - s.gs);
  return null;
}

/** trecho do video final no tempo t */
export function segAt(tl, t) {
  const S = tl.segs;
  if (!S.length) return null;
  let lo = 0, hi = S.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (S[m].o <= t) lo = m; else hi = m - 1;
  }
  return S[lo];
}

/**
 * Legendas no tempo final, prontas para desenhar (pacote do motor do Motion Captions).
 * caps = legendas revisadas (tempo G). Retorna [{s,e,lines,words,...}] com tempos absolutos.
 */
export function finalCaptions(S, tl, style, layout) {
  const out = [];
  (S.caps || []).forEach(c => {
    const ws = [];
    c.words.forEach(w => {
      const mid = (w.s + w.e) / 2;
      const seg = tl.segs.find(g => mid >= g.gs && mid <= g.ge);
      if (!seg) return;
      const s = seg.o + (Math.max(w.s, seg.gs) - seg.gs), e = seg.o + (Math.min(w.e, seg.ge) - seg.gs);
      ws.push({ w: w.w, s, e: Math.max(s + 0.04, e), hl: !!w.hl });
    });
    if (ws.length) out.push({ start: ws[0].s, end: ws[ws.length - 1].e, words: ws });
  });
  SEG.retime(out, Object.assign({}, layout, { fps: 30 }));
  const pl = P.buildPayload(out, style, layout, { anchor: "custom" }, {});
  return pl.captions;
}

/** legenda ativa no tempo t */
export function capAt(caps, t) {
  for (const c of caps) if (t >= c.s && t < c.e) return c;
  return null;
}

/** sons: nos cortes (transicoes) e nas palavras destaque */
export function sfxEvents(S, tl, caps) {
  const ev = [];
  const sf = S.sfx;
  if (sf.cut && sf.cut.id) {
    tl.cuts.forEach(c => {
      if (sf.cut.onlyTrans && !c.type) return;
      ev.push({ t: Math.max(0, c.t - 0.12), id: sf.cut.id, vol: sf.cut.vol });
    });
  }
  if (sf.hl && sf.hl.id) {
    let last = -1;
    caps.forEach(c => c.words.forEach(w => {
      if (!w.hl) return;
      const t = c.s + w.s;
      if (t - last < 0.25) return;
      last = t;
      ev.push({ t, id: sf.hl.id, vol: sf.hl.vol });
    }));
  }
  if (sf.word && sf.word.id) {
    let last = -1;
    caps.forEach(c => c.words.forEach(w => {
      const t = c.s + w.s;
      if (t - last < 0.09) return;
      last = t;
      ev.push({ t, id: sf.word.id, vol: sf.word.vol });
    }));
  }
  ev.sort((a, b) => a.t - b.t);
  return ev;
}
