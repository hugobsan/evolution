// Kit de telas do multiplayer, no motor do jogo e no estilo das telas modais da v1 (Setting / pirâmide / popups):
// fundo em gradiente com bolhas (sprites 309/311/317), painéis 9-slice (48), slots (59), botões (57), textos (5/76),
// FADE ao abrir/fechar, GAME.stop() enquanto aberta e GAME.start() ao voltar. Campos de texto = TextField de entrada do
// motor (sprite 5 + typing, como o RENAME do jogo). Nenhum HTML próprio.
import { player } from '../engine/core';
import { _global, _root, GlowFilter, ColorMatrixFilter } from '../engine/as2';
import { Game } from '../game/classes/Game';
import { Adult } from '../game/classes/Adult';
import { getLang, tr, onLangChange } from '../game/i18n';

export type MC = any;
export const t = (s: string) => (getLang() === 'pt' ? tr(s, false) : s);
export const money = (n: number) => '$ ' + (n | 0);

const P = () => player();
const G = () => _global.GAME;

// ───────────── tela (host) ─────────────
export interface View {
  /** título grande (EN; passa pela tradução) */
  title: string;
  /** busca os dados (assíncrono); o resultado vai para build */
  load?: () => Promise<any>;
  /** desenha a tela em `v` (limpa a cada renderização) */
  build: (v: MC, data: any) => void;
  /** vista anterior (botão BACK); sem back o BACK fecha a tela */
  back?: View | null;
}

const DEPTH = -16100; // acima do HUD e do mBar (depth SWF − 16384); negativa: o remove() do jogo não apaga
let host: MC | null = null;
let view: View | null = null;
let rid = 0;
let busy = false;
let wantStart = false;
export const isOpen = () => !!host && !host.removed;
export const isBusy = () => busy;
export const currentView = () => view;

// enquanto a tela está aberta, popups do jogo (confirmações) não podem reiniciar o jogo ao fechar
const startOrig = (Game.prototype as any).start;
(Game.prototype as any).start = function (this: any) {
  if (isOpen()) { wantStart = true; return; }
  return startOrig.apply(this, arguments);
};

// bolhas e círculos do fundo da tela Setting (sprite 404, frame 5), sem os besouros nem os controles
function decor(h: MC) {
  const defs: any[] = P().data.chars[404].frames[4];
  const d = h.createEmptyMovieClip('deco', 1); // todas as bolhas abaixo do conteúdo (depth 10)
  let i = 0;
  for (const op of defs) {
    if (op[0] !== 'p') continue;
    const o = op[2];
    if (o.c !== 311 && o.c !== 317) continue;
    const b = d.attachSymbol(o.c, 'bub' + i, i++, {}, false);
    b?.setMatrix?.(o.m);
  }
}

export function open(v: View) {
  const mg = _root?.mGame;
  if (!G() || !mg) return;
  if (!isOpen()) {
    _global.FADE?.();
    G().stop();
    host = mg.createEmptyMovieClip('mOnline', DEPTH);
    host.timeline = true; // some quando o jogo troca de tela (frame)
    host.placeKey = 'dyn';
    const bg = host.attachSymbol(309, 'bg', 0, {}, false);
    bg._width = _global.WIDTH; bg._height = _global.HEIGHT; // o 309 é um quadrado: a tela Setting o estica no load
    bg.onPress = () => {}; // bloqueia o HUD atrás
    bg.useHandCursor = false;
    bg.onRollOver = () => mg.mInfo?.setFrame?.();
    decor(host);
  }
  show(v);
}

export function close(fade = true, resume = true) {
  if (!host) return;
  rid++;
  const h = host;
  host = null; view = null; busy = false;
  if (fade) _global.FADE?.();
  h.parent?.removeChild(h);
  // como o mPop/mBar: só retoma se nenhum outro popup ou tela do jogo está aberto
  const g = G();
  const pop = _root?.children?.some((c: any) => String(c.name).startsWith('mPop'));
  if (resume && g?.mClip && !pop && g.mClip.mBar?._currentframe == 1) startOrig.call(g);
  else if (resume && wantStart && !pop) startOrig.call(g);
  wantStart = false;
}

export function show(v: View) {
  view = v;
  render();
}
export function back() {
  const b = view?.back;
  if (b) show(b); else close();
}
/** re-renderiza a vista atual (dados novos) */
export function refresh() { if (view) render(); }

async function render() {
  const v = view;
  if (!v || !host) return;
  const id = ++rid;
  busy = true;
  let data: any;
  try { data = await v.load?.(); } catch (e: any) { data = undefined; flash(e.message || String(e), true); }
  if (id !== rid || !host) return;
  P().run(() => {
    if (!host) return;
    host.v?.removeMovieClip();
    const c = host.createEmptyMovieClip('v', 10);
    c.__d = 0;
    title(c, v.title);
    try { v.build(c, data); } catch (e: any) { console.error(e); flash(e.message || String(e), true); }
    const bk = button(c, 0, 446, v.back ? 'BACK' : 'CLOSE', () => back(), { right: 634 });
    bk.name = 'btBack';
  });
  if (id === rid) busy = false;
}
onLangChange(() => refresh());

/** mensagem curta no estilo do jogo (balão Word) */
export function flash(s: string, err = false) {
  void err;
  if (!s) return;
  _global.GAME?.popWord?.(s);
}

// ───────────── widgets ─────────────
const nd = (p: MC) => ++p.__d;
const after = (f: () => void) => P().enqueue(f); // depois dos scripts de frame do clip recém-criado

export interface TextOpts { x?: number; align?: 'left' | 'center' | 'right'; size?: number; color?: number; w?: number; glow?: number; white?: boolean }
/** texto no estilo do jogo: sprite 5 (preto, fonte do jogo) ou 76 (branco, fonte pequena, `white`) */
export function label(p: MC, x: number, y: number, s: string, o: TextOpts = {}): MC {
  const c = p.attachSymbol(o.white ? 76 : 5, 'l' + nd(p), nd(p), { sTxt: s, sVariable: 'sTxt', autoSize: o.align ?? 'left' }, false);
  c._x = x; c._y = y;
  after(() => {
    const f = c.tTxt;
    if (!f) return;
    if (o.size) f.size = o.size;
    if (o.color !== undefined) f.textColor = o.color;
    if (o.w) { f.wordWrap = true; f.multiline = true; f._width = o.w; }
    f.changed();
    c.Replace?.();
    if (o.glow !== undefined) c.filters = [new GlowFilter(o.glow, 1, 8, 8, 1)];
  });
  return c;
}
export const setText = (c: MC, s: string) => { if (c) { c.sTxt = s; c.tTxt?.changed?.(); c.Replace?.(); } };

function title(p: MC, s: string) {
  const c = label(p, 320, 8, s, { align: 'center', size: 40, color: 0xffffff, glow: 0x00ffff });
  c.name = 'title';
  p.title = c; // as vistas podem trocar o título (ex.: nome do jogador no perfil)
}

export interface BtnOpts { right?: number; center?: number; enabled?: boolean; on?: boolean; scale?: number }
/** botão padrão do jogo (sprite 57) */
export function button(p: MC, x: number, y: number, text: string, onrelease: () => any, o: BtnOpts = {}): MC {
  const b = p.attachSymbol(57, 'b' + nd(p), nd(p), {
    _sLabel: ' ' + text + ' ', _bOn: true, autoSize: 'left', bAni_visible: true, enabled: true, sSwitch: '', sPop: '', y_tPop: -50,
  }, false);
  b._x = x; b._y = y;
  if (o.scale) b._xscale = b._yscale = o.scale;
  b.onrelease = () => { if (b.enabled !== false) act(onrelease); };
  if (o.right !== undefined || o.center !== undefined) after(() => { b._x = o.right !== undefined ? o.right - b._width : o.center! - b._width / 2; });
  if (o.enabled === false) { b.enabled = false; b._alpha = 45; }
  return b;
}
/** executa a ação de um botão: erros viram balão */
export function act(f: () => any) {
  try {
    const r = f();
    if (r && typeof r.then === 'function') r.catch((e: any) => flash(e.message || String(e), true));
  } catch (e: any) { flash(e.message || String(e), true); }
}
/** muda o rótulo de um botão (mantém o estilo) */
export function relabel(b: MC, text: string) { b.sLabel = ' ' + text + ' '; b.Frame?.(); }

/** painel 9-slice do jogo (sprite 48) */
export function panel(p: MC, x: number, y: number, w: number, h: number): MC {
  const c = p.attachSymbol(48, 'p' + nd(p), nd(p), {}, false);
  c._x = x; c._y = y; c._width = w; c._height = h;
  return c;
}

/** campo de texto de entrada do jogo (sprite 5 + typing, como o RENAME) */
export function input(p: MC, x: number, y: number, w: number, max: number, restrict: string, value = '', hint = ''): MC {
  const c = p.attachSymbol(5, 'i' + nd(p), nd(p), { sTxt: value, sVariable: 'sTxt', autoSize: 'none' }, false);
  c._x = x; c._y = y;
  after(() => {
    c.typing?.(max, restrict);
    c.tTxt._width = w;
    c.tTxt.align = 0;
    c.tTxt.size = 15;
    c.tTxt.background = true; c.tTxt.backgroundColor = 0xffffff;
    c.tTxt.changed();
    if (!value && hint) c.hint = hint;
  });
  c.value = () => String(c.tTxt?.text ?? '');
  return c;
}

/** besouro (ícone mIco, como nos popups) com cor; devolve o clip */
export function bugIcon(p: MC, x: number, y: number, nId: number, color: number, scale = 100): MC {
  const c = p.attachMovie('mIco', 'ico' + nd(p), nd(p));
  if (!c) return c;
  c.gotoAndStop(nId + 1);
  after(() => {
    c.mc?.gotoAndStop(nId + 1);
    c.mc?.mHead?.gotoAndStop(nId + 1);
    c.mc?.mBoot?.gotoAndStop(c.mc?.mBoot?._totalframes);
    if (color >= 0 && Adult.aColor[color]) c.filters = [new ColorMatrixFilter(Adult.aColor[color])];
  });
  c._x = x; c._y = y; c._xscale = c._yscale = scale;
  return c;
}

/** slot (sprite 59) com um besouro; `sel` mostra o contorno de seleção; clique e rollover opcionais */
export interface SlotOpts { sel?: boolean; on?: () => void; over?: () => void; scale?: number }
export function bugSlot(p: MC, x: number, y: number, b: { nId: number; nId_color: number } | null, o: SlotOpts = {}): MC {
  const k = o.scale ?? 100;
  const slot = p.attachSymbol(59, 's' + nd(p), nd(p), {}, false);
  slot._x = x; slot._y = y; slot._xscale = slot._yscale = k;
  if (o.sel) slot.filters = [new GlowFilter(0x00ccff, 1, 6, 6, 4)];
  if (b) bugIcon(p, x, y, b.nId, b.nId_color, k);
  if (o.on) slot.onRelease = () => act(o.on!);
  if (o.over) slot.onRollOver = () => act(o.over!);
  if (!o.on) slot.useHandCursor = false;
  return slot;
}

/** info (painel inferior do jogo) por rollover */
export const info = (s0: string, s1 = '', s2 = '') => G()?.mClip?.mInfo?.setFrame?.('txt', { s_0: s0, s_1: s1, s_2: s2 });
export const cyan = (s: string) => _global.TXTCOLOR('00ccff', s);

/** abas no topo da tela: botões do jogo; a aba atual fica com brilho */
export function tabs(v: MC, items: { k: string; label: string; n?: number }[], cur: string, pick: (k: string) => void, y = 58, x = 20) {
  let prev: MC = null;
  for (const it of items) {
    const b = button(v, x, y, it.label + (it.n ? ` (${it.n})` : ''), () => pick(it.k)); // rótulo em inglês: o motor traduz na exibição
    b.name = 'tab_' + it.k;
    if (it.k === cur) b.filters = [new GlowFilter(0x00ccff, 1, 6, 6, 4)];
    // a largura só é conhecida depois do script do botão: encadeia a posição de cada aba na anterior
    if (prev) { const p = prev; after(() => { b._x = p._x + p._width + 8; }); }
    prev = b;
  }
}

/** grade de slots de besouros (clique alterna seleção; rollover mostra os atributos) */
export interface GridOpts { cols?: number; total?: number; pitch?: number; scale?: number; sel?: string[]; on?: (b: any) => void; over?: (b: any) => void }
export function bugGrid(v: MC, bugs: any[], x: number, y: number, o: GridOpts = {}) {
  const cols = o.cols ?? 4, total = o.total ?? 12, pitch = o.pitch ?? 70, scale = o.scale ?? 100;
  for (let i = 0; i < total; i++) {
    const b = bugs[i];
    const sx = x + (i % cols) * pitch, sy = y + Math.floor(i / cols) * pitch;
    const s = bugSlot(v, sx, sy, b ?? null, {
      scale, sel: !!b && !!o.sel?.includes(b.uid), on: b && o.on ? () => o.on!(b) : undefined, over: b && o.over ? () => o.over!(b) : undefined,
    });
    if (b) s.name = (o.on ? 'slot_' : 'bug_') + b.uid; // slot_ = clicável (testes), bug_ = só leitura
  }
}

/** linha de atributos de um besouro (para o rollover) */
export function bugLine(b: any, st: { attack: number; hp: number; speed: number }): string {
  return `${t(b.sNickName)} · ${b.nSex > 0 ? '♂' : '♀'} ${t((b.nAge_now / 10).toFixed(1) + ' Days')} · ${t('ATK')} ${st.attack.toFixed(0)} · ${t('HP')} ${st.hp.toFixed(0)} · ${t('SPD')} ${st.speed.toFixed(2)}`;
}
