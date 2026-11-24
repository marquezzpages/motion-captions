/*
 * Motion Captions Pro - estilos, presets embutidos e montagem do pacote enviado ao After Effects.
 */
(function (root, factory) {
  var seg = (root.MCP && root.MCP.seg) ? root.MCP.seg : require("./segment.js");
  var lib = (root.MCP && root.MCP.presetLib) ? root.MCP.presetLib : require("./presets_lib.js");
  var ease = (root.MCP && root.MCP.ease) ? root.MCP.ease : require("./ease.js");
  var mod = factory(seg, lib, ease);
  if (typeof module === "object" && module.exports) module.exports = mod;
  root.MCP = root.MCP || {};
  root.MCP.presets = mod;
})(typeof window !== "undefined" ? window : globalThis, function (seg, lib, ease) {
  "use strict";

  var VERSION = 1;

  /** serifas italicas para o destaque; termina em fontes que ja vem no Windows */
  /** caligrafia (palavras de baixo) */
  var SCRIPT = ["AfxGreatVibes-Regular", "DancingScript-Bold", "InstrumentSerif-Italic", "Georgia-Italic"];
  var SERIF_IT = ["InstrumentSerif-Italic", "DMSerifDisplay-Italic", "PlayfairDisplay-Italic", "CormorantGaramond-BoldItalic",
    "Georgia-BoldItalic", "Georgia-Italic", "TimesNewRomanPS-BoldItalicMT"];

  /** estilo completo padrao: todo preset e mesclado sobre ele */
  var BASE = {
    font: {
      ps: "Montserrat-Bold", family: "Montserrat", style: "Bold",
      fallbacks: ["Montserrat-SemiBold", "Inter-Bold", "Arial-BoldMT", "ArialMT"],
      size: 72, fauxBold: false, fauxItalic: false, caseMode: "none",
      tracking: 0, leading: 0, align: "center", maxWidthPct: 84,
      // entrelinha curta: as linhas quase encostam (cada linha pelo proprio tamanho)
      tight: false
    },
    fill: { type: "solid", color: "#FFFFFF", color2: "#7C5CFF", angle: 90, opacity: 100 },
    stroke: { on: false, width: 6, color: "#000000", opacity: 100 },
    shadow: { on: true, color: "#000000", opacity: 55, blur: 14, distance: 4, angle: 135 },
    box: {
      on: false, mode: "caption", move: 110, type: "solid", color: "#000000", color2: "#7C5CFF", angle: 90, opacity: 85,
      radius: 18, padX: 28, padY: 14,
      border: { on: false, width: 3, color: "#FFFFFF", opacity: 100 },
      shadow: { on: false, color: "#000000", opacity: 45, blur: 20, distance: 6, angle: 135 }
    },
    // palavra-chave: cor ou degrade, fonte propria, tamanho (reflui a linha) e destaques empilhados
    highlight: {
      mode: "none", list: "", every: 0, color: "#FFD60A", type: "solid", color2: "#FF6A00", angle: 90,
      scale: 100, stack: false,
      // letra do destaque: "same" (so a cor), "bold", "italic", "boldItalic"; fonte propria = font.on
      look: "same",
      // entrada propria da palavra destaque ("same" = igual ao resto da legenda)
      anim: { type: "same", ms: 320, power: 100 },
      // caixa so do destaque ("same", "upper", "lower") e espacamento entre letras (null = igual ao texto)
      caseMode: "same", tracking: null,
      // empilhado em escada: linha de cima alinhada a esquerda da palavra grande, a de baixo a direita
      stair: false, stairAmt: 0.7,
      // luz parada na borda da palavra (CC Light Sweep) e ponto final no destaque
      sweep: false, period: false,
      // brilho so na palavra destaque
      glow: { on: false, color: "#FF1F3D", opacity: 85, blur: 28 },
      // marca na palavra: "none", "tag" (tarja atras), "underline" (sublinhado a mao), "circle" (oval a mao)
      mark: { type: "none", color: "#E3000A", delay: 80 },
      font: { on: false, ps: "InstrumentSerif-Italic", family: "Instrument Serif", style: "Italic",
        fallbacks: SERIF_IT, fauxItalic: false }
    },
    // palavras de cima (pre) e de baixo (post) no empilhado: caixa, tamanho, espacamento, cor e fonte proprios
    pre: { on: false, caseMode: "same", tracking: null, scale: 100, color: null,
      font: { on: false, ps: "GreatVibes-Regular", family: "Great Vibes", style: "Regular", fallbacks: SCRIPT } },
    post: { on: false, caseMode: "same", tracking: null, scale: 100, color: null,
      font: { on: false, ps: "GreatVibes-Regular", family: "Great Vibes", style: "Regular", fallbacks: SCRIPT } },
    sfx: { on: false, id: "click_suave", accent: "none", mode: "word", vol: -6, offset: 0, minGap: 90 },
    karaoke: { on: false, color: "#FFD60A", type: "solid", color2: "#FF6A00", angle: 90, scale: 100, accumulate: false },
    anim: {
      inT: "fade", outT: "fade", inMs: 250, outMs: 180, ease: "out", intensity: 100,
      sF: 85, sT: 100, sOut: 90, off: 40, rot: 14, ov: 1.7, oF: 0, oT: 100, blur: 18,
      unit: "phrase", wordIn: "pop", wordMs: 180, typeCps: 28, typeSync: true,
      // letra por letra: tipo, duracao de cada letra e intervalo entre letras (ms)
      letterIn: "lettersBlur", letterMs: 300, letterStag: 45,
      // modo dinamico: cada legenda muda de lugar, inclina e entra de um jeito diferente
      dyn: { on: false, pattern: "alternate", x: 70, y: 110, rot: 4, mixIn: true }
    }
  };

  /** layout = quebra; position = posicionamento. Ficam fora do preset. */
  var LAYOUT = { mode: "auto", maxChars: 26, maxLines: 2, minDur: 0.6, gap: 0.04, hold: 0.4, pause: 0.45, noOrphans: true, lead: 80 };
  var POSITION = { anchor: "bottom", x: 50, y: 78, offX: 0, offY: 0, safe: 15, keepSafe: true };

  var BUILTIN = [
    {
      id: "clean", name: "01 Clean", builtin: true,
      style: {
        font: { ps: "Montserrat-SemiBold", family: "Montserrat", style: "SemiBold", size: 64,
          fallbacks: ["Inter-SemiBold", "Montserrat-Bold", "ArialMT"] },
        shadow: { on: true, opacity: 45, blur: 16, distance: 3 },
        anim: { inT: "fade", outT: "fade", inMs: 260, outMs: 200, ease: "out" }
      }
    },
    {
      id: "dinamica", name: "02 Dinâmica", builtin: true, layout: { mode: 3, maxChars: 18 },
      style: {
        font: { ps: "Montserrat-Black", family: "Montserrat", style: "Black", size: 86, caseMode: "upper",
          fallbacks: ["Montserrat-ExtraBold", "Inter-Black", "Arial-BoldMT"] },
        stroke: { on: true, width: 7, color: "#000000" },
        shadow: { on: true, opacity: 50, blur: 10, distance: 5 },
        highlight: { mode: "auto", color: "#FFD60A", scale: 106 },
        anim: { inT: "none", outT: "fade", outMs: 120, unit: "word", wordIn: "pop", wordMs: 160, sF: 70, ov: 2.2 }
      }
    },
    {
      id: "box", name: "03 CapCut Box", builtin: true,
      style: {
        font: { ps: "Montserrat-Bold", family: "Montserrat", style: "Bold", size: 62 },
        shadow: { on: false },
        box: { on: true, mode: "word", move: 110, color: "#7C5CFF", opacity: 100, radius: 18, padX: 14, padY: 8 },
        anim: { inT: "pop", outT: "fade", inMs: 200, outMs: 150, sF: 90, ease: "back", ov: 1.4 }
      }
    },
    {
      id: "karaoke", name: "04 Karaokê", builtin: true, layout: { mode: "auto", maxChars: 22 },
      style: {
        font: { ps: "Montserrat-ExtraBold", family: "Montserrat", style: "ExtraBold", size: 72,
          fallbacks: ["Montserrat-Black", "Inter-ExtraBold", "Arial-BoldMT"] },
        stroke: { on: true, width: 6, color: "#000000" },
        karaoke: { on: true, color: "#FFD60A", scale: 106, accumulate: false },
        anim: { inT: "fade", outT: "fade", inMs: 160, outMs: 140 }
      }
    },
    {
      id: "pop", name: "05 Pop", builtin: true, layout: { mode: 2, maxChars: 16 },
      style: {
        font: { ps: "Montserrat-Black", family: "Montserrat", style: "Black", size: 92, caseMode: "upper",
          fallbacks: ["Montserrat-ExtraBold", "Arial-BoldMT"] },
        stroke: { on: true, width: 8, color: "#000000" },
        anim: { inT: "pop", outT: "fade", inMs: 140, outMs: 110, sF: 90, ease: "back", ov: 1.7 }
      }
    },
    {
      id: "cinematic", name: "06 Cinematic", builtin: true, layout: { mode: "sentence", maxChars: 34 },
      style: {
        font: { ps: "CormorantGaramond-SemiBold", family: "Cormorant Garamond", style: "SemiBold", size: 58,
          tracking: 60, caseMode: "none", fallbacks: ["CormorantGaramond-Medium", "Cinzel-Regular", "Georgia", "TimesNewRomanPSMT"] },
        shadow: { on: true, opacity: 60, blur: 24, distance: 0 },
        anim: { inT: "slideUp", outT: "fade", inMs: 700, outMs: 450, off: 24, ease: "inout" }
      }
    },
    {
      id: "typewriter", name: "07 Typewriter", builtin: true,
      style: {
        font: { ps: "CourierNewPS-BoldMT", family: "Courier New", style: "Bold", size: 60,
          fallbacks: ["CourierNewPSMT", "Inter-Medium", "ArialMT"] },
        shadow: { on: true, opacity: 60, blur: 8, distance: 3 },
        anim: { inT: "none", outT: "fade", outMs: 150, unit: "typewriter", typeCps: 30, typeSync: true }
      }
    },
    {
      id: "highlight", name: "08 Highlight", builtin: true,
      style: {
        font: { ps: "Montserrat-ExtraBold", family: "Montserrat", style: "ExtraBold", size: 74,
          fallbacks: ["Montserrat-Black", "Arial-BoldMT"] },
        stroke: { on: true, width: 5, color: "#000000" },
        // a cor anda com a fala: so a palavra que esta sendo dita fica colorida
        highlight: { mode: "none", color: "#7C5CFF", scale: 100 },
        karaoke: { on: true, color: "#7C5CFF", scale: 108, accumulate: false },
        anim: { inT: "scale", outT: "fade", inMs: 220, outMs: 160, sF: 92 }
      }
    }
  ];

  for (var bi = 0; bi < BUILTIN.length; bi++) BUILTIN[bi].cat = "Essenciais";
  BUILTIN = BUILTIN.concat(lib || []);
  var CATS = ["Essenciais"];
  for (var ci = 0; ci < BUILTIN.length; ci++) if (CATS.indexOf(BUILTIN[ci].cat) < 0) CATS.push(BUILTIN[ci].cat);

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function isObj(v) { return v && typeof v === "object" && !Array.isArray(v); }

  /** mescla profunda (b sobre a), sem alterar os originais */
  function merge(a, b) {
    var out = clone(a);
    if (!isObj(b)) return out;
    for (var k in b) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) continue;
      if (isObj(b[k]) && isObj(out[k])) out[k] = merge(out[k], b[k]);
      else out[k] = clone(b[k]);
    }
    return out;
  }

  function styleOf(preset) { return merge(BASE, preset && preset.style); }

  function defaultLayout() { return clone(LAYOUT); }
  function defaultPosition() { return clone(POSITION); }

  /** valida/normaliza um preset vindo de JSON importado */
  function sanitizePreset(p) {
    if (!isObj(p) || !isObj(p.style)) throw new Error("Preset sem campo 'style'.");
    var name = String(p.name || "Preset importado").slice(0, 60);
    return {
      id: "u_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name,
      builtin: false,
      style: merge(BASE, p.style),
      layout: isObj(p.layout) ? merge(LAYOUT, p.layout) : undefined
    };
  }

  function exportPresets(list) {
    return JSON.stringify({ app: "Motion Captions Pro", version: VERSION, presets: list.map(function (p) {
      return { name: p.name, style: p.style, layout: p.layout };
    }) }, null, 2);
  }

  function importPresets(json) {
    var data = typeof json === "string" ? JSON.parse(json) : json;
    var arr = Array.isArray(data) ? data : (data && Array.isArray(data.presets) ? data.presets : (data && data.style ? [data] : null));
    if (!arr) throw new Error("Arquivo nao contem presets do Motion Captions Pro.");
    return arr.map(sanitizePreset);
  }

  /**
   * Destaque com ponto final e papeis das palavras no empilhado: antes do destaque = "pre",
   * depois = "post" (cada papel pode ter caixa, fonte, tamanho e cor proprios).
   */
  function markRoles(words, style) {
    var H = style.highlight, a = -1, b = -1, i;
    for (i = 0; i < words.length; i++) if (words[i].hl) { if (a < 0) a = i; b = i; }
    if (a < 0) return;
    if (H.period && !/[?!]$/.test(words[b].w)) words[b].w = words[b].w.replace(/[.,;:\u2026]+$/, "") + ".";
    if (!H.stack) return;
    for (i = 0; i < words.length; i++) {
      var role = i < a ? "pre" : (i > b ? "post" : null);
      if (!role) continue;
      var R = style[role];
      if (!R || !R.on) continue;
      words[i].r = role;
      if (R.caseMode && R.caseMode !== "same") words[i].w = seg.applyCase(words[i].w, R.caseMode);
    }
  }

  /**
   * Monta o pacote que o ExtendScript recebe.
   * captions: [{start,end,words}] ; style/layout/position completos.
   * Tempos absolutos na composicao (ja com deslocamento).
   */
  function buildPayload(captions, style, layout, position, opts) {
    opts = opts || {};
    var offset = +opts.offset || 0;
    var out = [];
    var H = style.highlight;
    var hm = H.mode;
    var inList = hm === "list" ? seg.listMatcher(H.list) : null;
    var every = Math.max(0, +H.every || 0);
    var lastHl = -1e9;
    var A = style.anim;
    var mix = A.unit === "word" && A.wordIn === "mixed" ? ease.mixSeq(captions.length) : null;
    var dirN = A.unit === "word" && A.wordIn === "directions" ? 0 : -1;
    var dyn = A.dyn && A.dyn.on ? A.dyn : null;
    var dpos = dyn ? ease.dynSeq(captions.length, dyn) : null;
    var dIn = dyn && dyn.mixIn ? ease.pickSeq(captions.length, A.unit === "word" ? ease.DYN_WORD : ease.DYN_IN, 7) : null;
    for (var i = 0; i < captions.length; i++) {
      var c = captions[i];
      var words = [];
      var hlAuto = hm === "auto" || hm === "both" ? seg.autoHighlight(c.words) : -1;
      // automatico: no maximo um destaque a cada "every" segundos
      if (hlAuto >= 0 && hm === "auto" && every > 0 && c.start - lastHl < every - 1e-6) hlAuto = -1;
      var anyHl = false;
      for (var k = 0; k < c.words.length; k++) {
        var w = c.words[k];
        var hl = false;
        if (hm === "manual" || hm === "both") hl = !!w.hl;
        if (k === hlAuto) hl = true;
        if (inList && inList(w.w)) hl = true;
        // o destaque pode ter caixa propria (ex.: frase minuscula com a palavra em MAIUSCULAS)
        var cm = hl && H.caseMode && H.caseMode !== "same" ? H.caseMode : style.font.caseMode;
        var txt = seg.applyCase(w.w, cm).replace(/\s+/g, "");
        if (!txt) continue;
        if (hl) anyHl = true;
        words.push({ w: txt, s: +(w.s - c.start).toFixed(3), e: +(w.e - c.start).toFixed(3), hl: hl });
      }
      if (!words.length) continue;
      if (anyHl) lastHl = c.start;
      if (anyHl) markRoles(words, style);
      var toks = words.map(function (x) { return x.w; });
      var item = { n: i + 1, s: +(c.start + offset).toFixed(4), e: +(c.end + offset).toFixed(4), lines: null, words: words };
      var st = H.stack && hm !== "none" ? seg.stackLines(toks, words.map(function (x) { return x.hl; }), layout.maxChars) : null;
      if (st) { item.lines = st.lines; item.stk = st.big; }
      else item.lines = seg.wrap(toks, layout.maxChars, layout.maxLines);
      if (mix) item.wi = mix[i];
      // Direcoes: cada palavra do video pega o proximo lado do rodizio, entao vizinhas nunca vem do mesmo lado
      if (dirN >= 0) for (var dq = 0; dq < words.length; dq++) words[dq].dir = ease.DIRS[(dirN++) % ease.DIRS.length];
      if (dpos) { item.dx = dpos[i].dx; item.dy = dpos[i].dy; item.rot = dpos[i].rot; }
      if (dIn) { if (A.unit === "word") item.wi = dIn[i]; else item.inT = dIn[i]; }
      out.push(item);
    }
    return {
      v: VERSION,
      mode: opts.mode || "generate",
      style: style,
      layout: { maxChars: layout.maxChars, maxLines: layout.maxLines },
      lead: Math.max(0, (layout.lead == null ? 80 : +layout.lead) / 1000),
      position: position,
      captions: out
    };
  }

  return {
    BASE: BASE,
    BUILTIN: BUILTIN,
    CATS: CATS,
    merge: merge,
    clone: clone,
    styleOf: styleOf,
    defaultLayout: defaultLayout,
    defaultPosition: defaultPosition,
    sanitizePreset: sanitizePreset,
    exportPresets: exportPresets,
    importPresets: importPresets,
    buildPayload: buildPayload
  };
});
