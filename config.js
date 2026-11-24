/*
 * Configuracao do site.
 *
 * acessoLivre: true  -> o site abre direto no editor, sem login (fase de teste).
 * acessoLivre: false -> volta a pedir login (Google ou e-mail) e so entra quem for liberado.
 *   Para isso, preencha supabaseUrl e supabaseAnonKey com os dados do SEU projeto Supabase
 *   (Supabase > Project Settings > API) e rode supabase/schema.sql no banco.
 *   A "anon key" pode ficar aqui: ela e publica, quem protege os dados sao as regras (RLS).
 *   Com supabaseUrl vazio o login fica em MODO DEMONSTRACAO (so neste navegador).
 */
window.MCM_CONFIG = {
  acessoLivre: true,
  supabaseUrl: "",
  supabaseAnonKey: "",
  // nome mostrado no app e contato para quem ainda nao tem acesso
  nome: "Motion Captions",
  contato: "",
  // em modo demonstracao, quem entrar com este e-mail vira dono (pode liberar acessos)
  demoAdmin: "dono@exemplo.com"
};
