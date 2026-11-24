/*
 * Motion Captions Pro - modelo de palavras, quebra de legendas e sincronizacao.
 *
 * Palavra:  { w, s, e, hl, brk, est }
 *   w   texto (pode ter pontuacao colada)
 *   s,e inicio/fim em segundos
 *   hl  destaque manual
 *   brk ultima palavra de um bloco original (cue SRT ou segmento do Whisper)
 *   est tempo estimado (SRT nao traz tempo por palavra)
 * Legenda:  { start, end, words:[...] }  (o texto e sempre derivado de words)
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  root.MCP = root.MCP || {};
  root.MCP.seg = mod;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var STRONG = /[.!?…]["'”»)]*$/; // fim de frase
  var WEAK = /[,;:—–-]["'”»)]*$/; // pausa de leitura

  // palavras que soam mal sozinhas no fim de uma linha/legenda
  var STOP = (
    "a o as os um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas " +
    "para pra pro com sem e ou mas que se ao aos à às é eu tu ele ela nós vós eles elas me te " +
    "lhe nos vos meu minha seu sua teu tua isso isto aquilo esse essa este esta muito mais " +
    "the a an of to in on at and or but is are for with"
  ).split(" ");
  var STOPSET = {};
  for (var si = 0; si < STOP.length; si++) STOPSET[STOP[si]] = true;

  function bare(w) {
    return String(w).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  }
  function isStop(w) {
    return !!STOPSET[bare(w)];
  }

  /** texto -> tokens (palavras), aceitando *destaque* */
  function tokenize(text) {
    var raw = String(text || "").replace(/\s+/g, " ").trim();
    if (!raw) return [];
    var parts = raw.split(" ");
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var hl = false;
      if (/^\*[^*]+\*[^\s*]*$/.test(p) || /^\*[^*]+\*$/.test(p)) {
        hl = true;
        p = p.replace(/\*/g, "");
      } else if (p.indexOf("*") >= 0) {
        p = p.replace(/\*/g, "");
      }
      if (p) out.push({ w: p, hl: hl });
    }
    return out;
  }

  /** peso de leitura de uma palavra, para estimar tempos */
  function weight(w) {
    var n = bare(w).length || 1;
    var bonus = STRONG.test(w) ? 3 : WEAK.test(w) ? 1.5 : 0;
    return n + 1 + bonus;
  }

  /** distribui tokens no intervalo [s,e] proporcionalmente ao tamanho */
  function distribute(tokens, s, e) {
    var total = 0;
    for (var i = 0; i < tokens.length; i++) total += weight(tokens[i].w);
    var t = s;
    var dur = Math.max(0.001, e - s);
    var out = [];
    for (var j = 0; j < tokens.length; j++) {
      var d = (weight(tokens[j].w) / total) * dur;
      out.push({ w: tokens[j].w, s: round3(t), e: round3(t + d), hl: !!tokens[j].hl, brk: false, est: true });
      t += d;
    }
    if (out.length) out[out.length - 1].e = round3(e);
    return out;
  }

  function round3(x) {
    return Math.round(x * 1000) / 1000;
  }

  /** cues SRT -> palavras (tempos estimados dentro de cada cue) */
  function wordsFromCues(cues) {
    var words = [];
    for (var i = 0; i < cues.length; i++) {
      var c = cues[i];
      var end = c.end;
      if (i + 1 < cues.length && cues[i + 1].start < end) end = Math.max(c.start + 0.05, cues[i + 1].start);
      var ws = distribute(tokenize(c.text), c.start, end);
      if (ws.length) ws[ws.length - 1].brk = true;
      for (var k = 0; k < ws.length; k++) words.push(ws[k]);
    }
    return words;
  }

  /**
   * segmentos do Whisper -> palavras.
   * segs: [{start,end,text,words:[{word,start,end}]}]
   */
  function wordsFromSegments(segs) {
    var words = [];
    for (var i = 0; i < segs.length; i++) {
      var sg = segs[i];
      var ws = [];
      if (sg.words && sg.words.length) {
        for (var k = 0; k < sg.words.length; k++) {
          var w = String(sg.words[k].word || sg.words[k].w || "").trim();
          if (!w) continue;
          var s = +sg.words[k].start;
          var e = +sg.words[k].end;
          if (!(e > s)) e = s + 0.08;
          ws.push({ w: w, s: round3(s), e: round3(e), hl: false, brk: false, est: false });
        }
      } else {
        ws = distribute(tokenize(sg.text), sg.start, sg.end);
      }
      if (ws.length) ws[ws.length - 1].brk = true;
      for (var j = 0; j < ws.length; j++) words.push(ws[j]);
    }
    // garante ordem e sem sobreposicao
    for (var n = 1; n < words.length; n++) {
      if (words[n].s < words[n - 1].s) words[n].s = words[n - 1].s;
      if (words[n - 1].e > words[n].s) words[n - 1].e = Math.max(words[n - 1].s + 0.01, words[n].s);
    }
    return words;
  }

  function joinWords(ws) {
    var a = [];
    for (var i = 0; i < ws.length; i++) a.push(ws[i].w);
    return a.join(" ");
  }

  /**
   * Divide palavras em legendas.
   * opt: { mode:'auto'|'sentence'|1|2|3|4, maxChars, maxLines, minDur, gap, hold, noOrphans, pause }
   */
  function segment(words, opt) {
    opt = opt || {};
    var mode = opt.mode == null ? "auto" : opt.mode;
    var maxChars = Math.max(4, +opt.maxChars || 32);
    var maxLines = Math.max(1, +opt.maxLines || 2);
    var pause = opt.pause == null ? 0.45 : +opt.pause;
    var cap = maxChars * maxLines;
    var groups = [];
    var cur = [];
    var len = 0;

    function flush() {
      if (cur.length) groups.push(cur);
      cur = [];
      len = 0;
    }

    var n = parseInt(mode, 10);
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var next = words[i + 1];
      var addLen = (cur.length ? 1 : 0) + w.w.length;
      if (!isNaN(n) && n > 0) {
        cur.push(w);
        var gapN = next ? next.s - w.e : 0;
        if (cur.length >= n || w.brk || STRONG.test(w.w) || gapN > pause * 1.5) flush();
        continue;
      }
      if (mode === "sentence") {
        if (cur.length && len + addLen > cap * 1.6) flush(); // frase gigante: corta mesmo assim
        cur.push(w);
        len += addLen;
        if (w.brk) flush();
        continue;
      }
      // auto inteligente
      if (cur.length && len + addLen > cap) {
        // volta ate um ponto melhor (pontuacao ou palavra que nao e de ligacao)
        var cut = bestCut(cur);
        if (cut > 0 && cut < cur.length) {
          var rest = cur.slice(cut);
          cur = cur.slice(0, cut);
          flush();
          for (var r = 0; r < rest.length; r++) {
            len += (cur.length ? 1 : 0) + rest[r].w.length;
            cur.push(rest[r]);
          }
        } else {
          flush();
        }
        addLen = (cur.length ? 1 : 0) + w.w.length;
      }
      cur.push(w);
      len += addLen;
      var gap = next ? next.s - w.e : 0;
      if (STRONG.test(w.w) || w.brk || gap > pause) flush();
      else if (WEAK.test(w.w) && len >= cap * 0.5) flush();
    }
    flush();

    if (opt.noOrphans !== false && (mode === "auto" || mode === "sentence")) fixOrphans(groups, cap);

    var caps = [];
    for (var g = 0; g < groups.length; g++) {
      caps.push({ start: groups[g][0].s, end: groups[g][groups[g].length - 1].e, words: groups[g] });
    }
    return retime(caps, opt);
  }

  /** melhor ponto de corte dentro de um grupo cheio (indice da 1a palavra do proximo) */
  function bestCut(ws) {
    for (var i = ws.length - 1; i >= 1; i--) {
      if (STRONG.test(ws[i - 1].w) || WEAK.test(ws[i - 1].w)) return i;
    }
    // evita terminar em palavra de ligacao ("de", "o", "para"...)
    for (var j = ws.length; j >= Math.ceil(ws.length / 2); j--) {
      if (!isStop(ws[j - 1].w)) return j;
    }
    return ws.length;
  }

  /** evita legenda de uma palavra so quando ha espaco na anterior */
  function fixOrphans(groups, cap) {
    for (var i = 1; i < groups.length; i++) {
      var g = groups[i];
      var prev = groups[i - 1];
      if (g.length !== 1 || prev[prev.length - 1].brk) continue;
      if (STRONG.test(prev[prev.length - 1].w)) continue;
      var gapPrev = g[0].s - prev[prev.length - 1].e;
      if (gapPrev > 0.6) continue;
      var plen = joinWords(prev).length + 1 + g[0].w.length;
      if (plen <= cap * 1.15) {
        groups[i - 1] = prev.concat(g);
        groups.splice(i, 1);
        i--;
      } else if (prev.length > 2) {
        groups[i] = [prev.pop()].concat(g);
      }
    }
  }

  /**
   * Ajusta tempos: duracao minima, intervalo entre legendas e "segurar" a legenda
   * em pausas curtas. Nunca deixa sobrepor.
   */
  function retime(caps, opt) {
    var minDur = opt.minDur == null ? 0.6 : +opt.minDur;
    var gap = opt.gap == null ? 0.04 : +opt.gap;
    var hold = opt.hold == null ? 0.4 : +opt.hold;
    var fps = +opt.fps || 0;
    for (var i = 0; i < caps.length; i++) {
      var c = caps[i];
      var next = caps[i + 1];
      var limit = next ? next.start - gap : Infinity;
      var end = Math.max(c.end, Math.min(c.end + hold, limit));
      if (end - c.start < minDur) end = Math.min(c.start + minDur, limit);
      if (end <= c.start) end = c.start + Math.max(0.04, fps ? 1 / fps : 0.04);
      c.end = round3(end);
      if (fps) {
        // inicio arredonda para o quadro ANTERIOR: a legenda nunca comeca depois da fala
        var fl = function (x) { return Math.floor(x * fps + 1e-6) / fps; };
        c.start = fl(c.start);
        c.end = Math.max(c.start + 1 / fps, Math.round(c.end * fps) / fps);
        if (next && c.end > fl(next.start)) c.end = fl(next.start);
        c.start = round3(c.start);
        c.end = round3(c.end);
      }
    }
    return caps;
  }

  /**
   * Quebra de linhas equilibrada. Retorna array de linhas (strings).
   * Tenta o menor numero de linhas que caiba em maxChars, equilibrando o tamanho.
   */
  function wrap(words, maxChars, maxLines) {
    var toks = [];
    for (var i = 0; i < words.length; i++) toks.push(typeof words[i] === "string" ? words[i] : words[i].w);
    var full = toks.join(" ");
    maxChars = Math.max(4, +maxChars || 32);
    maxLines = Math.max(1, +maxLines || 2);
    if (full.length <= maxChars || toks.length < 2) return [full];
    var need = Math.min(maxLines, Math.max(2, Math.ceil(full.length / maxChars)));
    var best = null;
    for (var lines = 2; lines <= Math.max(need, 2) && lines <= toks.length; lines++) {
      var res = balance(toks, lines);
      var worst = 0;
      for (var k = 0; k < res.length; k++) worst = Math.max(worst, res[k].length);
      if (!best || worst < best.worst) best = { lines: res, worst: worst };
      if (worst <= maxChars) break;
    }
    return best.lines;
  }

  /** divide tokens em k linhas minimizando a linha mais longa (programacao dinamica) */
  function balance(toks, k) {
    var n = toks.length;
    var pre = [0];
    for (var i = 0; i < n; i++) pre.push(pre[i] + toks[i].length);
    function L(a, b) { return pre[b] - pre[a] + (b - a - 1); }
    var INF = 1e9;
    var dp = [];
    var cut = [];
    for (var j = 0; j <= k; j++) { dp.push([]); cut.push([]); for (var x = 0; x <= n; x++) { dp[j].push(INF); cut[j].push(0); } }
    dp[0][0] = 0;
    for (var l = 1; l <= k; l++) {
      for (var b = 1; b <= n; b++) {
        for (var a = l - 1; a < b; a++) {
          if (dp[l - 1][a] >= INF) continue;
          var len = L(a, b);
          // penaliza linha terminando em palavra de ligacao
          var pen = b < n && isStop(toks[b - 1]) ? 3 : 0;
          var v = Math.max(dp[l - 1][a], len + pen);
          if (v < dp[l][b]) { dp[l][b] = v; cut[l][b] = a; }
        }
      }
    }
    var out = [];
    var bb = n;
    for (var ll = k; ll >= 1; ll--) {
      var aa = cut[ll][bb];
      out.unshift(toks.slice(aa, bb).join(" "));
      bb = aa;
    }
    return out;
  }

  /** maiusculas/minusculas */
  function applyCase(text, mode) {
    switch (mode) {
      case "upper": return text.toLocaleUpperCase("pt-BR");
      case "lower": return text.toLocaleLowerCase("pt-BR");
      case "title":
        return text.toLocaleLowerCase("pt-BR").replace(/(^|[\s"'(“])(\p{L})/gu, function (m, a, b) { return a + b.toLocaleUpperCase("pt-BR"); });
      case "sentence":
        var t = text.toLocaleLowerCase("pt-BR");
        return t.replace(/(^\s*|[.!?…]\s+)(\p{L})/gu, function (m, a, b) { return a + b.toLocaleUpperCase("pt-BR"); });
      default: return text;
    }
  }

  /** escolhe a palavra-chave de uma legenda (destaque automatico) */
  function autoHighlight(words) {
    if (words.length < 2) return -1;
    var best = -1;
    var score = -1;
    for (var i = 0; i < words.length; i++) {
      var b = bare(words[i].w);
      if (!b || isStop(words[i].w)) continue;
      var sc = b.length;
      if (/\d/.test(b)) sc += 8; // numeros chamam atencao
      if (/[!?]$/.test(words[i].w)) sc += 2;
      if (/^\p{Lu}/u.test(words[i].w) && i > 0) sc += 2; // nome proprio
      if (sc > score) { score = sc; best = i; }
    }
    return score >= 4 ? best : -1;
  }

  /** palavra sem acento, minuscula, so letras e numeros (para comparar com a lista de destaques) */
  function fold(w) {
    return String(w).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  }

  /** "dinheiro, Liberdade\nsegredo" -> funcao que diz se a palavra esta na lista */
  function listMatcher(text) {
    var set = {};
    var any = false;
    String(text || "").split(/[,;\n\r]+/).forEach(function (p) {
      var k = fold(p.trim());
      if (k) { set[k] = true; any = true; }
    });
    return function (w) { return any && !!set[fold(w)]; };
  }

  /**
   * Destaques empilhados: o trecho destacado ganha uma linha so dele, entre o que vem antes e o
   * que vem depois. toks = textos das palavras; hl = flags. Retorna null se nao ha destaque.
   */
  function stackLines(toks, hl, maxChars) {
    var a = -1, b = -1;
    for (var i = 0; i < toks.length; i++) {
      if (!hl[i]) continue;
      if (a < 0) a = i;
      if (b < 0 || b === i - 1) b = i; else break;
    }
    if (a < 0) return null;
    var lines = [];
    var before = toks.slice(0, a), mid = toks.slice(a, b + 1), after = toks.slice(b + 1);
    if (before.length) lines = lines.concat(wrap(before, maxChars, 2));
    var big = lines.length;
    lines.push(mid.join(" "));
    if (after.length) lines = lines.concat(wrap(after, maxChars, 2));
    return { lines: lines, big: big };
  }

  /** texto editado de uma legenda -> novas palavras, preservando tempos quando possivel */
  function retext(caption, text) {
    var toks = tokenize(text);
    if (!toks.length) return [];
    var old = caption.words || [];
    if (old.length === toks.length) {
      var out = [];
      for (var i = 0; i < toks.length; i++) {
        out.push({ w: toks[i].w, s: old[i].s, e: old[i].e, hl: toks[i].hl, brk: old[i].brk, est: old[i].est });
      }
      return out;
    }
    var ws = distribute(toks, caption.start, caption.end);
    if (old.length && old[old.length - 1].brk) ws[ws.length - 1].brk = true;
    return ws;
  }

  /** legenda -> texto editavel (com *destaques*) */
  function editText(caption) {
    var a = [];
    for (var i = 0; i < caption.words.length; i++) {
      var w = caption.words[i];
      a.push(w.hl ? "*" + w.w + "*" : w.w);
    }
    return a.join(" ");
  }

  /** novo inicio/fim -> reescala os tempos das palavras */
  function rescale(caption, start, end) {
    var os = caption.start;
    var oe = caption.end;
    var k = oe - os > 0 ? (end - start) / (oe - os) : 0;
    for (var i = 0; i < caption.words.length; i++) {
      var w = caption.words[i];
      w.s = round3(start + (w.s - os) * k);
      w.e = round3(start + (w.e - os) * k);
      if (w.s < start) w.s = start;
      if (w.e > end) w.e = end;
    }
    caption.start = round3(start);
    caption.end = round3(end);
    return caption;
  }

  /** todas as palavras das legendas (para refazer a quebra sem perder edicoes) */
  function flatten(caps) {
    var out = [];
    for (var i = 0; i < caps.length; i++) {
      for (var k = 0; k < caps[i].words.length; k++) out.push(caps[i].words[k]);
    }
    return out;
  }

  /** valida legendas antes de gerar. Retorna lista de problemas. */
  function validate(caps, compDur) {
    var probs = [];
    for (var i = 0; i < caps.length; i++) {
      var c = caps[i];
      if (!(c.end > c.start)) probs.push("Legenda " + (i + 1) + ": fim antes do inicio.");
      if (!c.words.length) probs.push("Legenda " + (i + 1) + ": sem texto.");
      if (i && c.start < caps[i - 1].end - 0.0005) probs.push("Legendas " + i + " e " + (i + 1) + " se sobrepoem.");
      if (compDur && c.start >= compDur) probs.push("Legenda " + (i + 1) + " comeca depois do fim da composicao.");
    }
    return probs;
  }

  return {
    tokenize: tokenize,
    distribute: distribute,
    wordsFromCues: wordsFromCues,
    wordsFromSegments: wordsFromSegments,
    segment: segment,
    retime: retime,
    wrap: wrap,
    applyCase: applyCase,
    autoHighlight: autoHighlight,
    fold: fold,
    listMatcher: listMatcher,
    stackLines: stackLines,
    retext: retext,
    editText: editText,
    rescale: rescale,
    flatten: flatten,
    validate: validate,
    joinWords: joinWords,
    isStop: isStop
  };
});
