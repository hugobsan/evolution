// Configuração pública do online (vai no bundle; não há segredo aqui: a segurança está na RLS e nas RPCs).
// O ping agendado (GitHub Actions) chama: POST {SUPABASE_URL}/rest/v1/rpc/ping  com o header apikey: {SUPABASE_KEY}.
export const SUPABASE_URL = 'https://xezwvhrbculmnyksjyen.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_r04Ktxhs4LJZJj663lDx4A_9xzmG-Rl'; // publishable (antiga "anon")

/** domínio reservado (RFC 2606): o e-mail sintético do código de recuperação nunca é entregue */
export const PLAYER_EMAIL_DOMAIN = 'players.invalid';

/** captcha no login anônimo: desligado até existir a chave. Para ligar: siteKey do Turnstile aqui +
 *  [auth.captcha] enabled = true, provider = "turnstile", secret no Supabase (supabase config push). */
export const CAPTCHA = { provider: 'turnstile' as const, siteKey: '' };

/** máximo de membros por mundo (o servidor também limita em join_world) */
export const WORLD_MAX = 10;
