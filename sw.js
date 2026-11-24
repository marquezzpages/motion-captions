/*
 * Service worker: guarda o app no aparelho para abrir rapido e funcionar sem internet
 * depois da primeira vez. Paginas e codigo: rede primeiro (pega atualizacoes), cache se estiver
 * sem internet. Bibliotecas, fontes, sons e o motor wasm: cache primeiro.
 * O modelo de fala (Hugging Face) fica no cache do proprio transformers.js.
 * Login e banco (Supabase) nunca passam pelo cache.
 */
const VERSAO = "mcm-v1";
const PRE = ["./", "index.html", "config.js", "css/app.css", "manifest.webmanifest", "icons/icon-192.png"];
const FIXOS = /\/(vendor|fonts|sfx|icons)\//;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(PRE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("mcm-") && k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const jsdelivr = url.hostname === "cdn.jsdelivr.net" && url.pathname.indexOf("/npm/onnxruntime-web@") === 0;
  if (!same && !jsdelivr) return; // Supabase, Google, Hugging Face: direto
  if (same && (url.pathname.indexOf("/models/") >= 0 || url.pathname.indexOf("/_") >= 0)) return;
  if (jsdelivr || FIXOS.test(url.pathname)) {
    e.respondWith(caches.open(VERSAO).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) c.put(req, r.clone());
      return r;
    }));
    return;
  }
  e.respondWith(fetch(req).then(r => {
    if (r.ok && same) { const cp = r.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); }
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(h => h || caches.match("index.html"))));
});
