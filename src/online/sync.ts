// Save na nuvem (envio com controle de revisão), entregas (inbox) e avisos em tempo real.
import { _global, _root, SharedObject } from '../engine/as2';
import { SFM } from '../game/classes/SFM';
import * as api from './api';
import { applyEntry, snapshotOf } from './bugs';

const G = () => _global.GAME;
export const uid = () => api.session?.user.id;
/** o jogo aberto está vinculado à conta logada? (só então entregas/envio de save/trocas valem) */
export const linked = () => !!uid() && G()?.sOnlineUid === uid();
/** o jogo aberto foi criado com o multiplayer ligado? (sem isso, nenhuma interface do multiplayer aparece) */
export const mpGame = () => !!G()?.sOnlineUid;

// ── estado observado pela UI (contador do botão ONLINE, painel) ──
export const state = { pending: 0, offers: 0, challenges: 0, conflict: false, friends: new Map<string, api.Profile>(), world: null as api.World | null };
const subs = new Set<() => void>();
export const onState = (f: () => void) => { subs.add(f); return () => subs.delete(f); };
export const emit = () => subs.forEach(f => f());

export function popWord(s: string) { if (s && G()?.mClip && mpGame()) G().popWord(s); }

// ── save ──
/** o GAME exatamente como a v1 grava no SharedObject (sem clips nem funções) */
function gameJSON(): any {
  const so = _root?.mGame?.soData;
  if (!so || so.data.GAME !== G()) return null;
  so.flush();
  try { return JSON.parse(localStorage.getItem('evolution.so:' + so.name) || 'null')?.GAME ?? null; } catch { return null; }
}
const sig = (g: any) => JSON.stringify({ ...g, nOnlineRev: 0, aInboxDone: 0 });
let lastSig = '';
let chain: Promise<void> = Promise.resolve();

/** envia o save se mudou (force: envia mesmo igual / sobrescreve após conflito). Envios entram numa fila: um "SYNC NOW"
 *  durante um envio automático não se perde. */
export function pushNow(force = false): Promise<void> {
  const p = chain.then(() => doPush(force));
  chain = p.catch(() => {});
  return p;
}
async function doPush(force: boolean) {
  if (!linked() || state.conflict) return;
  const data = gameJSON();
  if (!data) return;
  const s = sig(data);
  if (s === lastSig && !force) return;
  try {
    G().nOnlineRev = await api.pushSave(data, snapshotOf(), G().nOnlineRev | 0, force);
    lastSig = s;
  } catch (e: any) {
    if (e.hint === 'save_conflict') askConflict();
    else console.warn('[online] push', e.message);
  }
}

function askConflict() {
  state.conflict = true; emit();
  const p = SFM.addClip('mPop', _root, { sTxt: 'Load newer cloud save?', sFrame: 'Y_N' });
  p.rtFun = async (yes: boolean) => {
    state.conflict = false;
    if (yes) { const s = await api.getSave(); if (s) loadCloud(s); }
    else pushNow(true);
  };
}

/** troca o jogo aberto pelo save da nuvem (mesmo caminho do "Continue" da v1: frame Initial_load) */
export function loadCloud(save: { data: any; rev: number }) {
  const mc = _root.mGame;
  G()?.stop();
  for (const c of [..._root.children]) if (String(c.name).startsWith('mPop')) c.removeMovieClip();
  mc.soData.data.GAME = { ...save.data, sOnlineUid: uid(), nOnlineRev: save.rev };
  lastSig = '';
  _global.FADE?.();
  mc.gotoAndStop('Initial_load');
}

/** vincula o jogo aberto à conta; com `rev` (save existente na nuvem) sobrescreve a nuvem */
export async function linkThisGame(rev?: number) {
  G().sOnlineUid = uid();
  G().nOnlineRev = rev ?? 0;
  lastSig = '';
  await pushNow(rev !== undefined);
  processInbox();
}

// ── entregas ──
let inboxBusy = false;
export async function processInbox() {
  if (!linked() || inboxBusy) return;
  inboxBusy = true;
  try {
    const rows = await api.inbox();
    const done: number[] = (G().aInboxDone ??= []);
    const fresh = rows.filter(r => !done.includes(r.id));
    const msgs = fresh.map(r => { const m = applyEntry(r); done.push(r.id); return m; }).filter(Boolean);
    if (done.length > 200) done.splice(0, done.length - 200);
    if (fresh.length) SharedObject.flushAll(); // grava antes do ack: reaplicar fica impossível
    if (rows.length) await api.ackInbox(rows.map(r => r.id));
    msgs.forEach((m, i) => setTimeout(() => popWord(m), i * 1500));
    if (fresh.length) { emit(); pushNow(); }
  } catch (e: any) { console.warn('[online] inbox', e.message); }
  finally { inboxBusy = false; }
}

// ── pendências e tempo real ──
export async function refreshPending() {
  const me = uid();
  if (!me) { state.pending = state.offers = state.challenges = 0; state.friends.clear(); state.world = null; emit(); return; }
  try {
    const [w, os, ms] = await Promise.all([api.myWorld(), api.offers(), api.matches(me)]);
    state.world = w?.world ?? null;
    // "amigos" = os outros membros do meu mundo
    state.friends = new Map((w?.members ?? []).filter(p => p.id !== me).map(p => [p.id, p]));
    state.offers = os.filter(o => o.status === 'pending' && o.to_user === me).length;
    state.challenges = ms.filter(m => m.status === 'pending' && m.opponent === me).length;
    state.pending = state.offers + state.challenges;
  } catch { /* offline */ }
  emit();
}

let channel: any = null;
let timer = 0;
export async function connect() {
  const c = await api.client();
  disconnect();
  const me = uid();
  if (!me) return;
  const on = (table: string, event: string, filter: string | null, f: (p: any) => void) =>
    channel.on('postgres_changes', { event, schema: 'public', table, ...(filter ? { filter } : {}) }, f);
  channel = c.channel('me:' + me);
  on('inbox', 'INSERT', `user_id=eq.${me}`, p => { processInbox(); if (String(p.new.kind).startsWith('world_')) refreshPending(); });
  on('world_members', '*', null, () => refreshPending());
  on('offers', '*', null, p => { if (p.eventType === 'INSERT' && p.new.to_user === me) popWord('New trade offer!'); refreshPending(); });
  on('matches', '*', null, p => { if (p.eventType === 'INSERT' && p.new.opponent === me) popWord('New challenge!'); refreshPending(); });
  channel.subscribe();
  timer = window.setInterval(() => { pushNow(); }, 20000);
  refreshPending();
  processInbox();
}
export function disconnect() {
  if (channel) api.sbNow()?.removeChannel(channel);
  channel = null;
  clearInterval(timer);
}
addEventListener('pagehide', () => { pushNow(); });
