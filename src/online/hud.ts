// HUD do multiplayer: botões novos no grupo do canto inferior direito (mesmo botão de ícone, sprite 357, com ícones no
// padrão do mIco) — terrário: Configuração do multiplayer e Amigos; arena: PvP; loja: Troca multiplayer. Rollover com
// texto no painel de info como os demais botões. Os clips entram em depth NEGATIVA (entre os botões do HUD, abaixo do mBar) com `timeline` (como o btContinue do
// menu): o mGame.remove() do jogo, que apaga clips de depth ≥ 0 a cada troca de tela, não os apaga; eles somem sozinhos
// na troca de frame e são recriados pelo script do frame seguinte.
import { player, ShapeInst } from '../engine/core';
import type { ShapeDef } from '../engine/render';
import { _global } from '../engine/as2';
import { ICON, ICON_SPRITE } from './icons';
import { state, onState } from './sync';
import { label, info, cyan, MC } from './kit';

// grade 5×2 do canto inferior direito: botões a 90% (36 px) em passo de 40 px; o painel de info recua para dar lugar
const COL = [442, 482, 522, 562, 602];
const ROW = [392, 437];
const SCALE = 90;
export const INFO_RIGHT = 436; // borda direita do painel de info (a original ia até 455)

const place = (b: MC, c: number, r: number) => { if (b) { b._x = COL[c]; b._y = ROW[r]; b._xscale = b._yscale = SCALE; } };

export type HudKind = 'home' | 'arena' | 'shop';
const buttons: Record<string, MC> = {};

function iconButton(mc: MC, name: string, depth: number, icon: number, c: number, r: number, onrelease: () => void, over: () => void) {
  const b = mc.attachSymbol(357, name, depth, {
    _bOn: true, enabled: true, nHeight: 40, nWidth: 40, nIco: icon, sIco: ICON_SPRITE, sSwitch: '',
  }, true);
  if (!b) return null;
  place(b, c, r);
  b.onrelease = onrelease;
  b.clipActs = { rollOver: over };
  buttons[name] = b;
  return b;
}

/** estreita o painel de info (fundo preto + moldura) para a nova coluna de botões */
function narrowInfo(mc: MC) {
  const bar = mc.children.find((c: MC) => c.spriteId === 350);
  if (!bar) return;
  const w = INFO_RIGHT - 95;
  for (const c of bar.children) if (c.spriteId === 239 || c.spriteId === 348) c._width = w;
}

/** reorganiza o HUD do terrário na grade 5×2 (os botões de comida/ferramentas mantêm ordem e ação) */
function regrid(mc: MC) {
  ['f0', 'f1', 'f2', 'f3'].forEach((n, i) => place(mc[n], i, 0));
  ['t0', 't1', 't2'].forEach((n, i) => place(mc[n], i, 1));
  place(mc.t3, 4, 1); // pirâmide: fica no canto, como no original
}

const txt = (a: string, b = '', c = '') => info(a, b ? cyan(b) : '', c ? cyan(c) : '');

type Open = (id: 'world' | 'friends' | 'pvp' | 'trade') => void;
let openScreen: Open = () => {};
export const setOpener = (f: Open) => { openScreen = f; };

/** chamado pelo script de cada tela do jogo (terrário, arena, loja) */
export function installHud(mc: MC, kind: HudKind) {
  for (const k of Object.keys(buttons)) delete buttons[k];
  narrowInfo(mc);
  if (kind === 'home') {
    regrid(mc);
    iconButton(mc, 'btFriends', -16171, ICON.friends, 4, 0, () => openScreen('friends'),
      () => txt('Friends : ', 'See who is online and open their profile!'));
    iconButton(mc, 'btWorld', -16169, ICON.config, 3, 1, () => openScreen('world'),
      () => txt('Multiplayer setup : ', 'Create or join a world and share its code!'));
  } else {
    place(mc.t3, 4, 1); // a pirâmide (bug list) é recriada na arena a cada volta de uma luta
    if (kind === 'arena') iconButton(mc, 'btPvp', -16167, ICON.pvp, 3, 1, () => openScreen('pvp'),
      () => txt('PvP : ', 'Challenge your friends to fights and races,', 'accept challenges and watch the replays!'));
    else iconButton(mc, 'btTrade', -16165, ICON.trade, 3, 1, () => openScreen('trade'),
      () => txt('Multiplayer trading : ', "Buy bugs from your friends' sell lists", 'and trade bugs and money with them!'));
  }
  badges();
}

// ───────────── contadores (ofertas/desafios pendentes) ─────────────
const R = 8;
const circ = `M${R} 0A${R} ${R} 0 1 0 ${-R} 0A${R} ${R} 0 1 0 ${R} 0Z`;
const BADGE: ShapeDef = {
  type: 'shape', bounds: [-R - 1, -R - 1, R + 1, R + 1], layers: [
    { f: { t: 0, c: [210, 40, 40, 255] }, d: circ },
    { l: { w: 1.4, c: [255, 255, 255, 255] }, d: circ },
  ],
};
function setBadge(b: MC | undefined, n: number) {
  if (!b || b.removed) return;
  b.mBadge?.removeMovieClip();
  if (!n) return;
  const h = b.createEmptyMovieClip('mBadge', 60);
  h.__d = 0;
  h.addChild(new ShapeInst(BADGE), 0);
  h._x = 33; h._y = 7;
  const t = label(h, 0, -8, String(n), { align: 'center', size: 11, color: 0xffffff });
  void t;
}
function badges() {
  setBadge(buttons.btPvp, state.challenges);
  setBadge(buttons.btTrade, state.offers);
  setBadge(buttons.btFriends, 0);
}
onState(() => player().run(badges));
void _global;
