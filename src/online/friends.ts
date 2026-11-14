// Tela "FRIENDS": todos do mundo, com quem está conectado agora (presença Realtime), e o perfil de cada um
// (dinheiro, pirâmide evolutiva, insetário e histórico de lutas e corridas, com ASSISTIR).
import * as api from './api';
import type { Match, Profile, Snapshot } from './api';
import * as sync from './sync';
import * as match from './match';
import { online, inShop } from './shop';
import { stats } from './bugs';
import { View, MC, label, button, panel, bugGrid, bugLine, show, close, t, money, setText } from './kit';
import { dot } from './world';

const names = new Map<string, string>();
export async function nameOf(ids: string[]) {
  const miss = [...new Set(ids)].filter(i => i && !names.has(i));
  for (const p of await api.profilesByIds(miss)) names.set(p.id, p.username);
  if (api.me) names.set(api.me.id, api.me.username);
}
export const nm = (id: string) => names.get(id) ?? t('(former member)');

/** assistir (replay/ao vivo): fecha a tela e abre a arena */
export function watch(m: Match, live: boolean) {
  close(false);
  match.play(m, [nm(m.challenger), nm(m.opponent)], live);
}

const PER_PAGE = 8;
export const friendsView: View = {
  title: 'FRIENDS',
  load: async () => {
    if (!api.session) return { none: true };
    const w = await api.myWorld();
    if (!w) return { none: true, nosession: false };
    for (const m of w.members) names.set(m.id, m.username);
    const snaps = new Map((await api.snapshots(w.members.map(m => m.id))).map(s => [s.user_id, s]));
    return { w, snaps };
  },
  build(v, d) {
    if (d?.none) {
      panel(v, 60, 100, 520, 140);
      label(v, 90, 125, api.session ? 'You are not in a world yet.' : 'You need an online player to use multiplayer.', { w: 460 });
      label(v, 90, 165, 'Open the multiplayer setup to create or join a world.', { w: 460, size: 15 });
      return;
    }
    const me = sync.uid();
    const rows: Profile[] = [...d.w.members].sort((a: Profile, b: Profile) =>
      (a.id === me ? -1 : b.id === me ? 1 : 0) || +(online.has(b.id)) - +(online.has(a.id)));
    const per = PER_PAGE;
    const st: any = friendsView;
    const pages = Math.max(1, Math.ceil(rows.length / per));
    const pg = Math.min(st.pg ?? 0, pages - 1);
    panel(v, 20, 62, 600, 36 + Math.min(per, rows.length) * 41);
    label(v, 50, 70, 'Name', { size: 13 });
    label(v, 290, 70, 'Money', { size: 13 });
    label(v, 395, 70, 'Time', { size: 13 });
    label(v, 480, 70, 'Pyramid', { size: 13 });
    rows.slice(pg * per, pg * per + per).forEach((m, i) => {
      const y = 92 + i * 41;
      const s: Snapshot | undefined = d.snaps.get(m.id);
      const on = m.id === me || online.has(m.id);
      dot(v, 40, y + 13, on);
      const n = label(v, 54, y + 2, m.username, { size: 17 });
      n.name = 'fn_' + m.id;
      label(v, 54, y + 21, [on ? t('online') : t('offline'), inShop.has(m.id) ? t('in the shop now') : '', m.id === me ? t('(you)') : ''].filter(Boolean).join(' · '), { size: 11, white: false });
      label(v, 290, y + 6, s ? money(s.money) : '-', { size: 15 });
      label(v, 395, y + 6, s ? t(s.days + ' days') : '-', { size: 15 });
      label(v, 480, y + 6, s ? `${s.have.length}/15` : '-', { size: 15 });
      if (m.id !== me) button(v, 532, y + 6, 'PROFILE', () => show(profileView(m.id)), { scale: 90 });
    });
    if (pages > 1) {
      button(v, 30, 446, '<', () => { st.pg = pg - 1; show(friendsView); }, { enabled: pg > 0 });
      label(v, 66, 444, `${pg + 1}/${pages}`);
      button(v, 120, 446, '>', () => { st.pg = pg + 1; show(friendsView); }, { enabled: pg < pages - 1 });
    }
  },
};

export const openProfile = (id: string) => show(profileView(id, null));

// ───────────── perfil ─────────────
const ROWS = [[14], [12, 13], [9, 10, 11], [5, 6, 7, 8], [0, 1, 2, 3, 4]];
/** pirâmide evolutiva: os hexágonos do jogo (sprite 360, "?" até criar a espécie) com o besouro das espécies já criadas */
function pyramid(v: MC, have: number[], x0: number, y0: number, k: number) {
  const hex: Record<number, [number, number]> = {};
  ROWS.forEach((r, ri) => r.forEach((id, ci) => { hex[id] = [x0 + (ci - (r.length - 1) / 2) * 100 * k, y0 + ri * 90 * k]; }));
  for (const id of Object.keys(hex).map(Number)) {
    const [x, y] = hex[id];
    const h = v.attachSymbol(360, 'hx' + id, ++v.__d, {}, false);
    h._x = x; h._y = y; h._xscale = h._yscale = 100 * k;
    if (have.includes(id)) {
      h.mTxt && (h.mTxt._visible = false);
      const b = h.attachMovie('beetle', 'beetle', 0);
      if (b) {
        b._rotation = -45; b._yscale = b._xscale = 25 + Math.ceil(id / 3);
        b.gotoAndStop(id + 1); b.mHead?.gotoAndStop(id + 1); b.mBoot?.gotoAndStop(b.mBoot._totalframes);
      }
    }
  }
}

export function profileView(id: string, back: View | null = friendsView): View {
  const pv: View = {
    title: '',
    back,
    load: async () => {
      await nameOf([id]);
      const [s, ms] = await Promise.all([api.snapshot(id), api.matches(id)]);
      await nameOf(ms.flatMap(m => [m.challenger, m.opponent]));
      return { s, ms };
    },
    build(v, d) {
      const { s, ms } = d as { s: Snapshot | null; ms: Match[] };
      pv.title = '';
      const done = ms.filter(m => m.status === 'done');
      setText(v.title, nm(id)); // título = nome do jogador
      const on = id === sync.uid() || online.has(id);
      dot(v, 34, 78, on);
      label(v, 48, 66, `${on ? t('online') : t('offline')}${inShop.has(id) ? ' · ' + t('in the shop now') : ''}`, { size: 14 });
      if (!s) { label(v, 40, 110, '(no game linked)', {}); return; }
      label(v, 270, 66, `${money(s.money)} · ${t(s.days + ' days')} · ${t('Pyramid')} ${s.have.length}/15`, { size: 15 });
      panel(v, 20, 92, 215, 252);
      pyramid(v, s.have, 127, 124, 0.44);
      panel(v, 245, 92, 375, 252);
      label(v, 258, 98, 'Bug collection', { size: 14 });
      const hover = label(v, 256, 318, '', { size: 12 });
      bugGrid(v, s.bugs, 290, 146, {
        pitch: 86, scale: 90, cols: 4,
        over: b => setText(hover, bugLine(b, stats(b))),
      });
      panel(v, 20, 352, 600, 84);
      label(v, 32, 356, 'Fights and races', { size: 14 });
      if (!done.length) label(v, 32, 384, 'No fights or races yet.', { size: 14 });
      done.slice(0, 2).forEach((m, i) => {
        const y = 376 + i * 28;
        const other = m.challenger === id ? m.opponent : m.challenger;
        const won = m.winner === id;
        label(v, 32, y, `${t(m.kind === 'battle' ? 'FIGHT' : 'RACE')} · ${t('vs')} ${nm(other)} · ${t(won ? 'won' : 'lost')} · ${t('Bet')} ${money(m.bet)}`, { size: 14, color: won ? 0x0a5c1a : 0x7a1010 });
        button(v, 520, y - 2, 'WATCH', () => watch(m, false), { scale: 90 });
      });
    },
  };
  // o título do perfil é o nome: a vista guarda o nome já carregado para aparecer logo
  pv.title = names.get(id) ?? '';
  return pv;
}

