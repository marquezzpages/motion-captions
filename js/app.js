/*
 * Motion Captions Mobile - telas e fluxo:
 * escolher videos -> transcrever no aparelho -> revisar -> editar (estilo, cortes, zoom,
 * transicoes, sons) -> exportar MP4 para a galeria.
 */
import { loadFonts, familyList, weightsOf, weightOf, WEIGHT_NAMES } from "./fonts.js";
import { drawCaption } from "./render.js";
import { openClip, thumb, decodeAudio, to16k, decodeSoundFile } from "./media.js";
import { energy, keeps } from "./cuts.js";
import * as TL from "./timeline.js";
import { Player } from "./player.js";
import { mixAudio, exportVideo } from "./export.js";
import { auth, DEMO, validEmail } from "./supa.js";
import { isNative, openGalleryWriter, openWebWriter, shareFile, download, keepAwake, sons, prefs, freeSpace, onBack, exitApp } from "./native.js";

const MCP = window.MCP;
const P = MCP.presets, SEG = MCP.seg, SFX = MCP.sfx;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
const fmtT = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ":" + (s < 10 ? "0" : "") + s; };
const fmtT1 = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1); };

/* ---------- estado ---------- */
const DEF = {
  lang: "portuguese", presetId: "e_minusculo", ov: {}, wpc: "estilo", size: 100, hlOn: null, posBy: {}, fit: "cover",
  cut: { on: true, respiro: 8, pontas: true },
  zoom: { mode: "alterna", amount: 12, slow: true },
  trans: { where: "clips", type: "auto", ms: 320 },
  sfx: { cut: { id: "whoosh_curto", vol: -10, onlyTrans: true }, hl: { id: "", vol: -10 }, word: { id: "", vol: -16 } },
  voiceDb: 0, quality: "1080"
};
const saved = prefs.load();
const S = Object.assign(P.clone(DEF), saved, {
  clips: [], caps: [], removed: {}, segZoom: {}, segTrans: {}, fmt: null, tab: "estilo", ctab: "fill", sel: 0
});
["cut", "zoom", "trans", "sfx"].forEach(k => { S[k] = P.merge(DEF[k], saved[k] || {}); });
function savePrefs() {
  const p = {};
  ["lang", "model", "presetId", "ov", "wpc", "size", "hlOn", "posBy", "fit", "cut", "zoom", "trans", "sfx", "voiceDb", "quality"].forEach(k => { p[k] = S[k]; });
  prefs.save(p);
}

let R = null, keyN = 0;
const player = new Player($("pv"), () => R, getSfx);

/* ---------- avisos ---------- */
let toastT = 0;
function toast(msg, ms) {
  const t = $("toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms || 2600);
}
function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === id));
  if (id === "editor") requestAnimationFrame(layoutStage);
  if (id !== "editor") player.pause();
}
function sheet(html, bind) {
  $("sheet").innerHTML = html;
  $("modal").classList.remove("hidden");
  const close = () => $("modal").classList.add("hidden");
  $("modal").onclick = e => { if (e.target === $("modal")) close(); };
  if (bind) bind($("sheet"), close);
  return close;
}

/* ---------- sons (efeitos) ---------- */
const sfxCache = new Map();
function getSfx(id) {
  if (!id) return Promise.resolve(null);
  if (!sfxCache.has(id)) {
    const p = (async () => {
      try {
        if (String(id).indexOf("u:") === 0) {
          const rec = await sons.get(id);
          if (!rec) return null;
          return await decodeSoundFile(rec.blob);
        }
        const ab = await (await fetch("sfx/" + id + ".wav")).arrayBuffer();
        return await new OfflineAudioContext(2, 2, 48000).decodeAudioData(ab);
      } catch (e) { console.warn("som", id, e); return null; }
    })();
    sfxCache.set(id, p);
  }
  return sfxCache.get(id);
}
let auCtx = null;
async function playSound(id, vol) {
  const b = await getSfx(id);
  if (!b) return;
  if (!auCtx) auCtx = new AudioContext();
  const s = auCtx.createBufferSource(); s.buffer = b;
  const g = auCtx.createGain(); g.gain.value = Math.pow(10, (vol == null ? -6 : vol) / 20);
  s.connect(g); g.connect(auCtx.destination); s.start();
}
let mySounds = [];
async function refreshSounds() { try { mySounds = await sons.list(); } catch (e) { mySounds = []; } }
function soundName(id) {
  if (!id) return "Nenhum";
  const m = mySounds.find(s => s.id === id);
  if (m) return m.name;
  const b = SFX.BY_ID[id];
  return b ? b.name : "Som";
}
function soundOptions(cur) {
  let h = '<option value="">Nenhum</option>';
  if (mySounds.length) h += '<optgroup label="Meus sons">' + mySounds.map(s => '<option value="' + s.id + '"' + (s.id === cur ? " selected" : "") + ">" + esc(s.name) + "</option>").join("") + "</optgroup>";
  h += '<optgroup label="Sons do app">' + SFX.LIST.map(s => '<option value="' + s.id + '"' + (s.id === cur ? " selected" : "") + ">" + esc(s.name) + "</option>").join("") + "</optgroup>";
  return h;
}

/* ---------- 1. escolher videos ---------- */
const COLL = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
$("pickInput").addEventListener("change", e => {
  const files = Array.from(e.target.files || []);
  e.target.value = "";
  addFiles(files);
});
async function addFiles(files) {
  if (!files.length) return;
  files.sort((a, b) => COLL.compare(a.name, b.name));
  for (const f of files) {
    try {
      toast("Abrindo " + f.name + "…", 1200);
      const c = await openClip(f);
      Object.assign(c, { id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), file: f, name: f.name, url: URL.createObjectURL(f) });
      S.clips.push(c);
      renderClips();
      thumb(c, Math.min(1, c.dur / 2)).then(u => { c.thumb = u; renderClips(); }).catch(() => {});
    } catch (err) {
      console.error(err);
      toast("Não deu para abrir " + f.name + ": " + (err.message || err), 4500);
    }
  }
  renderClips();
}
function renderClips() {
  $("clipList").innerHTML = S.clips.map((c, i) =>
    '<div class="clip">' + (c.thumb ? '<img src="' + c.thumb + '">' : '<div class="ph"></div>') +
    '<div class="info"><b>' + (i + 1) + ". " + esc(c.name) + "</b><span>" + fmtT(c.dur) + " · " + c.w + "×" + c.h + "</span></div>" +
    '<button data-a="up" data-i="' + i + '">↑</button><button data-a="del" data-i="' + i + '">✕</button></div>').join("");
  $("goBtn").disabled = !S.clips.length;
  $("homeOpts").classList.toggle("hidden", !S.clips.length);
  $("lang").value = S.lang;
  $("model").value = S.model;
}
$("clipList").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const i = +b.dataset.i;
  if (b.dataset.a === "del") { URL.revokeObjectURL(S.clips[i].url); S.clips.splice(i, 1); }
  if (b.dataset.a === "up" && i > 0) { const c = S.clips.splice(i, 1)[0]; S.clips.splice(i - 1, 0, c); }
  renderClips();
});
$("lang").addEventListener("change", () => { S.lang = $("lang").value; savePrefs(); });
$("model").addEventListener("change", () => { S.model = $("model").value; savePrefs(); S.clips.forEach(c => { c.words = null; }); });

/* ---------- 2. preparar: audio, transcricao, cortes ---------- */
let cancelled = false, worker = null;
$("workCancel").addEventListener("click", () => { cancelled = true; if (worker) { worker.terminate(); worker = null; } toast("Cancelado"); show(S.caps.length || S.ready ? "editor" : "home"); });
function work(title, p, txt) {
  $("workTitle").textContent = title;
  $("workBar").style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + "%";
  $("workText").textContent = txt || "";
}

/* ---------- modelo de fala: dentro do app (pasta models/) ou baixado na 1a vez (site) ---------- */
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
if (!S.model) S.model = IOS ? "base" : "small";
const localModels = {};
let localWasm = false;
async function probeLocal() {
  const head = async u => { try { const r = await fetch(u, { method: "HEAD", cache: "no-store" }); return r.ok; } catch (e) { return false; } };
  localModels.small = await head("models/whisper-small/config.json");
  localModels.base = await head("models/whisper-base/config.json");
  localWasm = await head("vendor/ort/ort-wasm-simd-threaded.asyncify.wasm");
}
function asrCfg() { return { model: S.model, local: localModels, localWasm }; }
const MODEL_MB = { small: 250, base: 80 };

function transcribe(a16, onP) {
  return new Promise((res, rej) => {
    if (!worker) worker = new Worker(new URL("./asr-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = ev => {
      const m = ev.data;
      if (m.t === "load") onP("load", m.p);
      else if (m.t === "progress") onP("run", m.p);
      else if (m.t === "ready") onP("ready", 0);
      else if (m.t === "done") res(m.words);
      else if (m.t === "error") rej(new Error(m.msg));
    };
    worker.onerror = e => rej(new Error(e.message || "erro na transcrição"));
    const copy = new Float32Array(a16);
    worker.postMessage({ t: "run", audio: copy, lang: S.lang, cfg: asrCfg() }, [copy.buffer]);
  });
}

$("goBtn").addEventListener("click", prepare);
async function prepare() {
  cancelled = false;
  const noCaps = $("noCaps").checked;
  show("work");
  await keepAwake(true);
  try {
    const n = S.clips.length;
    let gOff = 0;
    const allWords = [];
    for (let i = 0; i < n; i++) {
      const c = S.clips[i];
      const label = n > 1 ? " (" + (i + 1) + " de " + n + ")" : "";
      if (!c.audio) {
        work("Lendo o áudio" + label, 0, c.name);
        c.audio = await decodeAudio(c, p => work("Lendo o áudio" + label, p, c.name));
        c.a16 = await to16k(c.audio);
        c.db = energy(c.a16);
      }
      if (cancelled) return;
      if (!noCaps && !c.words) {
        work("Transcrevendo" + label, 0, "Carregando o modelo de fala…");
        const t0 = performance.now();
        c.words = await transcribe(c.a16, (ph, p) => {
          if (ph === "load") work("Transcrevendo" + label, p * 0.15, (localModels[S.model] ? "Carregando o modelo de fala… " : "Baixando o modelo de fala (só na primeira vez, ~" + MODEL_MB[S.model] + " MB)… ") + Math.round(p * 100) + "%");
          else if (ph === "run") {
            const el = (performance.now() - t0) / 1000;
            const eta = p > 0.05 ? Math.round(el / p * (1 - p)) : null;
            work("Transcrevendo" + label, 0.15 + p * 0.85, "Ouvindo a fala…" + (eta != null ? " falta ~" + fmtT(eta) : ""));
          }
        });
      }
      if (cancelled) return;
      c.words = c.words || [];
      const k = keeps(c.db, c.dur, c.words, { respiro: S.cut.respiro, pontas: S.cut.pontas });
      c.keeps = k.keeps; c.descartado = k.descartado;
      c.words.forEach((w, j) => allWords.push({ w: w.w, s: +(w.s + gOff).toFixed(3), e: +(w.e + gOff).toFixed(3), hl: false, brk: j === c.words.length - 1, est: false }));
      gOff += c.dur;
    }
    const F = TL.frameFor(S.clips[0].w, S.clips[0].h);
    S.fmt = S.fmt || F.fmt;
    S.caps = allWords.length ? segmentWords(allWords) : [];
    if (hlOn()) autoHl(false);
    S.ready = true;
    await keepAwake(false);
    if (S.caps.length) { openReview(); } else { if (!noCaps) toast("Nenhuma fala encontrada: dá para editar sem legenda."); openEditor(); }
  } catch (err) {
    console.error(err);
    await keepAwake(false);
    show("home");
    toast("Erro: " + (err.message || err), 6000);
  }
}

/* ---------- legendas: quebra e destaque ---------- */
function preset() { return P.BUILTIN.find(p => p.id === S.presetId) || P.BUILTIN[0]; }
function layoutFor() {
  const L = P.merge(P.defaultLayout(), preset().layout || {});
  const wp = S.wpc;
  if (!wp || wp === "estilo") return L;
  if (wp === "frase") { L.mode = "sentence"; L.maxLines = 3; L.maxChars = Math.max(L.maxChars || 26, 24); return L; }
  const n = Math.max(1, Math.min(8, parseInt(wp, 10) || 3));
  L.mode = n; L.maxLines = n <= 3 ? Math.max(1, Math.min(L.maxLines || 2, 2)) : 2;
  if (n === 1) L.minDur = Math.min(L.minDur || 0.6, 0.25);
  return L;
}
function segmentWords(words) {
  const L = layoutFor();
  // segment() mexe nos tempos das legendas, nao nas palavras
  return SEG.segment(words.map(w => Object.assign({}, w)), L).map(c => ({ start: c.start, end: c.end, words: c.words }));
}
function resegment() { if (S.caps.length) S.caps = segmentWords(SEG.flatten(S.caps)); }
/** destaque ligado? (o do estilo, ate a pessoa mudar) */
function hlOn() { return S.hlOn == null ? preset().style && preset().style.highlight && preset().style.highlight.mode && preset().style.highlight.mode !== "none" : S.hlOn; }
/** marca a palavra-chave de cada legenda (so onde nao ha nenhuma marcada, a menos que force) */
function autoHl(force) {
  S.caps.forEach(c => {
    if (!force && c.words.some(w => w.hl)) return;
    if (force) c.words.forEach(w => { w.hl = false; });
    const i = SEG.autoHighlight(c.words);
    if (i >= 0) c.words[i].hl = true;
  });
}

/* ---------- estilo final ---------- */
function finalStyle() {
  let st = P.merge(P.styleOf(preset()), S.ov);
  st = P.merge(st, { font: { size: Math.round(st.font.size * S.size / 100) } });
  // as palavras-chave sao as marcadas na revisao (o automatico ja marcou ao transcrever)
  st.highlight.mode = hlOn() ? "manual" : "none";
  st.sfx = { on: false };
  return st;
}
function fmtNow() { return TL.fmtOf(S.fmt || "9:16"); }
function posNow() {
  const F = fmtNow();
  const p = S.posBy[F.fmt] || { x: 50, y: F.y };
  return { anchor: "custom", x: p.x, y: p.y, safe: 4, keepSafe: true };
}

/** refaz tudo o que a previa e a exportacao usam */
function rebuild() {
  const F = fmtNow();
  const tl = TL.build(S);
  const style = finalStyle();
  const caps = TL.finalCaptions(S, tl, style, layoutFor());
  R = { tl, caps, style, pos: posNow(), comp: { w: F.W, h: F.H }, fit: S.fit, key: ++keyN };
  R.events = TL.sfxEvents(S, tl, caps);
  if (player.t > tl.dur) player.t = 0;
  $("scrub").max = Math.max(1, Math.round(tl.dur * 100));
  player.draw();
}
let rbT = 0;
function changed(now) {
  clearTimeout(rbT);
  if (now) rebuild(); else rbT = setTimeout(rebuild, 60);
  savePrefs();
}

/* ---------- 3. revisao ---------- */
const revImg = new Image();
let revRaf = 0;
function openReview() {
  show("review");
  S.sel = Math.min(S.sel || 0, Math.max(0, S.caps.length - 1));
  renderReview();
  startRevPreview();
}
function capText(c) { return c.words.map(w => w.w).join(" "); }
function renderReview() {
  $("revList").innerHTML = S.caps.map((c, i) =>
    '<div class="cap-row' + (i === S.sel ? " sel" : "") + '" data-i="' + i + '">' +
    '<div class="tm"><span>' + (i + 1) + " · " + fmtT1(c.start) + " → " + fmtT1(c.end) + "</span></div>" +
    '<input class="tx" type="text" value="' + esc(capText(c)) + '" data-i="' + i + '">' +
    '<div class="ws">' + c.words.map((w, k) => '<span data-k="' + k + '" class="' + (w.hl ? "hl" : "") + '">' + esc(w.w) + "</span>").join("") + "</div>" +
    '<div class="ra"><button data-a="join">Juntar com a próxima</button><button data-a="split">Dividir</button><button data-a="del">Apagar</button></div>' +
    "</div>").join("") || '<p class="muted pad">Sem legendas.</p>';
}
function selectCap(i) {
  S.sel = i;
  document.querySelectorAll(".cap-row").forEach(r => r.classList.toggle("sel", +r.dataset.i === i));
}
$("revList").addEventListener("click", e => {
  const row = e.target.closest(".cap-row"); if (!row) return;
  const i = +row.dataset.i;
  const c = S.caps[i];
  if (S.sel !== i) selectCap(i);
  const chip = e.target.closest(".ws span");
  if (chip) { const w = c.words[+chip.dataset.k]; w.hl = !w.hl; chip.classList.toggle("hl", w.hl); if (w.hl && !hlOn()) S.hlOn = true; return; }
  const b = e.target.closest(".ra button"); if (!b) return;
  if (b.dataset.a === "del") { S.caps.splice(i, 1); S.sel = Math.max(0, Math.min(i, S.caps.length - 1)); }
  if (b.dataset.a === "join" && S.caps[i + 1]) { const n = S.caps[i + 1]; c.words = c.words.concat(n.words); c.end = n.end; S.caps.splice(i + 1, 1); }
  if (b.dataset.a === "split" && c.words.length > 1) {
    const m = Math.ceil(c.words.length / 2);
    const a = c.words.slice(0, m), z = c.words.slice(m);
    S.caps.splice(i, 1, { start: c.start, end: a[a.length - 1].e, words: a }, { start: z[0].s, end: c.end, words: z });
  }
  renderReview();
});
$("revList").addEventListener("focusin", e => { const r = e.target.closest(".cap-row"); if (r) selectCap(+r.dataset.i); });
$("revList").addEventListener("change", e => {
  if (!e.target.classList.contains("tx")) return;
  const i = +e.target.dataset.i, c = S.caps[i];
  const old = c.words;
  const nw = SEG.retext(c, e.target.value.replace(/\*/g, ""));
  if (!nw.length) { S.caps.splice(i, 1); renderReview(); return; }
  if (nw.length === old.length) nw.forEach((w, k) => { w.hl = old[k].hl; });
  c.words = nw;
  const row = e.target.closest(".cap-row");
  row.querySelector(".ws").innerHTML = c.words.map((w, k) => '<span data-k="' + k + '" class="' + (w.hl ? "hl" : "") + '">' + esc(w.w) + "</span>").join("");
});
$("revList").addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.classList.contains("tx")) {
    e.target.blur();
    const nx = document.querySelector('.cap-row[data-i="' + (+e.target.dataset.i + 1) + '"] input');
    if (nx) nx.focus();
  }
});
$("revReplace").addEventListener("click", () => {
  sheet('<h3>Trocar palavra em todas as legendas</h3><div class="field"><span>Procurar</span><input type="text" id="rpA"></div>' +
    '<div class="field"><span>Trocar por</span><input type="text" id="rpB"></div><div class="btns"><button class="ghost" id="rpX">Fechar</button><button class="primary" id="rpOk">Trocar</button></div>',
  (el, close) => {
    el.querySelector("#rpX").onclick = close;
    el.querySelector("#rpOk").onclick = () => {
      const a = el.querySelector("#rpA").value.trim(), b = el.querySelector("#rpB").value.trim();
      if (!a) return;
      const fold = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
      let n = 0;
      S.caps.forEach(c => c.words.forEach(w => {
        if (fold(w.w) === fold(a)) { const tail = (w.w.match(/[.,!?;:…]+$/) || [""])[0]; w.w = b + tail; n++; }
      }));
      close(); renderReview(); toast(n + (n === 1 ? " troca" : " trocas"));
    };
  });
});
$("revBack").addEventListener("click", () => { cancelAnimationFrame(revRaf); if (S.fromEditor) openEditor(); else show("home"); });
$("revDone").addEventListener("click", () => { cancelAnimationFrame(revRaf); openEditor(); });

/** previa da legenda escolhida sobre a miniatura do clipe */
function startRevPreview() {
  const cv = $("revCanvas");
  const F = fmtNow();
  const k = 480 / F.H;
  cv.width = Math.round(F.W * k); cv.height = Math.round(F.H * k);
  const ctx = cv.getContext("2d");
  let t0 = performance.now(), last = -1, src = null;
  const loop = now => {
    if (!$("review").classList.contains("on")) return;
    const c = S.caps[S.sel];
    if (c) {
      const ci = clipAtG(c.start);
      const th = S.clips[ci] && S.clips[ci].thumb;
      if (th && revImg.src !== th) revImg.src = th;
      if (S.sel !== last) { last = S.sel; t0 = now; }
      const style = finalStyle();
      const src2 = { start: 0, end: Math.max(0.8, c.end - c.start), words: c.words.map(w => ({ w: w.w, s: w.s - c.start, e: w.e - c.start, hl: w.hl })) };
      const L = layoutFor();
      src = P.buildPayload([src2], style, L, {}, {}).captions[0];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cv.width, cv.height);
      if (revImg.complete && revImg.naturalWidth) {
        const s = Math.max(cv.width / revImg.naturalWidth, cv.height / revImg.naturalHeight);
        ctx.globalAlpha = 0.85;
        ctx.drawImage(revImg, (cv.width - revImg.naturalWidth * s) / 2, (cv.height - revImg.naturalHeight * s) / 2, revImg.naturalWidth * s, revImg.naturalHeight * s);
        ctx.globalAlpha = 1;
      }
      if (src) {
        const d = src.e - src.s + 0.6;
        const t = ((now - t0) / 1000) % d;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        if (t < src.e - src.s) drawCaption(ctx, style, posNow(), { w: F.W, h: F.H }, src, t, { scale: k });
      }
    }
    revRaf = requestAnimationFrame(loop);
  };
  cancelAnimationFrame(revRaf);
  revRaf = requestAnimationFrame(loop);
}
function clipAtG(g) {
  let off = 0;
  for (let i = 0; i < S.clips.length; i++) { if (g < off + S.clips[i].dur) return i; off += S.clips[i].dur; }
  return S.clips.length - 1;
}

/* ---------- 4. editor ---------- */
function openEditor() {
  S.fromEditor = true;
  show("editor");
  player.setClips(S.clips);
  rebuild();
  renderTab();
  requestAnimationFrame(layoutStage);
}
function layoutStage() {
  const w = $("stageWrap");
  if (!R) return;
  player.resize(R.comp, w.clientWidth - 12, w.clientHeight - 12);
}
window.addEventListener("resize", () => { if ($("editor").classList.contains("on")) layoutStage(); });
$("edBack").addEventListener("click", () => {
  sheet('<h3>Voltar ao início?</h3><p class="muted">A edição deste vídeo será descartada.</p><div class="btns"><button class="ghost" id="bk0">Ficar</button><button class="primary" id="bk1">Voltar</button></div>',
    (el, close) => {
      el.querySelector("#bk0").onclick = close;
      el.querySelector("#bk1").onclick = () => { close(); resetProject(); show("home"); };
    });
});
function resetProject() {
  player.pause();
  S.clips.forEach(c => URL.revokeObjectURL(c.url));
  S.clips = []; S.caps = []; S.removed = {}; S.segZoom = {}; S.segTrans = {}; S.fmt = null; S.ready = false; S.fromEditor = false;
  renderClips();
}
$("playBtn").addEventListener("click", () => player.toggle());
player.onTime = t => {
  $("timeTxt").textContent = fmtT(t) + " / " + fmtT(R ? R.tl.dur : 0);
  if (!scrubbing) $("scrub").value = Math.round(t * 100);
  $("playBtn").textContent = player.playing ? "❚❚" : "▶";
};
let scrubbing = false;
$("scrub").addEventListener("input", () => { scrubbing = true; player.pause(); player.seek(+$("scrub").value / 100); });
$("scrub").addEventListener("change", () => { scrubbing = false; });

// arrastar a legenda na previa (ima no centro)
(function () {
  const st = $("stage");
  let drag = false;
  function at(e) {
    const r = $("pv").getBoundingClientRect();
    let x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100;
    if (Math.abs(x - 50) < 4) { x = 50; st.classList.add("snap"); } else st.classList.remove("snap");
    setPos(x, y, true);
  }
  st.addEventListener("pointerdown", e => { if (!S.caps.length) return; drag = true; st.setPointerCapture(e.pointerId); at(e); });
  st.addEventListener("pointermove", e => { if (drag) at(e); });
  const end = () => { if (!drag) return; drag = false; st.classList.remove("snap"); savePrefs(); if (S.tab === "posicao") renderTab(); };
  st.addEventListener("pointerup", end); st.addEventListener("pointercancel", end);
})();
function setPos(x, y, live) {
  const F = fmtNow();
  S.posBy[F.fmt] = { x: Math.round(Math.max(10, Math.min(90, x))), y: Math.round(Math.max(6, Math.min(94, y))) };
  if (R) { R.pos = posNow(); player.draw(); }
  if (!live) { savePrefs(); renderTab(); }
}

/* ---------- abas ---------- */
$("tabs").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  S.tab = b.dataset.tab;
  [].forEach.call($("tabs").children, x => x.classList.toggle("on", x === b));
  renderTab();
});
function chips(name, opts, cur) {
  return '<div class="chips" data-chips="' + name + '">' + opts.map(o => '<button class="chip' + (String(o[0]) === String(cur) ? " on" : "") + '" data-v="' + o[0] + '">' + o[1] + "</button>").join("") + "</div>";
}
function slider(name, label, min, max, step, v, unit) {
  return '<div class="field"><span>' + label + '</span><input type="range" data-r="' + name + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v + '"><span class="val" data-rv="' + name + '">' + v + (unit || "") + "</span></div>";
}
const TABS = {};
function renderTab() {
  const el = $("panel");
  const keep = el.scrollTop;
  el.innerHTML = (TABS[S.tab] || TABS.estilo).html();
  if (TABS[S.tab].bind) TABS[S.tab].bind(el);
  el.scrollTop = keep;
}
// eventos genericos: chips e sliders chamam a funcao da aba
$("panel").addEventListener("click", e => {
  const b = e.target.closest("[data-chips] button");
  if (b && TABS[S.tab].chip) TABS[S.tab].chip(b.closest("[data-chips]").dataset.chips, b.dataset.v, b);
});
$("panel").addEventListener("input", e => {
  const r = e.target.dataset && e.target.dataset.r;
  if (!r) return;
  const v = +e.target.value;
  const lbl = $("panel").querySelector('[data-rv="' + r + '"]');
  if (lbl) lbl.textContent = (TABS[S.tab].fmt ? TABS[S.tab].fmt(r, v) : v);
  if (TABS[S.tab].range) TABS[S.tab].range(r, v);
});

/* Estilo */
let thumbObs = null;
TABS.estilo = {
  html() {
    const cats = P.CATS;
    const cur = preset();
    S.cat = S.cat || cur.cat || cats[0];
    return "<h4>Palavras por legenda</h4>" + chips("wpc", [["estilo", "Do estilo"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["frase", "Frase"]], S.wpc) +
      '<h4>Estilos</h4><div class="hscroll" data-chips="cat">' + cats.map(c => '<button class="chip' + (c === S.cat ? " on" : "") + '" data-v="' + esc(c) + '">' + esc(c) + "</button>").join("") + "</div>" +
      '<div class="presets" style="margin-top:8px">' + P.BUILTIN.filter(p => p.cat === S.cat).map(p =>
        '<button class="preset' + (p.id === S.presetId ? " on" : "") + '" data-p="' + p.id + '"><canvas width="324" height="168"></canvas><span>' + esc(p.name) + "</span></button>").join("") + "</div>";
  },
  bind(el) {
    if (thumbObs) thumbObs.disconnect();
    thumbObs = new IntersectionObserver(ents => ents.forEach(en => {
      if (!en.isIntersecting) return;
      thumbObs.unobserve(en.target);
      drawThumb(en.target.querySelector("canvas"), P.BUILTIN.find(p => p.id === en.target.dataset.p));
    }), { root: el });
    el.querySelectorAll(".preset").forEach(b => {
      thumbObs.observe(b);
      b.addEventListener("click", () => {
        S.presetId = b.dataset.p; S.ov = {}; S.hlOn = null;
        el.querySelectorAll(".preset").forEach(x => x.classList.toggle("on", x === b));
        if (S.wpc === "estilo") resegment();
        if (hlOn()) autoHl(false);
        changed(true);
        if (!player.playing) previewCurrent();
      });
    });
  },
  chip(name, v) {
    if (name === "wpc") { S.wpc = v; resegment(); changed(true); renderTab(); previewCurrent(); }
    if (name === "cat") { S.cat = v; renderTab(); $("panel").scrollTop = 0; }
  }
};
/** depois de trocar o estilo: mostra uma legenda tocando */
function previewCurrent() {
  if (!R || !R.caps.length || player.playing) return;
  const c = TL.capAt(R.caps, player.t) || R.caps.find(x => x.s >= player.t) || R.caps[0];
  player.seek(c.s + 0.01);
  player.play();
}
function drawThumb(cv, p) {
  if (!cv || !p) return;
  const ctx = cv.getContext("2d");
  // miniatura: palco menor que o video, para a letra aparecer grande
  const TW = 460, TH = 239;
  const k = cv.width / TW;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  let st = P.merge(P.styleOf(p), { font: { maxWidthPct: 92 } });
  if (st.highlight.mode !== "none") st.highlight.mode = "manual";
  const text = p.thumb || "edite seus vídeos";
  const toks = SEG.applyCase(text, st.font.caseMode).split(" ");
  const words = toks.map((w, i) => ({ w, s: i * 0.3, e: i * 0.3 + 0.3, hl: i === 1 }));
  const cap = { s: 0, e: 2, words, lines: [toks.join(" ")] };
  if (st.highlight.stack && st.highlight.mode !== "none") {
    const sk = SEG.stackLines(toks, toks.map((x, i) => i === 1), 14);
    if (sk) { cap.lines = sk.lines; cap.stk = sk.big; }
  }
  ctx.setTransform(k, 0, 0, k, 0, 0);
  try { drawCaption(ctx, st, { anchor: "center", safe: 4, keepSafe: true }, { w: TW, h: TH }, cap, st.karaoke.on ? 0.65 : null, { scale: k }); } catch (e) { console.warn(p.id, e); }
}

/* Texto */
TABS.texto = {
  html() {
    const st = finalStyle();
    const fams = familyList();
    const fam = (S.ov.font && S.ov.font.family) || st.font.family;
    const wts = weightsOf(fam);
    const w0 = weightOf(st.font.style);
    const hs = (S.ov.highlight && S.ov.highlight.scale) || (P.styleOf(preset()).highlight.scale || 100);
    return '<div class="field"><span>Fonte</span><select data-s="family">' + fams.map(f => '<option' + (f === fam ? " selected" : "") + ">" + esc(f) + "</option>").join("") +
      (fams.indexOf(fam) < 0 ? '<option selected>' + esc(fam) + "</option>" : "") + "</select></div>" +
      (wts.length > 1 ? '<div class="field"><span>Espessura</span><select data-s="weight">' + wts.map(w => '<option value="' + w + '"' + (w === w0 ? " selected" : "") + ">" + WEIGHT_NAMES[w] + "</option>").join("") + "</select></div>" : "") +
      slider("size", "Tamanho", 50, 180, 1, S.size, "%") +
      slider("hls", "Destaque", 60, 320, 5, hs, "%") +
      slider("track", "Espaçamento", -80, 200, 5, st.font.tracking || 0, "") +
      "<h4>Letras</h4>" + chips("case", [["none", "Como falado"], ["lower", "minúsculas"], ["upper", "MAIÚSCULAS"], ["sentence", "Frase"]], st.font.caseMode || "none") +
      "<h4>Alinhamento</h4>" + chips("align", [["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]], st.font.align || "center") +
      '<p class="note">As fontes vêm junto com o app e funcionam sem internet.</p>';
  },
  fmt(r, v) { return r === "track" ? String(v) : v + "%"; },
  bind(el) {
    el.querySelectorAll("select[data-s]").forEach(s => s.addEventListener("change", () => {
      if (s.dataset.s === "family") {
        const fam = s.value;
        const wts = weightsOf(fam);
        const want = weightOf(finalStyle().font.style);
        const w = wts.reduce((a, b) => Math.abs(b - want) < Math.abs(a - want) ? b : a, wts[0] || 400);
        setOv("font", { family: fam, style: WEIGHT_NAMES[w] || "Regular", ps: "", fallbacks: [] });
      } else setOv("font", { style: WEIGHT_NAMES[+s.value] });
      changed(); renderTab();
    }));
  },
  range(r, v) {
    if (r === "size") S.size = v;
    if (r === "hls") setOv("highlight", { scale: v });
    if (r === "track") setOv("font", { tracking: v });
    changed();
  },
  chip(name, v) {
    if (name === "case") setOv("font", { caseMode: v });
    if (name === "align") setOv("font", { align: v });
    changed(); renderTab();
  }
};
function setOv(key, obj) {
  S.ov[key] = Object.assign({}, S.ov[key] || {}, obj);
  // o destaque e a palavra dita do karaoke andam juntos
  if (key === "highlight") {
    const k = {};
    ["type", "color", "color2", "angle"].forEach(f => { if (f in obj) k[f] = obj[f]; });
    if (Object.keys(k).length) S.ov.karaoke = Object.assign({}, S.ov.karaoke || {}, k);
  }
}

/* Cores */
const QUICK = ["#FFFFFF", "#B3B3B3", "#808080", "#3F3F3F", "#000000", "#F4C70F", "#FFD60A", "#FF8000", "#FF0855", "#CB00FF", "#0090FF", "#00B209",
  "#FF87CE", "#FF3EAA", "#EC1D1D", "#FF6700", "#FFDC00", "#F0FF00", "#99DF00", "#00FF18", "#00FFFF", "#00CFC6", "#64BCFF", "#0045C8",
  "#A287FF", "#7C5CFF", "#8100FF", "#E3DACE", "#C5AB93", "#78561A"];
const GRADS = [["Ouro", "#FFF07A", "#FFC400"], ["Pôr do sol", "#FFB000", "#FF2D7A"], ["Fogo", "#FFD60A", "#FF3D00"], ["Neon", "#00F0FF", "#7C5CFF"],
  ["Rosa e azul", "#FF3DB8", "#2F6BFF"], ["Verde", "#B6FFD9", "#16C060"], ["Lima", "#F4FF9A", "#7BD300"], ["Prata", "#FFFFFF", "#9AA3B5"], ["Roxo", "#E0D4FF", "#7C5CFF"]];
const CTABS = {
  fill: { key: "fill", grad: true, label: "Texto" },
  hl: { key: "highlight", grad: true, label: "Destaque", on: "Destacar palavras-chave (e a palavra dita no karaokê)" },
  stroke: { key: "stroke", label: "Contorno", on: "Contorno nas letras", amt: ["width", "Espessura", 1, 20, " px"] },
  shadow: { key: "shadow", label: "Sombra", on: "Sombra atrás das letras", amt: ["opacity", "Força", 10, 100, "%"] },
  box: { key: "box", grad: true, label: "Caixa", on: "Caixa atrás do texto", amt: ["opacity", "Opacidade", 10, 100, "%"] }
};
TABS.cores = {
  html() {
    const T = CTABS[S.ctab];
    const st = finalStyle();
    const o = st[T.key];
    const isOn = S.ctab === "hl" ? hlOn() : (T.on ? !!o.on : true);
    const isGrad = o.type === "linear";
    let h = chips("ctab", Object.keys(CTABS).map(k => [k, CTABS[k].label]), S.ctab);
    if (T.on) h += '<label class="row chk"><input type="checkbox" data-on ' + (isOn ? "checked" : "") + "> " + T.on + "</label>";
    if (S.ctab === "box") h += chips("boxmode", [["caption", "Atrás da legenda"], ["word", "Segue a palavra dita"]], o.mode || "caption");
    h += "<h4>Cor</h4>" + '<div class="swatches">' + QUICK.map(c => '<button class="sw' + (!isGrad && String(o.color).toUpperCase() === c ? " on" : "") + '" data-c="' + c + '" style="background:' + c + '"></button>').join("") +
      '<input type="color" data-pick value="' + (String(o.color || "#ffffff").length === 7 ? o.color : "#ffffff") + '"></div>';
    if (T.grad) h += "<h4>Degradê</h4>" + '<div class="swatches">' + GRADS.map(g => '<button class="sw' + (isGrad && String(o.color).toUpperCase() === g[1] && String(o.color2).toUpperCase() === g[2] ? " on" : "") + '" data-g1="' + g[1] + '" data-g2="' + g[2] + '" title="' + g[0] + '" style="background:linear-gradient(180deg,' + g[1] + "," + g[2] + ')"></button>').join("") + "</div>";
    if (T.amt) h += slider("amt", T.amt[1], T.amt[2], T.amt[3], 1, o[T.amt[0]] == null ? T.amt[2] : o[T.amt[0]], T.amt[4]);
    if (S.ctab === "hl") h += '<button class="chip" data-auto style="margin-top:10px">Escolher palavras-chave automático</button>';
    return h;
  },
  fmt(r, v) { const T = CTABS[S.ctab]; return v + (T.amt ? T.amt[4] : ""); },
  bind(el) {
    const T = CTABS[S.ctab];
    const on = el.querySelector("[data-on]");
    if (on) on.addEventListener("change", () => {
      if (S.ctab === "hl") { S.hlOn = on.checked; if (on.checked && !S.caps.some(c => c.words.some(w => w.hl))) autoHl(false); }
      else setOv(T.key, { on: on.checked });
      changed(); renderTab();
    });
    el.querySelectorAll(".sw").forEach(b => b.addEventListener("click", () => {
      if (b.dataset.c) setOv(T.key, { color: b.dataset.c, type: "solid" });
      else setOv(T.key, { color: b.dataset.g1, color2: b.dataset.g2, type: "linear", angle: 90 });
      turnOn(); changed(); renderTab();
    }));
    const pk = el.querySelector("[data-pick]");
    if (pk) pk.addEventListener("input", () => { setOv(T.key, { color: pk.value.toUpperCase(), type: "solid" }); turnOn(); changed(); });
    const au = el.querySelector("[data-auto]");
    if (au) au.addEventListener("click", () => { S.hlOn = true; autoHl(true); changed(true); toast("Palavras-chave marcadas"); renderTab(); });
  },
  range(r, v) { const T = CTABS[S.ctab]; const o = {}; o[T.amt[0]] = v; setOv(T.key, o); turnOn(); changed(); },
  chip(name, v) {
    if (name === "ctab") { S.ctab = v; renderTab(); }
    if (name === "boxmode") { setOv("box", { mode: v, on: true }); changed(); renderTab(); }
  }
};
function turnOn() {
  if (S.ctab === "hl") { if (!hlOn()) { S.hlOn = true; autoHl(false); } return; }
  const T = CTABS[S.ctab];
  if (T.on) setOv(T.key, { on: true });
}

/* Posicao */
TABS.posicao = {
  html() {
    const F = fmtNow(), p = posNow();
    return "<h4>Formato do vídeo</h4>" + chips("fmt", TL.FORMATS.map(f => [f.fmt, f.nome]), F.fmt) +
      "<h4>Enquadrar</h4>" + chips("fit", [["cover", "Preencher (corta as bordas)"], ["contain", "Caber inteiro (fundo desfocado)"]], S.fit) +
      "<h4>Legenda</h4>" + chips("posy", [[14, "Topo"], [30, "Cima"], [50, "Meio"], [62, "Abaixo do meio"], [F.y, "Baixo"], [88, "Rodapé"]], p.y) +
      slider("y", "Altura", 6, 94, 1, p.y, "%") + slider("x", "Lado", 10, 90, 1, p.x, "%") +
      '<p class="note">Arraste a legenda na prévia para posicionar. Cada formato guarda a sua posição.</p>';
  },
  range(r, v) { const p = posNow(); if (r === "y") setPos(p.x, v, true); else setPos(v, p.y, true); savePrefs(); },
  chip(name, v) {
    if (name === "fmt") { S.fmt = v; rebuild(); layoutStage(); }
    if (name === "fit") { S.fit = v; changed(true); }
    if (name === "posy") { const p = posNow(); setPos(p.x, +v); }
    renderTab();
  }
};

/* Cortes */
TABS.cortes = {
  html() {
    let h = '<label class="row chk"><input type="checkbox" data-k="on" ' + (S.cut.on ? "checked" : "") + "> Cortar os silêncios</label>";
    if (S.cut.on) {
      h += slider("respiro", "Respiro", 0, 20, 1, S.cut.respiro, " q") +
        '<label class="row chk"><input type="checkbox" data-k="pontas" ' + (S.cut.pontas ? "checked" : "") + "> Limpar começo e fim (toques, “pode falar”, voz de quem filma)</label>";
      const desc = [];
      S.clips.forEach((c, i) => (c.descartado || []).forEach(d => desc.push((S.clips.length > 1 ? "Vídeo " + (i + 1) + ", " : "") + d.onde + ": " + d.motivo + " (" + fmtT1(d.s) + ")")));
      if (desc.length) h += '<p class="note">Tirado das pontas: ' + esc(desc.join("; ")) + "</p>";
    }
    h += "<h4>Aparar cada vídeo</h4>";
    S.clips.forEach((c, i) => {
      const a = c.trimIn || 0, b = c.trimOut == null ? c.dur : c.trimOut;
      h += '<div class="note">' + (i + 1) + ". " + esc(c.name) + " (" + fmtT1(c.dur) + ")</div>" +
        slider("ti" + i, "Começa em", 0, Math.floor(c.dur * 10), 1, Math.round(a * 10), "") + slider("to" + i, "Termina em", 0, Math.floor(c.dur * 10), 1, Math.round(b * 10), "");
    });
    h += "<h4>Trechos (toque para ver; dá para tirar um trecho)</h4>" + segList((g, key) =>
      '<button data-rm="' + key + '">' + (S.removed[key] ? "Voltar" : "Tirar") + "</button>", true);
    return h;
  },
  fmt(r, v) { return r === "respiro" ? v + " q" : fmtT1(v / 10); },
  bind(el) {
    el.querySelectorAll("input[data-k]").forEach(c => c.addEventListener("change", () => {
      S.cut[c.dataset.k] = c.checked;
      if (c.dataset.k === "pontas") recut();
      changed(true); renderTab();
    }));
    bindSegList(el);
    el.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      const k = b.dataset.rm;
      if (S.removed[k]) delete S.removed[k]; else S.removed[k] = true;
      changed(true); renderTab();
    }));
  },
  range(r, v) {
    if (r === "respiro") { S.cut.respiro = v; recutLater(); return; }
    const i = +r.slice(2), c = S.clips[i];
    if (r.indexOf("ti") === 0) c.trimIn = Math.min(v / 10, (c.trimOut == null ? c.dur : c.trimOut) - 0.3);
    else c.trimOut = Math.max(v / 10, (c.trimIn || 0) + 0.3);
    changed();
  }
};
let recutT = 0;
function recutLater() { clearTimeout(recutT); recutT = setTimeout(() => { recut(); changed(true); }, 200); }
function recut() {
  S.clips.forEach(c => {
    if (!c.db) return;
    const k = keeps(c.db, c.dur, c.words || [], { respiro: S.cut.respiro, pontas: S.cut.pontas });
    c.keeps = k.keeps; c.descartado = k.descartado;
  });
  S.removed = {}; S.segZoom = {}; S.segTrans = {};
}
/** lista dos trechos da linha do tempo, inclusive os tirados */
function segList(extra, includeRemoved) {
  const tl = R ? R.tl : TL.build(S);
  const rows = [];
  let n = 0;
  S.clips.forEach((c, ci) => {
    const tIn = c.trimIn || 0, tOut = c.trimOut == null ? c.dur : c.trimOut;
    const ks = (S.cut.on && c.keeps ? c.keeps : [[0, c.dur]]).map(k => [Math.max(k[0], tIn), Math.min(k[1], tOut)]).filter(k => k[1] - k[0] > 0.05);
    ks.forEach((k, ki) => {
      const key = c.id + ":" + ki;
      const g = tl.segs.find(x => x.key === key);
      if (!g && !includeRemoved) return;
      n++;
      const txt = wordsIn(ci, k[0], k[1]);
      rows.push('<div class="segrow' + (g ? "" : " off") + '" data-seek="' + (g ? g.o : "") + '"><div class="t">' + n + ". " + fmtT1(k[1] - k[0]) + "<small>" + esc(txt || "(sem fala)") + "</small></div>" + extra(g, key) + "</div>");
    });
  });
  return '<div class="seglist">' + rows.join("") + "</div>";
}
function wordsIn(ci, a, b) {
  let off = 0;
  for (let i = 0; i < ci; i++) off += S.clips[i].dur;
  const ws = [];
  S.caps.forEach(c => c.words.forEach(w => { const m = (w.s + w.e) / 2 - off; if (m >= a && m <= b) ws.push(w.w); }));
  return ws.join(" ");
}
function bindSegList(el) {
  el.querySelectorAll(".segrow").forEach(r => r.addEventListener("click", e => {
    if (e.target.closest("button,select")) return;
    if (r.dataset.seek !== "") { player.pause(); player.seek(+r.dataset.seek + 0.01); }
  }));
}

/* Zoom */
const ZOOMS = [["", "Auto"], ["1", "100%"], ["1.1", "110%"], ["1.2", "120%"], ["1.3", "130%"], ["1.45", "145%"]];
TABS.zoom = {
  html() {
    return chips("zmode", [["off", "Sem zoom"], ["alterna", "Alternar nos cortes"], ["sempre", "Sempre aproximado"]], S.zoom.mode) +
      (S.zoom.mode !== "off" ? slider("amt", "Aproximar", 4, 45, 1, S.zoom.amount, "%") : "") +
      '<label class="row chk"><input type="checkbox" data-slow ' + (S.zoom.slow ? "checked" : "") + "> Aproximação lenta durante cada trecho</label>" +
      "<h4>Zoom de cada trecho</h4>" + segList((g, key) => g ? '<select data-z="' + key + '">' + ZOOMS.map(z => '<option value="' + z[0] + '"' + (String(S.segZoom[key] == null ? "" : S.segZoom[key]) === z[0] ? " selected" : "") + ">" + z[1] + "</option>").join("") + "</select>" : "");
  },
  fmt(r, v) { return v + "%"; },
  bind(el) {
    el.querySelector("[data-slow]").addEventListener("change", e => { S.zoom.slow = e.target.checked; changed(true); });
    el.querySelectorAll("select[data-z]").forEach(s => s.addEventListener("change", () => {
      if (s.value === "") delete S.segZoom[s.dataset.z]; else S.segZoom[s.dataset.z] = +s.value;
      changed(true);
      const g = R.tl.segs.find(x => x.key === s.dataset.z);
      if (g) { player.pause(); player.seek(g.o + 0.01); }
    }));
    bindSegList(el);
  },
  range(r, v) { S.zoom.amount = v; changed(); },
  chip(name, v) { S.zoom.mode = v; changed(true); renderTab(); }
};

/* Transicoes */
TABS.trans = {
  html() {
    const opts = [["", "Nenhuma"], ["auto", "Aleatória"]].concat(TL.TRANSITIONS.map(t => [t.id, t.nome]));
    let h = "<h4>Onde</h4>" + chips("where", [["none", "Nenhuma"], ["clips", "Entre os vídeos"], ["all", "Em todos os cortes"]], S.trans.where);
    if (S.trans.where !== "none") h += "<h4>Tipo</h4>" + chips("type", [["auto", "Aleatória"]].concat(TL.TRANSITIONS.map(t => [t.id, t.nome])), S.trans.type) +
      slider("ms", "Duração", 160, 800, 20, S.trans.ms, " ms");
    const cuts = R ? R.tl.cuts : [];
    if (cuts.length) {
      h += "<h4>Cada corte</h4><div class='seglist'>" + cuts.map((c, i) => {
        const ov = S.segTrans[c.key];
        const cur = ov === undefined ? "default" : (ov || "");
        return '<div class="segrow" data-seek="' + Math.max(0, c.t - 0.6) + '"><div class="t">Corte ' + (i + 1) + " · " + fmtT1(c.t) + (c.between ? "<small>entre vídeos</small>" : "<small>silêncio cortado</small>") + "</div>" +
          '<select data-tc="' + c.key + '"><option value="default"' + (cur === "default" ? " selected" : "") + ">Padrão</option>" + opts.map(o => '<option value="' + o[0] + '"' + (cur === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select></div>";
      }).join("") + "</div>";
    } else h += '<p class="note">Sem cortes ainda: as transições aparecem entre vídeos e nos silêncios cortados.</p>';
    return h;
  },
  fmt(r, v) { return v + " ms"; },
  bind(el) {
    el.querySelectorAll("select[data-tc]").forEach(s => s.addEventListener("change", () => {
      if (s.value === "default") delete S.segTrans[s.dataset.tc]; else S.segTrans[s.dataset.tc] = s.value;
      changed(true);
      const c = R.tl.cuts.find(x => x.key === s.dataset.tc);
      if (c) { player.seek(Math.max(0, c.t - 0.6)); player.play(); }
    }));
    bindSegList(el);
  },
  range(r, v) { S.trans.ms = v; changed(); },
  chip(name, v) {
    S.trans[name] = v;
    changed(true); renderTab();
    if (name === "type" && R && R.tl.cuts.length) { const c = R.tl.cuts.find(x => x.type) || R.tl.cuts[0]; player.seek(Math.max(0, c.t - 0.6)); player.play(); }
  }
};

/* Sons */
TABS.sons = {
  html() {
    const sel = (k, label) => '<div class="field"><span>' + label + '</span><select data-sf="' + k + '">' + soundOptions(S.sfx[k].id) + "</select>" +
      '<button class="chip" data-try="' + k + '">▶</button></div>' + (S.sfx[k].id ? slider("v_" + k, "Volume", -30, 6, 1, S.sfx[k].vol, " dB") : "");
    return sel("cut", "Nos cortes") +
      '<label class="row chk"><input type="checkbox" data-only ' + (S.sfx.cut.onlyTrans ? "checked" : "") + "> Só nos cortes com transição</label>" +
      sel("hl", "Palavra destaque") + sel("word", "Toda palavra") +
      slider("voice", "Voz do vídeo", -20, 10, 1, S.voiceDb, " dB") +
      "<h4>Meus sons</h4>" +
      '<label class="chip" style="display:inline-block">＋ Adicionar som do celular<input type="file" accept="audio/*" multiple hidden data-add></label>' +
      '<div style="margin-top:6px">' + (mySounds.length ? mySounds.map(s => '<div class="sound"><span class="n">' + esc(s.name) + '</span><button data-play="' + s.id + '">▶</button><button data-del="' + s.id + '">✕</button></div>').join("") : '<p class="note">Escolha arquivos de som (MP3, WAV, M4A…) do seu celular. Eles ficam guardados no app para os próximos vídeos.</p>') + "</div>" +
      "<h4>Sons do app</h4>" + SFX.LIST.map(s => '<div class="sound"><span class="n">' + esc(s.name) + ' <span class="muted small">' + esc(s.desc) + '</span></span><button data-play="' + s.id + '">▶</button></div>').join("");
  },
  fmt(r, v) { return v + " dB"; },
  bind(el) {
    el.querySelectorAll("select[data-sf]").forEach(s => s.addEventListener("change", () => {
      S.sfx[s.dataset.sf].id = s.value; changed(true); renderTab();
      if (s.value) playSound(s.value, S.sfx[s.dataset.sf].vol);
    }));
    el.querySelectorAll("[data-try]").forEach(b => b.addEventListener("click", () => { const k = b.dataset.try; if (S.sfx[k].id) playSound(S.sfx[k].id, S.sfx[k].vol); }));
    el.querySelector("[data-only]").addEventListener("change", e => { S.sfx.cut.onlyTrans = e.target.checked; changed(true); });
    el.querySelectorAll("[data-play]").forEach(b => b.addEventListener("click", () => playSound(b.dataset.play, -6)));
    el.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
      await sons.del(b.dataset.del); sfxCache.delete(b.dataset.del);
      ["cut", "hl", "word"].forEach(k => { if (S.sfx[k].id === b.dataset.del) S.sfx[k].id = ""; });
      await refreshSounds(); changed(true); renderTab();
    }));
    el.querySelector("[data-add]").addEventListener("change", async e => {
      const files = Array.from(e.target.files || []);
      let ok = 0;
      for (const f of files) {
        try {
          await decodeSoundFile(f); // confere se o celular abre o arquivo
          const id = await sons.add(f.name.replace(/\.[^.]+$/, ""), f);
          ok++;
          if (!S.sfx.cut.id && ok === 1) S.sfx.cut.id = id;
        } catch (err) { toast("Não deu para abrir " + f.name, 3500); }
      }
      await refreshSounds();
      if (ok) toast(ok === 1 ? "Som adicionado" : ok + " sons adicionados");
      changed(true); renderTab();
    });
  },
  range(r, v) {
    if (r === "voice") S.voiceDb = v;
    else S.sfx[r.slice(2)].vol = v;
    changed();
  }
};

/* Legendas */
TABS.legendas = {
  html() {
    return '<button class="primary wide" data-rev>Revisar e corrigir as legendas</button>' +
      "<h4>Palavras por legenda</h4>" + chips("wpc", [["estilo", "Do estilo"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["frase", "Frase"]], S.wpc) +
      '<label class="row chk"><input type="checkbox" data-hl ' + (hlOn() ? "checked" : "") + "> Destacar palavras-chave</label>" +
      '<p class="note">' + S.caps.length + " legendas. As legendas são gravadas no vídeo ao exportar (não ficam editáveis depois).</p>";
  },
  bind(el) {
    el.querySelector("[data-rev]").addEventListener("click", openReview);
    el.querySelector("[data-hl]").addEventListener("change", e => { S.hlOn = e.target.checked; if (S.hlOn) autoHl(false); changed(true); });
  },
  chip(name, v) { if (name === "wpc") { S.wpc = v; resegment(); changed(true); renderTab(); } }
};

/* ---------- 5. exportar ---------- */
$("exportBtn").addEventListener("click", () => {
  player.pause();
  const F = fmtNow();
  sheet("<h3>Exportar vídeo</h3>" + chips("q", [["1080", "Alta (" + F.W + "×" + F.H + ")"], ["720", "Rápida (" + even(F.W * 2 / 3) + "×" + even(F.H * 2 / 3) + ")"]], S.quality) +
    '<p class="note">Duração: ' + fmtT(R.tl.dur) + ". Legendas, cortes, zoom, transições e sons vão gravados no vídeo. Mantenha o app aberto até terminar.</p>" +
    '<div class="btns"><button class="ghost" id="exX">Cancelar</button><button class="primary" id="exOk">Exportar</button></div>',
  (el, close) => {
    el.querySelectorAll("[data-chips] button").forEach(b => b.addEventListener("click", () => {
      S.quality = b.dataset.v; el.querySelectorAll("[data-chips] button").forEach(x => x.classList.toggle("on", x === b)); savePrefs();
    }));
    el.querySelector("#exX").onclick = close;
    el.querySelector("#exOk").onclick = () => { close(); doExport(); };
  });
});
const even = x => Math.max(2, Math.round(x / 2) * 2);
async function doExport() {
  rebuild();
  const F = fmtNow();
  const q = S.quality === "720" ? 2 / 3 : 1;
  const W = even(F.W * q), H = even(F.H * q);
  cancelled = false;
  show("work");
  work("Exportando", 0, "Misturando o áudio…");
  await keepAwake(true);
  const name = "MotionCaptions_" + new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "") + ".mp4";
  let writer = null;
  const t0 = performance.now();
  try {
    const audio = await mixAudio(S, R.tl, R.events, getSfx);
    if (cancelled) throw new Error("cancelado");
    const free = await freeSpace();
    const need = (W * H >= 1.9e6 ? 10e6 : 5e6) / 8 * R.tl.dur * 1.3 + 30e6;
    if (free != null && free < need) throw new Error("pouco espaço livre no celular (precisa de uns " + Math.ceil(need / 1e6) + " MB)");
    writer = isNative ? await openGalleryWriter(name) : await openWebWriter(name);
    const res = await exportVideo(S, R, audio, { width: W, height: H, fps: 30, bitrate: W * H >= 1.9e6 ? 10e6 : 5e6 }, {
      writable: writer ? writer.writable : null,
      isCancelled: () => cancelled,
      onProgress: p => {
        const el = (performance.now() - t0) / 1000;
        const eta = p > 0.03 ? Math.round(el / p * (1 - p)) : null;
        work("Exportando", p, Math.round(p * 100) + "%" + (eta != null ? " · falta ~" + fmtT(eta) : ""));
      }
    });
    let where = "", file = null;
    if (writer) {
      const r = await writer.finish();
      if (r && r.file) file = new File([r.file], name, { type: "video/mp4" });
      else where = r && r.path ? r.path : "Galeria › Filmes › Motion Captions";
    } else file = new File([res.blob], name, { type: "video/mp4" });
    await keepAwake(false);
    showDone(file, where, W, H);
  } catch (err) {
    console.error(err);
    if (writer) await writer.abort();
    await keepAwake(false);
    openEditor();
    if (String(err.message || err) !== "cancelado") toast("Erro ao exportar: " + (err.message || err), 6000);
  }
}
/** tela final: no app vai direto para a galeria; no site, a pessoa toca em Salvar */
let doneFile = null, doneUrl = null;
function showDone(file, where, W, H) {
  doneFile = file;
  if (doneUrl) URL.revokeObjectURL(doneUrl);
  doneUrl = file ? URL.createObjectURL(file) : null;
  $("doneVideo").classList.toggle("hidden", !file);
  if (file) $("doneVideo").src = doneUrl;
  $("doneSave").classList.toggle("hidden", !file);
  $("doneTitle").textContent = file ? "Vídeo pronto" : "Vídeo salvo";
  $("doneText").textContent = (file ? "Toque em Salvar no celular. No iPhone, escolha “Salvar vídeo” para ir para as Fotos." : "Salvo em " + where + ".") +
    " Duração " + fmtT(R.tl.dur) + ", " + W + "×" + H + ".";
  show("done");
}
$("doneSave").addEventListener("click", async () => {
  if (!doneFile) return;
  const r = await shareFile(doneFile);
  if (r === "download") toast("Baixando " + doneFile.name);
});
$("doneEdit").addEventListener("click", openEditor);
$("doneNew").addEventListener("click", () => { resetProject(); show("home"); });

/* ---------- botao voltar do Android ---------- */
onBack(() => {
  if (!$("modal").classList.contains("hidden")) { $("modal").classList.add("hidden"); return; }
  const on = document.querySelector(".screen.on").id;
  if (on === "work") return; // espera terminar ou usa o Cancelar
  if (on === "review") { $("revBack").click(); return; }
  if (on === "editor") { $("edBack").click(); return; }
  if (on === "done") { $("doneEdit").click(); return; }
  exitApp();
});

/* ---------- acesso: login, lista de liberados ---------- */
const CFG = window.MCM_CONFIG || {};
let SESSION = null, ACC = null, lgMode = "in";
function lgMsg(t, kind) { $("lgMsg").textContent = t || ""; $("lgMsg").className = "msg" + (kind ? " " + kind : ""); }
const LIVRE = CFG.acessoLivre === true; // fase de teste: abre direto, sem login
async function gate() {
  if (LIVRE) { SESSION = null; ACC = { ativo: true, admin: false }; show("home"); return true; }
  try { SESSION = await auth.session(); } catch (e) { SESSION = null; show("login"); lgMsg(e.message, "bad"); return false; }
  if (!SESSION) { show("login"); return false; }
  if (SESSION.recovery) { show("newpass"); return false; }
  try { ACC = await auth.access(SESSION); }
  catch (e) { ACC = { ativo: false, admin: false }; toast("Não deu para conferir o acesso: " + e.message, 5000); }
  if (!ACC.ativo) {
    $("pdEmail").textContent = SESSION.user && SESSION.user.email || "";
    $("pdContato").textContent = CFG.contato ? "Dúvidas ou liberação: " + CFG.contato : "";
    show("pending");
    return false;
  }
  show("home");
  return true;
}
$("demoNote").classList.toggle("hidden", !DEMO);
document.querySelectorAll(".appname").forEach(el => { el.textContent = CFG.nome || "Motion Captions"; });
$("lgMode").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  lgMode = b.dataset.v;
  [].forEach.call($("lgMode").children, x => x.classList.toggle("on", x === b));
  $("lgGo").textContent = lgMode === "in" ? "Entrar" : "Criar conta";
  $("lgPass").autocomplete = lgMode === "in" ? "current-password" : "new-password";
  lgMsg("");
});
$("gBtn").addEventListener("click", () => { lgMsg("Abrindo o Google…"); auth.google(); });
$("lgGo").addEventListener("click", async () => {
  const em = $("lgEmail").value.trim(), pw = $("lgPass").value;
  if (!validEmail(em)) return lgMsg("Digite um e-mail válido.", "bad");
  if (pw.length < 6) return lgMsg("A senha precisa ter pelo menos 6 caracteres.", "bad");
  $("lgGo").disabled = true;
  try {
    if (lgMode === "up") {
      const r = await auth.signUp(em, pw);
      if (r.confirm) { lgMsg("Conta criada. Abra o e-mail de confirmação que enviamos e depois toque em Entrar.", "good"); return; }
    } else await auth.signIn(em, pw);
    lgMsg("");
    $("lgPass").value = "";
    await gate();
  } catch (e) { lgMsg(e.message, "bad"); }
  finally { $("lgGo").disabled = false; }
});
$("lgPass").addEventListener("keydown", e => { if (e.key === "Enter") $("lgGo").click(); });
$("lgForgot").addEventListener("click", async () => {
  const em = $("lgEmail").value.trim();
  if (!validEmail(em)) return lgMsg("Digite seu e-mail acima e toque de novo em “Esqueci a senha”.", "bad");
  if (DEMO) return lgMsg("No modo demonstração não há e-mail de recuperação.", "bad");
  try { await auth.recover(em); lgMsg("Se o e-mail tiver cadastro, enviamos um link para criar uma senha nova.", "good"); }
  catch (e) { lgMsg(e.message, "bad"); }
});
$("npGo").addEventListener("click", async () => {
  const pw = $("npPass").value;
  if (pw.length < 6) { $("npMsg").textContent = "A senha precisa ter pelo menos 6 caracteres."; return; }
  try { await auth.newPassword(SESSION, pw); SESSION.recovery = false; toast("Senha alterada"); await gate(); }
  catch (e) { $("npMsg").textContent = e.message; }
});
$("pdAgain").addEventListener("click", async () => { const ok = await gate(); if (!ok && $("pending").classList.contains("on")) toast("Ainda não liberado"); });
$("pdOut").addEventListener("click", async () => { await auth.signOut(SESSION); SESSION = null; show("login"); });
$("menuBtn").addEventListener("click", () => {
  if (LIVRE) { sheet("<h3>" + esc(CFG.nome || "Motion Captions") + "</h3><p class=\"muted\">Versão de teste: acesso livre, sem login. Tudo roda no seu aparelho; os vídeos não saem dele.</p>"); return; }
  const em = SESSION && SESSION.user ? SESSION.user.email : "";
  sheet("<h3>Conta</h3><p class=\"muted\">" + esc(em) + (DEMO ? " (modo demonstração)" : "") + "</p><div class=\"menu\">" +
    (ACC && ACC.admin ? "<a href=\"admin.html\">Painel de acesso (liberar e-mails)</a>" : "") +
    "<button id=\"mnOut\">Sair</button></div>", (el, close) => {
    el.querySelector("#mnOut").onclick = async () => { close(); await auth.signOut(SESSION); SESSION = null; resetProject(); show("login"); };
  });
});

/* ---------- inicio ---------- */
(async function init() {
  window.MCM = { addFiles, S, TL, rebuild: () => rebuild(), openEditor, openReview, get R() { return R; }, player, segmentWords, autoHl, prepare };
  if ("serviceWorker" in navigator && !isNative) navigator.serviceWorker.register("sw.js").catch(e => console.warn("sw", e));
  await probeLocal();
  await gate();
  renderClips();
  await refreshSounds();
  try { await loadFonts(); } catch (e) { console.warn(e); }
})();
