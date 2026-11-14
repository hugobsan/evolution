// Novo (não existe no original): ícone sobre a cabeça dos NPCs da arena indicando luta (espadas) ou corrida (bandeira).
// Desenhado com o próprio pipeline de shapes do motor (paths SVG em px).
import { ShapeInst } from '../engine/core';
import type { ShapeDef } from '../engine/render';

const R = 11;
const circle = (r: number) => `M${r} 0A${r} ${r} 0 1 0 ${-r} 0A${r} ${r} 0 1 0 ${r} 0Z`;
/** retângulo w×h centrado em (cx,cy), girado `a` radianos */
function rect(cx: number, cy: number, w: number, h: number, a = 0) {
  const c = Math.cos(a), s = Math.sin(a);
  const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([x, y]) => `${(cx + x * c - y * s).toFixed(2)} ${(cy + x * s + y * c).toFixed(2)}`);
  return `M${pts.join('L')}Z`;
}
function sword(a: number) {
  const ux = Math.cos(a), uy = Math.sin(a);
  const at = (t: number) => [ux * t, uy * t];
  const [bx, by] = at(-1.5), [gx, gy] = at(4), [hx, hy] = at(6.2);
  return rect(bx, by, 11, 2.2, a) + rect(gx, gy, 1.4, 6, a) + rect(hx, hy, 3, 1.6, a);
}
const WHITE = [255, 255, 255, 255], BLACK = [20, 20, 20, 255];
const bounds: [number, number, number, number] = [-R - 1, -R - 1, R + 1, R + 1];

const FIGHT: ShapeDef = {
  type: 'shape', bounds, layers: [
    { f: { t: 0, c: [200, 40, 40, 255] }, d: circle(R) },
    { l: { w: 1.5, c: WHITE }, d: circle(R) },
    { f: { t: 0, c: WHITE }, d: sword(Math.PI * 3 / 4) },
    { f: { t: 0, c: WHITE }, d: sword(Math.PI / 4) },
  ],
};

const flagChecks = () => {
  let d = '';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) d += rect(-2.6 + i * 2.4 + 1.2, -6.5 + j * 2.2 + 1.1, 2.4, 2.2);
  return d;
};
const RACE: ShapeDef = {
  type: 'shape', bounds, layers: [
    { f: { t: 0, c: [40, 110, 210, 255] }, d: circle(R) },
    { l: { w: 1.5, c: WHITE }, d: circle(R) },
    { f: { t: 0, c: WHITE }, d: rect(-4.2, 0, 1.6, 14) },
    { f: { t: 0, c: WHITE }, d: rect(2.2, -3.2, 9.6, 6.6) },
    { f: { t: 0, c: BLACK }, d: flagChecks() },
  ],
};

/** coloca o ícone acima da cabeça do NPC (clip mPeople); nBattle 1 = luta, -1 = corrida */
export function addArenaBadge(clip: any, nBattle: number) {
  const b = clip.localBounds();
  const holder = clip.createEmptyMovieClip('mBadge', 900);
  holder.addChild(new ShapeInst(nBattle === -1 ? RACE : FIGHT), 0);
  holder._x = (b[0] + b[2]) / 2;
  holder._y = b[1] - R - 4;
  // desfaz o espelhamento do NPC (_xscale = ±100) para o ícone não aparecer invertido
  holder._xscale = clip._xscale < 0 ? -100 : 100;
}
