// Novo (não existe no original): cercas no insetário. Dados em GAME.aFence = [[x1,y1,x2,y2], ...] no espaço do mGround
// (por isso entram no save local e no da nuvem sem mais nada). Os clips ficam só em memória e são refeitos a cada
// mudança. Desktop: botão direito + arrastar desenha; celular: botão flutuante liga o "modo cerca" e o dedo desenha.
// Clicar/tocar numa cerca e arrastar a move; soltar sobre a lixeira (que aparece durante o arrasto) a exclui.
// Os insetos não atravessam (Adult.move usa fenceHit); o arrasto do jogador ignora as cercas.
import { ShapeInst, type Player } from '../engine/core';
import type { ShapeDef } from '../engine/render';
import { _global, _root, GlowFilter } from '../engine/as2';
import { SFM } from './classes/SFM';
import { Mycolor } from './classes/Mycolor';

export type Seg = [number, number, number, number];
type MC = any;

const AREA_W = 640, AREA_H = 378; // insetário: acima da barra do HUD (y 380)
export const FENCE_R = 6; // distância mínima do centro do inseto à cerca (px)
const MIN_LEN = 30; // menor que isso é clique acidental, não cerca
const MAX_FENCES = 12;
const MOVE = 8; // px do palco: menos que isso é toque, não arrasto

const G = () => _global.GAME;
const mg = () => _root?.mGame;
const IDENT = [1, 0, 0, 1, 0, 0];

// ───────────── dados e colisão ─────────────
const valid = (s: any): s is Seg => Array.isArray(s) && s.length === 4 && s.every(n => typeof n === 'number' && isFinite(n));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** saves antigos não têm aFence; lixo no save vira lista vazia/filtrada */
function fences(): Seg[] {
  const g = G();
  if (!Array.isArray(g.aFence)) g.aFence = [];
  if (!g.aFence.every(valid)) g.aFence = g.aFence.filter(valid);
  return g.aFence;
}
function segDist(px: number, py: number, s: Seg) {
  const dx = s[2] - s[0], dy = s[3] - s[1], l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - s[0]) * dx + (py - s[1]) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - (s[0] + t * dx), py - (s[1] + t * dy));
}
/** o passo (ox,oy)→(nx,ny) chega perto demais de uma cerca? Devolve o ângulo dela. Só barra quem se APROXIMA: quem
 *  foi solto/arrastado já encostado numa cerca consegue sair andando para longe dela (nunca fica preso). */
export function fenceHit(ox: number, oy: number, nx: number, ny: number): number | null {
  const g = G();
  if (g?.nScreen !== 0 || !Array.isArray(g.aFence)) return null;
  for (const s of g.aFence as Seg[]) {
    if (!valid(s)) continue;
    const d = segDist(nx, ny, s);
    if (d < FENCE_R && d < segDist(ox, oy, s) - 1e-6) return Math.atan2(s[3] - s[1], s[2] - s[0]);
  }
  return null;
}

// ───────────── arte (ShapeDef no padrão do jogo: contorno escuro, gradiente, paleta de terra e azul-aço do HUD) ─────────────
const WOOD_L = [230, 182, 112], WOOD_M = [186, 130, 70], WOOD_D = [122, 76, 36], WOOD_O = [62, 38, 18], OUTLINE = [28, 40, 60];
const a = (c: number[], al = 255) => [...c, al];
const vgrad = (top: number[], bot: number[], y0: number, y1: number, cx = 0) =>
  ({ t: 16, m: [0, (y1 - y0) / 1638.4, -(y1 - y0) / 1638.4, 0, cx, (y0 + y1) / 2], s: [[0, ...top, 255], [1, ...bot, 255]] });
const rgrad = (cx: number, cy: number, k: number, c0: number[], c1: number[]) =>
  ({ t: 18, m: [k / 819.2, 0, 0, k / 819.2, cx, cy], s: [[0, ...c0, 255], [1, ...c1, 255]] });
const circ = (cx: number, cy: number, r: number) => `M${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}Z`;
const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;

/** uma estaca vista de cima: disco de madeira com miolo escuro, contorno marrom e brilho no alto */
function post(cx: number, cy: number, r: number) {
  return [
    { f: rgrad(cx - r * 0.35, cy - r * 0.4, r * 1.5, WOOD_L, WOOD_D), d: circ(cx, cy, r) },
    { l: { w: 1.4, c: a(WOOD_O) }, d: circ(cx, cy, r) },
    { f: { t: 0, c: a(WOOD_O, 110) }, d: circ(cx + r * 0.1, cy + r * 0.1, r * 0.38) },
    { f: { t: 0, c: [255, 240, 205, 190] }, d: circ(cx - r * 0.42, cy - r * 0.5, r * 0.2) },
  ];
}

/** cerca de gravetos: travessa de madeira (gradiente + veio) ao longo de +x, com estacas nas pontas e a cada ~36px */
function fenceShape(L: number): ShapeDef {
  const n = Math.max(1, Math.round(L / 36));
  const rail = rrect(0, -3.2, L, 6.4, 3.2);
  const layers: any[] = [
    { l: { w: 18, c: [0, 0, 0, 0] }, d: `M0 0H${L}` }, // área de toque larga e invisível (dedo, ponteiro do mouse)
    { f: vgrad(WOOD_L, WOOD_D, -3.2, 3.2, L / 2), d: rail },
    { l: { w: 1.4, c: a(WOOD_O) }, d: rail },
    { l: { w: 0.8, c: [255, 238, 200, 150] }, d: `M3 -1.2H${L - 3}` },
    { l: { w: 0.7, c: a(WOOD_M, 190) }, d: `M5 0.9H${L * 0.45}M${L * 0.55} 1H${L - 5}` },
  ];
  for (let i = 0; i <= n; i++) layers.push(...post((L * i) / n, 0, 4.8));
  return { type: 'shape', bounds: [-9, -10, L + 9, 10], layers };
}

const TILE = 40;
const tile = (hot: 0 | 1 | 2, size = TILE): any[] => {
  const top = hot === 2 ? [255, 150, 130] : hot === 1 ? [150, 215, 255] : [200, 224, 244];
  const bot = hot === 2 ? [190, 40, 36] : hot === 1 ? [40, 120, 200] : [98, 130, 168];
  return [
    { f: vgrad(top, bot, 0, size, size / 2), d: rrect(0, 0, size, size, 5) },
    { l: { w: 1.5, c: a(OUTLINE) }, d: rrect(0, 0, size, size, 5) },
    { l: { w: 1, c: [255, 255, 255, 170] }, d: `M4 1.8H${size - 4}M1.8 4V${size * 0.5}` },
  ];
};
/** botão do modo cerca: tile do HUD com uma cerca de três estacas */
const buttonShape = (on: boolean): ShapeDef => {
  const rails = [14, 24].map(y => ({ f: vgrad(WOOD_L, WOOD_D, y - 2.5, y + 2.5, 20), d: rrect(6, y - 2.5, 28, 5, 2.5) }));
  const railO = [14, 24].map(y => ({ l: { w: 1.2, c: a(WOOD_O) }, d: rrect(6, y - 2.5, 28, 5, 2.5) }));
  const stakes = [10, 20, 30].flatMap(x => [
    { f: vgrad(WOOD_L, WOOD_D, 8, 32, x), d: rrect(x - 3, 8, 6, 24, 3) },
    { l: { w: 1.3, c: a(WOOD_O) }, d: rrect(x - 3, 8, 6, 24, 3) },
    { l: { w: 0.8, c: [255, 238, 200, 170] }, d: `M${x - 1} 11V28` },
  ]);
  return { type: 'shape', bounds: [-2, -2, TILE + 2, TILE + 2], layers: [...tile(on ? 1 : 0), ...rails, ...railO, ...stakes] };
};
/** lixeira: tile do HUD (vermelho quando o que se arrasta está em cima) com balde de metal e tampa */
const trashShape = (hot: boolean): ShapeDef => {
  const S = 44, K = [150, 170, 196], KD = [70, 92, 126];
  const body = 'M12 17H32L30 37Q30 39 28 39H16Q14 39 14 37Z';
  const slits = [18.5, 22, 25.5].map(x => ({ l: { w: 1.3, c: a(KD, 220) }, d: `M${x} 20.5V35` }));
  return {
    type: 'shape', bounds: [-2, -2, S + 2, S + 2], layers: [
      ...tile(hot ? 2 : 0, S),
      { f: vgrad(K, KD, 17, 39, 22), d: body }, { l: { w: 1.5, c: a(OUTLINE) }, d: body },
      ...slits,
      { f: vgrad([210, 222, 238], KD, 11, 17, 22), d: rrect(9, 12.5, 26, 4.5, 2) }, { l: { w: 1.5, c: a(OUTLINE) }, d: rrect(9, 12.5, 26, 4.5, 2) },
      { f: vgrad(K, KD, 8, 12.5, 22), d: rrect(18, 8, 8, 4.5, 1.8) }, { l: { w: 1.4, c: a(OUTLINE) }, d: rrect(18, 8, 8, 4.5, 1.8) },
    ],
  };
};
const TRASH = { x: 8, y: AREA_H - 44 - 6, s: 44 };

// ───────────── clips ─────────────
let mode = false; // modo cerca (celular)
let cap: { id: number; x1: number; y1: number; x2: number; y2: number } | null = null; // cerca sendo desenhada
let drag: { i: number; h: MC; mx: number; my: number; moved: boolean } | null = null; // cerca sendo arrastada
let ui: { btn: MC; trash: MC; trashHot: MC; trashCool: MC } | null = null;
let P: Player;

/** insetário "livre": sem Setting/List, sem multiplayer, sem popup nem as dicas iniciais por cima */
function active() {
  const g = G(), m = mg();
  return !!g && g.nScreen === 0 && m?.cur === 38 && m.mBar?._currentframe == 1 && !m.mOnline && !!m.mGround
    && !_root.children.some((c: MC) => String(c.name).startsWith('mPop')) && !m.children.some((c: MC) => String(c.name).startsWith('mFirst'));
}
const toGround = (): [number, number] => {
  const [x, y] = mg().mGround.globalToLocalXY(P.mouseX, P.mouseY);
  return [clamp(x, 0, AREA_W), clamp(y, 0, AREA_H)];
};

/** a cerca na posição dada (clip em x,y do mGround, girado) */
function fenceClip(parent: MC, name: string, depth: number, s: Seg) {
  const L = Math.hypot(s[2] - s[0], s[3] - s[1]);
  const h = parent.createEmptyMovieClip(name, depth);
  const body = h.createEmptyMovieClip('mBody', 0);
  body.addChild(new ShapeInst(fenceShape(L)), 0);
  body._x = s[0]; body._y = s[1];
  body._rotation = Math.atan2(s[3] - s[1], s[2] - s[0]) * 180 / Math.PI;
  Mycolor.dropShadow(h, { blurX: 4, blurY: 4, distance: 3, strength: 0.5, quality: 0 }); // mesma sombra dos besouros
  return h;
}

const hint = (t0: string, t1: string) => G()?.mClip?.mInfo?.setFrame('txt', {
  s_0: t0 + ' ' + _global.TXTCOLOR('00ccff', t1), s_1: '',
  s_2: 'Hint: ' + _global.TXTCOLOR('00ccff', 'Right-click and drag to build fences!'),
});

/** refaz os clips das cercas no mGround (depois de desenhar/mover/excluir, ou ao entrar no insetário) */
function render() {
  const ground = mg()?.mGround;
  if (!ground || !G()) return;
  let mf = ground.mFence;
  if (!mf || mf.removed) { mf = ground.createEmptyMovieClip('mFence', -16380); mf.timeline = true; mf.placeKey = 'dyn'; mf.__d = 0; } // entre a comida e os insetos
  for (const k of [...mf.children]) mf.removeChild(k);
  fences().forEach((s, i) => {
    const h = fenceClip(mf, 'f' + i, i, s);
    h.onPress = () => startDrag(i, h);
    h.onRelease = h.onReleaseOutside = endDrag;
    h.onRollOver = () => hint('Fence :', 'Drag it onto the trash to remove it!');
  });
}
const save = () => { try { mg()?.soData?.flush(); } catch { /* sem storage */ } };

// ───────────── arrasto e lixeira ─────────────
const overTrash = () => P.mouseX >= TRASH.x - 6 && P.mouseX <= TRASH.x + TRASH.s + 6 && P.mouseY >= TRASH.y - 6 && P.mouseY <= TRASH.y + TRASH.s + 6;
function showTrash(v: boolean) {
  if (!ui) return;
  ui.trash._visible = v;
  ui.trashHot._visible = v && overTrash();
  ui.trashCool._visible = v && !overTrash();
  ui.trash._xscale = ui.trash._yscale = ui.trashHot._visible ? 118 : 100;
}
function startDrag(i: number, h: MC) {
  if (!active() || drag) return;
  const s = fences()[i];
  // as duas pontas ficam dentro do insetário
  h.startDrag(false, -Math.min(s[0], s[2]), -Math.min(s[1], s[3]), AREA_W - Math.max(s[0], s[2]), AREA_H - Math.max(s[1], s[3]));
  drag = { i, h, mx: P.mouseX, my: P.mouseY, moved: false };
}
function endDrag() {
  const d = drag;
  if (!d) return;
  drag = null;
  d.h.stopDrag();
  const list = fences(), s = list[d.i];
  if (d.moved && s) {
    if (overTrash()) list.splice(d.i, 1);
    else { const dx = d.h._x, dy = d.h._y; list[d.i] = [s[0] + dx, s[1] + dy, s[2] + dx, s[3] + dy].map(n => Math.round(n * 10) / 10) as Seg; }
    save();
  }
  showTrash(false);
  render();
}

// ───────────── desenho (botão direito / modo cerca) ─────────────
function preview() {
  const ground = mg()?.mGround;
  if (!ground || !cap) return;
  let mf = ground.mFence;
  if (!mf || mf.removed) { render(); mf = ground.mFence; }
  mf.children.filter((c: MC) => c.name === 'mPrev').forEach((c: MC) => mf.removeChild(c));
  if (Math.hypot(cap.x2 - cap.x1, cap.y2 - cap.y1) < 2) return;
  const h = fenceClip(mf, 'mPrev', 900, [cap.x1, cap.y1, cap.x2, cap.y2]);
  h._alpha = Math.hypot(cap.x2 - cap.x1, cap.y2 - cap.y1) >= MIN_LEN ? 85 : 40; // curta demais: esmaecida (não vai valer)
}
function endCapture(commit: boolean) {
  const c = cap;
  cap = null;
  mg()?.mGround?.mFence?.children.filter((k: MC) => k.name === 'mPrev').forEach((k: MC) => k.parent.removeChild(k));
  if (!c || !commit || Math.hypot(c.x2 - c.x1, c.y2 - c.y1) < MIN_LEN) return;
  const list = fences();
  if (list.length >= MAX_FENCES) { G().popWord('There are too many fences!'); return; }
  list.push([c.x1, c.y1, c.x2, c.y2].map(n => Math.round(n * 10) / 10) as Seg);
  save();
  render();
}

/** tipo 'down'/'move'/'up'/'cancel' do gancho do motor; true = o motor não repassa o evento ao jogo */
function hook(type: string, e?: PointerEvent): boolean {
  if (type === 'cancel') { endCapture(false); return false; }
  if (!e) return false;
  if (type === 'down') {
    if (cap) return true;
    const touch = e.pointerType === 'touch';
    if (!(touch ? mode && e.button === 0 : e.button === 2) || !active() || P.mouseY >= AREA_H) return false;
    const top: MC = P.pick(P.root, P.mouseX, P.mouseY, IDENT as any);
    if (top?.__fenceUi) return false; // o próprio botão do modo cerca
    const [x, y] = toGround();
    cap = { id: e.pointerId, x1: x, y1: y, x2: x, y2: y };
    return true;
  }
  if (type === 'move') {
    if (cap) {
      if (e.pointerId === cap.id) { [cap.x2, cap.y2] = toGround(); preview(); }
      return true;
    }
    if (drag) {
      if (!drag.moved && Math.hypot(P.mouseX - drag.mx, P.mouseY - drag.my) > MOVE) drag.moved = true;
      if (drag.moved) showTrash(true);
    }
    return false;
  }
  if (cap) { // 'up'
    if (e.pointerId === cap.id) { [cap.x2, cap.y2] = toGround(); endCapture(true); }
    return true;
  }
  return false;
}

// ───────────── botão do modo cerca e lixeira (no mGame: não acompanham o zoom do mGround) ─────────────
const dyn = (c: MC) => { c.timeline = true; c.placeKey = 'dyn'; c.__d = 0; return c; };
function buildUi() {
  const m = mg();
  mode = false; cap = null; drag = null;
  for (const c of [...m.children]) if (c.name === 'mFenceTrash' || c.name === 'mFenceBtn') m.removeChild(c); // refazendo no mesmo frame
  const trash = dyn(m.createEmptyMovieClip('mFenceTrash', m.getNextHighestDepth()));
  trash._x = TRASH.x; trash._y = TRASH.y;
  const mk = (hot: boolean) => { const c = trash.createEmptyMovieClip(hot ? 'hot' : 'cool', hot ? 1 : 0); c.addChild(new ShapeInst(trashShape(hot)), 0); return c; };
  const trashCool = mk(false), trashHot = mk(true);
  Mycolor.dropShadow(trash, { blurX: 4, blurY: 4, distance: 2, strength: 0.5, quality: 0 });
  trash._visible = false;
  const btn = dyn(m.createEmptyMovieClip('mFenceBtn', m.getNextHighestDepth()));
  btn.__fenceUi = true;
  btn._x = AREA_W - TILE - 6; btn._y = AREA_H - TILE - 6; // canto inferior direito do insetário, acima da barra do HUD
  const sh = [false, true].map(on => { const c = btn.createEmptyMovieClip(on ? 'on' : 'off', on ? 1 : 0); c.addChild(new ShapeInst(buttonShape(on)), 0); return c; });
  Mycolor.dropShadow(btn, { blurX: 4, blurY: 4, distance: 2, strength: 0.5, quality: 0 });
  const paint = () => { sh[0]._visible = !mode; sh[1]._visible = mode; btn.filters = mode ? [new GlowFilter(0x00ccff, 1, 6, 6, 4)] : []; };
  paint();
  btn.useHandCursor = true;
  btn.onRelease = () => { mode = !mode; paint(); };
  btn.onRollOver = () => G()?.mClip?.mInfo?.setFrame('txt', {
    s_0: 'Fence mode : ' + _global.TXTCOLOR('00ccff', 'Drag on the ground to build fences!'), s_1: '',
    s_2: 'Hint: ' + _global.TXTCOLOR('00ccff', 'Tap again to move the bugs as usual.'),
  });
  // só no celular (o motor guarda o tipo do último toque/clique) e só no insetário livre
  btn.onEnterFrame = () => { const v = P.pointerType === 'touch' && active(); btn._visible = v; if (!v && mode) { mode = false; paint(); } };
  btn._visible = false;
  ui = { btn, trash, trashHot, trashCool };
}

/** ao entrar no insetário (Game.initial_0, depois de criar o mGround) */
export function buildFences() {
  if (!P || !mg()?.mGround) return;
  fences();
  render();
  buildUi();
}

export function installFence(p: Player) {
  P = p;
  p.inputHook = hook;
}
