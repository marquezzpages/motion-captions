/*
 * Transcricao no proprio celular: Whisper small (ONNX, 8 bits) com transformers.js.
 * Recebe audio 16 kHz mono e devolve palavras com tempo. Nada sai do aparelho.
 */
import { pipeline, env } from "../vendor/transformers.min.js";

/*
 * Onde fica o modelo:
 * - app instalado / teste no computador: dentro do proprio app (pasta models/, sem internet);
 * - site: baixado do Hugging Face na primeira vez e guardado no navegador (Cache).
 */
const MODELS = {
  small: { local: "whisper-small", remote: "onnx-community/whisper-small_timestamped" },
  base: { local: "whisper-base", remote: "onnx-community/whisper-base_timestamped" }
};
let asr = null, asrKey = "";
async function load(cfg) {
  cfg = cfg || {};
  const which = MODELS[cfg.model] ? cfg.model : "small";
  const local = !!(cfg.local && cfg.local[which]);
  const key = which + (local ? ":local" : ":remote");
  if (asr && asrKey === key) return asr;
  if (asr && asr.dispose) { try { await asr.dispose(); } catch (e) { /* ok */ } }
  asr = null;
  env.allowLocalModels = local;
  env.allowRemoteModels = !local;
  env.useBrowserCache = !local;
  // caminho relativo ao site (com URL completa o transformers.js acha que o arquivo e remoto)
  env.localModelPath = new URL("../models/", import.meta.url).pathname;
  // motor wasm: o do app quando existe; no site vem do jsDelivr (arquivo grande demais para a hospedagem)
  if (cfg.localWasm) env.backends.onnx.wasm.wasmPaths = new URL("../vendor/ort/", import.meta.url).href;
  env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)) : 1;
  env.backends.onnx.wasm.proxy = false;
  const seen = {};
  asr = await pipeline("automatic-speech-recognition", local ? MODELS[which].local : MODELS[which].remote, {
    device: "wasm",
    dtype: { encoder_model: "q8", decoder_model_merged: "q8" },
    progress_callback: p => {
      if (p.status === "progress" && p.total) {
        seen[p.file] = [p.loaded, p.total];
        let l = 0, t = 0;
        Object.values(seen).forEach(v => { l += v[0]; t += v[1]; });
        postMessage({ t: "load", p: t ? l / t : 0, mb: Math.round(t / 1e6), local });
      }
    }
  });
  asrKey = key;
  return asr;
}

/*
 * Trechos com fala (energia do audio, a cada 10 ms). O Whisper so recebe fala: os silencios
 * longos viram 0,3 s (ele costuma parar de escrever depois de uma pausa longa ou inventar texto nela).
 */
function speechRegions(x, sr) {
  const hop = Math.round(sr * 0.01), n = Math.floor(x.length / hop);
  if (n < 2) return [];
  const db = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let e = 0;
    for (let k = 0; k < hop; k += 2) { const v = x[f * hop + k] || 0; e += v * v; }
    db[f] = 10 * Math.log10(e / (hop / 2) + 1e-10);
  }
  const srt = Float32Array.from(db).sort();
  const floor = srt[Math.floor(n * 0.08)], loud = srt[Math.floor(n * 0.95)];
  if (loud - floor < 6 && loud < -45) return [];
  const thr = floor + Math.max(5, 0.25 * (loud - floor));
  const reg = [];
  let st = -1, lastOn = -100;
  for (let f = 0; f < n; f++) {
    if (db[f] > thr) { if (st < 0 || f - lastOn > 40) { if (st >= 0) reg.push([st, lastOn + 1]); st = f; } lastOn = f; }
  }
  if (st >= 0) reg.push([st, lastOn + 1]);
  // folga de 0,2 s nas pontas, junta o que encostar
  const out = [];
  reg.forEach(([a, b]) => {
    let s = Math.max(0, (a - 20) * hop), e = Math.min(x.length, (b + 20) * hop);
    if (e - s < sr * 0.12) return;
    if (out.length && s <= out[out.length - 1][1]) out[out.length - 1][1] = e; else out.push([s, e]);
  });
  // trecho maior que 27 s: divide no ponto mais quieto
  const fin = [];
  out.forEach(([s, e]) => {
    while (e - s > 27 * sr) {
      let best = s + 27 * sr, bestE = Infinity;
      for (let c = s + 15 * sr; c < s + 27 * sr; c += hop * 2) {
        const f = Math.floor(c / hop);
        const v = (db[f] || 0) + (db[f + 1] || 0) + (db[f + 2] || 0);
        if (v < bestE) { bestE = v; best = c; }
      }
      fin.push([s, best]); s = best;
    }
    fin.push([s, e]);
  });
  return fin;
}

/** junta trechos em janelas de ate 28 s (com 0,3 s entre eles) e o mapa de tempo de volta */
function buildWindow(x, sr, regs, i0) {
  const gap = Math.round(sr * 0.3), max = 28 * sr;
  const map = [];
  let len = 0, i = i0;
  while (i < regs.length) {
    const L = regs[i][1] - regs[i][0];
    if (map.length && len + gap + L > max) break;
    if (map.length) len += gap;
    map.push({ src: regs[i][0], dst: len, len: L });
    len += L; i++;
  }
  const buf = new Float32Array(len);
  map.forEach(m => buf.set(x.subarray(m.src, m.src + m.len), m.dst));
  return { buf, map, next: i };
}
function toSrc(map, t, sr) {
  const d = t * sr;
  let m = map[0];
  for (const q of map) if (q.dst <= d + 1) m = q;
  return (m.src + Math.max(0, Math.min(d - m.dst, m.len))) / sr;
}

self.onmessage = async ev => {
  const msg = ev.data;
  try {
    if (msg.t === "load") { await load(msg.cfg); postMessage({ t: "ready", threads: env.backends.onnx.wasm.numThreads }); return; }
    if (msg.t === "run") {
      const model = await load(msg.cfg);
      postMessage({ t: "ready", threads: env.backends.onnx.wasm.numThreads });
      const x = msg.audio, sr = 16000;
      const regs = speechRegions(x, sr);
      const words = [];
      let i = 0, guard = 0;
      while (i < regs.length && guard++ < 400) {
        postMessage({ t: "progress", p: regs[i][0] / x.length });
        const W = buildWindow(x, sr, regs, i);
        const out = await model(W.buf, { language: msg.lang || "portuguese", task: "transcribe", return_timestamps: "word" });
        let lastDst = 0;
        (out.chunks || []).forEach(c => {
          const w = String(c.text || "").trim();
          if (!w || c.timestamp[0] == null) return;
          let s = c.timestamp[0], e = c.timestamp[1];
          if (e == null || !(e > s)) e = s + 0.2;
          lastDst = Math.max(lastDst, e);
          words.push({ w, s: +toSrc(W.map, s, sr).toFixed(3), e: +toSrc(W.map, Math.min(e, W.buf.length / sr), sr).toFixed(3) });
        });
        // parou antes do fim da janela: continua do primeiro trecho que ficou sem texto
        let nx = W.next;
        if (lastDst < W.buf.length / sr - 1.5) {
          const k = W.map.findIndex(m => m.dst / sr > lastDst + 0.1);
          if (k > 0) nx = i + k;
        }
        i = nx;
      }
      // ordem e sem sobreposicao
      words.sort((a, b) => a.s - b.s);
      const clean = [];
      words.forEach(w => {
        const p = clean[clean.length - 1];
        if (p && w.s < p.s) w.s = p.s;
        if (p && p.e > w.s) p.e = Math.max(p.s + 0.01, w.s);
        if (w.e < w.s + 0.02) w.e = w.s + 0.02;
        clean.push(w);
      });
      postMessage({ t: "done", words: clean });
    }
  } catch (e) {
    postMessage({ t: "error", msg: String(e && e.message || e) });
  }
};
