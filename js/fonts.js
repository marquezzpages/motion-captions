/*
 * Fontes embutidas no app (todas de licenca livre: OFL / Apache) e o tradutor dos nomes
 * usados pelos estilos do Motion Captions Pro (nomes PostScript do After Effects) para elas.
 */
const MCP = window.MCP;

/** prefixo do nome PostScript -> familia embutida */
const PS = {
  Inter: "Inter", AfxInter: "Inter", Montserrat: "Montserrat", AfxMontserrat: "Montserrat", Anton: "Anton",
  BebasNeue: "Bebas Neue", Poppins: "Poppins", DMSerifDisplay: "DM Serif Display", InstrumentSerif: "Instrument Serif",
  AfxInstrumentSerif: "Instrument Serif", PlayfairDisplay: "Playfair Display", DancingScript: "Dancing Script",
  GreatVibes: "Great Vibes", AfxGreatVibes: "Great Vibes", LuckiestGuy: "Luckiest Guy", Bangers: "Bangers", Outfit: "Outfit",
  Rubik: "Rubik", CormorantGaramond: "Cormorant Garamond", Cinzel: "Cinzel", SpaceGrotesk: "Space Grotesk", Raleway: "Raleway",
  Nunito: "Nunito", Orbitron: "Orbitron", LibreCaslonText: "Libre Caslon Text",
  // fontes do Windows (nao podem ser distribuidas): troca por uma parecida
  Arial: "Inter", ArialMT: "Inter", "Arial-BoldMT": "Inter", SegoeUI: "Inter", SegoeUIBlack: "Inter", Impact: "Anton",
  Georgia: "Playfair Display", TimesNewRomanPS: "Playfair Display", TimesNewRomanPSMT: "Playfair Display", ComicSansMS: "Bangers",
  CourierNewPS: "monospace", CourierNewPSMT: "monospace"
};
/** familia (nome visivel) -> familia embutida */
const FAM = {
  "Arial": "Inter", "Arial Black": "Inter", "Segoe UI": "Inter", "Impact": "Anton", "Georgia": "Playfair Display",
  "Times New Roman": "Playfair Display", "Courier New": "monospace", "Comic Sans MS": "Bangers", "RL Madena": "Playfair Display"
};

let LIST = [];
const families = new Set(["monospace"]);
let ready = null;

/** carrega e registra todas as fontes (uma vez) */
export function loadFonts() {
  if (ready) return ready;
  ready = fetch("fonts/fonts.json").then(r => r.json()).then(list => {
    LIST = list;
    const jobs = list.map(f => {
      families.add(f.family);
      const face = new FontFace(f.family, "url(fonts/" + encodeURIComponent(f.file) + ")", { weight: f.weight, style: f.style });
      return face.load().then(ff => { document.fonts.add(ff); }).catch(e => console.warn("fonte", f.file, e));
    });
    return Promise.all(jobs);
  });
  return ready;
}

/** familias para o seletor de fonte (Inter primeiro) */
export function familyList() {
  const out = [];
  LIST.forEach(f => { if (out.indexOf(f.family) < 0) out.push(f.family); });
  out.sort((a, b) => (a === "Inter" ? -1 : b === "Inter" ? 1 : a.localeCompare(b)));
  return out;
}

/** pesos disponiveis de uma familia (para o seletor de espessura) */
export function weightsOf(family) {
  const ws = new Set();
  LIST.filter(f => f.family === family && f.style === "normal").forEach(f => {
    const p = String(f.weight).split(" ").map(Number);
    if (p.length === 2) [300, 400, 500, 600, 700, 800, 900].forEach(w => { if (w >= p[0] && w <= p[1]) ws.add(w); });
    else ws.add(p[0]);
  });
  return Array.from(ws).sort((a, b) => a - b);
}

const WEIGHTS = [["thin", 100], ["extralight", 200], ["ultralight", 200], ["light", 300], ["regular", 400], ["book", 400], ["normal", 400],
  ["medium", 500], ["semibold", 600], ["demibold", 600], ["extrabold", 800], ["ultrabold", 800], ["black", 900], ["heavy", 900]];
export function weightOf(styleName) {
  const s = String(styleName || "").toLowerCase().replace(/[\s_-]/g, "");
  for (const [k, w] of WEIGHTS) if (s.indexOf(k) >= 0) return w;
  if (s.indexOf("bold") >= 0) return 700;
  return 400;
}
export const WEIGHT_NAMES = { 100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black" };

function fromPs(ps) {
  if (!ps) return null;
  const pre = String(ps).split("-")[0];
  const fam = PS[ps] || PS[pre];
  if (!fam) return null;
  return fam;
}

/** fonte de um estilo ({family, style, ps, fallbacks, fauxItalic}) -> {family, weight, italic} embutidos */
export function resolve(f) {
  f = f || {};
  let fam = null;
  if (f.family && families.has(f.family)) fam = f.family;
  if (!fam && f.family && FAM[f.family]) fam = FAM[f.family];
  if (!fam) fam = fromPs(f.ps);
  if (!fam) for (const p of (f.fallbacks || [])) { fam = fromPs(p); if (fam) break; }
  if (!fam) fam = "Inter";
  let weight = weightOf(f.style);
  // estilo veio do nome PostScript (ex.: "Montserrat-Black") quando o nome visivel nao diz
  if (!f.style && f.ps) weight = weightOf(String(f.ps).split("-")[1]);
  const italic = /italic|oblique/i.test(f.style || "") || /italic/i.test(f.ps || "") && !f.style || !!f.fauxItalic;
  return { family: fam, weight, italic };
}

/** string de ctx.font */
export function cssFont(r, sizePx) {
  const fam = r.family === "monospace" ? "monospace" : "\"" + r.family + "\", Inter, sans-serif";
  return (r.italic ? "italic " : "") + r.weight + " " + sizePx.toFixed(2) + "px " + fam;
}

if (MCP) MCP.fonts = { resolve, cssFont, weightOf };
