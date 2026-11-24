/*
 * Motion Captions Pro - efeitos sonoros na entrada das palavras.
 * Os 20 sons sao originais (sintetizados por ferramentas/gerar_sfx.py) e ficam em extensao/sfx.
 * A regra de quando tocar (events) e a mesma do jsx/mcp_sfx.jsx.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  root.MCP = root.MCP || {};
  root.MCP.sfx = mod;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var LIST = [
    { id: "click_suave", name: "Clique suave", desc: "clique de mouse macio" },
    { id: "clique_seco", name: "Clique seco", desc: "clique curto e preciso" },
    { id: "tique", name: "Tique", desc: "tique agudo bem curto" },
    { id: "tecla", name: "Tecla", desc: "tecla de teclado" },
    { id: "tecla_macia", name: "Tecla macia", desc: "tecla abafada" },
    { id: "interruptor", name: "Interruptor", desc: "clique duplo de chave" },
    { id: "haptico", name: "Háptico", desc: "toque grave, vibração" },
    { id: "pop_suave", name: "Pop suave", desc: "pop redondo e baixo" },
    { id: "bolha", name: "Bolha", desc: "bolha descendo" },
    { id: "gota", name: "Gota", desc: "gota d'água subindo" },
    { id: "estalo", name: "Estalo", desc: "estalo de dedo leve" },
    { id: "madeira", name: "Madeira", desc: "toque de madeira" },
    { id: "toque_vidro", name: "Toque de vidro", desc: "toque agudo e brilhante" },
    { id: "cristal", name: "Cristal", desc: "brilho cristalino" },
    { id: "marimba", name: "Marimba", desc: "nota de marimba" },
    { id: "pluck", name: "Pluck", desc: "corda dedilhada" },
    { id: "ding", name: "Ding", desc: "sininho curto" },
    { id: "notificacao", name: "Notificação", desc: "duas notas subindo" },
    { id: "whoosh_curto", name: "Whoosh curto", desc: "passagem de ar" },
    { id: "swipe", name: "Swipe", desc: "deslize rápido" }
  ];

  var BY_ID = {};
  for (var i = 0; i < LIST.length; i++) BY_ID[LIST[i].id] = LIST[i];

  /**
   * Momentos de som de uma legenda. words: [{s, hl}] com s relativo ao inicio da legenda.
   * sfx: {id, accent, mode:'word'|'first'|'hl', offset(ms), minGap(ms)}.
   * lastT: instante (mesma escala) do ultimo som da legenda anterior, para o intervalo minimo.
   * Retorna [{t, id}] (t relativo, ja com o ajuste fino).
   */
  function events(words, sfx, lastT) {
    var out = [];
    var gap = Math.max(0, (sfx.minGap == null ? 90 : sfx.minGap) / 1000);
    var off = (sfx.offset || 0) / 1000;
    var last = lastT == null ? -1e9 : lastT;
    for (var k = 0; k < words.length; k++) {
      var w = words[k];
      if (sfx.mode === "first" && k > 0) break;
      if (sfx.mode === "hl" && !w.hl) continue;
      var id = (w.hl && sfx.accent && sfx.accent !== "none") ? sfx.accent : sfx.id;
      var t = Math.max(0, (w.s || 0) + off);
      if (t - last < gap - 1e-9) continue;
      out.push({ t: t, id: id });
      last = t;
    }
    return out;
  }

  /* ---- tocar no painel (so no navegador/CEP) ---- */
  var cache = {};
  var userUrl = null;   // definido pelo painel: id "u:arquivo" -> URL file:///
  function url(id) { return String(id).indexOf("u:") === 0 ? (userUrl ? userUrl(id) : "") : "sfx/" + id + ".wav"; }
  function setUserUrl(fn) { userUrl = fn; }
  function play(id, volDb) {
    if (typeof Audio === "undefined" || (!BY_ID[id] && String(id).indexOf("u:") !== 0) || !url(id)) return;
    try {
      var a = cache[id];
      if (!a || !a.paused) { a = new Audio(url(id)); cache[id] = a; }
      a.volume = Math.max(0, Math.min(1, Math.pow(10, (volDb || 0) / 20)));
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  return { LIST: LIST, BY_ID: BY_ID, events: events, play: play, url: url, setUserUrl: setUserUrl };
});
