/*
 * Monta um quadro do video final: imagem do clipe (enquadrada, com zoom e transicao) + legenda.
 * Usado igual na previa e na exportacao.
 */
import { drawCaption } from "./render.js";
import { segAt, capAt } from "./timeline.js";

const cl = x => x < 0 ? 0 : (x > 1 ? 1 : x);
const easeIO = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

let tmp = null;
function tmpCanvas(w, h) {
  if (!tmp) tmp = document.createElement("canvas");
  if (tmp.width !== w || tmp.height !== h) { tmp.width = w; tmp.height = h; }
  return tmp;
}

/** desenha img cobrindo (ou cabendo em) w x h, com zoom z e deslocamento */
function drawFit(ctx, img, iw, ih, w, h, z, fit, dx, dy, rot) {
  const cover = Math.max(w / iw, h / ih), contain = Math.min(w / iw, h / ih);
  if (fit === "contain") {
    // fundo: a mesma imagem ampliada e desfocada
    ctx.save();
    ctx.filter = "blur(" + Math.round(Math.max(w, h) / 40) + "px) brightness(0.6)";
    const k = cover * 1.15;
    ctx.drawImage(img, (w - iw * k) / 2, (h - ih * k) / 2, iw * k, ih * k);
    ctx.restore();
  }
  const k = (fit === "contain" ? contain : cover) * z;
  const one = (ox, oy) => {
    ctx.save();
    ctx.translate(w / 2 + ox, h / 2 + oy);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(img, -iw * k / 2, -ih * k / 2, iw * k, ih * k);
    ctx.restore();
  };
  dx = dx || 0; dy = dy || 0;
  one(dx, dy);
  // no chicote a imagem da a volta (sem faixa preta na borda)
  if (Math.abs(dx) > 1) one(dx - Math.sign(dx) * w, dy);
  if (Math.abs(dy) > 1) one(dx, dy - Math.sign(dy) * h);
}

/**
 * Desenha o quadro do tempo t no ctx (canvas do tamanho da saida).
 * R = { tl, caps, style, pos, comp, fit }; img = imagem do clipe naquele instante (video/canvas) e seu tamanho.
 */
export function drawFrame(ctx, R, t, img, iw, ih) {
  const cw = ctx.canvas.width, chh = ctx.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cw, chh);
  const seg = segAt(R.tl, t);
  if (img && seg && iw && ih) {
    const u = seg.len > 0 ? cl((t - seg.o) / seg.len) : 0;
    let z = seg.zoom * (1 + seg.push * u);
    let dx = 0, dy = 0, rot = 0, fx = null;
    // transicao: metade no fim do trecho anterior, metade no comeco do proximo
    const tr = transitionAt(R.tl, t);
    if (tr) {
      const p = tr.p; // -1..0 saindo, 0..1 entrando
      const a = 1 - Math.abs(p); // 1 no corte
      const ea = easeIO(a);
      switch (tr.type) {
        case "whip": dx = p < 0 ? -cw * 0.5 * ea : cw * 0.5 * ea; fx = { blurX: true, amt: ea }; break;
        case "whipV": dy = p < 0 ? -chh * 0.4 * ea : chh * 0.4 * ea; fx = { blurY: true, amt: ea }; break;
        case "zoom": z *= 1 + 0.6 * ea; fx = { blur: ea }; break;
        case "spin": rot = (p < 0 ? 1 : -1) * ea * 0.5; z *= 1 + 0.35 * ea; fx = { blur: ea * 0.7 }; break;
        case "flash": fx = { white: ea }; break;
        case "fade": fx = { black: ea }; break;
        case "glitch": fx = { glitch: ea, seed: Math.floor(t * 30) }; break;
      }
    }
    if (fx && (fx.blurX || fx.blurY) && fx.amt > 0.05) {
      // borrao de movimento: varias copias deslocadas
      const n = 6, span = (fx.blurX ? cw : chh) * 0.12 * fx.amt;
      ctx.globalAlpha = 1;
      drawFit(ctx, img, iw, ih, cw, chh, z, R.fit, dx, dy, rot);
      for (let i = 1; i <= n; i++) {
        ctx.globalAlpha = 0.5 / i + 0.1;
        const o = (i / n - 0.5) * span;
        drawFit(ctx, img, iw, ih, cw, chh, z, R.fit, dx + (fx.blurX ? o : 0), dy + (fx.blurY ? o : 0), rot);
      }
      ctx.globalAlpha = 1;
    } else if (fx && fx.blur && fx.blur > 0.05) {
      ctx.filter = "blur(" + (fx.blur * cw / 90).toFixed(1) + "px)";
      drawFit(ctx, img, iw, ih, cw, chh, z, R.fit, dx, dy, rot);
      ctx.filter = "none";
    } else {
      drawFit(ctx, img, iw, ih, cw, chh, z, R.fit, dx, dy, rot);
    }
    if (fx && fx.glitch > 0.05) glitch(ctx, cw, chh, fx.glitch, fx.seed);
    if (fx && fx.white > 0) { ctx.fillStyle = "rgba(255,255,255," + (fx.white * 0.95).toFixed(3) + ")"; ctx.fillRect(0, 0, cw, chh); }
    if (fx && fx.black > 0) { ctx.fillStyle = "rgba(0,0,0," + fx.black.toFixed(3) + ")"; ctx.fillRect(0, 0, cw, chh); }
  }
  // legenda
  const cap = capAt(R.caps, t);
  if (cap) {
    const k = cw / R.comp.w;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawCaption(ctx, R.style, R.pos, R.comp, cap, t - cap.s, { scale: k, key: R.key });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}

/** transicao ativa em t: { type, p } com p de -1 (inicio da saida) a 1 (fim da entrada) */
export function transitionAt(tl, t) {
  for (const c of tl.cuts) {
    if (!c.type) continue;
    const h = c.ms / 2000;
    if (t >= c.t - h && t < c.t + h) return { type: c.type, p: (t - c.t) / h };
  }
  return null;
}

/** falha digital: faixas deslocadas e canais separados */
function glitch(ctx, w, h, amt, seed) {
  const c = tmpCanvas(w, h);
  const g = c.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  g.drawImage(ctx.canvas, 0, 0);
  const rnd = i => { const x = Math.sin((seed + 1) * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); };
  const n = 7;
  for (let i = 0; i < n; i++) {
    const y = rnd(i) * h, hh = (0.02 + rnd(i + 20) * 0.08) * h;
    const off = (rnd(i + 40) - 0.5) * w * 0.18 * amt;
    ctx.drawImage(c, 0, y, w, hh, off, y, w, hh);
  }
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.45 * amt;
  ctx.filter = "hue-rotate(90deg)";
  ctx.drawImage(c, w * 0.012 * amt, 0);
  ctx.filter = "hue-rotate(-90deg)";
  ctx.drawImage(c, -w * 0.012 * amt, 0);
  ctx.restore();
}
