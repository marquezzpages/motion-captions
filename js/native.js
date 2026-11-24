/*
 * Ponte com o celular: salvar o video na galeria (plugin nativo VideoSaver do app) e
 * guardar os sons da pessoa (IndexedDB). No navegador do computador, o video e baixado.
 */
const Cap = window.Capacitor;
export const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const Saver = isNative && Cap.Plugins ? Cap.Plugins.VideoSaver : null;

function b64(u8) {
  let s = "";
  const step = 0x8000;
  for (let i = 0; i < u8.length; i += step) s += String.fromCharCode.apply(null, u8.subarray(i, i + step));
  return btoa(s);
}

/** abre um arquivo temporario no celular e devolve { writable, finish(), abort() } */
export async function openGalleryWriter(name) {
  if (!Saver) return null;
  const r = await Saver.open({ name });
  const id = r.id;
  const writable = new WritableStream({
    async write(chunk) {
      await Saver.write({ id, position: chunk.position, data: b64(chunk.data) });
    }
  });
  return {
    writable,
    finish: async () => (await Saver.close({ id })),
    abort: async () => { try { await Saver.abort({ id }); } catch (e) { /* ok */ } }
  };
}

/**
 * No navegador: grava o MP4 no armazenamento privado do site (OPFS), em partes, sem ocupar a
 * memoria. Navegador sem suporte -> null (a exportacao usa a memoria).
 */
export async function openWebWriter(name) {
  if (isNative || !navigator.storage || !navigator.storage.getDirectory) return null;
  try {
    const root = await navigator.storage.getDirectory();
    try { for await (const k of root.keys()) if (k.indexOf("export_") === 0) await root.removeEntry(k); } catch (e) { /* ok */ }
    const fh = await root.getFileHandle("export_" + name, { create: true });
    if (!fh.createWritable) return null;
    const w = await fh.createWritable();
    let closed = false;
    const closeW = async () => { if (!closed) { closed = true; await w.close(); } };
    const writable = new WritableStream({
      async write(ch) { await w.write({ type: "write", position: ch.position, data: ch.data }); },
      close: closeW
    });
    return {
      writable,
      finish: async () => { await closeW(); return { file: await fh.getFile() }; },
      abort: async () => { try { closed = true; await w.abort(); } catch (e) { /* ok */ } }
    };
  } catch (e) { console.warn("opfs", e); return null; }
}

/** salvar/compartilhar o video pronto (precisa ser chamado num toque) */
export async function shareFile(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: file.name }); return "share"; }
    catch (e) { if (e && e.name === "AbortError") return "cancel"; }
  }
  download(file, file.name);
  return "download";
}

/** espaco livre no aparelho (bytes) ou null */
export async function freeSpace() {
  if (!Saver) {
    try { const e = await navigator.storage.estimate(); return e.quota != null ? e.quota - (e.usage || 0) : null; } catch (err) { return null; }
  }
  try { return (await Saver.freeSpace()).bytes; } catch (e) { return null; }
}

/** botao voltar do Android */
export function onBack(fn) {
  const App = isNative && Cap.Plugins ? Cap.Plugins.App : null;
  if (App) App.addListener("backButton", fn);
}
export function exitApp() {
  const App = isNative && Cap.Plugins ? Cap.Plugins.App : null;
  if (App) App.exitApp();
}

/** sem o app nativo: baixa o arquivo */
export function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

/** mantem a tela ligada durante a exportacao, quando o aparelho deixa */
let lock = null;
export async function keepAwake(on) {
  if (Saver) { try { await Saver.keepAwake({ on: !!on }); } catch (e) { /* ok */ } return; }
  try {
    if (on && navigator.wakeLock && !lock) lock = await navigator.wakeLock.request("screen");
    if (!on && lock) { await lock.release(); lock = null; }
  } catch (e) { /* ok */ }
}

/* ---------- "Meus sons" (ficam guardados no aparelho) ---------- */
function db() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open("mcm", 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore("sons", { keyPath: "id" });
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
function tx(store, mode, fn) {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
    t.onerror = () => rej(t.error);
  }));
}
export const sons = {
  list: () => tx("sons", "readonly", s => s.getAll()).then(r => (r || []).map(x => ({ id: x.id, name: x.name }))),
  get: id => tx("sons", "readonly", s => s.get(id)),
  add: (name, blob) => {
    const id = "u:" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    return tx("sons", "readwrite", s => s.put({ id, name, blob })).then(() => id);
  },
  del: id => tx("sons", "readwrite", s => s.delete(id))
};

/* ---------- preferencias ---------- */
export const prefs = {
  load() { try { return JSON.parse(localStorage.getItem("mcm.prefs") || "{}"); } catch (e) { return {}; } },
  save(p) { try { localStorage.setItem("mcm.prefs", JSON.stringify(p)); } catch (e) { /* ok */ } }
};
