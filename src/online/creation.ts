// Multiplayer escolhido na criação do jogo (tela de instruções, sprite 434 frame 32, antes de INICIAR JOGO): toggle
// MULTIPLAYER; ligado, o texto das instruções dá lugar às opções (nome online ou código de recuperação, mundo novo ou
// código de um mundo, save na nuvem). Desligado, o jogo é offline: nenhuma interface do multiplayer aparece nele.
import { ShapeInst } from '../engine/core';
import type { ShapeDef } from '../engine/render';
import { _root, GlowFilter } from '../engine/as2';
import { SFM } from '../game/classes/SFM';
import { clipActions } from '../game/timeline';
import * as api from './api';
import * as sync from './sync';
import { WORLD_MAX } from './config';
import { label, button, panel, input, t, MC } from './kit';
import { confirm } from './world';

let on = false;
let busy = false;
/** jogo novo a vincular quando chegar ao terrário (rev do save na nuvem que ele substitui) */
let pending: { rev?: number } | null = null;
let boot: () => Promise<void> = async () => {};
let screen: MC = null;

const warn = (s: string) => SFM.addClip('mPop', _root, { sTxt: s, sFrame: 'WARN' });

// ───────────── toggle (pílula + bolinha, no padrão das bolinhas de presença) ─────────────
const W = 48, H = 24, R = 12;
const pill = `M${R} 0H${W - R}A${R} ${R} 0 1 1 ${W - R} ${H}H${R}A${R} ${R} 0 1 1 ${R} 0Z`;
const circ = (cx: number, r: number) => `M${cx + r} ${R}A${r} ${r} 0 1 0 ${cx - r} ${R}A${r} ${r} 0 1 0 ${cx + r} ${R}Z`;
const vgrad = (top: number[], bot: number[]) => ({ t: 16, m: [0, H / 1638.4, -H / 1638.4, 0, W / 2, H / 2], s: [[0, ...top, 255], [1, ...bot, 255]] });
const OUTLINE = { w: 1.5, c: [28, 40, 60, 255] };
const sw = (onState: boolean): ShapeDef => {
  const cx = onState ? W - R : R, k = 10;
  return {
    type: 'shape', bounds: [-1, -1, W + 1, H + 1], layers: [
      { f: onState ? vgrad([20, 100, 190], [90, 200, 255]) : vgrad([140, 150, 165], [210, 216, 226]), d: pill },
      { l: OUTLINE, d: pill },
      { f: { t: 18, m: [k / 819.2, 0, 0, k / 819.2, cx - 3, R - 3], s: [[0, 255, 255, 255, 255], [1, 185, 200, 222, 255]] }, d: circ(cx, k) },
      { l: { w: 1, c: [28, 40, 60, 255] }, d: circ(cx, k) },
    ],
  };
};

function toggle(p: MC, x: number, y: number, change: (v: boolean) => void) {
  const h = p.createEmptyMovieClip('mToggle', 5);
  h.__d = 0;
  h._x = x; h._y = y;
  const tx = label(h, 0, 0, 'MULTIPLAYER', { size: 18 });
  void tx;
  const states = [false, true].map(v => {
    const c = h.createEmptyMovieClip(v ? 'swOn' : 'swOff', v ? 21 : 20); // depth 1 é do rótulo
    c.addChild(new ShapeInst(sw(v)), 0);
    c._x = 140; c._y = 1;
    return c;
  });
  const paint = () => { states[0]._visible = !on; states[1]._visible = on; };
  paint();
  h.onRelease = () => { if (busy) return; on = !on; paint(); change(on); };
  return h;
}

// ───────────── opções (no lugar do texto das instruções) ─────────────
type Info = { world: { world: api.World; members: api.Profile[] } | null; save: { rev: number; data: any } | null };
let fields: { name?: MC; world?: MC; code?: MC } = {};

async function loadInfo(): Promise<Info> {
  await api.client();
  if (!api.session) return { world: null, save: null };
  const [world, save] = await Promise.all([api.myWorld(), api.getSave()]);
  return { world, save };
}

function options(mc: MC) {
  if (mc.mMpOpts) mc.removeChild(mc.mMpOpts); // depth negativa: removeMovieClip não remove (regra do AS2)
  const text = mc.children.find((c: MC) => c.depth === 115 - 16384); // texto das instruções (o 108 é o título)
  if (text) text._visible = !on;
  fields = {};
  if (!on) return;
  const c = mc.createEmptyMovieClip('mMpOpts', -15870);
  c.timeline = true; c.placeKey = 'dyn'; c.__d = 0;
  label(c, 40, 110, '...', { size: 15 });
  loadInfo().then(d => { if (screen === mc && on && !c.removed) fill(c, mc, d); }).catch(e => warn(e.message || String(e)));
}

/** dois painéis: JOGADOR ONLINE (nome novo ou recuperar com o código) e MUNDO (criar um novo ou entrar no de um amigo) */
let join = false; // escolha do painel MUNDO
const draft = { name: null as string | null, world: '', code: '' }; // o que já foi digitado (o painel é redesenhado)
function fill(c: MC, mc: MC, d: Info) {
  if (fields.name) draft.name = fields.name.value();
  if (fields.world) draft.world = fields.world.value();
  if (fields.code) draft.code = fields.code.value();
  fields = {};
  for (const k of [...c.children]) c.removeChild(k);
  const X = 36;
  const redo = () => fill(c, mc, d);
  // ── jogador online ──
  panel(c, 20, 92, 600, 104);
  label(c, X, 96, 'ONLINE PLAYER', { size: 16 });
  if (!api.session) {
    label(c, X, 126, 'Name:', { size: 15 });
    fields.name = input(c, 110, 124, 160, 16, '^<>&"', draft.name ?? String(mc.sPlayer ?? '').slice(0, 16));
    fields.name.name = 'inMpName';
    label(c, X, 160, 'Already have a player? Recovery code:', { size: 13 });
    fields.code = input(c, 285, 157, 215, 32, 'A-Za-z0-9-', draft.code);
    fields.code.name = 'inMpRecover';
    button(c, 508, 155, 'RECOVER', async () => {
      await api.recover(fields.code!.value());
      await boot();
      options(mc);
    }, { scale: 85 });
  } else {
    label(c, X, 124, api.me?.username ?? '', { size: 20, color: 0x0a2a5c });
    button(c, 508, 122, 'SIGN OUT', () => confirm('Sign out ?\nKeep your recovery code!', async () => { await api.signOut(); options(mc); }), { scale: 85 });
    if (d.save) {
      label(c, X, 160, 'Your player already has a cloud save:', { size: 13 });
      button(c, 285, 155, 'LOAD CLOUD SAVE', () => { sync.loadCloud(d.save!); }, { scale: 85 });
      label(c, 440, 162, 'A new game replaces it.', { size: 11, color: 0x8a1a1a });
    }
  }
  // ── mundo ──
  panel(c, 20, 202, 600, 102);
  label(c, X, 206, 'WORLD', { size: 16 });
  if (d.world) {
    label(c, X, 236, 'Your player is in the world', { size: 15 });
    label(c, 270, 230, d.world.world.code, { size: 22, color: 0x0a2a5c });
    label(c, 400, 236, `${d.world.members.length}/${WORLD_MAX} ${t('players')}`, { size: 14 });
    label(c, X, 268, 'This new game joins it.', { size: 13 });
    return;
  }
  const pickBtn = (x: number, text: string, v: boolean) => {
    const b = button(c, x, 232, text, () => { join = v; redo(); }, { scale: 90 });
    b.name = v ? 'mpJoin' : 'mpCreate';
    if (join === v) b.filters = [new GlowFilter(0x00ccff, 1, 6, 6, 4)];
  };
  pickBtn(X, 'CREATE A NEW WORLD', false);
  pickBtn(250, "JOIN A FRIEND'S WORLD", true);
  if (join) {
    label(c, X, 274, 'World code (ask your friend):', { size: 14 });
    fields.world = input(c, 285, 271, 110, 8, 'A-Za-z0-9', draft.world);
    fields.world.name = 'inMpWorld';
  } else label(c, X, 274, 'A code will be created for you to share with your friends.', { size: 13 });
}

/** script do frame 32 (instruções): toggle + opções */
export function build(mc: MC) {
  screen = mc;
  on = false;
  join = false;
  draft.name = null; draft.world = ''; draft.code = '';
  pending = null;
  if (mc.sPlayer == undefined) return; // instruções avulsas (menu → Instruções): sem INICIAR JOGO, sem toggle
  const g = mc.createEmptyMovieClip('mMp', -15880);
  g.timeline = true; g.placeKey = 'dyn'; g.__d = 0;
  toggle(g, 245, 312, () => options(mc));
}

/** antes de INICIAR JOGO com o multiplayer ligado: jogador online e mundo prontos (erros param aqui, com aviso) */
async function prepare() {
  if (!api.session) await api.start(fields.name?.value() ?? '');
  await boot();
  if (!(await api.myWorld())) {
    const code = fields.world?.value().trim();
    if (join && !code) throw new Error('Enter the world code your friend sent you.');
    if (join) await api.joinWorld(code!); else await api.createWorld();
  }
  await sync.refreshPending(); // mundo/amigos no estado já ao entrar no jogo (presença na loja, contadores)
  const save = await api.getSave();
  pending = { rev: save?.rev };
}

export function install(b: () => Promise<void>) {
  boot = b;
  const acts: any = clipActions['434:32:110']; // INICIAR JOGO
  const release = acts.release;
  acts.release = function (this: MC) {
    if (!on) { pending = null; return release.call(this); }
    if (busy) return;
    busy = true;
    prepare().then(() => { busy = false; release.call(this); }, e => {
      busy = false;
      warn(e.message || String(e));
      if (screen && !screen.removed) options(screen); // a conta pode ter sido criada antes do erro do mundo
    });
  };
}

/** no terrário do jogo novo: vincula à conta (o save local passa a ir para a nuvem) */
export function finish() {
  const p = pending;
  pending = null;
  if (!p || !api.session) return;
  sync.linkThisGame(p.rev).then(() => sync.refreshPending()).catch(e => console.warn('[online] link', e.message));
}
