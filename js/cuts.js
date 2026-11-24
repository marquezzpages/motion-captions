/*
 * Corte de silencio medido no audio (mesma regra do py/cortes.py do Motion Captions CapCut).
 * A fala e achada pela energia do audio; as palavras do Whisper so protegem a fala fraca.
 * Cada pausa maior que "min" vira corte, deixando "respiro" quadros de silencio entre as falas.
 */
const SR = 16000;
const HOP = 0.01;

function percentile(arr, p) {
  const a = Float32Array.from(arr).sort();
  if (!a.length) return 0;
  const idx = (a.length - 1) * p / 100;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return a[lo] + (a[hi] - a[lo]) * (idx - lo);
}

function runs(mask, val) {
  const out = [];
  let i = 0;
  const n = mask.length;
  while (i < n) {
    if (!!mask[i] === val) {
      let j = i;
      while (j < n && !!mask[j] === val) j++;
      out.push([i, j]);
      i = j;
    } else i++;
  }
  return out;
}

/** energia em dB a cada 10 ms (janela de 30 ms) */
export function energy(x) {
  const hop = Math.round(SR * HOP), win = Math.round(SR * 0.03);
  const n = Math.max(1, Math.floor((x.length - win) / hop) + 1);
  const db = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let s = 0;
    const o = f * hop;
    for (let k = 0; k < win; k++) { const v = x[Math.min(o + k, x.length - 1)] || 0; s += v * v; }
    db[f] = 20 * Math.log10(Math.sqrt(s / win + 1e-12) + 1e-9);
  }
  return db;
}

function speechMask(db) {
  const floor = percentile(db, 8), loud = percentile(db, 92);
  const thr = floor + Math.max(6, 0.32 * (loud - floor));
  const m = new Uint8Array(db.length);
  for (let i = 0; i < db.length; i++) m[i] = db[i] > thr ? 1 : 0;
  // fecha buracos curtos (consoantes) e tira estalos isolados
  runs(m, false).forEach(([a, b]) => { if (b - a < 12) m.fill(1, a, b); });
  runs(m, true).forEach(([a, b]) => { if (b - a < 6) m.fill(0, a, b); });
  return { m, thr };
}

// palavras de bastidor (quem filma ou a contagem antes de comecar / depois de terminar)
const CUE = new Set(("pode podes falar fala gravando gravou grava gravar valendo vai ja acao corta cortar foi pronto beleza ok okay comeca " +
  "comecar comecou um dois tres quatro la bora partiu rodando rodou ta to isso agora go e ai entao vamos lets").split(" "));
function fold(t) { return String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""); }

/** tira do comeco/fim o som isolado: estalo, voz baixa (quem filma), som sem fala, fala de bastidor */
function limparPontas(sp, db, m, words, pausa) {
  const blocks = [];
  sp.forEach(([s, e]) => {
    if (blocks.length && s - blocks[blocks.length - 1][1] < 0.6) blocks[blocks.length - 1][1] = e;
    else blocks.push([s, e]);
  });
  if (blocks.length < 2) return { sp, out: [] };
  const talk = [];
  for (let i = 0; i < db.length; i++) if (m[i]) talk.push(db[i]);
  const ref = percentile(talk.length ? talk : db, 70);
  const info = b => {
    const a0 = Math.floor(b[0] / HOP), b0 = Math.max(a0 + 1, Math.floor(b[1] / HOP));
    const lv = percentile(db.subarray(a0, b0), 80);
    const toks = words.filter(w => b[0] - 0.05 <= (w.s + w.e) / 2 && (w.s + w.e) / 2 <= b[1] + 0.05).map(w => fold(w.w)).filter(Boolean);
    return { lv, toks };
  };
  const isolado = (b, gap) => {
    if (gap < pausa) return null;
    const d = b[1] - b[0];
    const { lv, toks } = info(b);
    if (d <= 0.35) return "toque ou estalo";
    if (lv <= ref - 9) return "voz baixa, longe do microfone";
    if (!toks.length && d <= 2.5) return "som sem fala";
    if (toks.length && toks.length <= 5 && toks.every(t => CUE.has(t))) return "fala de bastidor";
    return null;
  };
  const out = [];
  while (blocks.length >= 2 && blocks[0][0] < 8) {
    const why = isolado(blocks[0], blocks[1][0] - blocks[0][1]);
    if (!why) break;
    out.push({ onde: "início", s: blocks[0][0], e: blocks[0][1], motivo: why });
    blocks.shift();
  }
  const endT = db.length * HOP;
  while (blocks.length >= 2 && blocks[blocks.length - 1][1] > endT - 8) {
    const n = blocks.length;
    const why = isolado(blocks[n - 1], blocks[n - 1][0] - blocks[n - 2][1]);
    if (!why) break;
    out.push({ onde: "fim", s: blocks[n - 1][0], e: blocks[n - 1][1], motivo: why });
    blocks.pop();
  }
  if (!out.length) return { sp, out };
  const lo = blocks[0][0], hi = blocks[blocks.length - 1][1];
  return { sp: sp.filter(r => r[1] > lo - 1e-6 && r[0] < hi + 1e-6), out };
}

/**
 * Trechos que ficam. db = energy(audio 16 kHz); words = [{w,s,e}] em segundos do clipe.
 * opt: { fps, respiro (quadros), min (s), pontas (bool), soPontas (bool) }
 */
export function keeps(db, dur, words, opt) {
  opt = Object.assign({ fps: 30, respiro: 8, min: 0.30, pontas: true, soPontas: false, pausaPonta: 1.0 }, opt || {});
  const { m } = speechMask(db);
  const n = m.length;
  (words || []).forEach(w => {
    // protege so o miolo da palavra: o Whisper costuma esticar a borda dentro do silencio
    const ins = w.s + Math.min(0.06, (w.e - w.s) * 0.25), ine = w.e - Math.min(0.06, (w.e - w.s) * 0.25);
    if (ine > ins) m.fill(1, Math.floor(ins / HOP), Math.min(n, Math.floor(ine / HOP) + 1));
  });
  const half = (opt.respiro / opt.fps) / 2;
  let sp = runs(m, true).map(r => [r[0] * HOP, r[1] * HOP + 0.03]);
  let descartado = [];
  if (sp.length && opt.pontas) { const r = limparPontas(sp, db, m, words || [], opt.pausaPonta); sp = r.sp; descartado = r.out; }
  if (sp.length && opt.soPontas) sp = [[sp[0][0], sp[sp.length - 1][1]]];
  if (!sp.length) return { keeps: [[0, dur]], descartado: [] };
  const out = [];
  let cur = [Math.max(0, sp[0][0] - half), sp[0][1]];
  for (let i = 1; i < sp.length; i++) {
    const [s, e] = sp[i];
    if (s - cur[1] > Math.max(opt.min, 2 * half + 0.04)) {
      cur[1] = Math.min(dur, cur[1] + half);
      out.push(cur);
      cur = [Math.max(0, s - half), e];
    } else cur[1] = e;
  }
  cur[1] = Math.min(dur, cur[1] + half);
  out.push(cur);
  const fr = 1 / opt.fps;
  const ks = out.map(k => [Math.round(k[0] / fr) * fr, Math.round(k[1] / fr) * fr]).filter(k => k[1] - k[0] > fr);
  return { keeps: ks.length ? ks : [[0, dur]], descartado };
}
