/*
 * Motion Captions Pro - mesma matematica das expressoes do After Effects (jsx/mcp_anim.jsx),
 * usada pela previa do painel. Se mudar uma, mude a outra.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  root.MCP = root.MCP || {};
  root.MCP.ease = mod;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function cl(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

  function ez(x, k, ov) {
    x = cl(x);
    if (k === "linear") return x;
    if (k === "expo") return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
    if (k === "quart") return 1 - Math.pow(1 - x, 4);
    if (k === "in") return x * x * x;
    if (k === "inout") return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    if (k === "back") { var c = ov || 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
    if (k === "elastic") { if (x === 0 || x === 1) return x; return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * 2.0944) + 1; }
    if (k === "bounce") {
      var n = 7.5625, b = 2.75;
      if (x < 1 / b) return n * x * x;
      if (x < 2 / b) { x -= 1.5 / b; return n * x * x + 0.75; }
      if (x < 2.5 / b) { x -= 2.25 / b; return n * x * x + 0.9375; }
      x -= 2.625 / b; return n * x * x + 0.984375;
    }
    return 1 - Math.pow(1 - x, 3);
  }

  function params(style) {
    var a = style.anim;
    var k = (a.intensity == null ? 100 : a.intensity) / 100;
    var ie = a.ease || "out";
    if (a.inT === "pop" && ie === "out") ie = "back";
    if (a.inT === "bounce") ie = "elastic";
    if (a.inT === "drop" && ie === "out") ie = "bounce";
    if (a.inT === "scaleUp") ie = "expo";
    var sF = 100 - (100 - (a.sF == null ? 85 : a.sF)) * k, sOut = 100 - (100 - (a.sOut == null ? 90 : a.sOut)) * k;
    return {
      i: Math.max(0, (a.inMs || 0) / 1000), o: Math.max(0, (a.outMs || 0) / 1000),
      inT: a.inT || "none", outT: a.outT || "none", ie: ie, ov: a.ov == null ? 1.7 : a.ov,
      sF: sF, sT: a.sT == null ? 100 : a.sT, sOut: sOut, zF: 200 - sF, zO: 200 - sOut,
      rot: (a.rot == null ? 14 : a.rot) * k,
      off: (a.off == null ? 40 : a.off) * k, oF: a.oF == null ? 0 : a.oF, oT: a.oT == null ? 100 : a.oT,
      blur: (a.blur == null ? 18 : a.blur) * k
    };
  }

  /** Scale Bounce: cresce do zero em 0,1 s e passa 5% do tamanho, voltando em 0,3 s (sem ricochete) */
  function bounceScale(t) {
    if (t < 0.1) return Math.max(0, t / 0.1);
    var x = (t - 0.1) / 0.3;
    return x >= 1 ? 1 : 1 + 0.05 * 6.75 * x * (1 - x) * (1 - x);
  }

  /** estado da camada no tempo t (s desde o inicio da legenda), duracao d */
  function state(A, t, d) {
    var di = Math.min(A.i, d * 0.45), dO = Math.min(A.o, d * 0.35);
    var pi = di > 0 ? cl(t / di) : 1, po = dO > 0 ? cl((d - t) / dO) : 1;
    var ei = ez(pi, A.ie, A.ov), eo = ez(po, "out", 0);
    var m = 1;
    if (A.inT === "scale" || A.inT === "pop" || A.inT === "bounce" || A.inT === "spin") m *= (A.sF + (A.sT - A.sF) * ei) / 100;
    else if (A.inT === "zoom") m *= (A.zF + (A.sT - A.zF) * ei) / 100;
    else if (A.inT === "scaleUp") m *= ei;
    else if (A.inT === "scaleBounce") m *= bounceScale(t);
    if (A.outT === "scale" || A.outT === "pop" || A.outT === "spin") m *= (A.sOut + (100 - A.sOut) * eo) / 100;
    else if (A.outT === "zoom") m *= (A.zO + (100 - A.zO) * eo) / 100;
    var o = A.oT;
    if (A.inT !== "none") {
      var q = (A.inT === "pop" || A.inT === "bounce" || A.inT === "scale" || A.inT === "zoom" || A.inT === "spin" || A.inT === "drop" || A.inT === "scaleUp") ? cl(pi * 2.5) :
        (A.inT === "scaleBounce" ? 1 : (A.inT === "riseBlur" ? cl(pi * 1.5) : pi));
      o = A.oF + (A.oT - A.oF) * ez(q, "out", 0);
    }
    if (A.outT !== "none") o *= eo;
    var dy = 0, dx = 0, rot = 0;
    if (A.inT === "slideUp" || A.inT === "riseBlur") dy += A.off * (1 - ei); else if (A.inT === "slideDown" || A.inT === "drop") dy -= A.off * (1 - ei);
    else if (A.inT === "fromLeft") dx -= A.off * (1 - ei); else if (A.inT === "fromRight") dx += A.off * (1 - ei);
    if (A.outT === "slideUp") dy -= A.off * (1 - eo); else if (A.outT === "slideDown") dy += A.off * (1 - eo);
    else if (A.outT === "toLeft") dx -= A.off * (1 - eo); else if (A.outT === "toRight") dx += A.off * (1 - eo);
    if (A.inT === "spin") rot -= A.rot * (1 - ei);
    if (A.outT === "spin") rot += A.rot * (1 - eo);
    var b = 0;
    if (A.inT === "blur" || A.inT === "riseBlur") b += A.blur * (1 - ei);
    if (A.outT === "blur") b += A.blur * (1 - eo);
    return { scale: m, opacity: o, dy: dy, dx: dx, rot: rot, blur: b };
  }

  /** easing de cada entrada por palavra (igual a MCP.wordEase no jsx) */
  function wordEase(type, ease) {
    if (type === "pop") return "back";
    if (type === "elastic") return "elastic";
    if (type === "drop") return "bounce";
    if (type === "blurUp") return "out";
    if (type === "slideWord") return "quart";
    return ease || "out";
  }

  /**
   * Estado de uma palavra na entrada (amt = 1 antes de entrar, 0 depois). Mesmos numeros de
   * MCP.addWordReveal no jsx. Retorna { op, sc, dx, dy, rot, blur }.
   */
  function wordState(type, amt, a, intensity) {
    var k = intensity == null ? 1 : intensity;
    var sF = (100 - (100 - (a.sF == null ? 70 : a.sF)) * k) / 100;
    var off = (a.off == null ? 40 : a.off) * k;
    var r = { op: 1 - cl(amt), sc: 1, dx: 0, dy: 0, rot: 0, blur: 0 };
    if (type === "pop" || type === "scale" || type === "elastic" || type === "spin") r.sc = 1 + (sF - 1) * amt;
    if (type === "zoom") r.sc = 1 + (1 - sF) * amt;
    if (type === "slide") r.dy = off * 0.6 * amt;
    if (type === "slideDown") r.dy = -off * 0.6 * amt;
    if (type === "drop") r.dy = -off * 1.2 * amt;
    if (type === "fromLeft") r.dx = -off * amt;
    if (type === "fromRight") r.dx = off * amt;
    if (type === "spin") r.rot = -(a.rot == null ? 14 : a.rot) * k * 1.5 * amt;
    if (type === "blur") r.blur = (a.blur == null ? 18 : a.blur) * k * Math.max(0, amt);
    if (type === "blurUp") { r.dy = off * 0.5 * amt; r.blur = (a.blur == null ? 18 : a.blur) * k * Math.max(0, amt); }
    var B = (a.blur == null ? 18 : a.blur) * k * Math.max(0, amt);
    if (type === "fallBlur") { r.dy = -off * amt; r.blur = B; }
    if (type === "leftBlur") { r.dx = -off * amt; r.blur = B; }
    if (type === "rightBlur") { r.dx = off * amt; r.blur = B; }
    if (type === "rise") { r.dy = off * amt; r.blur = B * 0.5; }
    if (type === "slideWord") { r.dy = off * amt; r.blur = B; }
    if (type === "zoomBlur") { r.sc = 1 + (1 - sF) * amt; r.blur = (a.blur == null ? 18 : a.blur) * k * Math.max(0, amt); }
    return r;
  }

  /** numero pseudoaleatorio fixo (mesma legenda = mesmo resultado no painel e no AE) */
  function hash(i, salt) {
    var h = ((i + 1) * 2654435761 + (salt || 0) * 40503) % 4294967296;
    return Math.floor(h / 65536) / 65536;
  }

  /** sorteia um item do conjunto por legenda, sem repetir a vizinha */
  function pickSeq(n, pool, salt) {
    var out = [], prev = -1;
    for (var i = 0; i < n; i++) {
      var opts = [];
      for (var j = 0; j < pool.length; j++) if (j !== prev) opts.push(j);
      var pick = opts[Math.floor(hash(i, salt) * opts.length) % opts.length];
      out.push(pool[pick]);
      prev = pick;
    }
    return out;
  }

  /** estilos do "Misto": cada legenda recebe um, e duas vizinhas nunca repetem */
  var MIX = ["fade", "elastic", "blurUp"];
  function mixSeq(n) { return pickSeq(n, MIX, 0); }

  /** entradas do modo dinamico (por frase e por palavra) */
  var DYN_IN = ["pop", "slideUp", "zoom", "fromLeft", "fromRight", "blur", "drop", "bounce"];
  var DYN_WORD = ["pop", "blurUp", "fromLeft", "fromRight", "elastic", "slide", "zoom", "drop"];
  /** posicoes do padrao "alternado" (multiplicam a amplitude X/Y/giro) */
  var ALT = [[0, 0, 0], [-1, -0.6, -1], [1, 0.3, 1], [0, -1, 0], [-0.7, 0.7, 1], [0.8, -0.4, -1]];

  /** deslocamento e inclinacao de cada legenda no modo dinamico */
  function dynSeq(n, dyn) {
    var out = [];
    var X = +dyn.x || 0, Y = +dyn.y || 0, R = +dyn.rot || 0;
    for (var i = 0; i < n; i++) {
      var m;
      if (dyn.pattern === "random") m = [hash(i, 1) * 2 - 1, hash(i, 2) * 2 - 1, hash(i, 3) * 2 - 1];
      else m = ALT[i % ALT.length];
      out.push({ dx: Math.round(m[0] * X), dy: Math.round(m[1] * Y), rot: Math.round(m[2] * R * 10) / 10 });
    }
    return out;
  }

  /** entrada da palavra destaque (iguais a MCP.hlRevealParams no jsx). Retorna {type, a} para wordState */
  var HL_IN = ["same", "focus", "flicker", "pop", "slam", "elastic", "blurUp", "drop", "rise", "fromLeft", "fromRight", "spin", "fade"];
  /** pisca (liga e desliga nos primeiros quadros), igual ao jsx: quanto falta aparecer por quadro */
  var FLICKER = [45, 100, 0, 100, 100];
  function flickerAmt(frame) { return frame < 0 ? 100 : (frame < FLICKER.length ? FLICKER[frame] : 0); }
  function hlParams(type, power) {
    var k = power == null ? 1 : power;
    var t = type === "slam" ? "zoom" : (type === "rise" ? "slide" : (type === "focus" ? "zoomBlur" : type));
    var base = type === "slam" ? 20 : (type === "focus" ? 70 : 45);
    return { type: t, a: { sF: 100 - (100 - base) * k, off: 80 * k, rot: 20 * k, blur: 26 * k, ov: 2.2 } };
  }

  /** letra por letra: estado de uma letra (amt = 1 antes de entrar). Iguais a MCP.letterProps no jsx */
  var LETTER_IN = ["lettersBlur", "lettersRight", "lettersSpin"];
  /** "Direcoes": de baixo para cima, da esquerda para o centro, da direita para o centro, de cima para baixo */
  var DIRS = ["rise", "leftBlur", "rightBlur", "fallBlur"];
  function letterState(type, amt, a) {
    var off = (a.off == null ? 40 : a.off), bl = (a.blur == null ? 18 : a.blur);
    var r = { op: 1 - cl(amt), dx: 0, dy: 0, rot: 0, blur: 0 };
    if (type === "lettersBlur") { r.dx = off * 0.3 * amt; r.blur = bl * amt; }
    if (type === "lettersRight") { r.dx = off * amt; }
    if (type === "lettersSpin") { r.rot = 90 * amt; r.dy = -off * 0.6 * amt; }
    return r;
  }
  /** inicio de cada letra: comeca na fala da palavra, uma letra a cada "stag" segundos */
  function letterTimes(words, stag) {
    var out = [];
    for (var i = 0; i < words.length; i++) for (var c = 0; c < String(words[i].w).length; c++) out.push(words[i].s + c * stag);
    return out;
  }
  /** Slide palavra: as palavras entram em sequencia, 3 quadros (0,1 s) depois da anterior */
  function wordStart(type, w, i) { return type === "slideWord" ? i * 0.1 : w.s; }

  return { DIRS: DIRS, cl: cl, ez: ez, bounceScale: bounceScale, LETTER_IN: LETTER_IN, letterState: letterState, letterTimes: letterTimes, wordStart: wordStart, params: params, state: state, wordEase: wordEase, wordState: wordState, MIX: MIX, mixSeq: mixSeq,
    hash: hash, pickSeq: pickSeq, flickerAmt: flickerAmt, DYN_IN: DYN_IN, DYN_WORD: DYN_WORD, dynSeq: dynSeq, HL_IN: HL_IN, hlParams: hlParams };
});
