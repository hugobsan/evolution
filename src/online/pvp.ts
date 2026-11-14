// Tela "PvP" (arena): desafios recebidos (aceitar e escolher o time), desafiar amigos (luta/corrida + aposta) e histórico
// recente do mundo com ASSISTIR.
import { _global } from '../engine/as2';
import * as api from './api';
import type { Bug, Match } from './api';
import * as sync from './sync';
import { online } from './shop';
import { bugOf, stats, myBug } from './bugs';
import { View, MC, label, button, panel, input, tabs, bugGrid, bugLine, show, refresh, flash, money, t, setText } from './kit';
import { nameOf, nm, watch } from './friends';
import { dot } from './world';

const G = () => _global.GAME;
const myBugs = (): Bug[] => (G()?.aAdult ?? []).map(bugOf);
const mustLink = () => { if (!sync.linked()) throw new Error('Link this game to your player first.'); };
const desc = (m: Match) => `${t(m.kind === 'battle' ? 'FIGHT' : 'RACE')} · ${m.team_a.length} ${t('bugs')} · ${t('Bet')} ${money(m.bet)}`;

type Tab = 'in' | 'new' | 'hist';
let tab: Tab = 'in';
const PER = 6;
const pg: Record<string, number> = {};

function team(sel: string[]): Bug[] {
  const bugs = sel.map(u => myBug(u)).filter(Boolean);
  if (!bugs.length) throw new Error('Please select at least one bug!');
  if (bugs.some((a: any) => a.nHeart <= 50)) throw new Error('The bug is unhappy!');
  return bugs.map(bugOf);
}

/** lista paginada em painel: desenha `per` linhas a partir da página atual */
function list<T>(v: MC, items: T[], key: string, y0: number, rowH: number, draw: (it: T, y: number) => void, empty: string) {
  const pages = Math.max(1, Math.ceil(items.length / PER));
  const p = Math.min(pg[key] ?? 0, pages - 1);
  pg[key] = p;
  const n = Math.min(PER, items.length - p * PER);
  panel(v, 20, 94, 600, items.length ? 18 + n * rowH : 60); // o painel acompanha as linhas
  if (!items.length) { label(v, 40, y0 + 6, empty, { size: 15 }); return; }
  items.slice(p * PER, p * PER + PER).forEach((it, i) => draw(it, y0 + i * rowH));
  if (pages > 1) {
    button(v, 30, 446, '<', () => { pg[key] = p - 1; show(pvpView); }, { enabled: p > 0 });
    label(v, 66, 444, `${p + 1}/${pages}`);
    button(v, 120, 446, '>', () => { pg[key] = p + 1; show(pvpView); }, { enabled: p < pages - 1 });
  }
}

export const pvpView: View = {
  title: 'PvP',
  load: async () => {
    const me = sync.uid();
    if (!me) return { none: true };
    const w = await api.myWorld();
    if (!w) return { none: true };
    const [mine, recent] = await Promise.all([api.matches(me), api.recentMatches()]);
    await nameOf([...w.members.map(m => m.id), ...mine.concat(recent).flatMap(m => [m.challenger, m.opponent])]);
    const snaps = new Map((await api.snapshots(w.members.map(m => m.id))).map(s => [s.user_id, s]));
    return { w, mine, recent, snaps, me };
  },
  build(v, d) {
    if (d?.none) {
      panel(v, 60, 100, 520, 140);
      label(v, 90, 125, 'You are not in a world yet.', { w: 460 });
      label(v, 90, 165, 'Open the multiplayer setup to create or join a world.', { w: 460, size: 15 });
      return;
    }
    const { w, mine, recent, me } = d as { w: any; mine: Match[]; recent: Match[]; me: string };
    const inc = mine.filter(m => m.status === 'pending' && m.opponent === me);
    const out = mine.filter(m => m.status === 'pending' && m.challenger === me);
    const acc = mine.filter(m => m.status === 'accepted');
    tabs(v, [{ k: 'in', label: 'CHALLENGES', n: inc.length }, { k: 'new', label: 'CHALLENGE A FRIEND' }, { k: 'hist', label: 'HISTORY' }], tab,
      k => { tab = k as Tab; show(pvpView); });
    if (tab === 'in') {
      type Row = { m: Match; kind: 'in' | 'out' | 'acc' };
      const rows: Row[] = [...inc.map(m => ({ m, kind: 'in' as const })), ...acc.map(m => ({ m, kind: 'acc' as const })), ...out.map(m => ({ m, kind: 'out' as const }))];
      list(v, rows, 'in', 104, 54, ({ m, kind }, y) => {
        if (kind === 'in') {
          label(v, 36, y, nm(m.challenger), { size: 17 }).name = 'cn_' + m.id;
          label(v, 36, y + 24, desc(m), { size: 13 });
          button(v, 440, y + 6, 'ACCEPT', () => show(acceptView(m)), { scale: 95 });
          button(v, 528, y + 6, 'DECLINE', async () => { await api.declineMatch(m.id); await sync.refreshPending(); refresh(); }, { scale: 95 });
        } else if (kind === 'acc') {
          label(v, 36, y, `${nm(m.challenger)} ${t('vs')} ${nm(m.opponent)}`, { size: 17 });
          label(v, 36, y + 24, `${t('In progress')} · ${desc(m)}`, { size: 13 });
          button(v, 528, y + 6, 'WATCH', () => watch(m, true), { scale: 95 });
        } else {
          label(v, 36, y, `${t('to')} ${nm(m.opponent)}`, { size: 17 });
          label(v, 36, y + 24, `${t('Waiting for your friend')} · ${desc(m)}`, { size: 13 });
          button(v, 528, y + 6, 'CANCEL', async () => { await api.declineMatch(m.id); await sync.processInbox(); refresh(); }, { scale: 95 });
        }
      }, 'No challenges.');
    } else if (tab === 'new') {
      const others = (w.members as api.Profile[]).filter(p => p.id !== me);
      list(v, others, 'new', 104, 54, (p, y) => {
        dot(v, 40, y + 13, online.has(p.id));
        label(v, 54, y + 1, p.username, { size: 17 }).name = 'pn_' + p.id;
        const s = d.snaps.get(p.id);
        label(v, 54, y + 24, s ? `${money(s.money)} · ${t(s.days + ' days')} · ${t('Pyramid')} ${s.have.length}/15` : t('(no game linked)'), { size: 13 });
        button(v, 420, y + 6, 'FIGHT', () => show(composeView(p.id, 'battle')), { scale: 95 }).name = 'fight_' + p.id;
        button(v, 508, y + 6, 'RACE', () => show(composeView(p.id, 'race')), { scale: 95 }).name = 'race_' + p.id;
      }, 'No friends in your world yet.');
    } else {
      const done = recent.filter(m => m.status === 'done');
      list(v, done, 'hist', 104, 54, (m, y) => {
        const won = m.winner;
        label(v, 36, y, `${nm(m.challenger)} ${t('vs')} ${nm(m.opponent)}`, { size: 17 });
        label(v, 36, y + 24, `${desc(m)} · ${nm(won ?? '')} ${t('won')}`, { size: 13, color: 0x0a5c1a });
        button(v, 528, y + 6, 'WATCH', () => watch(m, false), { scale: 95 });
      }, 'No fights or races yet.');
    }
  },
};

// ───────────── desafiar ─────────────
const state = { sel: [] as string[], bet: '0' };
function composeView(id: string, kind: 'battle' | 'race'): View {
  state.sel = [];
  const max = kind === 'race' ? 2 : 3;
  const cv: View = {
    title: kind === 'battle' ? 'FIGHT' : 'RACE',
    back: pvpView,
    load: async () => { await nameOf([id]); return {}; },
    build(v) {
      label(v, 40, 62, `${t(kind === 'battle' ? 'Fight against' : 'Race against')} ${nm(id)}`, { size: 18 });
      panel(v, 20, 92, 310, 240);
      const hover = label(v, 24, 338, '', { size: 12 });
      const mine = myBugs();
      const grid = () => bugGrid(v, mine, 62, 124, {
        sel: state.sel,
        on: b => {
          const i = state.sel.indexOf(b.uid);
          if (i >= 0) state.sel.splice(i, 1); else if (state.sel.length < max) state.sel.push(b.uid); else { flash(`Pick up to ${max} bugs.`); return; }
          show(cv);
        },
        over: b => setText(hover, bugLine(b, stats(b))),
      });
      grid();
      panel(v, 340, 92, 280, 240);
      label(v, 354, 104, kind === 'battle' ? 'Pick 1 to 3 bugs. Your friend picks the same number.' : 'Pick 1 or 2 bugs. Your friend picks the same number.', { w: 252, size: 14 });
      label(v, 354, 190, `${t('Your team')}: ${state.sel.length}/${max}`, { size: 15 });
      label(v, 354, 226, 'Bet: $', { size: 15 });
      const bet = input(v, 420, 222, 90, 6, '0-9', state.bet);
      bet.name = 'inBet';
      label(v, 354, 256, '(the winner takes both bets)', { size: 12 });
      button(v, 354, 290, 'SEND CHALLENGE', async () => {
        mustLink();
        state.bet = bet.value();
        const tm = team(state.sel);
        const b = Math.max(0, +bet.value() | 0);
        if (b > G().nMoney) throw new Error('Not enough money to bet this amount!');
        if (b > 100000) throw new Error('Bet too high!');
        await api.createMatch(id, kind, b, tm);
        await sync.processInbox();
        flash('Challenge sent!');
        tab = 'in';
        show(pvpView);
      });
    },
  };
  return cv;
}

// ───────────── aceitar ─────────────
function acceptView(m: Match): View {
  const sel: string[] = [];
  const n = m.team_a.length;
  const av: View = {
    title: m.kind === 'battle' ? 'FIGHT' : 'RACE',
    back: pvpView,
    load: async () => { await nameOf([m.challenger]); return {}; },
    build(v) {
      label(v, 40, 62, `${nm(m.challenger)} · ${desc(m)}`, { size: 17 });
      panel(v, 20, 92, 190, 240);
      label(v, 32, 98, 'Their team', { size: 15 });
      bugGrid(v, m.team_a, 62, 150, { cols: 2, total: n, pitch: 80 });
      panel(v, 220, 92, 400, 240);
      label(v, 232, 98, `Pick exactly ${n} bugs.`, { size: 15 });
      const hover = label(v, 224, 338, '', { size: 12 });
      bugGrid(v, myBugs(), 262, 150, {
        sel, on: b => {
          const i = sel.indexOf(b.uid);
          if (i >= 0) sel.splice(i, 1); else if (sel.length < n) sel.push(b.uid); else { flash(`Pick up to ${n} bugs.`); return; }
          show(av);
        },
        over: b => setText(hover, bugLine(b, stats(b))),
      });
      button(v, 40, 366, 'START', async () => {
        mustLink();
        const tm = team(sel);
        if (tm.length !== n) throw new Error(`Pick exactly ${n} bugs.`);
        if (m.bet > G().nMoney) throw new Error('Not enough money to bet this amount!');
        const acc = await api.acceptMatch(m.id, tm);
        await sync.processInbox();
        watch(acc, true);
      });
    },
  };
  return av;
}
