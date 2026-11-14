// Cliente Supabase (carregado sob demanda: sem online, o jogo não baixa nada disto) + chamadas usadas pelo online.
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, PLAYER_EMAIL_DOMAIN, CAPTCHA } from './config';

const REF = new URL(SUPABASE_URL).hostname.split('.')[0];

export type Profile = { id: string; username: string; look: number };
export type Bug = {
  uid: string; nId: number; nId_color: number; nGrow: number; nRandom: number; nHealth: number;
  nAge_now: number; nSex: number; sNickName: string; nFed: number; nHeart: number;
};
export type SellBug = Bug & { price: number };
export type Snapshot = { user_id: string; money: number; level: number; days: number; score: number; have: number[]; bugs: Bug[]; selling: number; sell: SellBug[]; updated_at: string };
export type World = { id: string; code: string; owner: string };
export type Offer = {
  id: number; from_user: string; to_user: string; give_bugs: Bug[]; give_money: number; want_bugs: Bug[]; want_money: number;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'; created_at: string;
};
export type Match = {
  id: number; kind: 'battle' | 'race'; challenger: string; opponent: string; bet: number; seed: number;
  team_a: Bug[]; team_b: Bug[] | null; status: 'pending' | 'accepted' | 'done' | 'declined' | 'cancelled';
  winner: string | null; result: any; created_at: string;
};
export type InboxRow = { id: number; kind: string; ref: string | null; money: number; add_bugs: Bug[]; remove_uids: string[] };

let sb: SupabaseClient | null = null;
let loading: Promise<SupabaseClient> | null = null;
export let session: Session | null = null;
export let me: Profile | null = null;

/** há sessão salva? (decide se vale carregar o supabase-js na abertura do jogo) */
export function hasStoredSession() {
  try { return !!localStorage.getItem(`sb-${REF}-auth-token`); } catch { return false; }
}

export function client(): Promise<SupabaseClient> {
  if (sb) return Promise.resolve(sb);
  return (loading ??= import('@supabase/supabase-js').then(async ({ createClient }) => {
    sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    session = (await sb.auth.getSession()).data.session;
    if (session) await loadMe();
    sb.auth.onAuthStateChange((_e, s) => { session = s; });
    return sb;
  }));
}
export const sbNow = () => sb; // já carregado (ou null)

export async function loadMe() {
  me = null;
  if (!session || !sb) return;
  const { data } = await sb.from('profiles').select('id, username, look').eq('id', session.user.id).maybeSingle();
  me = data as Profile | null;
}

/** erro do Supabase → Error com a mensagem do servidor (as RPCs usam mensagens curtas em inglês) */
function chk(r: { data: any; error: any }): any {
  if (r.error) { const e: any = new Error(r.error.message || String(r.error)); e.hint = r.error.hint; e.details = r.error.details; throw e; }
  return r.data;
}
const rpc = async (fn: string, args: Record<string, any> = {}) => chk(await (await client()).rpc(fn, args));

// ── identidade: usuário anônimo + código de recuperação ──
// O código (24 caracteres base32 Crockford) codifica um e-mail sintético não entregável (8 primeiros) e uma senha
// aleatória de 80 bits (16 restantes), vinculados ao usuário anônimo com updateUser. Em outro aparelho (ou depois de
// limpar o navegador) o código vira signInWithPassword: mesma conta, mesmo save na nuvem.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_KEY = 'evolution.online.code';
const rnd32 = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => B32[b & 31]).join('');
export const formatCode = (c: string) => c.match(/.{4}/g)!.join('-');
function credOf(code: string) {
  const c = code.toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0').replace(/[^0-9A-Z]/g, '');
  if (c.length !== 24 || [...c].some(ch => !B32.includes(ch))) throw new Error('Invalid recovery code.');
  return { code: c, email: `p-${c.slice(0, 8).toLowerCase()}@${PLAYER_EMAIL_DOMAIN}`, password: c.slice(8) };
}
export function storedCode(): string | null { try { return localStorage.getItem(CODE_KEY); } catch { return null; } }
function storeCode(c: string | null) { try { c ? localStorage.setItem(CODE_KEY, c) : localStorage.removeItem(CODE_KEY); } catch { /* */ } }

/** captcha (Turnstile) antes do login: só com CAPTCHA.siteKey definido (hoje desligado) */
let turnstile: Promise<any> | null = null;
async function captchaToken(): Promise<string | undefined> {
  if (!CAPTCHA.siteKey) return undefined;
  const ts = await (turnstile ??= new Promise((ok, err) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.onload = () => ok((window as any).turnstile);
    s.onerror = () => err(new Error('Captcha failed to load.'));
    document.head.append(s);
  }));
  return new Promise((ok, err) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:60';
    document.body.append(d);
    ts.render(d, { sitekey: CAPTCHA.siteKey, callback: (t: string) => { d.remove(); ok(t); }, 'error-callback': () => { d.remove(); err(new Error('Captcha failed.')); } });
  });
}

/** novo jogador online: entra só com o nome; em seguida cria o código de recuperação */
const checkName = (n: string) => { if (n.trim().length < 2 || n.trim().length > 16) throw new Error('Name: 2 to 16 characters.'); };
export async function start(name: string) {
  checkName(name);
  const c = await client();
  chk(await c.auth.signInAnonymously({ options: { data: { username: name.trim() }, captchaToken: await captchaToken() } }));
  session = (await c.auth.getSession()).data.session;
  await loadMe();
  await ensureCode();
}
/** vincula a credencial sintética (se ainda não houver) e guarda o código neste aparelho */
export async function ensureCode() {
  const c = await client();
  if (storedCode() || !session?.user.is_anonymous) return storedCode();
  for (let i = 0; i < 3; i++) {
    const cr = credOf(rnd32(24));
    const r = await c.auth.updateUser({ email: cr.email, password: cr.password });
    if (!r.error) { storeCode(cr.code); session = (await c.auth.getSession()).data.session; return cr.code; }
    if (i === 2) chk(r);
  }
  return null;
}
/** entra com o código de recuperação (outro aparelho / navegador limpo) */
export async function recover(code: string) {
  const c = await client();
  const cr = credOf(code);
  chk(await c.auth.signInWithPassword({ email: cr.email, password: cr.password, options: { captchaToken: await captchaToken() } }));
  session = (await c.auth.getSession()).data.session;
  storeCode(cr.code);
  await loadMe();
}
export async function signOut() { await (await client()).auth.signOut(); session = null; me = null; storeCode(null); }
export async function rename(name: string) {
  checkName(name);
  chk(await (await client()).from('profiles').update({ username: name.trim() }).eq('id', session!.user.id));
  await loadMe();
}

// ── leitura ──
export async function getSave() {
  return chk(await (await client()).from('saves').select('data, rev, updated_at').maybeSingle()) as { data: any; rev: number; updated_at: string } | null;
}
export async function profilesByIds(ids: string[]): Promise<Profile[]> {
  if (!ids.length) return [];
  return chk(await (await client()).from('profiles').select('id, username, look').in('id', ids)) as Profile[];
}
/** meu mundo e os membros (RLS: só quem é do mundo enxerga) */
export async function myWorld(): Promise<{ world: World; members: Profile[] } | null> {
  const c = await client();
  const world = chk(await c.from('worlds').select('id, code, owner').maybeSingle()) as World | null;
  if (!world) return null;
  const ms = chk(await c.from('world_members').select('user_id, joined_at').eq('world_id', world.id).order('joined_at')) as { user_id: string }[];
  const ps = new Map((await profilesByIds(ms.map(m => m.user_id))).map(p => [p.id, p]));
  return { world, members: ms.map(m => ps.get(m.user_id)!).filter(Boolean) };
}
export async function snapshot(uid: string): Promise<Snapshot | null> {
  return chk(await (await client()).from('snapshots').select('*').eq('user_id', uid).maybeSingle()) as Snapshot | null;
}
export async function snapshots(uids: string[]): Promise<Snapshot[]> {
  if (!uids.length) return [];
  return chk(await (await client()).from('snapshots').select('user_id, money, level, days, have, bugs, sell').in('user_id', uids)) as Snapshot[];
}
export async function offers(): Promise<Offer[]> {
  return chk(await (await client()).from('offers').select('*').order('id', { ascending: false }).limit(40)) as Offer[];
}
/** desafios em que `uid` participa (o meu histórico ou o de um amigo) */
export async function matches(uid: string): Promise<Match[]> {
  return chk(await (await client()).from('matches').select('*').or(`challenger.eq.${uid},opponent.eq.${uid}`)
    .order('id', { ascending: false }).limit(30)) as Match[];
}
/** desafios recentes do mundo (RLS: os meus e os dos membros do meu mundo) */
export async function recentMatches(): Promise<Match[]> {
  return chk(await (await client()).from('matches').select('*').order('id', { ascending: false }).limit(30)) as Match[];
}
export async function inbox(): Promise<InboxRow[]> {
  return chk(await (await client()).from('inbox').select('id, kind, ref, money, add_bugs, remove_uids').is('applied_at', null).order('id')) as InboxRow[];
}

// ── escrita (RPCs) ──
export const pushSave = (data: any, snap: any, baseRev: number, force = false) =>
  rpc('push_save', { p_data: data, p_snap: snap, p_base_rev: baseRev, p_force: force }) as Promise<number>;
export const ackInbox = (ids: number[]) => rpc('ack_inbox', { p_ids: ids });
export const createWorld = () => rpc('create_world') as Promise<string>;
export const joinWorld = (code: string) => rpc('join_world', { p_code: code });
export const leaveWorld = () => rpc('leave_world');
export const kickMember = (uid: string) => rpc('kick_member', { p_user: uid });
export const endWorld = () => rpc('end_world');
export const createOffer = (to: string, giveBugs: Bug[], giveMoney: number, wantBugs: Bug[], wantMoney: number) =>
  rpc('create_offer', { p_to: to, p_give_bugs: giveBugs, p_give_money: giveMoney, p_want_bugs: wantBugs, p_want_money: wantMoney }) as Promise<number>;
export const respondOffer = (id: number, accept: boolean, wantBugs: Bug[] = []) =>
  rpc('respond_offer', { p_id: id, p_accept: accept, p_want_bugs: wantBugs });
export const cancelOffer = (id: number) => rpc('cancel_offer', { p_id: id });
export const createMatch = (to: string, kind: 'battle' | 'race', bet: number, team: Bug[]) =>
  rpc('create_match', { p_to: to, p_kind: kind, p_bet: bet, p_team: team }) as Promise<number>;
export const acceptMatch = (id: number, team: Bug[]) => rpc('accept_match', { p_id: id, p_team: team }) as Promise<Match>;
export const declineMatch = (id: number) => rpc('decline_match', { p_id: id });
export const finishMatch = (id: number, side: 'a' | 'b', result: any) => rpc('finish_match', { p_id: id, p_winner_side: side, p_result: result });
