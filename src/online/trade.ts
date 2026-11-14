// Tela "TRADE" (mercado): besouros à venda dos amigos (lista de venda do jogo deles, via snapshot) para comprar, ofertas
// recebidas/enviadas (aceitar, recusar, cancelar) e propor troca (besouro × besouro, com $ opcional).
import { _global } from '../engine/as2';
import * as api from './api';
import type { Bug, Offer, SellBug, Snapshot } from './api';
import * as sync from './sync';
import { online } from './shop';
import { bugOf, stats, myBug } from './bugs';
import { View, MC, label, button, panel, input, tabs, bugSlot, bugGrid, bugLine, show, refresh, flash, money, t, setText } from './kit';
import { nameOf, nm } from './friends';
import { dot } from './world';

const G = () => _global.GAME;
const myBugs = (): Bug[] => (G()?.aAdult ?? []).map(bugOf);
const mustLink = () => { if (!sync.linked()) throw new Error('Link this game to your player first.'); };

type Tab = 'sale' | 'offers' | 'trade';
let tab: Tab = 'sale';
const PER = 6;
const pg: Record<string, number> = {};

const part = (b: Bug | null, m: number) => [b ? `${t(b.sNickName)}` : '', b && m ? ' + ' : '', m ? money(m) : ''].join('') || '-';
const sexAge = (b: Bug) => `${b.nSex > 0 ? '♂' : '♀'} ${t((b.nAge_now / 10).toFixed(1) + ' Days')}`;

function list<T>(v: MC, items: T[], key: string, y0: number, rowH: number, draw: (it: T, y: number) => void, empty: string) {
  const pages = Math.max(1, Math.ceil(items.length / PER));
  const p = Math.min(pg[key] ?? 0, pages - 1);
  pg[key] = p;
  const n = Math.min(PER, items.length - p * PER);
  panel(v, 20, 94, 600, items.length ? 18 + n * rowH : 60); // o painel acompanha as linhas
  if (!items.length) { label(v, 40, y0 + 6, empty, { size: 15 }); return; }
  items.slice(p * PER, p * PER + PER).forEach((it, i) => draw(it, y0 + i * rowH));
  if (pages > 1) {
    button(v, 30, 446, '<', () => { pg[key] = p - 1; show(tradeView); }, { enabled: p > 0 });
    label(v, 66, 444, `${p + 1}/${pages}`);
    button(v, 120, 446, '>', () => { pg[key] = p + 1; show(tradeView); }, { enabled: p < pages - 1 });
  }
}

export const tradeView: View = {
  title: 'TRADE',
  load: async () => {
    const me = sync.uid();
    if (!me) return { none: true };
    const w = await api.myWorld();
    if (!w) return { none: true };
    const [os, snaps] = await Promise.all([api.offers(), api.snapshots(w.members.map(m => m.id))]);
    await nameOf([...w.members.map(m => m.id), ...os.flatMap(o => [o.from_user, o.to_user])]);
    return { w, os, snaps: new Map(snaps.map(s => [s.user_id, s])), me };
  },
  build(v, d) {
    if (d?.none) {
      panel(v, 60, 100, 520, 140);
      label(v, 90, 125, 'You are not in a world yet.', { w: 460 });
      label(v, 90, 165, 'Open the multiplayer setup to create or join a world.', { w: 460, size: 15 });
      return;
    }
    const { w, os, snaps, me } = d as { w: any; os: Offer[]; snaps: Map<string, Snapshot>; me: string };
    const inc = os.filter(o => o.status === 'pending' && o.to_user === me);
    tabs(v, [{ k: 'sale', label: 'FOR SALE' }, { k: 'offers', label: 'OFFERS', n: inc.length }, { k: 'trade', label: 'TRADE WITH A FRIEND' }], tab,
      k => { tab = k as Tab; show(tradeView); });
    if (tab === 'sale') {
      const items: { owner: string; bug: SellBug }[] = [];
      for (const m of w.members as api.Profile[]) if (m.id !== me) for (const b of snaps.get(m.id)?.sell ?? []) items.push({ owner: m.id, bug: b });
      items.sort((a, b) => a.bug.price - b.bug.price);
      list(v, items, 'sale', 100, 56, ({ owner, bug }, y) => {
        bugSlot(v, 58, y + 26, bug, { scale: 80 });
        label(v, 96, y, `${t(bug.sNickName)}  ${sexAge(bug)}`, { size: 16 }).name = 'sn_' + bug.uid;
        const st = stats(bug);
        label(v, 96, y + 22, `${t('ATK')} ${st.attack.toFixed(0)} · ${t('HP')} ${st.hp.toFixed(0)} · ${t('SPD')} ${st.speed.toFixed(2)} · ${nm(owner)}`, { size: 12 });
        label(v, 400, y + 8, money(bug.price), { size: 18, color: 0x0a2a5c });
        button(v, 520, y + 8, 'BUY', async () => {
          mustLink();
          if (bug.price > G().nMoney) throw new Error("You don't have enough money!");
          const { price, ...plain } = bug;
          await api.createOffer(owner, null, price, plain, 0);
          await sync.processInbox();
          flash('Purchase request sent!');
          refresh();
        }, { scale: 95 }).name = 'buy_' + bug.uid;
      }, 'No bugs for sale in your world.');
    } else if (tab === 'offers') {
      type Row = { o: Offer; kind: 'in' | 'out' | 'old' };
      const rows: Row[] = [
        ...inc.map(o => ({ o, kind: 'in' as const })),
        ...os.filter(o => o.status === 'pending' && o.from_user === me).map(o => ({ o, kind: 'out' as const })),
        ...os.filter(o => o.status !== 'pending').slice(0, 8).map(o => ({ o, kind: 'old' as const })),
      ];
      const accept = async (o: Offer) => {
        mustLink();
        const mine = o.want_bug ? myBug(o.want_bug.uid) : null;
        if (o.want_bug && !mine) throw new Error('You no longer have that bug.');
        if (o.want_money > G().nMoney) throw new Error("You don't have enough money!");
        await api.respondOffer(o.id, true, mine ? bugOf(mine) : null);
        await sync.processInbox(); await sync.refreshPending();
        refresh();
      };
      list(v, rows, 'offers', 104, 54, ({ o, kind }, y) => {
        if (kind === 'in') {
          label(v, 36, y, nm(o.from_user), { size: 17 }).name = 'on_' + o.id;
          label(v, 36, y + 24, `${t('gives:')} ${part(o.give_bug, o.give_money)} — ${t('wants:')} ${part(o.want_bug, o.want_money)}`, { size: 13 });
          button(v, 440, y + 6, 'ACCEPT', () => accept(o), { scale: 95 }).name = 'acc_' + o.id;
          button(v, 528, y + 6, 'DECLINE', async () => { await api.respondOffer(o.id, false); await sync.refreshPending(); refresh(); }, { scale: 95 });
        } else if (kind === 'out') {
          label(v, 36, y, `${t('to')} ${nm(o.to_user)}`, { size: 17 });
          label(v, 36, y + 24, `${t('you give')} ${part(o.give_bug, o.give_money)} — ${t('you get')} ${part(o.want_bug, o.want_money)}`, { size: 13 });
          button(v, 528, y + 6, 'CANCEL', async () => { await api.cancelOffer(o.id); await sync.processInbox(); refresh(); }, { scale: 95 });
        } else {
          label(v, 36, y, `${nm(o.from_user)} → ${nm(o.to_user)}`, { size: 15, color: 0x3a4a5c });
          label(v, 36, y + 22, `${part(o.give_bug, o.give_money)} ⇄ ${part(o.want_bug, o.want_money)} · ${t(o.status)}`, { size: 13, color: 0x3a4a5c });
        }
      }, 'No offers.');
    } else {
      const others = (w.members as api.Profile[]).filter(p => p.id !== me);
      list(v, others, 'trade', 104, 54, (p, y) => {
        dot(v, 40, y + 13, online.has(p.id));
        label(v, 54, y + 1, p.username, { size: 17 }).name = 'tn_' + p.id;
        const s = snaps.get(p.id);
        label(v, 54, y + 24, s ? `${money(s.money)} · ${t(s.days + ' days')} · ${s.bugs.length} ${t('bugs')}` : t('(no game linked)'), { size: 13 });
        button(v, 470, y + 6, 'OFFER TRADE', () => show(offerView(p.id)), { scale: 95 }).name = 'offer_' + p.id;
      }, 'No friends in your world yet.');
    }
  },
};

// ───────────── propor troca ─────────────
function offerView(id: string): View {
  const st = { give: null as string | null, want: null as string | null, gm: '0', wm: '0' };
  const ov: View = {
    title: 'TRADE',
    back: tradeView,
    load: async () => { await nameOf([id]); return { s: await api.snapshot(id) }; },
    build(v, d) {
      const s: Snapshot | null = d.s;
      label(v, 40, 62, `${t('Trade with')} ${nm(id)}`, { size: 18 });
      const mine = myBugs();
      const hover = label(v, 24, 336, '', { size: 12 });
      let gmIn: MC, wmIn: MC;
      const keep = () => { st.gm = gmIn.value(); st.wm = wmIn.value(); };
      panel(v, 20, 92, 295, 238);
      label(v, 30, 94, 'You give', { size: 14 });
      bugGrid(v, mine, 54, 148, { pitch: 62, scale: 90, sel: st.give ? [st.give] : [],
        on: b => { keep(); st.give = st.give === b.uid ? null : b.uid; show(ov); }, over: b => setText(hover, bugLine(b, stats(b))) });
      label(v, 30, 302, '+ money: $', { size: 14 });
      gmIn = input(v, 130, 298, 90, 7, '0-9', st.gm);
      gmIn.name = 'inGive';
      panel(v, 325, 92, 295, 238);
      label(v, 335, 94, 'You want', { size: 14 });
      bugGrid(v, s?.bugs ?? [], 359, 148, { pitch: 62, scale: 90, sel: st.want ? [st.want] : [],
        on: b => { keep(); st.want = st.want === b.uid ? null : b.uid; show(ov); }, over: b => setText(hover, bugLine(b, stats(b))) });
      label(v, 335, 302, '+ money: $', { size: 14 });
      wmIn = input(v, 435, 298, 90, 7, '0-9', st.wm);
      wmIn.name = 'inWant';
      button(v, 20, 366, 'SEND OFFER', async () => {
        mustLink();
        keep();
        const give = st.give ? mine.find(b => b.uid === st.give)! : null;
        const want = st.want ? s?.bugs.find(b => b.uid === st.want) ?? null : null;
        const giveMoney = Math.max(0, +st.gm | 0), wantMoney = Math.max(0, +st.wm | 0);
        if (!give && !want) throw new Error('Pick at least one bug.');
        if (give && give.nAge_now < 150) throw new Error('The bug is not old enough to sell!');
        if (giveMoney > G().nMoney) throw new Error("You don't have enough money!");
        await api.createOffer(id, give, giveMoney, want, wantMoney);
        await sync.processInbox();
        flash('Offer sent!');
        tab = 'offers';
        show(tradeView);
      });
    },
  };
  return ov;
}
