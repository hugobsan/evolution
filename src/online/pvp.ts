// Tela "PvP" (arena): desafios recebidos (aceitar e escolher o time), desafiar amigos (luta/corrida + aposta) e histórico
// recente do mundo com ASSISTIR. Atributos no rollover = caixa preta de info do jogo; aceitar = popup de adversário da
// arena (o mesmo dos NPCs), com o time do desafiante no lado do adversário e a aposta do desafio.
import { _global, _root } from '../engine/as2';
import { Game } from '../game/classes/Game';
import { SFM } from '../game/classes/SFM';
import { clipActions } from '../game/timeline';
import * as api from './api';
import type { Bug, Match } from './api';
import * as sync from './sync';
import { online } from './shop';
import { bugOf, myBug, battleOb } from './bugs';
import { View, MC, label, button, panel, input, tabs, bugGrid, infoBox, show, refresh, flash, money, t, close } from './kit';
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
          button(v, 440, y + 6, 'ACCEPT', () => acceptPopup(m), { scale: 95 }).name = 'acc_' + m.id;
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
      // painel de info: o lado da disputa (corrida mostra o tamanho) e a marca do melhor besouro, como na arena
      G().pSell = { nId: -1, nBattle: kind === 'battle' ? 1 : -1, nMoney: 0, nDif: 1, aBug_have: [], aBug_age: [], aBug_color: [], aBug_random: [] };
      G().paRace = [];
      const box = infoBox(v);
      const mine = myBugs();
      const grid = () => bugGrid(v, mine, 62, 124, {
        sel: state.sel,
        on: b => {
          const i = state.sel.indexOf(b.uid);
          if (i >= 0) state.sel.splice(i, 1); else if (state.sel.length < max) state.sel.push(b.uid); else { flash(`Pick up to ${max} bugs.`); return; }
          state.bet = bet.value(); // a tela é redesenhada: guarda a aposta já digitada
          show(cv);
        },
        over: b => box?.setFrame?.('battle', battleOb(b)),
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

// ───────────── aceitar: popup de adversário da arena ─────────────
function acceptPopup(m: Match) {
  mustLink();
  if (m.bet > G().nMoney) throw new Error('Not enough money to bet this amount!');
  const g = G(), a = m.team_a;
  // pSell no formato dos NPCs (o popup e o painel de info leem daqui) + o desafio
  g.pSell = { nId: -1, nBattle: m.kind === 'battle' ? 1 : -1, nMoney: m.bet, nDif: 1, pvp: m,
    aBug_have: a.map(b => b.nId), aBug_color: a.map(b => b.nId_color), aBug_age: a.map(b => b.nAge_now), aBug_random: a.map(b => b.nRandom) };
  close(false, false);
  const pop = SFM.addClip('mPop', _root, { sTxt: m.bet, ob: g.pSell, sFrame: m.kind === 'battle' ? 'BATTLE' : 'RACE' });
  setTimeout(() => {
    const f = pop?.zName?.tTxt;
    if (f) { f.text = String(m.bet); f.changed?.(); } // aposta = a do desafio
    const cpu = pop?.children?.find((c: any) => c.depth === 65 - 16384); // rótulo "CPU" → nome do desafiante
    if (cpu) { cpu.sTxt = nm(m.challenger); cpu.tTxt?.changed?.(); cpu.Replace?.(); }
  }, 150);
}

// rollover no time do desafiante: os atributos reais (não a conta dos NPCs por idade)
const P = Game.prototype as any;
const rollOver = P.rtRollOver;
P.rtRollOver = function (this: any, ico: any) {
  const b = this.pSell?.pvp?.team_a?.[ico?.nId_2];
  if (b && this.nScreen == 1 && ico.nSide == 1) { this.mClip?.mInfo?.setFrame('battle', battleOb(b)); return; }
  return rollOver.call(this, ico);
};

// START do popup (luta: 84:14:60, corrida: 84:15:60): num desafio, aceita com o time escolhido e abre a disputa
let busy = false;
for (const key of ['84:14:60', '84:15:60']) {
  const acts: any = clipActions[key];
  const press = acts.press;
  acts.press = function (this: any) {
    const g = G(), m: Match | undefined = g?.pSell?.pvp;
    if (!m) return press.call(this);
    const picked = (m.kind === 'battle' ? g.paBattle : g.paRace).filter(Boolean);
    if (picked.length !== m.team_a.length) { g.popWord(`Pick exactly ${m.team_a.length} bugs.`); return; }
    if (busy) return;
    busy = true;
    const pop = this._parent;
    api.acceptMatch(m.id, picked.map(bugOf)).then(async acc => {
      await sync.processInbox();
      pop?.removeMovieClip();
      watch(acc, true);
    }, e => g.popWord(e.message || String(e))).finally(() => { busy = false; });
  };
}
