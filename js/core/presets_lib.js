/*
 * Motion Captions Pro - biblioteca de presets prontos (09 a 58), por categoria.
 * Cada preset e mesclado sobre o estilo BASE de presets.js. As fontes trazem fontes de reserva
 * que ja vem no Windows (Arial, Impact, Segoe UI, Georgia, Courier New), para funcionar em
 * qualquer computador mesmo sem as fontes do Google instaladas.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  root.MCP = root.MCP || {};
  root.MCP.presetLib = mod;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var FB = {
    heavy: ["Montserrat-Black", "SegoeUIBlack", "Arial-Black", "Impact"],
    bold: ["Montserrat-Bold", "SegoeUI-Bold", "Arial-BoldMT"],
    cond: ["BebasNeue-Regular", "Anton-Regular", "Impact", "Arial-Black"],
    serif: ["PlayfairDisplay-Bold", "Georgia-Bold", "TimesNewRomanPS-BoldMT"],
    script: ["DancingScript-Bold", "Georgia-BoldItalic", "Georgia-Bold"],
    mono: ["CourierNewPS-BoldMT", "CourierNewPSMT"],
    fun: ["LuckiestGuy-Regular", "Bangers-Regular", "ComicSansMS-Bold", "Arial-Black"]
  };

  /** fonte: ps, familia e estilo como o AE e o navegador conhecem */
  function F(ps, family, style, size, kind, extra) {
    var f = { ps: ps, family: family, style: style, size: size, fallbacks: FB[kind] || FB.bold };
    for (var k in extra || {}) f[k] = extra[k];
    return f;
  }

  var BLACK = "#000000", WHITE = "#FFFFFF", YELLOW = "#FFD60A";
  var NOSHADOW = { on: false };
  function glow(c, op, blur) { return { on: true, color: c, opacity: op, blur: blur, distance: 0 }; }
  function stroke(w, c) { return { on: true, width: w, color: c || BLACK }; }

  var C1 = "Palavra por palavra", C2 = "Fundo", C3 = "Destaque na fala", C4 = "Impacto",
    C5 = "Elegante", C6 = "Divertido", C7 = "Neon / Tech", C8 = "Destaques", C9 = "Dinâmicos", C10 = "Referências virais", C11 = "Textos virais";

  /** 3 palavras (Inter Bold 80, limpa): cada palavra entra na sua fala, todas com o mesmo movimento */
  function tres(id, name, wordIn, off) {
    return { id: id, thumb: "edite seus vídeos", name: name, cat: C11, layout: { mode: 3 },
      style: { font: F("Inter-Bold", "Inter", "Bold", 80, "bold", { tracking: -35, fallbacks: ["AfxInter-Bold", "Montserrat-Bold", "Arial-BoldMT"] }),
        shadow: { on: true, opacity: 45, blur: 16, distance: 3 },
        anim: { inT: "none", outT: "none", unit: "word", wordIn: wordIn, wordMs: 450, off: off, blur: 12 } } };
  }

  /** textos virais: texto pequeno Inter Bold, destaque gigante com degrade vertical (claro em cima) */
  var TV_SHADOW = { on: true, opacity: 40, blur: 14, distance: 3 };
  function tv(id, name, thumb, hl, extra) {
    var st = { font: F("Inter-Bold", "Inter", "Bold", 62, "bold", { caseMode: "lower", tracking: -25, tight: true, fallbacks: ["AfxInter-Bold", "Montserrat-Bold", "Arial-BoldMT"] }),
      shadow: TV_SHADOW,
      highlight: { mode: "auto", stack: true, stair: true, stairAmt: 0.9, look: "bold", scale: 270, tracking: -55, type: "linear", angle: 90 },
      anim: { inT: "none", outT: "none", unit: "word", wordIn: "blur", wordMs: 350, blur: 10 } };
    for (var k in hl) st.highlight[k] = hl[k];
    for (var e in extra || {}) st[e] = extra[e];
    return { id: id, thumb: thumb, name: name, cat: C11, layout: { mode: "auto", maxChars: 18 }, style: st };
  }
  var RL_MADENA = { on: true, ps: "RLMadena-Regular", family: "RL Madena", style: "Regular",
    fallbacks: ["RL-Madena", "PlayfairDisplay-BlackItalic", "DMSerifDisplay-Italic", "Georgia-BoldItalic"] };
  var PLAYFAIR = { on: true, ps: "PlayfairDisplay-ExtraBoldItalic", family: "Playfair Display", style: "ExtraBold Italic",
    fallbacks: ["PlayfairDisplay-BlackItalic", "DMSerifDisplay-Italic", "Georgia-BoldItalic"] };
  var CASLON = { on: true, ps: "LibreCaslonText-Italic", family: "Libre Caslon Text", style: "Italic",
    fallbacks: ["AfxLibreCaslonText-Italic", "InstrumentSerif-Italic", "Georgia-Italic"] };
  var VIBES = { on: true, ps: "GreatVibes-Regular", family: "Great Vibes", style: "Regular",
    fallbacks: ["AfxGreatVibes-Regular", "DancingScript-Bold", "Georgia-Italic"] };

  /** serifa italica pesada (a Instrument Serif e mais fina que a das referencias) */
  var SERIF_HEAVY = { on: true, ps: "DMSerifDisplay-Italic", family: "DM Serif Display", style: "Italic",
    fallbacks: ["PlayfairDisplay-BoldItalic", "PlayfairDisplay-Italic", "InstrumentSerif-Italic", "Georgia-BoldItalic", "Georgia-Italic"] };
  var LIME = "#E4FF5A", RED = "#E3000A", RED_GLOW = "#FF1F3D";
  var ITAL = ["Inter-Italic", "Montserrat-SemiBoldItalic", "Arial-BoldItalicMT", "Arial-BoldMT"];

  /** fonte de destaque em serifa italica (ultimas opcoes ja vem no Windows) */
  var SERIF_HL = { on: true, ps: "InstrumentSerif-Italic", family: "Instrument Serif", style: "Italic",
    fallbacks: ["DMSerifDisplay-Italic", "PlayfairDisplay-Italic", "CormorantGaramond-BoldItalic", "Georgia-BoldItalic", "Georgia-Italic"] };

  var LIB = [
    // ---------- palavra por palavra ----------
    { id: "w_sobe", name: "09 Sobe Palavra", cat: C1, layout: { mode: "auto", maxChars: 20 },
      style: { font: F("Poppins-ExtraBold", "Poppins", "ExtraBold", 76, "bold"), stroke: stroke(6),
        anim: { inT: "none", outT: "fade", outMs: 140, unit: "word", wordIn: "slide", wordMs: 220, off: 60, ease: "out" } } },
    { id: "w_desce", name: "10 Desce Palavra", cat: C1, layout: { mode: 3, maxChars: 18 },
      style: { font: F("Montserrat-Black", "Montserrat", "Black", 80, "heavy", { caseMode: "upper" }), stroke: stroke(7),
        anim: { inT: "none", outT: "fade", outMs: 140, unit: "word", wordIn: "slideDown", wordMs: 220, off: 60, ease: "out" } } },
    { id: "w_esq", name: "11 Entra da Esquerda", cat: C1, layout: { mode: "auto", maxChars: 22 },
      style: { font: F("Inter-ExtraBold", "Inter", "ExtraBold", 74, "bold"), stroke: stroke(5),
        anim: { inT: "none", outT: "fade", outMs: 140, unit: "word", wordIn: "fromLeft", wordMs: 240, off: 70, ease: "out" } } },
    { id: "w_dir", name: "12 Entra da Direita", cat: C1, layout: { mode: "auto", maxChars: 22 },
      style: { font: F("Inter-ExtraBold", "Inter", "ExtraBold", 74, "bold"), stroke: stroke(5),
        anim: { inT: "none", outT: "fade", outMs: 140, unit: "word", wordIn: "fromRight", wordMs: 240, off: 70, ease: "out" } } },
    { id: "w_queda", name: "13 Queda com Quique", cat: C1, thumb: "MUITO BOM", layout: { mode: 2, maxChars: 16 },
      style: { font: F("LuckiestGuy-Regular", "Luckiest Guy", "Regular", 88, "fun", { caseMode: "upper" }), stroke: stroke(8),
        anim: { inT: "none", outT: "fade", outMs: 120, unit: "word", wordIn: "drop", wordMs: 420, off: 90 } } },
    { id: "w_zoom", name: "14 Zoom Palavra", cat: C1, thumb: "MUITO BOM", layout: { mode: 2, maxChars: 14 },
      style: { font: F("Anton-Regular", "Anton", "Regular", 96, "cond", { caseMode: "upper" }), stroke: stroke(7),
        anim: { inT: "none", outT: "fade", outMs: 120, unit: "word", wordIn: "zoom", wordMs: 200, sF: 60 } } },
    { id: "w_elastico", name: "15 Elástico", cat: C1, thumb: "MUITO BOM", layout: { mode: 2, maxChars: 16 },
      style: { font: F("Rubik-Black", "Rubik", "Black", 84, "heavy"), stroke: stroke(7),
        anim: { inT: "none", outT: "fade", outMs: 120, unit: "word", wordIn: "elastic", wordMs: 520, sF: 40 } } },
    { id: "w_giro", name: "16 Giro Palavra", cat: C1, layout: { mode: 3, maxChars: 18 },
      style: { font: F("Kanit-Black", "Kanit", "Black", 82, "heavy", { caseMode: "upper" }), stroke: stroke(7),
        anim: { inT: "none", outT: "fade", outMs: 120, unit: "word", wordIn: "spin", wordMs: 260, sF: 60, rot: 20 } } },
    { id: "w_blur", name: "17 Blur Palavra", cat: C1, layout: { mode: "auto", maxChars: 22 },
      style: { font: F("Outfit-Black", "Outfit", "Black", 74, "heavy"), shadow: { on: true, opacity: 60, blur: 18, distance: 3 },
        anim: { inT: "none", outT: "fade", outMs: 160, unit: "word", wordIn: "blur", wordMs: 260, blur: 24 } } },
    { id: "w_uma", name: "18 Uma por Vez", cat: C1, thumb: "BOM", layout: { mode: 1, maxChars: 12, minDur: 0.25 },
      style: { font: F("TheBoldFont", "The Bold Font", "Bold", 120, "heavy", { caseMode: "upper" }), stroke: stroke(8),
        anim: { inT: "pop", outT: "none", inMs: 140, sF: 70, ov: 2, ease: "back" } } },
    { id: "w_duas", name: "19 Duas por Vez Pop", cat: C1, thumb: "MUITO BOM", layout: { mode: 2, maxChars: 16 },
      style: { font: F("Montserrat-Black", "Montserrat", "Black", 100, "heavy", { caseMode: "upper" }), stroke: stroke(8),
        highlight: { mode: "auto", color: YELLOW, scale: 100 },
        anim: { inT: "none", outT: "fade", outMs: 110, unit: "word", wordIn: "pop", wordMs: 160, sF: 60, ov: 2 } } },

    // ---------- fundo ----------
    { id: "b_branco", name: "20 Box Branco", cat: C2,
      style: { font: F("Poppins-Bold", "Poppins", "Bold", 64, "bold"), fill: { color: "#111111" }, shadow: NOSHADOW,
        box: { on: true, mode: "caption", color: WHITE, opacity: 100, radius: 18, padX: 30, padY: 14 },
        anim: { inT: "pop", outT: "fade", inMs: 200, outMs: 140, sF: 88, ov: 1.4 } } },
    { id: "b_verm", name: "21 Box Palavra Vermelha", cat: C2,
      style: { font: F("Montserrat-ExtraBold", "Montserrat", "ExtraBold", 68, "heavy"), shadow: NOSHADOW,
        box: { on: true, mode: "word", move: 100, color: "#FF2D2D", opacity: 100, radius: 14, padX: 14, padY: 8 },
        anim: { inT: "pop", outT: "fade", inMs: 180, outMs: 140, sF: 90, ov: 1.4 } } },
    { id: "b_verde", name: "22 Box Palavra Verde", cat: C2,
      style: { font: F("Inter-Black", "Inter", "Black", 70, "heavy", { caseMode: "upper" }), shadow: NOSHADOW,
        box: { on: true, mode: "word", move: 110, color: "#16C060", opacity: 100, radius: 12, padX: 14, padY: 8 },
        anim: { inT: "scale", outT: "fade", inMs: 200, outMs: 140, sF: 90 } } },
    { id: "b_azul", name: "23 Box Palavra Azul", cat: C2,
      style: { font: F("Poppins-ExtraBold", "Poppins", "ExtraBold", 68, "bold"), shadow: NOSHADOW,
        box: { on: true, mode: "word", move: 130, color: "#2F6BFF", opacity: 100, radius: 20, padX: 16, padY: 8 },
        anim: { inT: "slideUp", outT: "fade", inMs: 240, outMs: 140, off: 30 } } },
    { id: "b_pilula", name: "24 Pílula Escura", cat: C2,
      style: { font: F("Inter-SemiBold", "Inter", "SemiBold", 58, "bold"), shadow: NOSHADOW,
        box: { on: true, mode: "caption", color: BLACK, opacity: 70, radius: 200, padX: 40, padY: 14 },
        anim: { inT: "slideUp", outT: "fade", inMs: 260, outMs: 160, off: 30 } } },
    { id: "b_degrade", name: "25 Caixa Degradê", cat: C2,
      style: { font: F("Montserrat-ExtraBold", "Montserrat", "ExtraBold", 64, "heavy"), shadow: NOSHADOW,
        box: { on: true, mode: "caption", type: "linear", color: "#7C5CFF", color2: "#FF4FD8", angle: 0, opacity: 100, radius: 22, padX: 30, padY: 16 },
        anim: { inT: "zoom", outT: "fade", inMs: 240, outMs: 150, sF: 85 } } },
    { id: "b_etiqueta", name: "26 Etiqueta com Borda", cat: C2,
      style: { font: F("SpaceGrotesk-Bold", "Space Grotesk", "Bold", 60, "bold"), shadow: NOSHADOW,
        box: { on: true, mode: "caption", color: BLACK, opacity: 60, radius: 14, padX: 28, padY: 14, border: { on: true, width: 3, color: WHITE, opacity: 100 } },
        anim: { inT: "fromLeft", outT: "toRight", inMs: 280, outMs: 200, off: 80 } } },
    { id: "b_escura", name: "27 Box Palavra Escura", cat: C2,
      style: { font: F("Montserrat-Bold", "Montserrat", "Bold", 64, "bold"), fill: { color: "#CFCFD6" }, shadow: NOSHADOW,
        box: { on: true, mode: "word", move: 110, color: BLACK, opacity: 85, radius: 16, padX: 14, padY: 8 },
        karaoke: { on: true, color: WHITE, scale: 104, accumulate: false },
        anim: { inT: "fade", outT: "fade", inMs: 180, outMs: 140 } } },

    // ---------- destaque na fala ----------
    { id: "k_amarelo", name: "28 Karaokê Acumula", cat: C3,
      style: { font: F("Montserrat-ExtraBold", "Montserrat", "ExtraBold", 70, "heavy"), stroke: stroke(6),
        karaoke: { on: true, color: YELLOW, scale: 100, accumulate: true },
        anim: { inT: "fade", outT: "fade", inMs: 160, outMs: 140 } } },
    { id: "k_verde", name: "29 Fala Verde", cat: C3, layout: { mode: "auto", maxChars: 20 },
      style: { font: F("Poppins-Black", "Poppins", "Black", 74, "heavy", { caseMode: "upper" }), stroke: stroke(7),
        karaoke: { on: true, color: "#39FF14", scale: 112, accumulate: false },
        anim: { inT: "pop", outT: "fade", inMs: 180, outMs: 140, sF: 90 } } },
    { id: "k_rosa", name: "30 Fala Rosa", cat: C3,
      style: { font: F("Inter-Black", "Inter", "Black", 72, "heavy"), stroke: stroke(5),
        karaoke: { on: true, color: "#FF4FD8", scale: 108, accumulate: false },
        anim: { inT: "scale", outT: "fade", inMs: 200, outMs: 140, sF: 92 } } },
    { id: "k_laranja", name: "31 Fala Laranja", cat: C3, layout: { mode: 3, maxChars: 18 },
      style: { font: F("Anton-Regular", "Anton", "Regular", 90, "cond", { caseMode: "upper" }), stroke: stroke(7),
        karaoke: { on: true, color: "#FF8A00", scale: 110, accumulate: false },
        anim: { inT: "slideUp", outT: "fade", inMs: 220, outMs: 140, off: 40 } } },
    { id: "k_ciano", name: "32 Fala Ciano Neon", cat: C3,
      style: { font: F("Outfit-Black", "Outfit", "Black", 72, "heavy"), shadow: glow("#00E5FF", 80, 22),
        karaoke: { on: true, color: "#00E5FF", scale: 106, accumulate: false },
        anim: { inT: "blur", outT: "fade", inMs: 260, outMs: 160 } } },
    { id: "k_vermelho", name: "33 Fala Vermelha Pop", cat: C3, thumb: "MUITO BOM", layout: { mode: 2, maxChars: 14 },
      style: { font: F("TheBoldFont", "The Bold Font", "Bold", 92, "heavy", { caseMode: "upper" }), stroke: stroke(8),
        karaoke: { on: true, color: "#FF2D2D", scale: 116, accumulate: false },
        anim: { inT: "pop", outT: "fade", inMs: 150, outMs: 110, sF: 75, ov: 2 } } },
    { id: "k_cinza", name: "34 Cinza para Branco", cat: C3,
      style: { font: F("Inter-Bold", "Inter", "Bold", 68, "bold"), fill: { color: "#8E8E96" },
        karaoke: { on: true, color: WHITE, scale: 100, accumulate: true },
        anim: { inT: "fade", outT: "fade", inMs: 180, outMs: 140 } } },
    { id: "k_gigante", name: "35 Destaque Gigante", cat: C3, layout: { mode: 3, maxChars: 18 },
      style: { font: F("Montserrat-Black", "Montserrat", "Black", 74, "heavy", { caseMode: "upper", tracking: 40 }), stroke: stroke(7),
        karaoke: { on: true, color: YELLOW, scale: 118, accumulate: false },
        anim: { inT: "pop", outT: "fade", inMs: 170, outMs: 120, sF: 85 } } },

    // ---------- impacto ----------
    { id: "i_amarelo", name: "36 Impacto Amarelo", cat: C4, thumb: "MUITO BOM", layout: { mode: 2, maxChars: 14 },
      style: { font: F("Impact", "Impact", "Regular", 110, "cond", { caseMode: "upper" }), fill: { color: YELLOW }, stroke: stroke(8),
        anim: { inT: "pop", outT: "scale", inMs: 160, outMs: 120, sF: 60, ov: 2.4, sOut: 85 } } },
    { id: "i_bebas", name: "37 Bebas Cinema", cat: C4, layout: { mode: 3, maxChars: 18 },
      style: { font: F("BebasNeue-Regular", "Bebas Neue", "Regular", 130, "cond", { caseMode: "upper", tracking: 20 }),
        shadow: { on: true, opacity: 70, blur: 20, distance: 6 },
        anim: { inT: "slideUp", outT: "fade", inMs: 300, outMs: 160, off: 60, ease: "back", ov: 1.4 } } },
    { id: "i_anton", name: "38 Anton Contorno", cat: C4, thumb: "MUITO BOM", layout: { mode: 2, maxChars: 14 },
      style: { font: F("Anton-Regular", "Anton", "Regular", 104, "cond", { caseMode: "upper" }), stroke: stroke(10), shadow: NOSHADOW,
        anim: { inT: "zoom", outT: "fade", inMs: 200, outMs: 120, sF: 70 } } },
    { id: "i_viral", name: "39 Viral Verde", cat: C4, thumb: "MUITO BOM", layout: { mode: 2, maxChars: 14 },
      style: { font: F("TheBoldFont", "The Bold Font", "Bold", 100, "heavy", { caseMode: "upper" }), stroke: stroke(9),
        highlight: { mode: "auto", color: "#3CFF5A", scale: 100 },
        anim: { inT: "bounce", outT: "fade", inMs: 420, outMs: 110, sF: 55 } } },
    { id: "i_alerta", name: "40 Alerta Vermelho", cat: C4, layout: { mode: 3, maxChars: 16 },
      style: { font: F("ArchivoBlack-Regular", "Archivo Black", "Regular", 86, "heavy", { caseMode: "upper" }), shadow: NOSHADOW,
        box: { on: true, mode: "caption", color: "#E11D2E", opacity: 100, radius: 10, padX: 26, padY: 12 },
        anim: { inT: "spin", outT: "scale", inMs: 260, outMs: 140, sF: 70, rot: 8, ease: "back", ov: 1.6 } } },
    { id: "i_queda", name: "41 Queda Pesada", cat: C4, layout: { mode: 3, maxChars: 18 },
      style: { font: F("LeagueSpartan-Black", "League Spartan", "Black", 96, "heavy", { caseMode: "upper" }), stroke: stroke(7),
        anim: { inT: "drop", outT: "fade", inMs: 600, outMs: 140, off: 140 } } },
    { id: "i_choque", name: "42 Choque", cat: C4, thumb: "MUITO BOM", layout: { mode: 2, maxChars: 14 },
      style: { font: F("Poppins-Black", "Poppins", "Black", 96, "heavy", { caseMode: "upper" }), stroke: stroke(7),
        anim: { inT: "bounce", outT: "zoom", inMs: 500, outMs: 140, sF: 50, sOut: 80 } } },

    // ---------- elegante ----------
    { id: "e_playfair", name: "43 Playfair Itálico", cat: C5, layout: { mode: "sentence", maxChars: 30 },
      style: { font: F("PlayfairDisplay-BlackItalic", "Playfair Display", "Black Italic", 72, "serif"),
        shadow: { on: true, opacity: 55, blur: 22, distance: 2 },
        anim: { inT: "blur", outT: "fade", inMs: 600, outMs: 400, ease: "inout", blur: 20 } } },
    { id: "e_serifa", name: "44 Serifa Minimal", cat: C5, layout: { mode: "sentence", maxChars: 30 },
      style: { font: F("DMSerifDisplay-Regular", "DM Serif Display", "Regular", 70, "serif", { tracking: 10 }),
        shadow: { on: true, opacity: 50, blur: 20, distance: 0 },
        anim: { inT: "fade", outT: "fade", inMs: 500, outMs: 400, ease: "inout" } } },
    { id: "e_cinzel", name: "45 Cinzel Épico", cat: C5, layout: { mode: "sentence", maxChars: 26 },
      style: { font: F("Cinzel-Regular", "Cinzel", "Regular", 64, "serif", { caseMode: "upper", tracking: 120 }),
        shadow: { on: true, opacity: 75, blur: 26, distance: 0 },
        anim: { inT: "zoom", outT: "fade", inMs: 900, outMs: 450, sF: 92, ease: "inout" } } },
    { id: "e_dourado", name: "46 Script Dourado", cat: C5, layout: { mode: "auto", maxChars: 22 },
      style: { font: F("DancingScript-Bold", "Dancing Script", "Bold", 88, "script"),
        fill: { type: "linear", color: "#FFF1C1", color2: "#D4A24C", angle: 90 },
        shadow: { on: true, opacity: 60, blur: 16, distance: 3 },
        anim: { inT: "slideUp", outT: "fade", inMs: 500, outMs: 350, off: 26, ease: "inout" } } },
    { id: "e_minusculo", name: "47 Inter Minúsculo", cat: C5,
      style: { font: F("Inter-SemiBold", "Inter", "SemiBold", 62, "bold", { caseMode: "lower" }),
        shadow: { on: true, opacity: 45, blur: 18, distance: 2 },
        anim: { inT: "slideUp", outT: "fade", inMs: 400, outMs: 250, off: 24, ease: "inout" } } },
    { id: "e_raleway", name: "48 Raleway Espaçado", cat: C5, layout: { mode: "auto", maxChars: 20 },
      style: { font: F("Raleway-ExtraBold", "Raleway", "ExtraBold", 60, "bold", { caseMode: "upper", tracking: 60 }),
        shadow: { on: true, opacity: 50, blur: 16, distance: 2 },
        anim: { inT: "fromLeft", outT: "fade", inMs: 500, outMs: 300, off: 40, ease: "inout" } } },

    // ---------- divertido ----------
    { id: "d_quadrinho", name: "49 Quadrinho", cat: C6, thumb: "MUITO BOM", layout: { mode: 2, maxChars: 14 },
      style: { font: F("Bangers-Regular", "Bangers", "Regular", 96, "fun", { caseMode: "upper", tracking: 20 }),
        fill: { color: YELLOW }, stroke: stroke(8),
        anim: { inT: "bounce", outT: "fade", inMs: 450, outMs: 120, sF: 40 } } },
    { id: "d_komika", name: "50 Komika Elástico", cat: C6, layout: { mode: 3, maxChars: 18 },
      style: { font: F("KomikaAxis", "Komika Axis", "Regular", 78, "fun", { caseMode: "upper" }), stroke: stroke(7),
        anim: { inT: "none", outT: "fade", outMs: 120, unit: "word", wordIn: "elastic", wordMs: 480, sF: 45 } } },
    { id: "d_lilita", name: "51 Lilita Doce", cat: C6, thumb: "MUITO BOM", layout: { mode: 2, maxChars: 14 },
      style: { font: F("LilitaOne", "Lilita One", "Regular", 88, "fun"), fill: { color: "#FF6FB5" }, stroke: stroke(8, WHITE),
        shadow: { on: true, opacity: 40, blur: 12, distance: 5 },
        anim: { inT: "pop", outT: "fade", inMs: 200, outMs: 120, sF: 60, ov: 2.5 } } },
    { id: "d_luckiest", name: "52 Luckiest Laranja", cat: C6, thumb: "MUITO BOM", layout: { mode: 2, maxChars: 14 },
      style: { font: F("LuckiestGuy-Regular", "Luckiest Guy", "Regular", 90, "fun", { caseMode: "upper" }),
        fill: { color: "#FF8A00" }, stroke: stroke(9),
        anim: { inT: "none", outT: "fade", outMs: 120, unit: "word", wordIn: "drop", wordMs: 420, off: 80 } } },
    { id: "d_arcoiris", name: "53 Arco-íris", cat: C6, layout: { mode: 3, maxChars: 18 },
      style: { font: F("Rubik-Black", "Rubik", "Black", 86, "heavy"), fill: { type: "linear", color: "#FF4FD8", color2: YELLOW, angle: 0 },
        shadow: { on: true, color: BLACK, opacity: 70, blur: 10, distance: 5 },
        anim: { inT: "spin", outT: "fade", inMs: 320, outMs: 140, sF: 70, rot: 16, ease: "back" } } },
    { id: "d_fofo", name: "54 Nunito Fofo", cat: C6,
      style: { font: F("Nunito-Black", "Nunito", "Black", 76, "heavy"), shadow: NOSHADOW,
        box: { on: true, mode: "caption", color: "#FF8FC7", opacity: 100, radius: 60, padX: 34, padY: 14 },
        anim: { inT: "bounce", outT: "scale", inMs: 450, outMs: 140, sF: 60 } } },

    // ---------- neon / tech ----------
    { id: "n_ciano", name: "55 Neon Ciano", cat: C7,
      style: { font: F("Outfit-Black", "Outfit", "Black", 78, "heavy"), fill: { color: "#E9FFFF" }, shadow: glow("#00E5FF", 95, 28),
        anim: { inT: "blur", outT: "fade", inMs: 280, outMs: 160, blur: 22 } } },
    { id: "n_rosa", name: "56 Neon Rosa", cat: C7, layout: { mode: "auto", maxChars: 20 },
      style: { font: F("Montserrat-ExtraBold", "Montserrat", "ExtraBold", 76, "heavy"), fill: { color: "#FFE6F7" }, shadow: glow("#FF2BD6", 95, 28),
        anim: { inT: "none", outT: "fade", outMs: 150, unit: "word", wordIn: "fade", wordMs: 200 } } },
    { id: "n_orbitron", name: "57 Orbitron Tech", cat: C7, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Orbitron-Black", "Orbitron", "Black", 62, "heavy", { caseMode: "upper", tracking: 60 }),
        fill: { type: "linear", color: "#00E5FF", color2: "#7C5CFF", angle: 0 }, shadow: glow("#00E5FF", 60, 20),
        anim: { inT: "none", outT: "fade", outMs: 150, unit: "typewriter", typeCps: 34, typeSync: true } } },
    { id: "n_terminal", name: "58 Terminal Verde", cat: C7,
      style: { font: F("CourierNewPS-BoldMT", "Courier New", "Bold", 60, "mono"), fill: { color: "#39FF14" }, shadow: glow("#39FF14", 80, 18),
        anim: { inT: "none", outT: "fade", outMs: 150, unit: "typewriter", typeCps: 32, typeSync: true } } },

    // ---- Destaques: fonte propria, degrade, empilhado, Misto e Blur up (v1.4) ----
    { id: "d_emp_serifa", thumb: "o segredo real", name: "59 Empilhado Serifa", cat: C8, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Montserrat-SemiBold", "Montserrat", "SemiBold", 60, "bold", { caseMode: "lower" }),
        shadow: { on: true, opacity: 55, blur: 18, distance: 2 },
        highlight: { anim: { type: "rise", ms: 420 }, mode: "auto", every: 0, stack: true, scale: 185, color: YELLOW, type: "solid", font: SERIF_HL },
        anim: { inT: "none", outT: "blur", outMs: 180, blur: 16, unit: "word", wordIn: "fade", wordMs: 200 } } },
    { id: "d_emp_degrade", thumb: "O SEGREDO REAL", name: "60 Empilhado Degradê", cat: C8, layout: { mode: "auto", maxChars: 16 },
      style: { font: F("Montserrat-Black", "Montserrat", "Black", 64, "heavy", { caseMode: "upper" }),
        shadow: { on: true, opacity: 60, blur: 16, distance: 3 },
        highlight: { anim: { type: "slam", ms: 300 }, mode: "auto", stack: true, scale: 165, type: "linear", color: "#FF2BD6", color2: "#7C5CFF", angle: 0 },
        anim: { inT: "none", outT: "fade", outMs: 140, unit: "word", wordIn: "blurUp", wordMs: 260, off: 50, blur: 20 } } },
    { id: "d_dourada", thumb: "ISSO MUDA", name: "61 Palavra Dourada", cat: C8, layout: { mode: "auto", maxChars: 20 },
      style: { font: F("Montserrat-ExtraBold", "Montserrat", "ExtraBold", 74, "heavy", { caseMode: "upper" }), stroke: stroke(6),
        shadow: { on: true, opacity: 50, blur: 10, distance: 4 },
        highlight: { anim: { type: "pop", ms: 260 }, mode: "auto", scale: 122, type: "linear", color: "#FFF1A8", color2: "#FF9F1C", angle: 90 },
        anim: { inT: "none", outT: "fade", outMs: 120, unit: "word", wordIn: "pop", wordMs: 170, sF: 70 } } },
    { id: "d_italico", thumb: "isso muda tudo", name: "62 Itálico Elegante", cat: C8, layout: { mode: "auto", maxChars: 24 },
      style: { font: F("Inter-SemiBold", "Inter", "SemiBold", 62, "bold", { caseMode: "lower" }),
        shadow: { on: true, opacity: 50, blur: 20, distance: 0 },
        highlight: { anim: { type: "blurUp", ms: 420 }, mode: "auto", scale: 140, color: "#FFD27A", type: "solid", font: SERIF_HL },
        anim: { inT: "none", outT: "fade", outMs: 180, unit: "word", wordIn: "fade", wordMs: 240 } } },
    { id: "d_misto", thumb: "OLHA ISSO", name: "63 Misto Viral", cat: C8, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Montserrat-ExtraBold", "Montserrat", "ExtraBold", 76, "heavy", { caseMode: "upper" }), stroke: stroke(6),
        shadow: { on: true, opacity: 45, blur: 10, distance: 4 },
        highlight: { anim: { type: "slam", ms: 280 }, mode: "auto", scale: 116, color: YELLOW },
        anim: { inT: "none", outT: "fade", outMs: 120, unit: "word", wordIn: "mixed", wordMs: 240, off: 46, blur: 18 } } },
    { id: "d_blurup", thumb: "Legenda pro", name: "64 Blur Up", cat: C8, layout: { mode: "auto", maxChars: 22 },
      style: { font: F("Inter-Bold", "Inter", "Bold", 66, "bold"), shadow: { on: true, opacity: 45, blur: 16, distance: 2 },
        highlight: { mode: "auto", scale: 112, color: "#00E5FF" },
        anim: { inT: "none", outT: "blur", outMs: 200, blur: 22, unit: "word", wordIn: "blurUp", wordMs: 320, off: 44 } } },
    { id: "d_kara_degrade", thumb: "OLHA ISSO", name: "65 Karaokê Degradê", cat: C8, layout: { mode: "auto", maxChars: 20 },
      style: { font: F("Montserrat-Black", "Montserrat", "Black", 76, "heavy", { caseMode: "upper" }), stroke: stroke(6),
        karaoke: { on: true, type: "linear", color: "#00F5A0", color2: "#00B4FF", angle: 90, scale: 112 },
        anim: { inT: "pop", outT: "fade", inMs: 160, outMs: 140, sF: 90 } } },
    { id: "d_bounce", thumb: "ISSO MUDA", name: "66 Bounce Destaque", cat: C8, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Montserrat-Black", "Montserrat", "Black", 72, "heavy", { caseMode: "upper" }), stroke: stroke(6),
        highlight: { anim: { type: "elastic", ms: 560 }, mode: "auto", scale: 135, type: "linear", color: "#FF5A5A", color2: "#FFB800", angle: 90,
          font: { on: true, ps: "Anton-Regular", family: "Anton", style: "Regular", fallbacks: ["BebasNeueBold", "BebasNeue-Regular", "Impact"] } },
        anim: { inT: "none", outT: "fade", outMs: 120, unit: "word", wordIn: "elastic", wordMs: 420 } } },

    // ---- v1.4: mesma fonte (so cor, negrito, italico), serifa com degrade e modo dinamico ----
    { id: "d_so_cor", thumb: "ISSO MUDA", name: "67 Só a Cor", cat: C8, layout: { mode: "auto", maxChars: 20 },
      style: { font: F("Montserrat-Bold", "Montserrat", "Bold", 70, "bold", { caseMode: "upper" }), shadow: { on: true, opacity: 50, blur: 12, distance: 3 },
        highlight: { mode: "auto", look: "same", color: YELLOW, scale: 112, anim: { type: "pop", ms: 240 } },
        anim: { inT: "none", outT: "fade", outMs: 140, unit: "word", wordIn: "fade", wordMs: 200 } } },
    { id: "d_negrito", thumb: "isso muda tudo", name: "68 Negrito na Palavra", cat: C8, layout: { mode: "auto", maxChars: 24 },
      style: { font: F("Montserrat-Regular", "Montserrat", "Regular", 64, "bold", { caseMode: "lower" }), fill: { color: "#D6D6D6" },
        shadow: { on: true, opacity: 55, blur: 16, distance: 2 },
        highlight: { mode: "auto", look: "bold", color: WHITE, scale: 122, anim: { type: "slam", ms: 260 } },
        anim: { inT: "none", outT: "fade", outMs: 160, unit: "word", wordIn: "fade", wordMs: 220 } } },
    { id: "d_italico_mesma", thumb: "isso muda tudo", name: "69 Itálico na Palavra", cat: C8, layout: { mode: "auto", maxChars: 24 },
      style: { font: F("Inter-SemiBold", "Inter", "SemiBold", 64, "bold", { caseMode: "lower" }), shadow: { on: true, opacity: 50, blur: 18, distance: 0 },
        highlight: { mode: "auto", look: "italic", color: "#FFD27A", scale: 118, anim: { type: "blurUp", ms: 380 } },
        anim: { inT: "none", outT: "fade", outMs: 160, unit: "word", wordIn: "fade", wordMs: 220 } } },
    { id: "d_serifa_degrade", thumb: "o segredo real", name: "70 Serifa Degradê", cat: C8, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Montserrat-SemiBold", "Montserrat", "SemiBold", 62, "bold", { caseMode: "lower" }), shadow: { on: true, opacity: 55, blur: 18, distance: 2 },
        highlight: { mode: "auto", stack: true, scale: 160, type: "linear", color: "#FFE29F", color2: "#FF719A", angle: 0, font: SERIF_HL,
          anim: { type: "rise", ms: 420 } },
        anim: { inT: "none", outT: "blur", outMs: 180, blur: 16, unit: "word", wordIn: "fade", wordMs: 200 } } },
    { id: "d_serifa_dourada", thumb: "isso muda tudo", name: "71 Serifa Dourada", cat: C8, layout: { mode: "auto", maxChars: 24 },
      style: { font: F("Inter-SemiBold", "Inter", "SemiBold", 62, "bold", { caseMode: "lower" }), shadow: { on: true, opacity: 50, blur: 20, distance: 0 },
        highlight: { mode: "auto", scale: 145, type: "linear", color: "#FFF3B0", color2: "#E0A526", angle: 90, font: SERIF_HL, anim: { type: "fade", ms: 360 } },
        anim: { inT: "none", outT: "fade", outMs: 180, unit: "word", wordIn: "blurUp", wordMs: 300, off: 36 } } },
    { id: "d_negrito_degrade", thumb: "ISSO MUDA", name: "72 Negrito Degradê", cat: C8, layout: { mode: "auto", maxChars: 22 },
      style: { font: F("Montserrat-Medium", "Montserrat", "Medium", 64, "bold", { caseMode: "upper" }), shadow: { on: true, opacity: 50, blur: 14, distance: 3 },
        highlight: { mode: "auto", look: "bold", scale: 128, type: "linear", color: "#00F5A0", color2: "#00B4FF", angle: 0, anim: { type: "slam", ms: 280 } },
        anim: { inT: "none", outT: "fade", outMs: 140, unit: "word", wordIn: "fade", wordMs: 200 } } },
    { id: "y_viral", thumb: "OLHA ISSO", name: "73 Dinâmico Viral", cat: C9, layout: { mode: "auto", maxChars: 16 },
      style: { font: F("Montserrat-ExtraBold", "Montserrat", "ExtraBold", 76, "heavy", { caseMode: "upper" }), stroke: stroke(6),
        shadow: { on: true, opacity: 45, blur: 10, distance: 4 },
        highlight: { mode: "auto", look: "bold", color: YELLOW, scale: 125, anim: { type: "slam", ms: 260 } },
        anim: { inT: "none", outT: "fade", outMs: 120, unit: "word", wordIn: "pop", wordMs: 180,
          dyn: { on: true, pattern: "alternate", x: 80, y: 140, rot: 5, mixIn: true } } } },
    { id: "y_empilhado", thumb: "o segredo real", name: "74 Dinâmico Empilhado", cat: C9, layout: { mode: "auto", maxChars: 16 },
      style: { font: F("Montserrat-SemiBold", "Montserrat", "SemiBold", 60, "bold", { caseMode: "lower" }), shadow: { on: true, opacity: 55, blur: 18, distance: 2 },
        highlight: { mode: "auto", stack: true, scale: 165, type: "linear", color: "#FFD60A", color2: "#FF6A00", angle: 90, font: SERIF_HL,
          anim: { type: "rise", ms: 420 } },
        anim: { inT: "pop", outT: "blur", inMs: 260, outMs: 180, blur: 16, sF: 88,
          dyn: { on: true, pattern: "random", x: 90, y: 160, rot: 4, mixIn: true } } } },
    { id: "y_clean", thumb: "isso muda tudo", name: "75 Dinâmico Clean", cat: C9, layout: { mode: "auto", maxChars: 22 },
      style: { font: F("Inter-SemiBold", "Inter", "SemiBold", 62, "bold", { caseMode: "lower" }), shadow: { on: true, opacity: 50, blur: 16, distance: 2 },
        highlight: { mode: "auto", look: "italic", color: "#7FE7FF", scale: 120, anim: { type: "elastic", ms: 520 } },
        anim: { inT: "none", outT: "fade", outMs: 160, unit: "word", wordIn: "blurUp", wordMs: 300,
          dyn: { on: true, pattern: "alternate", x: 60, y: 120, rot: 3, mixIn: false } } } },
    { id: "y_impacto", thumb: "ISSO MUDA", name: "76 Impacto na Palavra", cat: C9, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Montserrat-Black", "Montserrat", "Black", 70, "heavy", { caseMode: "upper" }), stroke: stroke(6),
        highlight: { mode: "auto", scale: 140, type: "linear", color: "#FF3B3B", color2: "#FFB800", angle: 90,
          font: { on: true, ps: "Anton-Regular", family: "Anton", style: "Regular", fallbacks: ["BebasNeueBold", "BebasNeue-Regular", "Impact"] },
          anim: { type: "slam", ms: 300, power: 130 } },
        anim: { inT: "none", outT: "fade", outMs: 120, unit: "word", wordIn: "fade", wordMs: 160,
          dyn: { on: true, pattern: "alternate", x: 50, y: 90, rot: 4, mixIn: false } } } },

    // ---- Referencias virais (Estilo/ESTILO-LEGENDAS-DINAMICAS.md): neon limao, legenda no peito,
    //      escada azul, vermelho com brilho e editorial vermelho ----
    { id: "r_neon", thumb: "o segredo real", name: "77 Neon Limão", cat: C10, layout: { mode: "auto", maxChars: 16 },
      style: { font: F("Inter-Bold", "Inter", "Bold", 54, "bold", { caseMode: "lower", tracking: -20, tight: true }),
        shadow: { on: true, opacity: 45, blur: 14, distance: 0 },
        highlight: { mode: "auto", stack: true, look: "bold", scale: 185, tracking: -40, color: LIME,
          glow: { on: true, color: LIME, opacity: 70, blur: 32 }, anim: { type: "focus", ms: 170 } },
        anim: { inT: "none", outT: "none", unit: "word", wordIn: "fade", wordMs: 120 } } },
    { id: "r_neon_escada", thumb: "o segredo real", name: "78 Neon Limão Escada", cat: C10, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Inter-Bold", "Inter", "Bold", 54, "bold", { caseMode: "lower", tracking: -20, tight: true }),
        shadow: { on: true, opacity: 45, blur: 14, distance: 0 },
        highlight: { mode: "auto", stack: true, stair: true, look: "bold", scale: 185, tracking: -40, color: LIME,
          glow: { on: true, color: LIME, opacity: 70, blur: 32 }, anim: { type: "focus", ms: 170 } },
        anim: { inT: "none", outT: "none", unit: "word", wordIn: "fade", wordMs: 120 } } },
    { id: "r_peito", thumb: "o segredo real", name: "79 Peito Serifa", cat: C10, layout: { mode: "auto", maxChars: 16 },
      style: { font: F("Inter-Bold", "Inter", "Bold", 66, "bold", { caseMode: "lower", tracking: -30, tight: true }),
        shadow: { on: true, opacity: 60, blur: 8, distance: 3 },
        highlight: { mode: "auto", stack: true, stair: true, scale: 140, color: WHITE, font: SERIF_HEAVY, anim: { type: "rise", ms: 260 } },
        anim: { inT: "none", outT: "blur", outMs: 160, blur: 14, unit: "word", wordIn: "blurUp", wordMs: 230, off: 30 } } },
    { id: "r_peito_oval", thumb: "isso leva tempo", name: "80 Peito Simples", cat: C10, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Inter-Bold", "Inter", "Bold", 66, "bold", { caseMode: "lower", tracking: -30, tight: true }),
        shadow: { on: true, opacity: 60, blur: 8, distance: 3 },
        highlight: { mode: "auto", look: "bold", scale: 120, color: WHITE, anim: { type: "rise", ms: 240 } },
        anim: { inT: "none", outT: "blur", outMs: 160, blur: 14, unit: "word", wordIn: "blurUp", wordMs: 230, off: 30 } } },
    { id: "r_peito_tarja", thumb: "não faz isso", name: "81 Peito Tarja", cat: C10, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Inter-Bold", "Inter", "Bold", 66, "bold", { caseMode: "lower", tracking: -30, tight: true }),
        shadow: { on: true, opacity: 60, blur: 8, distance: 3 },
        highlight: { mode: "auto", look: "bold", color: WHITE, mark: { type: "tag", color: RED, delay: 170 } },
        anim: { inT: "none", outT: "blur", outMs: 160, blur: 14, unit: "word", wordIn: "blurUp", wordMs: 230, off: 30 } } },
    { id: "r_azul_escada", thumb: "anyone CAN RUN", name: "82 Azul Escada", cat: C10, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Inter-SemiBold", "Inter", "SemiBold", 52, "bold", { caseMode: "lower", tracking: -20, tight: true }),
        shadow: { on: true, opacity: 45, blur: 18, distance: 2 },
        highlight: { mode: "auto", stack: true, stair: true, look: "bold", caseMode: "upper", scale: 185, tracking: -50,
          type: "linear", color: "#6FD0FF", color2: "#1E6BFF", angle: 90, anim: { type: "slam", ms: 240 } },
        anim: { inT: "none", outT: "fade", outMs: 100, unit: "word", wordIn: "pop", wordMs: 160, sF: 80 } } },
    { id: "r_contraste", thumb: "over 300 brokers", name: "83 Contraste de Tamanho", cat: C10, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Inter-SemiBold", "Inter", "SemiBold", 54, "bold", { caseMode: "lower", tracking: -20, tight: true }),
        shadow: { on: true, opacity: 50, blur: 16, distance: 2 },
        highlight: { mode: "auto", look: "bold", scale: 160, tracking: -45, color: WHITE, anim: { type: "pop", ms: 220 } },
        anim: { inT: "none", outT: "fade", outMs: 100, unit: "word", wordIn: "pop", wordMs: 150, sF: 82 } } },
    { id: "r_vermelho_glow", thumb: "Because content", name: "84 Vermelho Brilho", cat: C10, layout: { mode: "auto", maxChars: 20 },
      style: { font: F("Inter-SemiBold", "Inter", "SemiBold", 56, "bold", { tracking: -20 }), shadow: { on: false },
        highlight: { mode: "auto", look: "bold", scale: 150, tracking: -40, color: RED_GLOW,
          glow: { on: true, color: RED_GLOW, opacity: 80, blur: 34 }, anim: { type: "focus", ms: 200 } },
        anim: { inT: "none", outT: "blur", outMs: 160, blur: 16, unit: "word", wordIn: "blur", wordMs: 200 } } },
    { id: "r_vermelho_claro", thumb: "It rewards strategy", name: "85 Vermelho Fundo Claro", cat: C10, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Inter-SemiBold", "Inter", "SemiBold", 56, "bold", { tracking: -20, tight: true }), fill: { color: "#141414" }, shadow: { on: false },
        highlight: { mode: "auto", stack: true, look: "bold", scale: 155, tracking: -40, color: "#E8112D", anim: { type: "pop", ms: 220 } },
        anim: { inT: "none", outT: "blur", outMs: 160, blur: 14, unit: "word", wordIn: "blurUp", wordMs: 220, off: 30 } } },
    { id: "r_editorial", thumb: "they THINK", name: "86 Editorial Vermelho", cat: C10, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Inter-Italic", "Inter", "Italic", 54, "bold", { caseMode: "lower", tracking: -20, tight: true, fallbacks: ITAL }),
        shadow: { on: true, opacity: 40, blur: 16, distance: 2 },
        highlight: { mode: "auto", stack: true, stair: true, look: "bold", caseMode: "upper", scale: 165, tracking: -30, color: RED,
          anim: { type: "slam", ms: 240 } },
        anim: { inT: "none", outT: "fade", outMs: 120, unit: "word", wordIn: "fade", wordMs: 160,
          dyn: { on: true, pattern: "alternate", x: 110, y: 200, rot: 0, mixIn: false } } } },
    { id: "r_editorial_tarja", thumb: "wasting money", name: "87 Editorial Tarja", cat: C10, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Inter-Italic", "Inter", "Italic", 54, "bold", { caseMode: "lower", tracking: -20, fallbacks: ITAL }),
        shadow: { on: true, opacity: 40, blur: 16, distance: 2 },
        highlight: { mode: "auto", look: "bold", caseMode: "lower", color: WHITE, mark: { type: "tag", color: RED, delay: 60 },
          anim: { type: "pop", ms: 200 } },
        anim: { inT: "none", outT: "fade", outMs: 120, unit: "word", wordIn: "fade", wordMs: 160 } } },
    { id: "r_sublinhado", thumb: "weeks ago", name: "88 Negrito Suave", cat: C10, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Inter-SemiBold", "Inter", "SemiBold", 54, "bold", { caseMode: "lower", tracking: -20 }),
        shadow: { on: true, opacity: 50, blur: 14, distance: 2 },
        highlight: { mode: "auto", look: "bold", scale: 115, color: WHITE, anim: { type: "rise", ms: 240 } },
        anim: { inT: "none", outT: "fade", outMs: 140, unit: "word", wordIn: "blurUp", wordMs: 220, off: 26 } } },
    { id: "r_peito_negrito", thumb: "isso muda tudo", name: "89 Peito Negrito", cat: C10, layout: { mode: "auto", maxChars: 18 },
      style: { font: F("Inter-Bold", "Inter", "Bold", 66, "bold", { caseMode: "lower", tracking: -30, tight: true }),
        shadow: { on: true, opacity: 60, blur: 8, distance: 3 },
        highlight: { mode: "auto", look: "bold", color: WHITE },
        anim: { inT: "none", outT: "blur", outMs: 160, blur: 14, unit: "word", wordIn: "blurUp", wordMs: 230, off: 30 } } },

    // ---- Textos virais (Estilo/ESTILO-LEGENDAS-DINAMICAS.md): destaque gigante em degrade, escada encostada ----
    tv("t_halo", "90 Halo Azul", "o segredo real", { color: "#79A6FF", color2: "#1F4DFF", sweep: true }),
    tv("t_ponto", "91 Ponto Final", "seja constante", { color: "#FFF07A", color2: "#FFC400", period: true }),
    tv("t_embaixo", "92 Laranja", "o segredo real", { color: "#FFB36B", color2: "#FF5A00", sweep: true }),
    tv("t_serifa", "93 Serifa Rosa", "o segredo real", { look: "same", font: RL_MADENA, scale: 300, tracking: -20, color: "#FFA3C9", color2: "#FF3D8B" }),
    tv("t_keynote", "94 Keynote", "depois liberdade", { look: "same", scale: 300, tracking: -50, color: "#9CF0FF", color2: "#16B4FF", sweep: true, stairAmt: 0.5 },
      { pre: { on: true, caseMode: "upper", tracking: 320, scale: 64, color: null } }),
    tv("t_vermelho", "95 Vermelho Viral", "o segredo real", { color: "#FF6B78", color2: "#E0001B" }),
    tv("t_lateral", "96 Lateral Limão", "o segredo real", { color: "#E2FF9E", color2: "#8EE600", stair: false },
      { font: F("Inter-Bold", "Inter", "Bold", 62, "bold", { caseMode: "lower", tracking: -25, tight: true, align: "left", fallbacks: ["AfxInter-Bold", "Montserrat-Bold", "Arial-BoldMT"] }) }),
    tv("t_numero", "97 Número", "faturei 30 mil", { scale: 300, tracking: -60, color: "#FFE9A3", color2: "#FFAE00", sweep: true },
      { post: { on: true, scale: 225, tracking: 0, font: VIBES } }),
    tv("t_jogada", "98 Jogada Verde", "a smart move", { look: "same", font: CASLON, scale: 118, tracking: 0, color: "#A2EC9C", color2: "#6AC263",
      glow: { on: true, color: "#5FDC5F", opacity: 55, blur: 24 }, stairAmt: 0.4 },
      { font: F("Inter-Bold", "Inter", "Bold", 110, "bold", { caseMode: "lower", tracking: -40, tight: true, fallbacks: ["AfxInter-Bold", "Montserrat-Bold", "Arial-BoldMT"] }) }),
    tv("t_roxo", "99 Roxo Script", "o segredo real", { look: "same", font: VIBES, scale: 210, tracking: 0, color: "#B24CF0", color2: "#F1C4F8", angle: 45,
      glow: { on: true, color: "#C25CFF", opacity: 90, blur: 28 }, stair: false },
      { font: F("Inter-Bold", "Inter", "Bold", 84, "bold", { caseMode: "lower", tracking: -40, tight: true, fallbacks: ["AfxInter-Bold", "Montserrat-Bold", "Arial-BoldMT"] }) }),
    tv("t_clean", "100 Clean Verde", "o segredo real", { scale: 240, tracking: -60, color: "#A8FFE4", color2: "#22C995", sweep: true }),
    tv("t_azul_serif", "101 Azul Serifa", "o segredo real", { look: "same", font: PLAYFAIR, scale: 230, tracking: -30, color: "#5EA8FF", color2: "#2F74FF",
      glow: { on: true, color: "#1F6BFF", opacity: 60, blur: 30 }, anim: { type: "rise", ms: 340 } }),
    tv("t_fogo", "102 Fogo", "o segredo real", { scale: 240, tracking: -45, color: "#FFD41A", color2: "#FF4A00",
      glow: { on: true, color: "#C81800", opacity: 80, blur: 60 }, anim: { type: "flicker", ms: 200 } }),

    // ---- modos simples (sem destaque gigante) ----
    { id: "t_classico", thumb: "Legenda pro", name: "103 Clássico", cat: C11, layout: { mode: "auto", maxChars: 30, maxLines: 2 },
      style: { font: F("Arial-BoldMT", "Arial", "Bold", 60, "bold"), stroke: stroke(5),
        shadow: { on: true, opacity: 55, blur: 12, distance: 3 },
        anim: { inT: "riseBlur", outT: "none", inMs: 500, off: 70, blur: 14, unit: "phrase" } } },
    { id: "t_uma", thumb: "edite", name: "104 Uma por Vez", cat: C11, layout: { mode: 1 },
      style: { font: F("Inter-Bold", "Inter", "Bold", 110, "bold", { tracking: -40, fallbacks: ["AfxInter-Bold", "Montserrat-Bold", "Arial-BoldMT"] }),
        shadow: { on: true, opacity: 45, blur: 16, distance: 3 },
        anim: { inT: "scale", outT: "none", inMs: 140, sF: 30, ease: "out", unit: "phrase" } } },
    { id: "t_tres", thumb: "edite seus vídeos", name: "105 3 Palavras", cat: C11, layout: { mode: 3 },
      style: { font: F("Inter-Bold", "Inter", "Bold", 80, "bold", { tracking: -35, fallbacks: ["AfxInter-Bold", "Montserrat-Bold", "Arial-BoldMT"] }),
        shadow: { on: true, opacity: 45, blur: 16, distance: 3 },
        anim: { inT: "riseBlur", outT: "none", inMs: 500, off: 70, blur: 14, unit: "phrase" } } },
    // mesmo estilo do 105, palavra por palavra na fala, todas as palavras no mesmo movimento
    tres("t_tres_sobe", "106 3 Palavras Sobe", "rise", 70),
    tres("t_tres_esq", "107 3 Palavras Esquerda", "leftBlur", 140),
    tres("t_tres_dir", "108 3 Palavras Direita", "rightBlur", 140),
    tres("t_tres_desce", "109 3 Palavras Desce", "fallBlur", 70)
  ];

  /* Entrada de cada texto viral, como na vitrine das referencias:
     Subir, Da direita, Slide palavra, Zoom com blur, Letras com blur, Scale Bounce, Da esquerda,
     Letras da direita, Scale, Cair com blur, Slide frase (Suave), Letras girando e Blur leve. */
  var W = function (wi, ms) { return { inT: "none", unit: "word", wordIn: wi, wordMs: ms || 400, off: 46, blur: 12 }; };
  var Ph = function (inT, ms) { return { inT: inT, inMs: ms, unit: "phrase", off: 70, blur: 14, sF: 0 }; };
  var Lt = function (li) { return { inT: "none", unit: "letters", letterIn: li, letterMs: 320, letterStag: 45, off: 40, blur: 12 }; };
  var TV_ANIM = {
    t_halo: W("rise"), t_ponto: W("rightBlur"), t_embaixo: W("slideWord", 500), t_serifa: W("zoomBlur", 380),
    t_keynote: Lt("lettersBlur"), t_vermelho: Ph("scaleBounce", 400), t_lateral: W("leftBlur"), t_numero: Lt("lettersRight"),
    t_jogada: Ph("scaleUp", 600), t_roxo: W("fallBlur"), t_clean: Ph("riseBlur", 500), t_azul_serif: Lt("lettersSpin"), t_fogo: W("blur", 350)
  };
  for (var a = 0; a < LIB.length; a++) {
    var an = TV_ANIM[LIB[a].id];
    if (!an) continue;
    for (var k in an) LIB[a].style.anim[k] = an[k];
    LIB[a].style.anim.outT = "none";
  }
  // Azul Serifa: as letras giram, entao o destaque entra junto com elas
  for (var b = 0; b < LIB.length; b++) if (LIB[b].id === "t_azul_serif") LIB[b].style.highlight.anim = { type: "same" };

  for (var i = 0; i < LIB.length; i++) LIB[i].builtin = true;
  return LIB;
});
