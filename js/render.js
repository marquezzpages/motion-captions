/*
 * Desenho das legendas em canvas. E a mesma regra do preview.js do Motion Captions (que monta
 * em HTML/CSS), refeita em canvas para servir igual na previa e no video exportado.
 * Tudo em pixels da composicao (1080x1920 no vertical etc.).
 */
import { resolve, cssFont } from "./fonts.js";

const MCP = window.MCP;
const E = MCP.ease;
const cl = E.cl;

/* ---------- cores ---------- */
function rgba(hex, op) {
  let h = String(hex || "#000").replace("#", "");
  if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
  const n = parseInt(h, 16) || 0;
  return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + (op == null ? 1 : op / 100) + ")";
}
/** degrade como o CSS linear-gradient(angulo do painel + 90deg) sobre o retangulo x,y,w,h */
function cssGrad(ctx, x, y, w, h, angle, stops) {
  const th = ((angle || 0) + 90) * Math.PI / 180;
  const dx = Math.sin(th), dy = -Math.cos(th);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = x + w / 2, cy = y + h / 2;
  const g = ctx.createLinearGradient(cx - dx * len / 2, cy - dy * len / 2, cx + dx * len / 2, cy + dy * len / 2);
  stops.forEach(s => g.addColorStop(s[0], s[1]));
  return g;
}
function grad2(ctx, r, c1, c2, angle, op) {
  return cssGrad(ctx, r[0], r[1], r[2], r[3], angle, [[0, rgba(c1, op)], [1, rgba(c2, op)]]);
}
/** luz na borda (faixa clara a 115 graus) */
function liteGrad(ctx, r) {
  return cssGrad(ctx, r[0], r[1], r[2], r[3], 115 - 90, [[0, "rgba(255,255,255,0)"], [0.30, "rgba(255,255,255,0)"],
    [0.41, "rgba(255,255,255,.35)"], [0.52, "rgba(255,255,255,0)"], [1, "rgba(255,255,255,0)"]]);
}
function shadowOf(sh) {
  const a = (sh.angle == null ? 135 : sh.angle) * Math.PI / 180;
  const d = sh.distance || 0;
  return { x: Math.sin(a) * d, y: -Math.cos(a) * d, blur: (sh.blur || 0) * 0.6, color: rgba(sh.color, sh.opacity) };
}

/* ---------- medida ---------- */
const mctx = document.createElement("canvas").getContext("2d");
const HAS_LS = "letterSpacing" in mctx;
const mcache = new Map();
function measure(font, text) {
  const k = font + "\u0001" + text;
  let m = mcache.get(k);
  if (!m) {
    mctx.font = font;
    if (HAS_LS) mctx.letterSpacing = "0px";
    const r = mctx.measureText(text);
    m = { w: r.width, a: r.fontBoundingBoxAscent || 0, d: r.fontBoundingBoxDescent || 0 };
    if (!m.a && !m.d) { m.a = 0; m.d = 0; }
    if (mcache.size > 20000) mcache.clear();
    mcache.set(k, m);
  }
  return m;
}
function fontMetrics(font, size) {
  const m = measure(font, "Hg");
  return { a: m.a || size * 0.92, d: m.d || size * 0.24 };
}

/** fonte de uma palavra (destaque / de cima / de baixo) */
function wordFont(style, w, baseRes, size) {
  const f = style.font, H = style.highlight;
  let res = baseRes, sz = size, track = f.tracking || 0, lhTight = false, role = null;
  if (w.r === "pre" || w.r === "post") {
    const R = style[w.r];
    if (R && R.on) {
      role = R;
      if (R.scale && R.scale !== 100) sz = size * R.scale / 100;
      if (R.tracking != null) track = R.tracking;
      if (R.font && R.font.on) res = resolve(R.font);
    }
  }
  if (w.hl && H.mode !== "none") {
    if (H.scale && H.scale !== 100) sz = size * H.scale / 100;
    if (H.tracking != null) track = H.tracking;
    if (f.tight && !(f.leading > 0)) lhTight = true;
    const look = H.font && H.font.on ? "custom" : (H.look || "same");
    if (look === "custom") res = resolve(H.font);
    else {
      res = Object.assign({}, res);
      if (look === "bold" || look === "boldItalic") res.weight = Math.min(900, Math.max(baseRes.weight + 200, 700));
      if (look === "italic" || look === "boldItalic" || (H.font && H.font.fauxItalic)) res.italic = true;
    }
  }
  return { res, size: sz, ls: track / 1000 * sz, lhTight, role };
}

/**
 * Monta a diagramacao da legenda: linhas, palavras, tamanhos. Coordenadas a partir do canto do texto.
 * Retorna { w, h (com o respiro da caixa), padX, padY, tw, th, lines, words }.
 */
export function layout(style, cap) {
  const f = style.font;
  const size = f.size || 72;
  const baseRes = resolve(f);
  const baseFont = cssFont(baseRes, size);
  const lhF = f.leading > 0 ? null : (f.tight ? 0.98 : 1.2);
  const wsp = f.wordSpacing == null ? 100 : +f.wordSpacing;
  const ls0 = (f.tracking || 0) / 1000 * size;
  const spaceW = measure(baseFont, " ").w + (wsp - 100) / 100 * 0.27 * size + ls0;
  const bm = fontMetrics(baseFont, size);
  const typew = style.anim.unit === "typewriter" || style.anim.unit === "letters";
  const words = [];
  const lines = [];
  let k = 0, y = 0, maxW = 0;
  (cap.lines || [cap.words.map(w => w.w).join(" ")]).forEach(line => {
    const toks = line.split(" ").filter(Boolean);
    const ln = { words: [], y: 0, h: 0, base: 0, width: 0 };
    let x = 0;
    // caixa de linha do CSS: cada caixa inline (com meia entrelinha) alinhada na linha de base
    const strutLh = lhF ? size * lhF : f.leading;
    let top = -(bm.a + (strutLh - (bm.a + bm.d)) / 2), bot = bm.d + (strutLh - (bm.a + bm.d)) / 2;
    toks.forEach((tk, ti) => {
      const wi = k++;
      const w = cap.words[wi] || { w: tk, s: 0, e: 0 };
      const wf = wordFont(style, w, baseRes, size);
      const font = cssFont(wf.res, wf.size);
      const m = measure(font, tk);
      const fm = fontMetrics(font, wf.size);
      const lh = wf.lhTight ? wf.size * 0.86 : (lhF ? wf.size * lhF : f.leading);
      const half = (lh - (fm.a + fm.d)) / 2;
      top = Math.min(top, -(fm.a + half));
      bot = Math.max(bot, fm.d + half);
      const width = m.w + wf.ls * tk.length;
      const W = { i: wi, text: tk, w, font, size: wf.size, ls: wf.ls, res: wf.res, role: wf.role, x, width, a: fm.a, d: fm.d, lh, half, line: lines.length };
      if (typew) {
        W.chars = [];
        for (let c = 0; c < tk.length; c++) W.chars.push(measure(font, tk.slice(0, c)).w + wf.ls * c);
      }
      words.push(W);
      ln.words.push(W);
      x += width + (ti < toks.length - 1 ? spaceW : 0);
    });
    ln.width = x;
    ln.y = y;
    ln.h = bot - top;
    ln.base = y - top;
    ln.words.forEach(W => { W.base = ln.base; W.top = ln.base - W.a - W.half; W.bh = W.lh; });
    y += ln.h;
    maxW = Math.max(maxW, x);
    lines.push(ln);
  });
  const align = f.align || "center";
  lines.forEach(ln => {
    const off = align === "left" ? 0 : (align === "right" ? maxW - ln.width : (maxW - ln.width) / 2);
    ln.x0 = off;
    ln.words.forEach(W => { W.x += off; });
  });
  const box = style.box;
  const padX = box.on ? (box.padX || 0) : 0, padY = box.on ? (box.padY || 0) : 0;
  return { w: maxW + 2 * padX, h: y + 2 * padY, padX, padY, tw: maxW, th: y, lines, words };
}

/** escada: deslocamento de cada linha (mesma regra do jsx) */
function stairOffsets(style, cap, L) {
  const H = style.highlight;
  const on = H.stair && H.mode !== "none" && cap && cap.stk != null && L.lines.length > 1;
  const out = L.lines.map(() => 0);
  if (!on) return out;
  const wd = L.lines.map(ln => ln.words.length ? ln.words[ln.words.length - 1].x + ln.words[ln.words.length - 1].width - ln.words[0].x : 0);
  const W = wd[cap.stk] || 0;
  L.lines.forEach((ln, i) => {
    const d = Math.max(0, (W - wd[i]) / 2) * (H.stairAmt == null ? 0.7 : H.stairAmt);
    out[i] = i < cap.stk ? -d : (i > cap.stk ? d : 0);
  });
  return out;
}

/** posicao e escala-base da legenda no quadro (mesma regra do place() do preview.js) */
export function placement(style, pos, comp, L, cap) {
  const W = comp.w, H = comp.h;
  const safe = (pos.safe == null ? 15 : pos.safe) / 100;
  let maxW = W * (style.font.maxWidthPct || 84) / 100;
  if (W > H * 1.1) maxW = Math.min(maxW, H * 1.15);
  if (pos.keepSafe !== false) maxW = Math.min(maxW, W * (1 - 2 * safe));
  const maxH = H * (pos.keepSafe !== false ? 1 - 2 * safe : 1) * 0.5;
  let base = 1;
  if (L.w > maxW) base = maxW / L.w;
  if (L.h * base > maxH) base = maxH / L.h;
  const sw = L.w * base, sh = L.h * base;
  let x, y;
  if (pos.anchor === "custom") x = W * pos.x / 100;
  else if (style.font.align === "left") x = W * safe + sw / 2;
  else if (style.font.align === "right") x = W * (1 - safe) - sw / 2;
  else x = W / 2;
  if (pos.anchor === "top") y = H * safe + sh / 2;
  else if (pos.anchor === "center") y = H / 2;
  else if (pos.anchor === "custom") y = H * pos.y / 100;
  else y = H * (1 - safe) - sh / 2;
  x += (pos.offX || 0) + ((cap && cap.dx) || 0);
  y += (pos.offY || 0) + ((cap && cap.dy) || 0);
  if (pos.keepSafe !== false) {
    if (sw < W * (1 - 2 * safe)) x = Math.max(W * safe + sw / 2, Math.min(W * (1 - safe) - sw / 2, x));
    if (sh < H * (1 - 2 * safe)) y = Math.max(H * safe + sh / 2, Math.min(H * (1 - safe) - sh / 2, y));
  }
  return { x, y, base, sw, sh };
}

/* ---------- estado de cada palavra no tempo t (words() do preview.js) ---------- */
function charTimes(style, cap, d) {
  const a = style.anim;
  if (a.unit !== "typewriter") return null;
  const cps = Math.max(1, a.typeCps || 28);
  let chT = [], k = 0;
  cap.words.forEach(w => {
    const n = w.w.length;
    if (a.typeSync !== false) {
      const span = Math.min(Math.max(w.e - w.s, 0.05), n / cps);
      for (let c = 0; c < n; c++) chT.push(w.s + span * c / n);
    } else for (let c = 0; c < n; c++) chT.push((k++) / cps);
  });
  const last = chT.length ? chT[chT.length - 1] : 0;
  if (last > d * 0.85 && last > 0) chT = chT.map(x => x * d * 0.85 / last);
  return chT;
}

function wordStates(style, cap, L, t) {
  const a = style.anim, kk = style.karaoke, H = style.highlight, HA = H.anim;
  const intensity = (a.intensity == null ? 100 : a.intensity) / 100;
  return L.words.map(W => {
    const w = W.w, i = W.i;
    let sc = 1, op = 1, dy = 0, dx = 0, rt = 0, bl = 0;
    if (w.hl && H.mode !== "none" && HA && HA.type && HA.type !== "same") {
      if (HA.type === "flicker") {
        op = 1 - E.flickerAmt(Math.floor((t - w.s) * 30 + 1e-6)) / 100;
      } else {
        const hp = E.hlParams(HA.type, (HA.power == null ? 100 : HA.power) / 100);
        const HD = Math.max(0, (HA.ms || 320) / 1000);
        const hpp = HD > 0 ? cl((t - w.s) / HD) : (t >= w.s ? 1 : 0);
        const hst = E.wordState(hp.type, 1 - E.ez(hpp, E.wordEase(hp.type, "out"), hp.a.ov), hp.a, 1);
        op = hst.op; sc = hst.sc; dx = hst.dx; dy = hst.dy; rt = hst.rot; bl = hst.blur;
      }
    } else if (a.unit === "word") {
      const D = Math.max(0, (a.wordMs || 160) / 1000);
      let wi = cap.wi || a.wordIn || "pop";
      if (wi === "mixed") wi = "fade";
      if (wi === "directions") wi = w.dir || "rise";
      const w0 = E.wordStart(wi, w, i);
      const p = D > 0 ? cl((t - w0) / D) : (t >= w0 ? 1 : 0);
      const amt = 1 - E.ez(p, E.wordEase(wi, a.ease), a.ov);
      const ws = E.wordState(wi, amt, a, intensity);
      op = ws.op; sc = ws.sc; dx = ws.dx; dy = ws.dy; rt = ws.rot; bl = ws.blur;
    }
    let kv = 0;
    if (kk.on) {
      const on = cl((t - w.s) / 0.05);
      const nx = cap.words[i + 1];
      const kOff = (!kk.accumulate && nx) ? cl((t - nx.s) / 0.05) : 0;
      kv = on * (1 - kOff);
      if (kk.scale !== 100) sc *= 1 + (kk.scale / 100 - 1) * kv;
    }
    return { op, sc, dx, dy, rt, bl, kv };
  });
}

/* ---------- desenho ---------- */
function setLS(ctx, px) { if (HAS_LS) ctx.letterSpacing = px.toFixed(2) + "px"; }

/** escreve uma palavra (ou letra por letra) com fill ou stroke */
function drawWordText(ctx, W, x, y, mode, charState) {
  ctx.font = W.font;
  if (charState) {
    setLS(ctx, 0);
    for (let c = 0; c < W.text.length; c++) {
      const cs = charState(c);
      if (cs.op <= 0.001) continue;
      const cx = x + W.chars[c];
      ctx.save();
      ctx.globalAlpha *= cs.op;
      if (cs.blur > 0.2) ctx.filter = "blur(" + (cs.blur * cs.k).toFixed(1) + "px)";
      if (cs.dx || cs.dy || cs.rot) {
        const cw = measure(W.font, W.text[c]).w;
        const ox = cx + cw / 2, oy = W.top + W.bh / 2;
        ctx.translate(ox + (cs.dx || 0), oy + (cs.dy || 0));
        if (cs.rot) ctx.rotate(cs.rot * Math.PI / 180);
        ctx.translate(-ox, -oy);
      }
      if (mode === "stroke") ctx.strokeText(W.text[c], cx, y); else ctx.fillText(W.text[c], cx, y);
      ctx.restore();
    }
    return;
  }
  if (!HAS_LS && Math.abs(W.ls) > 0.01) {
    for (let c = 0; c < W.text.length; c++) {
      const cx = x + measure(W.font, W.text.slice(0, c)).w + W.ls * c;
      if (mode === "stroke") ctx.strokeText(W.text[c], cx, y); else ctx.fillText(W.text[c], cx, y);
    }
    return;
  }
  setLS(ctx, W.ls);
  if (mode === "stroke") ctx.strokeText(W.text, x, y); else ctx.fillText(W.text, x, y);
}

let offA = null, offB = null;
function off(which, w, h) {
  let c = which === "A" ? offA : offB;
  if (!c) { c = document.createElement("canvas"); if (which === "A") offA = c; else offB = c; }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c;
}

/**
 * Desenha a legenda no tempo t (segundos desde o inicio dela) no contexto ctx.
 * ctx ja deve estar na escala da composicao (setTransform(k,0,0,k,0,0) para saida menor).
 * opts.scale = escala da composicao -> pixels do canvas (para sombra e desfoque).
 */
export function drawCaption(ctx, style, pos, comp, cap, t, opts) {
  opts = opts || {};
  const k0 = opts.scale || 1;
  const L = cap._L && cap._Lkey === opts.key ? cap._L : layout(style, cap);
  if (opts.key) { cap._L = L; cap._Lkey = opts.key; }
  const P = placement(style, pos, comp, L, cap);
  const d = Math.max(0.05, cap.e - cap.s);
  if (!cap._A || cap._Akey !== opts.key) {
    cap._A = E.params(cap.inT ? MCP.presets.merge(style, { anim: { inT: cap.inT } }) : style);
    cap._Akey = opts.key;
  }
  const st = t == null ? { scale: 1, opacity: cap._A.oT, dy: 0, dx: 0, rot: 0, blur: 0 } : E.state(cap._A, t, d);
  const opacity = Math.max(0, Math.min(1, st.opacity / 100));
  if (opacity <= 0.002) return;
  const tt = t == null ? 1e9 : t;
  const rot = (st.rot || 0) + ((cap && cap.rot) || 0);
  const kk = P.base * st.scale; // escala da legenda dentro da composicao
  const K = k0 * kk; // escala total em pixels do canvas
  const cw = ctx.canvas.width, ch = ctx.canvas.height;

  // matriz: centro da legenda no lugar, gira e escala; origem local = canto da legenda (com o respiro)
  function local(c) {
    c.setTransform(k0, 0, 0, k0, 0, 0);
    c.translate(P.x + (st.dx || 0), P.y + st.dy);
    if (rot) c.rotate(rot * Math.PI / 180);
    c.scale(kk, kk);
    c.translate(-L.w / 2, -L.h / 2);
  }

  const A = off("A", cw, ch).getContext("2d");
  A.setTransform(1, 0, 0, 1, 0, 0);
  A.clearRect(0, 0, cw, ch);
  local(A);

  const ws = wordStates(style, cap, L, tt);
  const so = stairOffsets(style, cap, L);
  const tx = L.padX, ty = L.padY; // canto do texto dentro da legenda

  /* caixa */
  const box = style.box;
  if (box.on) {
    let r = [0, 0, L.w, L.h];
    if (box.mode === "word") {
      let i = 0;
      for (let q = 1; q < L.words.length; q++) if (tt >= L.words[q].w.s) i = q;
      const rect = W => [tx + W.x, ty + W.top, W.width, W.bh];
      const a = rect(L.words[i]), p = rect(L.words[i > 0 ? i - 1 : 0]);
      let u = 1;
      const M = Math.max(0, (box.move == null ? 110 : box.move) / 1000);
      if (i > 0 && M > 0) { u = cl((tt - L.words[i].w.s) / M); u = 1 - Math.pow(1 - u, 3); }
      const g = j => p[j] + (a[j] - p[j]) * u;
      r = [g(0) - L.padX, g(1) - L.padY, g(2) + 2 * L.padX, g(3) + 2 * L.padY];
    }
    const rad = Math.min(box.radius || 0, r[3] / 2, r[2] / 2);
    A.save();
    A.fillStyle = box.type === "linear" ? grad2(A, r, box.color, box.color2, box.angle, box.opacity) : rgba(box.color, box.opacity);
    if (box.shadow && box.shadow.on) {
      const s = shadowOf(box.shadow);
      A.shadowColor = s.color; A.shadowBlur = s.blur * K; A.shadowOffsetX = s.x * K; A.shadowOffsetY = s.y * K;
    }
    A.beginPath(); A.roundRect(r[0], r[1], r[2], r[3], rad); A.fill();
    A.restore();
    if (box.border && box.border.on && box.border.width > 0) {
      const bw = box.border.width;
      A.save();
      A.strokeStyle = rgba(box.border.color, box.border.opacity);
      A.lineWidth = bw;
      A.beginPath(); A.roundRect(r[0] + bw / 2, r[1] + bw / 2, r[2] - bw, r[3] - bw, Math.max(0, rad - bw / 2)); A.stroke();
      A.restore();
    }
  }

  /* marca na palavra destaque */
  const H = style.highlight, M = H.mark;
  if (M && M.type && M.type !== "none" && H.mode !== "none") {
    const hw = L.words.filter(W => W.w.hl);
    if (hw.length) {
      let l = 1e9, tp = 1e9, rr = -1e9, b = -1e9, t0 = 1e9;
      hw.forEach(W => {
        const x = tx + W.x + so[W.line];
        l = Math.min(l, x); tp = Math.min(tp, ty + W.top); rr = Math.max(rr, x + W.width); b = Math.max(b, ty + W.top + W.bh);
        t0 = Math.min(t0, W.w.s);
      });
      const h = b - tp, w = rr - l;
      const dur = M.type === "tag" ? 0.12 : (M.type === "circle" ? 0.28 : 0.2);
      let u = cl((tt - t0 - (M.delay == null ? 80 : M.delay) / 1000) / dur);
      u = 1 - Math.pow(1 - u, 3);
      const sw = Math.max(4, Math.round(h * 0.07));
      A.save();
      A.fillStyle = A.strokeStyle = rgba(M.color, 100);
      if (M.type === "tag") {
        const px = h * 0.14, py = h * 0.04;
        A.fillRect(l - px, tp - py, (w + 2 * px) * u, h + 2 * py);
      } else if (M.type === "underline") {
        if (u > 0) { A.beginPath(); A.roundRect(l - h * 0.05, b + sw * 0.9, Math.max(sw, (w + h * 0.13) * u), sw, sw / 2); A.fill(); }
      } else {
        const ew = w * 1.3 + h * 0.3, eh = h * 1.45;
        A.globalAlpha = u;
        A.translate(l + w / 2, tp + h / 2);
        A.rotate(-4 * Math.PI / 180);
        A.scale(0.85 + 0.15 * u, 0.85 + 0.15 * u);
        A.lineWidth = sw;
        A.beginPath(); A.ellipse(0, 0, ew / 2 - sw / 2, eh / 2 - sw / 2, 0, 0, Math.PI * 2); A.stroke();
      }
      A.restore();
    }
  }

  /* texto: contorno (atras) e preenchimento, numa camada propria para a sombra pegar os dois */
  const B = off("B", cw, ch).getContext("2d");
  B.setTransform(1, 0, 0, 1, 0, 0);
  B.clearRect(0, 0, cw, ch);
  local(B);
  B.translate(tx, ty);
  B.textBaseline = "alphabetic";
  B.lineJoin = "round";
  B.miterLimit = 2;

  const a = style.anim;
  const chT = charTimes(style, cap, d);
  const charBase = [];
  { let acc = 0; L.words.forEach((W, j) => { charBase[j] = acc; acc += W.w.w.length; }); }
  const skipLetters = W => W.w.hl && H.mode !== "none" && H.anim && H.anim.type && H.anim.type !== "same";
  function charStateFor(W, j) {
    if (chT) return c => ({ op: tt >= chT[charBase[j] + c] ? 1 : 0, k: K });
    if (a.unit === "letters" && !skipLetters(W)) {
      const LS = Math.max(0, (a.letterStag == null ? 45 : a.letterStag) / 1000), LD = Math.max(0.01, (a.letterMs || 300) / 1000);
      return c => {
        const la = 1 - E.ez(cl((tt - (W.w.s + c * LS)) / LD), "out", 0);
        const s = E.letterState(a.letterIn || "lettersBlur", la, a);
        return { op: s.op, dx: s.dx, dy: s.dy, rot: s.rot, blur: s.blur, k: K };
      };
    }
    return null;
  }
  function wordXform(c, W, s, j) {
    const x = W.x + so[W.line];
    if (s.dx || s.dy || s.rt || s.sc !== 1) {
      const ox = x + W.width / 2, oy = W.top + W.bh * 0.6;
      c.translate(ox + s.dx, oy + s.dy);
      if (s.rt) c.rotate(s.rt * Math.PI / 180);
      if (s.sc !== 1) c.scale(s.sc, s.sc);
      c.translate(-ox, -oy);
    }
    return x;
  }

  const stroke = style.stroke;
  if (stroke.on && stroke.width > 0) {
    B.strokeStyle = rgba(stroke.color, stroke.opacity);
    B.lineWidth = stroke.width * 2;
    L.words.forEach((W, j) => {
      const s = ws[j];
      if (s.op <= 0.001) return;
      B.save();
      B.globalAlpha = s.op;
      if (s.bl > 0.2) B.filter = "blur(" + (s.bl * K).toFixed(1) + "px)";
      const x = wordXform(B, W, s, j);
      drawWordText(B, W, x, W.base, "stroke", charStateFor(W, j));
      B.restore();
    });
  }

  const fill = style.fill;
  const layerRect = [0, 0, L.tw, L.th];
  const baseFill = fill.type === "linear" ? grad2(B, layerRect, fill.color, fill.color2, fill.angle, fill.opacity) : rgba(fill.color, fill.opacity);
  L.words.forEach((W, j) => {
    const s = ws[j];
    if (s.op <= 0.001) return;
    const w = W.w;
    B.save();
    B.globalAlpha = s.op;
    if (s.bl > 0.2) B.filter = "blur(" + (s.bl * K).toFixed(1) + "px)";
    const x = wordXform(B, W, s, j);
    const wr = [x, W.top, W.width, W.bh];
    let paint = baseFill, lite = false;
    if (W.role && W.role.color) paint = rgba(W.role.color, 100);
    const isHl = w.hl && H.mode !== "none";
    const kk = style.karaoke;
    if (kk.on && s.kv > 0.5) paint = kk.type === "linear" ? grad2(B, wr, kk.color, kk.color2, kk.angle, 100) : rgba(kk.color, 100);
    else if (isHl) {
      let c2 = H.type === "linear" ? H.color2 : null;
      if (H.sweep && !c2) c2 = H.color;
      paint = c2 ? grad2(B, wr, H.color, c2, H.angle, 100) : rgba(H.color, 100);
      lite = !!H.sweep;
    }
    if (isHl && H.glow && H.glow.on) {
      B.shadowColor = rgba(H.glow.color, H.glow.opacity);
      B.shadowBlur = (H.glow.blur || 0) * 0.5 * K;
    }
    B.fillStyle = paint;
    const cs = charStateFor(W, j);
    drawWordText(B, W, x, W.base, "fill", cs);
    if (lite) {
      B.shadowColor = "transparent";
      B.fillStyle = liteGrad(B, wr);
      drawWordText(B, W, x, W.base, "fill", cs);
    }
    B.restore();
  });

  // camada do texto -> legenda, com a sombra
  A.save();
  A.setTransform(1, 0, 0, 1, 0, 0);
  if (style.shadow.on) {
    const s = shadowOf(style.shadow);
    const r = rot * Math.PI / 180;
    A.shadowColor = s.color;
    A.shadowBlur = s.blur * K;
    A.shadowOffsetX = (s.x * Math.cos(r) - s.y * Math.sin(r)) * K;
    A.shadowOffsetY = (s.x * Math.sin(r) + s.y * Math.cos(r)) * K;
  }
  A.drawImage(B.canvas, 0, 0);
  A.restore();

  // legenda -> quadro, com a opacidade e o desfoque da entrada/saida
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= opacity;
  if (st.blur > 0.2) ctx.filter = "blur(" + (st.blur * K).toFixed(1) + "px)";
  ctx.drawImage(A.canvas, 0, 0);
  ctx.restore();
}

/** retangulo da legenda no quadro (para tocar e arrastar) */
export function captionRect(style, pos, comp, cap) {
  const L = layout(style, cap);
  const P = placement(style, pos, comp, L, cap);
  return { x: P.x - P.sw / 2, y: P.y - P.sh / 2, w: P.sw, h: P.sh };
}
