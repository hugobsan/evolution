// Novo (não existe no original): ícones dos botões do multiplayer, no mesmo padrão do mIco (sprite 235) do SWF:
// contorno escuro fino, preenchimentos com gradiente radial/linear brilhante. Desenhados com o pipeline de shapes do motor
// e registrados como um sprite extra ("mIcoOn", um frame por ícone) que o botão de ícone (sprite 357) usa no lugar do mIco.
// "Amigos" compõe dois NPCs do jogo (mPeople, sprite 270).
import { player } from '../engine/core';
import type { ShapeDef } from '../engine/render';
import { frameScripts } from '../game/timeline';

export const ICON_SPRITE = 'mIcoOn';
/** frame do ícone no sprite mIcoOn */
export const ICON = { config: 1, friends: 2, pvp: 3, trade: 4 } as const;

const R = 819.2; // meio lado do quadrado de gradiente do SWF
const INK = [28, 28, 38, 255]; // contorno
type Stop = [number, number, number, number];
const stops = (...c: Stop[]) => c.map((s, i) => [i / (c.length - 1), s[0], s[1], s[2], 255]);
/** radial: centro (cx,cy), raio r */
const radial = (cx: number, cy: number, r: number, ...c: Stop[]) => ({ t: 18, m: [r / R, 0, 0, r / R, cx, cy], s: stops(...c) });
/** linear de (x0,y0) a (x1,y1) */
const linear = (x0: number, y0: number, x1: number, y1: number, ...c: Stop[]) => {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  const k = len / 2 / R;
  return { t: 16, m: [Math.cos(a) * k, Math.sin(a) * k, -Math.sin(a) * k, Math.cos(a) * k, (x0 + x1) / 2, (y0 + y1) / 2], s: stops(...c) };
};
const solid = (c: number[]) => ({ t: 0, c });
const line = (w = 1) => ({ w, c: INK });

const f2 = (n: number) => n.toFixed(2);
const poly = (pts: number[][]) => 'M' + pts.map(p => `${f2(p[0])} ${f2(p[1])}`).join('L') + 'Z';
const circ = (cx: number, cy: number, r: number) => `M${f2(cx + r)} ${f2(cy)}A${r} ${r} 0 1 0 ${f2(cx - r)} ${f2(cy)}A${r} ${r} 0 1 0 ${f2(cx + r)} ${f2(cy)}Z`;
const rot = (pts: number[][], a: number) => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
const BOUNDS: [number, number, number, number] = [-18, -18, 18, 18];
const shape = (layers: ShapeDef['layers']): ShapeDef => ({ type: 'shape', bounds: BOUNDS, layers });

// ── Configuração: engrenagem de aço com um globo no centro ──
function gear() {
  const out: number[][] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    for (const [r, d] of [[11.4, -0.3], [15.2, -0.2], [15.2, 0.2], [11.4, 0.3]]) out.push([Math.cos(a + d) * r, Math.sin(a + d) * r]);
  }
  return poly(out);
}
const GEAR = gear();
const CONFIG = shape([
  { f: radial(-4, -5, 20, [255, 255, 255, 255], [190, 205, 225, 255], [92, 112, 148, 255]), d: GEAR + circ(0, 0, 6.2) },
  { l: line(1), d: GEAR },
  { l: line(1), d: circ(0, 0, 6.2) },
  { f: radial(-1.4, -1.8, 6.5, [200, 235, 255, 255], [60, 140, 235, 255], [20, 70, 175, 255]), d: circ(0, 0, 5.4) },
  { f: solid([70, 190, 80, 255]), d: poly([[-3.6, -1.2], [-1.4, -3.6], [0.4, -2.2], [-0.6, 0.2], [-2.4, 1.6]]) + poly([[1.8, 0.6], [3.6, 0.2], [3.4, 2.6], [1.8, 3]]) },
  { l: { w: 0.8, c: INK }, d: circ(0, 0, 5.4) },
]);

// ── PvP: duas espadas cruzadas ──
const BLADE = [[-2.4, 4], [-2.4, -10.5], [0, -15.5], [2.4, -10.5], [2.4, 4]];
const GUARD = [[-6.5, 3.6], [6.5, 3.6], [6.5, 6.4], [-6.5, 6.4]];
const GRIP = [[-1.5, 6.4], [1.5, 6.4], [1.5, 12], [-1.5, 12]];
function sword(a: number): ShapeDef['layers'] {
  const b = poly(rot(BLADE, a)), g = poly(rot(GUARD, a)), h = poly(rot(GRIP, a));
  const pom = rot([[0, 13.3]], a)[0];
  const c = Math.cos(a), s = Math.sin(a);
  const hl = linear(-2.4 * c, -2.4 * s, 2.4 * c, 2.4 * s, [150, 160, 175, 255], [255, 255, 255, 255], [135, 145, 165, 255]);
  return [
    { f: hl, d: b }, { l: line(0.9), d: b },
    { f: linear(0, 3.6 * c, 0, 6.4 * c, [255, 232, 120, 255], [215, 150, 20, 255]), d: g }, { l: line(0.9), d: g },
    { f: solid([128, 70, 28, 255]), d: h }, { l: line(0.9), d: h },
    { f: radial(pom[0] - 0.6, pom[1] - 0.6, 3, [255, 245, 160, 255], [205, 140, 20, 255]), d: circ(pom[0], pom[1], 2) }, { l: line(0.8), d: circ(pom[0], pom[1], 2) },
  ];
}
const PVP = shape([...sword(-Math.PI / 4), ...sword(Math.PI / 4)]);

// ── Troca: duas setas em sentidos opostos ──
const ARROW = [[-14, -3.2], [3, -3.2], [3, -8], [14, 0], [3, 8], [3, 3.2], [-14, 3.2]];
const mirror = (p: number[][]) => p.map(([x, y]) => [-x, y]);
const up = ARROW.map(([x, y]) => [x * 0.95, y * 0.62 - 6.8]);
const down = mirror(ARROW).map(([x, y]) => [x * 0.95, y * 0.62 + 6.8]);
const TRADE = shape([
  { f: radial(-4, -11, 20, [220, 255, 190, 255], [90, 200, 70, 255], [30, 120, 40, 255]), d: poly(up) }, { l: line(1), d: poly(up) },
  { f: radial(4, 2, 20, [255, 240, 170, 255], [250, 160, 40, 255], [200, 70, 20, 255]), d: poly(down) }, { l: line(1), d: poly(down) },
]);

/** registra os shapes e o sprite de ícones no pacote de assets (uma vez) */
let done = false;
export function installIcons() {
  if (done) return;
  done = true;
  const P = player();
  const chars = P.data.chars;
  const base = 90000;
  const ids = [CONFIG, null, PVP, TRADE].map((s, i) => {
    if (!s) return 0;
    chars[base + i] = s;
    return base + i;
  });
  // "Amigos": dois NPCs do jogo (mPeople, sprite 270), um de cada lado, o da frente maior; o visual (cabelo/roupa) é escolhido no frame
  const SC = 0.3;
  const friends = [
    ['p', 1, { c: 270, m: [SC, 0, 0, SC, -7, 18.5], n: 'pA' }],
    ['p', 2, { c: 270, m: [SC, 0, 0, SC, 7, 18.5], n: 'pB' }],
  ];
  // cada frame remove o que os outros usam (a display list do SWF acumula entre frames)
  const clear = [['r', 1], ['r', 2]];
  const frames = [
    [...clear, ['p', 1, { c: ids[0], m: [1, 0, 0, 1, 0, 0] }]],
    [...clear, ...friends],
    [...clear, ['p', 1, { c: ids[2], m: [1, 0, 0, 1, 0, 0] }]],
    [...clear, ['p', 1, { c: ids[3], m: [1, 0, 0, 1, 0, 0] }]],
  ];
  const id = base + 10;
  chars[id] = { type: 'sprite', frames, labels: {}, count: frames.length };
  P.data.exports[ICON_SPRITE] = id;
  // looks dos NPCs do ícone Amigos (aparências 2 e 3 do mPeople); o mPeople solto não define o look sozinho
  frameScripts[id] = {
    2: (mc: any) => {
      for (const [n, look] of [['pA', 2], ['pB', 3]] as const) {
        const p = mc[n];
        for (const part of ['mHead', 'mArm_0', 'mArm_1', 'mBody', 'mLeg_0', 'mLeg_1']) p?.[part]?.gotoAndStop(look);
      }
    },
  };
}
