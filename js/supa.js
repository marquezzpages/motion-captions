/*
 * Login e lista de acessos pelo Supabase (API REST direta, sem biblioteca).
 * - Google: fluxo de redirecionamento (volta com #access_token na URL);
 * - e-mail e senha: cadastro com confirmacao por e-mail, entrar, esqueci a senha;
 * - acessos: tabela "acessos" (e-mail liberado = acesso vitalicio) e "admins" (dono).
 * Sem configuracao: modo demonstracao, tudo guardado so neste navegador.
 */
const CFG = window.MCM_CONFIG || {};
export const DEMO = !CFG.supabaseUrl;
const URL0 = String(CFG.supabaseUrl || "").replace(/\/+$/, "");
const KEY = CFG.supabaseAnonKey || "";
const SKEY = "mcm.sessao";

const low = e => String(e || "").trim().toLowerCase();
function readSession() { try { return JSON.parse(localStorage.getItem(SKEY) || "null"); } catch (e) { return null; } }
function writeSession(s) { try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); } catch (e) { /* ok */ } }
const here = () => location.origin + location.pathname;

/** mensagens do Supabase em portugues */
function msgPt(m) {
  m = String(m || "");
  if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
  if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail primeiro (veja a caixa de entrada e o spam).";
  if (/User already registered/i.test(m)) return "Esse e-mail já tem cadastro. Use “Entrar” ou “Esqueci a senha”.";
  if (/Password should be at least/i.test(m)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/rate limit|too many/i.test(m)) return "Muitas tentativas. Espere alguns minutos e tente de novo.";
  if (/provider is not enabled/i.test(m)) return "Login com Google ainda não foi ativado no Supabase.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sem conexão com o servidor de login.";
  return m || "Erro desconhecido.";
}

async function api(path, opt) {
  opt = opt || {};
  const h = Object.assign({ apikey: KEY, "Content-Type": "application/json" }, opt.headers || {});
  const r = await fetch(URL0 + path, { method: opt.method || "GET", headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined });
  const txt = await r.text();
  let j = null;
  try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = txt; }
  if (!r.ok) throw new Error(msgPt((j && (j.msg || j.message || j.error_description || j.error)) || r.statusText));
  return j;
}

/* ---------------- Supabase de verdade ---------------- */
const real = {
  async session() {
    // volta do Google / do link do e-mail: #access_token=...&refresh_token=...
    const hp = new URLSearchParams(location.hash.slice(1));
    if (hp.get("error_description")) {
      history.replaceState(null, "", here());
      throw new Error(msgPt(hp.get("error_description")));
    }
    if (hp.get("access_token")) {
      const s = { access_token: hp.get("access_token"), refresh_token: hp.get("refresh_token"),
        expires_at: Math.floor(Date.now() / 1000) + (+hp.get("expires_in") || 3600), type: hp.get("type") || "" };
      s.user = await api("/auth/v1/user", { headers: { Authorization: "Bearer " + s.access_token } });
      writeSession(s);
      history.replaceState(null, "", here());
      if (s.type === "recovery") s.recovery = true;
      return s;
    }
    let s = readSession();
    if (!s) return null;
    if (s.expires_at - 60 < Date.now() / 1000) {
      try {
        const r = await api("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: s.refresh_token } });
        s = { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (r.expires_in || 3600), user: r.user };
        writeSession(s);
      } catch (e) { writeSession(null); return null; }
    }
    return s;
  },
  google() {
    location.href = URL0 + "/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(here());
  },
  async signUp(email, pass) {
    const r = await api("/auth/v1/signup?redirect_to=" + encodeURIComponent(here()), { method: "POST", body: { email: low(email), password: pass } });
    if (r && r.access_token) { const s = { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (r.expires_in || 3600), user: r.user }; writeSession(s); return { session: s }; }
    return { confirm: true };
  },
  async signIn(email, pass) {
    const r = await api("/auth/v1/token?grant_type=password", { method: "POST", body: { email: low(email), password: pass } });
    const s = { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (r.expires_in || 3600), user: r.user };
    writeSession(s);
    return s;
  },
  async recover(email) {
    await api("/auth/v1/recover?redirect_to=" + encodeURIComponent(here()), { method: "POST", body: { email: low(email) } });
  },
  async newPassword(s, pass) {
    await api("/auth/v1/user", { method: "PUT", headers: { Authorization: "Bearer " + s.access_token }, body: { password: pass } });
  },
  async signOut(s) {
    try { if (s) await api("/auth/v1/logout", { method: "POST", headers: { Authorization: "Bearer " + s.access_token } }); } catch (e) { /* ok */ }
    writeSession(null);
  },
  /** acesso do proprio usuario: { ativo, admin } */
  async access(s) {
    const auth = { Authorization: "Bearer " + s.access_token };
    const em = low(s.user && s.user.email);
    const [a, d] = await Promise.all([
      api("/rest/v1/acessos?select=email,ativo&email=eq." + encodeURIComponent(em), { headers: auth }),
      api("/rest/v1/admins?select=email&email=eq." + encodeURIComponent(em), { headers: auth })
    ]);
    const admin = Array.isArray(d) && d.length > 0;
    return { ativo: admin || (Array.isArray(a) && a.length > 0 && a[0].ativo === true), admin };
  },
  /* painel do dono */
  async list(s) {
    return api("/rest/v1/acessos?select=*&order=criado_em.desc", { headers: { Authorization: "Bearer " + s.access_token } });
  },
  async grant(s, emails, obs) {
    const rows = emails.map(e => ({ email: low(e), ativo: true, origem: "manual", observacao: obs || null, atualizado_em: new Date().toISOString() }));
    return api("/rest/v1/acessos?on_conflict=email", { method: "POST", body: rows,
      headers: { Authorization: "Bearer " + s.access_token, Prefer: "resolution=merge-duplicates,return=representation" } });
  },
  async setActive(s, email, ativo) {
    return api("/rest/v1/acessos?email=eq." + encodeURIComponent(low(email)), { method: "PATCH", body: { ativo, atualizado_em: new Date().toISOString() },
      headers: { Authorization: "Bearer " + s.access_token, Prefer: "return=representation" } });
  },
  async remove(s, email) {
    return api("/rest/v1/acessos?email=eq." + encodeURIComponent(low(email)), { method: "DELETE", headers: { Authorization: "Bearer " + s.access_token } });
  }
};

/* ---------------- modo demonstracao (so neste navegador) ---------------- */
const DB = "mcm.demo.db";
function dget() { try { return JSON.parse(localStorage.getItem(DB) || "null") || { users: {}, acessos: {} }; } catch (e) { return { users: {}, acessos: {} }; } }
function dset(d) { localStorage.setItem(DB, JSON.stringify(d)); }
function demoSession(email) { const s = { access_token: "demo", refresh_token: "demo", expires_at: 4e9, user: { email: low(email) } }; writeSession(s); return s; }
const demo = {
  async session() { return readSession(); },
  google() {
    const e = prompt("Modo demonstração: digite o e-mail da conta Google");
    if (e) { const d = dget(); d.users[low(e)] = d.users[low(e)] || { pass: null }; dset(d); demoSession(e); location.reload(); }
  },
  async signUp(email, pass) {
    if (String(pass).length < 6) throw new Error(msgPt("Password should be at least 6"));
    const d = dget();
    if (d.users[low(email)]) throw new Error(msgPt("User already registered"));
    d.users[low(email)] = { pass }; dset(d);
    return { session: demoSession(email) };
  },
  async signIn(email, pass) {
    const u = dget().users[low(email)];
    if (!u || u.pass !== pass) throw new Error(msgPt("Invalid login credentials"));
    return demoSession(email);
  },
  async recover() { /* sem e-mail no modo demonstracao */ },
  async newPassword(s, pass) { const d = dget(); d.users[s.user.email].pass = pass; dset(d); },
  async signOut() { writeSession(null); },
  async access(s) {
    const em = low(s.user.email), admin = em === low(CFG.demoAdmin);
    const a = dget().acessos[em];
    return { ativo: admin || !!(a && a.ativo), admin };
  },
  async list() { return Object.values(dget().acessos).sort((a, b) => b.criado_em.localeCompare(a.criado_em)); },
  async grant(s, emails, obs) {
    const d = dget(), now = new Date().toISOString();
    emails.forEach(e => { const k = low(e); d.acessos[k] = Object.assign({ email: k, criado_em: now, origem: "manual" }, d.acessos[k] || {}, { ativo: true, observacao: obs || (d.acessos[k] && d.acessos[k].observacao) || null, atualizado_em: now }); });
    dset(d);
  },
  async setActive(s, email, ativo) { const d = dget(); if (d.acessos[low(email)]) { d.acessos[low(email)].ativo = ativo; d.acessos[low(email)].atualizado_em = new Date().toISOString(); } dset(d); },
  async remove(s, email) { const d = dget(); delete d.acessos[low(email)]; dset(d); }
};

export const auth = DEMO ? demo : real;
export function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim()); }
