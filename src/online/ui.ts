// Painel online: HTML sobreposto ao canvas, no estilo dos popups do jogo (formulários e listas não existem no motor).
// Desenhado em coordenadas do jogo (640×480) e escalado junto com o canvas. Textos em EN, traduzidos por i18n.tr.
import { player } from '../engine/core';
import { _global, _root, ColorMatrixFilter, BitmapData } from '../engine/as2';
import { Adult } from '../game/classes/Adult';
import { getLang, tr, onLangChange } from '../game/i18n';
import * as api from './api';
import type { Bug, Match, Offer, Profile } from './api';
import * as sync from './sync';
import { bugOf, stats, myBug } from './bugs';
import * as match from './match';
import { inShop } from './shop';
import { WORLD_MAX } from './config';

const t = (s: string) => (getLang() === 'pt' ? tr(s, false) : s);
const G = () => _global.GAME;

// ───────────── miniaturas do besouro (sprite do SWF desenhado fora da tela) ─────────────
const thumbs = new Map<string, string>();
export function thumb(nId: number, color = -1): string {
  const k = nId + ':' + color;
  let url = thumbs.get(k);
  if (url) return url;
  const root = player().root as any;
  const holder = root.__thumbs ?? (root.__thumbs = root.createEmptyMovieClip('__thumbs', 32000));
  holder._visible = false;
  const b = holder.attachMovie('beetle', 'b', 0);
  b.gotoAndStop(nId + 1);
  b.mHead?.gotoAndStop(nId + 1);
  b.mBoot?.gotoAndStop(b.mBoot._totalframes);
  if (color >= 0) b.filters = [new ColorMatrixFilter(Adult.aColor[color])];
  b._rotation = -90;
  const r0 = b.getBounds(holder);
  const s = 52 / Math.max(r0.xMax - r0.xMin, r0.yMax - r0.yMin);
  b._xscale = b._yscale = 100 * s;
  const r = b.getBounds(holder);
  b._x = 28 - (r.xMin + r.xMax) / 2;
  b._y = 28 - (r.yMin + r.yMax) / 2;
  const bmp = new BitmapData(56, 56, true);
  bmp.draw(b);
  url = bmp.canvas.toDataURL();
  bmp.dispose();
  b.removeMovieClip();
  thumbs.set(k, url);
  return url;
}

// ───────────── DOM ─────────────
type Kid = Node | string | null | undefined | false | Kid[];
function el(tag: string, attrs: Record<string, any> = {}, ...kids: Kid[]): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  const add = (k: Kid) => { if (Array.isArray(k)) k.forEach(add); else if (k != null && k !== false) e.append(k as any); };
  kids.forEach(add);
  return e;
}
const btn = (label: string, on: () => any, cls = '') =>
  el('button', { type: 'button', class: 'evo-btn ' + cls, onclick: (e: Event) => { e.stopPropagation(); run(on); } }, t(label));
const h = (s: string) => el('h3', {}, t(s));
const p = (...k: Kid[]) => el('p', {}, ...k);
const money = (n: number) => '$ ' + (n | 0);

const CSS = `
.evo-ol{position:absolute;z-index:40;overflow:hidden}
.evo-in{position:absolute;left:0;top:0;width:640px;height:480px;transform-origin:0 0;background:rgba(0,0,0,.35)}
.evo-box{position:absolute;left:14px;top:12px;width:606px;height:452px;box-sizing:border-box;background:rgba(4,8,12,.97);
 border:2px solid #fff;border-radius:6px;color:#fff;font:12px/1.35 Verdana,Tahoma,sans-serif;display:flex;flex-direction:column}
.evo-tabs{display:flex;gap:4px;padding:6px 6px 0;border-bottom:1px solid #456}
.evo-tab{background:none;border:0;color:#9ab;font:bold 12px Verdana,sans-serif;padding:6px 9px;cursor:pointer;border-radius:4px 4px 0 0}
.evo-tab[aria-selected=true]{color:#fff;background:#24425c}
.evo-x{margin-left:auto}
.evo-body{flex:1;overflow-y:auto;padding:8px 12px}
.evo-msg{min-height:18px;padding:3px 12px 6px;color:#00ccff}
.evo-msg.err{color:#ff7b6b}
.evo-btn{background:linear-gradient(#6b829b,#2e4054);border:1px solid #d6e6f5;border-radius:3px;color:#fff;font:bold 11px Verdana,sans-serif;
 padding:4px 9px;cursor:pointer;margin:2px 4px 2px 0;text-transform:uppercase}
.evo-btn:hover{background:linear-gradient(#8aa3bd,#3d5670)}.evo-btn:disabled{opacity:.45;cursor:default}
.evo-btn.ok{background:linear-gradient(#5f9d55,#2d5a28)}.evo-btn.no{background:linear-gradient(#a9675f,#5a2d28)}
.evo-box h3{margin:10px 0 5px;font-size:12px;color:#00ccff;text-transform:uppercase}
.evo-box h3.evo-name{text-transform:none;font-size:15px;color:#fff}
.evo-box p{margin:4px 0}
.evo-box input{background:#111;border:1px solid #9ab;color:#fff;font:12px Verdana,sans-serif;padding:4px 6px;border-radius:3px;margin:2px 4px 2px 0}
.evo-box input[type=number]{width:80px}
.evo-row{display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #223}
.evo-row .grow{flex:1}
.evo-dim{color:#8a9aa8}
.evo-cards{display:flex;flex-wrap:wrap;gap:6px}
.evo-card{width:132px;border:1px solid #456;border-radius:4px;padding:4px;display:flex;gap:4px;background:#0c1620;font-size:10px;line-height:1.3;cursor:default}
.evo-card.pick{cursor:pointer}.evo-card.sel{border-color:#00ccff;background:#123247;box-shadow:0 0 0 1px #00ccff}
.evo-card img{width:40px;height:40px;flex:none}
.evo-card b{font-size:11px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:84px}
.evo-pyr{display:flex;flex-direction:column;align-items:center;gap:1px}
.evo-pyr div{display:flex;gap:1px}
.evo-pyr img{width:36px;height:36px}.evo-pyr img.off{filter:grayscale(1);opacity:.22}
`;

let ol: HTMLElement | null = null;
let inner: HTMLElement, body: HTMLElement, msgEl: HTMLElement, tabsEl: HTMLElement;
let view: () => Promise<Kid> | Kid = viewWorld;
let tab = 'world';
const names = new Map<string, string>();

function layout() {
  if (!ol) return;
  const c = player().canvas, st = ol.parentElement!;
  const cr = c.getBoundingClientRect(), pr = st.getBoundingClientRect();
  Object.assign(ol.style, { left: cr.left - pr.left + 'px', top: cr.top - pr.top + 'px', width: cr.width + 'px', height: cr.height + 'px' });
  inner.style.transform = `scale(${cr.width / 640})`;
}
addEventListener('resize', layout);

export const isOpen = () => !!ol;
export function open(v?: () => Promise<Kid> | Kid, tabName?: string) {
  if (!ol) {
    if (!document.getElementById('evo-css')) document.head.append(el('style', { id: 'evo-css' }, CSS));
    tabsEl = el('div', { class: 'evo-tabs', role: 'tablist' });
    body = el('div', { class: 'evo-body' });
    msgEl = el('div', { class: 'evo-msg', role: 'status', 'aria-live': 'polite' });
    inner = el('div', { class: 'evo-in' }, el('div', { class: 'evo-box', role: 'dialog', 'aria-label': 'Online' }, tabsEl, body, msgEl));
    ol = el('div', { class: 'evo-ol', id: 'evo-online' }, inner);
    for (const ev of ['pointerdown', 'pointerup', 'pointermove', 'click', 'wheel']) ol.addEventListener(ev, e => e.stopPropagation());
    ol.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); });
    player().canvas.parentElement!.append(ol);
    G()?.stop(); // como os mPop: o jogo pausa enquanto o painel está aberto
  }
  if (!api.session) { v = viewAccount; tabName = 'account'; }
  if (v) view = v;
  if (tabName) tab = tabName;
  layout();
  render();
}
export function close() {
  ol?.remove();
  ol = null;
  const g = G();
  const pop = _root?.children?.some((c: any) => String(c.name).startsWith('mPop'));
  if (g?.mClip && !pop && g.mClip.mBar?._currentframe == 1 && g.nScreen <= 2) g.start();
}

let renderId = 0;
async function render() {
  if (!ol) return;
  const id = ++renderId;
  const T = (k: string, label: string, v: () => any) =>
    el('button', { type: 'button', class: 'evo-tab', role: 'tab', 'aria-selected': String(tab === k), onclick: () => { msg(''); open(v, k); } }, t(label));
  tabsEl.replaceChildren(
    ...(api.session ? [T('world', 'WORLD', viewWorld), T('offers', 'OFFERS', viewOffers), T('matches', 'CHALLENGES', viewMatches)] : []),
    T('account', 'ACCOUNT', viewAccount),
    el('button', { type: 'button', class: 'evo-tab evo-x', 'aria-label': 'Close', onclick: close }, t('CLOSE')),
  );
  ol.dataset.busy = '1'; // testes esperam o render terminar
  try {
    const kids = await view();
    if (id !== renderId || !ol) return;
    body.replaceChildren(el('div', {}, kids as any));
  } catch (e: any) { msg(e.message, true); }
  if (id === renderId) delete ol?.dataset.busy;
}
function msg(s: string, err = false) { if (msgEl) { msgEl.textContent = t(s); msgEl.className = 'evo-msg' + (err ? ' err' : ''); } }
/** executa uma ação de botão: erros viram mensagem; re-renderiza no fim */
async function run(f: () => any) {
  try { await f(); } catch (e: any) { msg(e.message || String(e), true); return; }
  render();
}
sync.onState(() => {
  if (ol && sync.state.conflict) close(); // a pergunta do conflito é um mPop no canvas: o painel não pode cobri-la
  else if (ol && !body.contains(document.activeElement)) render();
});
onLangChange(() => render());

async function nameOf(ids: string[]) {
  const miss = [...new Set(ids)].filter(i => i && !names.has(i));
  for (const p of await api.profilesByIds(miss)) names.set(p.id, p.username);
  if (api.me) names.set(api.me.id, api.me.username);
}
const nm = (id: string) => names.get(id) ?? t('(former member)');

function needLink(): Kid {
  return sync.linked() ? null : el('p', { class: 'evo-msg err' }, t('Link this game to your player first.'), ' ', btn('ACCOUNT', () => open(viewAccount, 'account')));
}

// ───────────── besouros ─────────────
function card(b: Bug, opts: { pick?: boolean; sel?: boolean; on?: () => void } = {}) {
  const s = stats(b);
  return el('div', {
    class: 'evo-card' + (opts.pick ? ' pick' : '') + (opts.sel ? ' sel' : ''), role: opts.pick ? 'checkbox' : null,
    'aria-checked': opts.pick ? String(!!opts.sel) : null, tabindex: opts.pick ? 0 : null,
    onclick: opts.on, onkeydown: opts.on ? (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); opts.on!(); } } : null,
    'data-uid': b.uid,
  },
  el('img', { src: thumb(b.nId, b.nId_color), alt: '' }),
  el('div', {}, el('b', { title: b.sNickName }, t(b.sNickName)),
    `${b.nSex > 0 ? '♂' : '♀'} ${t((b.nAge_now / 10).toFixed(1) + ' Days')}`, el('br'),
    `${t('ATK')} ${s.attack.toFixed(0)} · ${t('HP')} ${s.hp.toFixed(0)}`, el('br'), `${t('SPD')} ${s.speed.toFixed(2)}`));
}
const myBugs = (): Bug[] => (G()?.aAdult ?? []).map(bugOf);

function pyramid(have: number[]) {
  const rows = [[14], [12, 13], [9, 10, 11], [5, 6, 7, 8], [0, 1, 2, 3, 4]];
  return el('div', { class: 'evo-pyr', role: 'img', 'aria-label': `${have.length}/15` },
    rows.map(r => el('div', {}, r.map(i => el('img', { src: thumb(i), class: have.includes(i) ? '' : 'off', alt: '' })))));
}

// ───────────── conta / identidade ─────────────
/** botão que pede um segundo clique para confirmar (sem diálogos do navegador) */
function sureBtn(label: string, warn: string, f: () => any, cls = 'no') {
  let armed = false;
  const b = btn(label, async () => {
    if (!armed) { armed = true; b.textContent = t('SURE?'); throw new Error(warn); }
    await f();
  }, cls);
  return b;
}
async function copy(s: string) {
  try { await navigator.clipboard.writeText(s); msg('Copied!'); } catch { msg('Select the text and copy it.'); }
}
const localName = () => String(_root?.mGame?.sPlayer ?? '').slice(0, 16);

async function viewAccount(): Promise<Kid> {
  if (!api.session) {
    const name = el('input', { type: 'text', id: 'evo-name', maxlength: 16, minlength: 2, required: true, value: localName(), autocomplete: 'nickname' }) as HTMLInputElement;
    const code = el('input', { type: 'text', id: 'evo-code', placeholder: 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX', autocomplete: 'off', spellcheck: 'false', size: 32 }) as HTMLInputElement;
    return [
      h('Play online'),
      p(t('Enter your name to play with friends: create a world and share its code, or join a friend\'s world.')),
      el('form', { onsubmit: (e: Event) => { e.preventDefault(); run(async () => { await api.start(name.value); await afterLogin(); }); } },
        el('label', { for: 'evo-name' }, t('Your name')), ' ', name, ' ', el('button', { type: 'submit', class: 'evo-btn ok' }, t('PLAY ONLINE'))),
      h('Already played online?'),
      p(el('span', { class: 'evo-dim' }, t('Use your recovery code to get your player back on this device.'))),
      el('form', { onsubmit: (e: Event) => { e.preventDefault(); run(async () => { await api.recover(code.value); await afterLogin(); }); } },
        el('label', { for: 'evo-code' }, t('Recovery code')), ' ', code, ' ', el('button', { type: 'submit', class: 'evo-btn' }, t('RECOVER'))),
      p(el('span', { class: 'evo-dim' }, t('Playing offline still works: the online mode only adds friends, trades and challenges.'))),
    ];
  }
  const code = api.storedCode();
  const nameIn = el('input', { type: 'text', id: 'evo-rename', maxlength: 16, value: api.me?.username ?? '', 'aria-label': t('Your name') }) as HTMLInputElement;
  const out: Kid[] = [
    h('Your player'),
    el('form', { onsubmit: (e: Event) => { e.preventDefault(); run(async () => { await api.rename(nameIn.value); msg('Saved!'); }); } },
      nameIn, el('button', { type: 'submit', class: 'evo-btn' }, t('SAVE NAME'))),
    h('Recovery code'),
    code ? p(el('code', { id: 'evo-mycode', style: 'font-size:14px;color:#ff0;user-select:all' }, api.formatCode(code)), ' ', btn('COPY', () => copy(api.formatCode(code))))
      : api.session.user.is_anonymous ? p(btn('CREATE RECOVERY CODE', () => api.ensureCode(), 'ok'))
      : p(el('span', { class: 'evo-dim' }, t('The recovery code is not stored on this device.'))),
    p(el('span', { class: 'evo-dim' }, t('Keep this code: it brings your player back if you clear the browser, and lets you play on another device.'))),
    h('Cloud save'),
  ];
  if (sync.linked()) {
    out.push(p(t('This game is linked to your player (cloud save).')), btn('SYNC NOW', async () => { await sync.pushNow(true); msg('Saved!'); }));
  } else if (G()) {
    const s = await api.getSave();
    if (!s) out.push(p(t('Link this game to your player?')), btn('LINK THIS GAME', async () => { await sync.linkThisGame(); msg('Linked!'); }, 'ok'));
    else {
      const d = s.data ?? {};
      out.push(p(t('Your player already has a cloud save:'), ' ', `${money(d.nMoney)} · ${t((Math.floor(d.nTime / 10)) + ' days')}`),
        btn('LOAD CLOUD SAVE', () => { close(); sync.loadCloud(s); }, 'ok'),
        btn('USE THIS GAME', async () => { await sync.linkThisGame(s.rev); msg('Linked!'); }));
    }
  }
  out.push(p(el('span', { class: 'evo-dim' }, t('Your local game is always kept on this device, online or not.'))),
    p(sureBtn('SIGN OUT', 'Without the recovery code this player is lost. Click again to sign out.', async () => { await api.signOut(); await onSignOut(); })));
  return out;
}
let afterLogin = async () => {};
let onSignOut = async () => {};
export function setAuthHooks(login: () => Promise<void>, logout: () => Promise<void>) { afterLogin = login; onSignOut = logout; }

// ───────────── mundo (os "amigos" são os membros do mesmo mundo) ─────────────
async function viewWorld(): Promise<Kid> {
  const me = sync.uid()!;
  const w = await api.myWorld();
  if (!w) {
    const code = el('input', { type: 'text', id: 'evo-world-code', maxlength: 8, placeholder: 'ABC234', autocomplete: 'off', size: 10, style: 'text-transform:uppercase' }) as HTMLInputElement;
    return [
      needLink(),
      h('Create a world'),
      p(t(`Create a world and share its code with up to ${WORLD_MAX - 1} friends.`)),
      p(btn('CREATE WORLD', async () => { await api.createWorld(); await sync.refreshPending(); }, 'ok')),
      h('Join a world'),
      el('form', { onsubmit: (e: Event) => { e.preventDefault(); run(async () => { await api.joinWorld(code.value); await sync.refreshPending(); msg('Welcome to the world!'); }); } },
        el('label', { for: 'evo-world-code' }, t('World code')), ' ', code, ' ', el('button', { type: 'submit', class: 'evo-btn ok' }, t('JOIN'))),
    ];
  }
  const owner = w.world.owner === me;
  for (const m of w.members) names.set(m.id, m.username);
  const snaps = new Map((await api.snapshots(w.members.map(m => m.id))).map(s => [s.user_id, s]));
  return [
    needLink(),
    h('World'),
    p(t('World code:'), ' ', el('code', { id: 'evo-world', style: 'font-size:16px;color:#ff0;user-select:all' }, w.world.code), ' ',
      btn('COPY', () => copy(w.world.code)), ' ', el('span', { class: 'evo-dim' }, `${w.members.length}/${WORLD_MAX} ${t('players')}`)),
    w.members.map(m => {
      const s = snaps.get(m.id);
      return el('div', { class: 'evo-row', 'data-member': m.id },
        el('span', { class: 'grow' }, el('b', {}, m.username), ' ',
          m.id === w.world.owner ? el('span', { class: 'evo-dim' }, t('(owner)'), ' ') : null,
          m.id === me ? el('span', { class: 'evo-dim' }, t('(you)'), ' ') : null,
          el('span', { class: 'evo-dim' }, s ? `${money(s.money)} · ${t(s.days + ' days')} · ${t('Pyramid')} ${s.have.length}/15` : t('(no game linked)')),
          inShop.has(m.id) ? el('span', {}, ' · ', t('in the shop now')) : null),
        m.id !== me ? btn('PROFILE', () => openProfile(m.id)) : null,
        owner && m.id !== me ? sureBtn('REMOVE', 'Click again to remove this player from the world.', async () => { await api.kickMember(m.id); await sync.refreshPending(); }) : null);
    }),
    p(),
    owner ? sureBtn('END MULTIPLAYER', 'Everyone leaves the world (local games are kept). Click again to end it.', async () => { await api.endWorld(); await sync.refreshPending(); })
      : sureBtn('LEAVE WORLD', 'Click again to leave the world.', async () => { await api.leaveWorld(); await sync.refreshPending(); }),
  ];
}

// ───────────── perfil do amigo ─────────────
export const openProfile = (id: string) => open(() => viewProfile(id), 'world');
async function viewProfile(id: string): Promise<Kid> {
  await nameOf([id]);
  const [s, ms] = await Promise.all([api.snapshot(id), api.matches(id)]);
  await nameOf(ms.flatMap(m => [m.challenger, m.opponent]));
  const done = ms.filter(m => m.status === 'done');
  return [
    p(btn('BACK', () => open(viewWorld))),
    el('h3', { class: 'evo-name' }, nm(id)),
    s ? p(`${money(s.money)} · ${t(s.days + ' days')} · ${t('Pyramid')} ${s.have.length}/15`, inShop.has(id) ? ' · ' + t('in the shop now') : '')
      : p(el('span', { class: 'evo-dim' }, t('(no game linked)'))),
    p(btn('OFFER TRADE', () => open(() => viewOffer(id))), btn('CHALLENGE: FIGHT', () => open(() => viewChallenge(id, 'battle'))),
      btn('CHALLENGE: RACE', () => open(() => viewChallenge(id, 'race')))),
    s ? el('div', { style: 'display:flex;gap:16px;align-items:flex-start' },
      el('div', {}, h('Pyramid'), pyramid(s.have)),
      el('div', { style: 'flex:1' }, h('Bug collection'), el('div', { class: 'evo-cards' }, s.bugs.map(b => card(b))))) : null,
    h('Fights and races'),
    done.length ? done.map(m => matchRow(m, id)) : p(el('span', { class: 'evo-dim' }, t('No fights or races yet.'))),
  ];
}

function matchRow(m: Match, pov: string) {
  const other = m.challenger === pov ? m.opponent : m.challenger;
  const won = m.winner === pov;
  return el('div', { class: 'evo-row' },
    el('span', { class: 'grow' }, `${t(m.kind === 'battle' ? 'FIGHT' : 'RACE')} · ${t('vs')} ${nm(other)} · `,
      el('b', { style: `color:${won ? '#7f7' : '#f99'}` }, t(won ? 'won' : 'lost')), ` · ${t('Bet')} ${money(m.bet)}`),
    btn('WATCH', () => watch(m, false)));
}
function watch(m: Match, live: boolean) {
  close();
  match.play(m, [nm(m.challenger), nm(m.opponent)], live);
}

// ───────────── ofertas ─────────────
async function viewOffer(id: string): Promise<Kid> {
  await nameOf([id]);
  const s = await api.snapshot(id);
  const sel = (view as any).sel ?? ((view as any).sel = { give: null as string | null, want: null as string | null });
  const num = (k: string, label: string) => el('input', { type: 'number', min: 0, value: sel[k] ?? 0, 'aria-label': t(label), id: 'evo-' + k,
    oninput: (e: any) => { sel[k] = e.target.value; } }) as HTMLInputElement;
  const gm = num('give_money', 'Money you give'), wm = num('want_money', 'Money you want');
  const mine = myBugs();
  const send = async () => {
    const give = sel.give ? mine.find(b => b.uid === sel.give)! : null;
    const want = sel.want ? s?.bugs.find(b => b.uid === sel.want) ?? null : null;
    const giveMoney = Math.max(0, +gm.value | 0), wantMoney = Math.max(0, +wm.value | 0);
    if (!give && !want) throw new Error('Pick at least one bug.');
    if (give && give.nAge_now < 150) throw new Error('The bug is not old enough to sell!');
    if (giveMoney > G().nMoney) throw new Error("You don't have enough money!");
    await api.createOffer(id, give, giveMoney, want, wantMoney);
    await sync.processInbox();
    msg('Offer sent!');
    open(viewOffers, 'offers');
  };
  return [
    p(btn('BACK', () => open(() => viewProfile(id)))),
    el('h3', {}, t('Trade with') + ' ', el('span', { style: 'text-transform:none' }, nm(id))), needLink(),
    h('You give'),
    el('div', { class: 'evo-cards' }, mine.map(b => card(b, { pick: true, sel: sel.give === b.uid, on: () => { sel.give = sel.give === b.uid ? null : b.uid; render(); } }))),
    p(t('+ money: $'), gm),
    h('You want'),
    el('div', { class: 'evo-cards' }, (s?.bugs ?? []).map(b => card(b, { pick: true, sel: sel.want === b.uid, on: () => { sel.want = sel.want === b.uid ? null : b.uid; render(); } }))),
    p(t('+ money: $'), wm),
    p(btn('SEND OFFER', send, 'ok')),
  ];
}

const offerPart = (b: Bug | null, m: number) => [b ? t(b.sNickName) : '', b && m ? ' + ' : '', m ? money(m) : ''].join('') || '-';
const offerText = (o: Offer) => `${offerPart(o.give_bug, o.give_money)} ⇄ ${offerPart(o.want_bug, o.want_money)}`;
async function viewOffers(): Promise<Kid> {
  const me = sync.uid()!;
  const os = await api.offers();
  await nameOf(os.flatMap(o => [o.from_user, o.to_user]));
  const accept = async (o: Offer) => {
    const mine = o.want_bug ? myBug(o.want_bug.uid) : null;
    if (o.want_bug && !mine) throw new Error('You no longer have that bug.');
    if (o.want_money > G().nMoney) throw new Error("You don't have enough money!");
    await api.respondOffer(o.id, true, mine ? bugOf(mine) : null);
    await sync.processInbox(); await sync.refreshPending();
  };
  const inc = os.filter(o => o.status === 'pending' && o.to_user === me);
  const out = os.filter(o => o.status === 'pending' && o.from_user === me);
  const old = os.filter(o => o.status !== 'pending').slice(0, 8);
  return [
    needLink(),
    h('Offers received'),
    inc.length ? inc.map(o => el('div', { class: 'evo-row', 'data-offer': o.id },
      el('span', { class: 'grow' }, el('b', {}, nm(o.from_user)), ' ', t('gives:'), ' ', offerPart(o.give_bug, o.give_money), ' — ', t('wants:'), ' ', offerPart(o.want_bug, o.want_money)),
      btn('ACCEPT', () => accept(o), 'ok'), btn('DECLINE', () => api.respondOffer(o.id, false).then(sync.refreshPending), 'no')))
      : p(el('span', { class: 'evo-dim' }, t('None.'))),
    h('Offers sent'),
    out.length ? out.map(o => el('div', { class: 'evo-row', 'data-offer': o.id },
      el('span', { class: 'grow' }, t('to'), ' ', el('b', {}, nm(o.to_user)), ': ', t('you give'), ' ', offerPart(o.give_bug, o.give_money), ' — ', t('you get'), ' ', offerPart(o.want_bug, o.want_money)),
      btn('CANCEL', async () => { await api.cancelOffer(o.id); await sync.processInbox(); }, 'no')))
      : p(el('span', { class: 'evo-dim' }, t('None.'))),
    old.length ? h('History') : null,
    old.map(o => el('div', { class: 'evo-row evo-dim' }, `${nm(o.from_user)} → ${nm(o.to_user)}: ${offerText(o)} · ${t(o.status)}`)),
  ];
}

// ───────────── desafios ─────────────
function teamPicker(max: number, exact: number | null, sel: string[]) {
  return el('div', { class: 'evo-cards' }, myBugs().map(b => card(b, {
    pick: true, sel: sel.includes(b.uid),
    on: () => {
      const i = sel.indexOf(b.uid);
      if (i >= 0) sel.splice(i, 1); else if (sel.length < (exact ?? max)) sel.push(b.uid); else { msg(`Pick up to ${exact ?? max} bugs.`, true); return; }
      render();
    },
  })));
}
function team(sel: string[]): Bug[] {
  const bugs = sel.map(u => myBug(u)).filter(Boolean);
  if (!bugs.length) throw new Error('Please select at least one bug!');
  if (bugs.some((a: any) => a.nHeart <= 50)) throw new Error('The bug is unhappy!');
  return bugs.map(bugOf);
}
async function viewChallenge(id: string, kind: 'battle' | 'race'): Promise<Kid> {
  await nameOf([id]);
  const sel: string[] = (view as any).sel ?? ((view as any).sel = []);
  const max = kind === 'race' ? 2 : 3;
  const bet = el('input', { type: 'number', min: 0, max: 100000, value: (view as any).bet ?? 0, 'aria-label': t('Bet'), id: 'evo-bet',
    oninput: (e: any) => { (view as any).bet = e.target.value; } }) as HTMLInputElement;
  const send = async () => {
    const tm = team(sel);
    const b = Math.max(0, +bet.value | 0);
    if (b > G().nMoney) throw new Error('Not enough money to bet this amount!');
    if (b > 100000) throw new Error('Bet too high!');
    await api.createMatch(id, kind, b, tm);
    await sync.processInbox();
    msg('Challenge sent!');
    open(viewMatches, 'matches');
  };
  return [
    p(btn('BACK', () => open(() => viewProfile(id)))),
    el('h3', {}, t(kind === 'battle' ? 'Fight against' : 'Race against') + ' ', el('span', { style: 'text-transform:none' }, nm(id))), needLink(),
    p(el('span', { class: 'evo-dim' }, t(kind === 'battle' ? 'Pick 1 to 3 bugs. Your friend picks the same number.' : 'Pick 1 or 2 bugs. Your friend picks the same number.'))),
    teamPicker(max, null, sel),
    p(t('Bet: $'), bet, ' ', el('span', { class: 'evo-dim' }, t('(the winner takes both bets)'))),
    p(btn('SEND CHALLENGE', send, 'ok')),
  ];
}
async function viewAccept(m: Match): Promise<Kid> {
  await nameOf([m.challenger]);
  const sel: string[] = (view as any).sel ?? ((view as any).sel = []);
  const n = m.team_a.length;
  const go = async () => {
    const tm = team(sel);
    if (tm.length !== n) throw new Error(`Pick exactly ${n} bugs.`);
    if (m.bet > G().nMoney) throw new Error('Not enough money to bet this amount!');
    const acc = await api.acceptMatch(m.id, tm);
    await sync.processInbox();
    watch(acc, true);
  };
  return [
    p(btn('BACK', () => open(viewMatches, 'matches'))),
    el('h3', {}, `${t(m.kind === 'battle' ? 'FIGHT' : 'RACE')} · ${nm(m.challenger)} · ${t('Bet')} ${money(m.bet)}`),
    h('Their team'), el('div', { class: 'evo-cards' }, m.team_a.map(b => card(b))),
    h(`Your team`), p(el('span', { class: 'evo-dim' }, t(`Pick exactly ${n} bugs.`))),
    teamPicker(n, n, sel),
    p(btn('START', go, 'ok')),
  ];
}
async function viewMatches(): Promise<Kid> {
  const me = sync.uid()!;
  const ms = await api.matches(me);
  await nameOf(ms.flatMap(m => [m.challenger, m.opponent]));
  const desc = (m: Match) => `${t(m.kind === 'battle' ? 'FIGHT' : 'RACE')} · ${m.team_a.length} ${t('bugs')} · ${t('Bet')} ${money(m.bet)}`;
  const inc = ms.filter(m => m.status === 'pending' && m.opponent === me);
  const out = ms.filter(m => m.status === 'pending' && m.challenger === me);
  const acc = ms.filter(m => m.status === 'accepted');
  const done = ms.filter(m => m.status === 'done');
  return [
    needLink(),
    h('Challenges received'),
    inc.length ? inc.map(m => el('div', { class: 'evo-row', 'data-match': m.id }, el('span', { class: 'grow' }, el('b', {}, nm(m.challenger)), ' · ', desc(m)),
      btn('ACCEPT', () => open(() => viewAccept(m)), 'ok'), btn('DECLINE', () => api.declineMatch(m.id).then(sync.refreshPending), 'no')))
      : p(el('span', { class: 'evo-dim' }, t('None.'))),
    out.length ? h('Waiting for your friend') : null,
    out.map(m => el('div', { class: 'evo-row', 'data-match': m.id }, el('span', { class: 'grow' }, t('to'), ' ', el('b', {}, nm(m.opponent)), ' · ', desc(m)),
      btn('CANCEL', async () => { await api.declineMatch(m.id); await sync.processInbox(); }, 'no'))),
    acc.length ? h('In progress') : null,
    acc.map(m => el('div', { class: 'evo-row', 'data-match': m.id }, el('span', { class: 'grow' }, `${nm(m.challenger)} ${t('vs')} ${nm(m.opponent)} · `, desc(m)),
      btn('WATCH', () => watch(m, true), 'ok'))),
    h('Results'),
    done.length ? done.map(m => matchRow(m, me)) : p(el('span', { class: 'evo-dim' }, t('None.'))),
  ];
}
export const openTab = (k: 'world' | 'offers' | 'matches' | 'account') =>
  open({ world: viewWorld, offers: viewOffers, matches: viewMatches, account: viewAccount }[k], k);
