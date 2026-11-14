// extra: pirâmide interativa (sprite 404, frame 7). Sem seleção, destaca os círculos dos cruzamentos que dá para fazer
// já com os besouros do jogador e que trazem espécie nova. Tocando em 2 espécies, acende a via até o resultado e mostra
// nos hexágonos as chances do filhote principal (mesma conta do jogo: Game.getBaby / getBabychance). Botão "?" explica.
import { _root, _global, GlowFilter } from '../engine/as2';
import { ShapeInst } from '../engine/core';
import type { ShapeDef } from '../engine/render';
import { Adult } from '../game/classes/Adult';
import { Game } from '../game/classes/Game';
import { getLang } from '../game/i18n';
import { label, panel, button, MC } from './kit';

// ───────────── cruzamento (espelho de Game.getBaby, sem o sorteio) ─────────────
const AID: number[][] = Adult.aId;
const idAt = (r: number, c: number) => AID.findIndex(p => p[0] === r && p[1] === c);

/** filhote principal de a × b: chance (%) de cada espécie; `mother` = a falha dá a espécie da mãe (mesma fileira) */
export function cross(a: number, b: number): { odds: Map<number, number>; target: number; mother: boolean } {
  const odds = new Map<number, number>();
  if (a === b) { odds.set(a, 100); return { odds, target: -1, mother: false }; }
  const [ra, ca] = AID[a], [rb, cb] = AID[b];
  const d0 = ra - rb, d1 = ca - cb, s0 = ra + rb, s1 = ca + cb;
  const lower = ra > rb ? [a] : ra < rb ? [b] : [a, b];
  const fail = (p: number) => { for (const s of lower) odds.set(s, (odds.get(s) ?? 0) + p); };
  let target = -1;
  if (Math.abs(d0) <= 1 && Math.abs(d1) <= 1) {
    if (d0 === 0) target = idAt(s0 / 2 - 1, (s1 - 1) / 2);
    else if (!(s1 === 0 || s1 === s0)) target = d1 === 0 ? idAt((s0 - 1) / 2, s1 / 2 - 1) : idAt((s0 - 1) / 2, (s1 + 1) / 2);
  }
  if (target < 0) { fail(100); return { odds, target, mother: lower.length > 1 }; }
  const ch = Game.getBabychance(ra, rb);
  odds.set(target, (odds.get(target) ?? 0) + ch);
  fail(100 - ch);
  return { odds, target, mother: lower.length > 1 };
}

// ───────────── textos ─────────────
const TX = {
  en: {
    hint: 'Tap 2 species to see the odds.\nGreen circle: a cross you can do now that gives a new species.',
    pair: (n: number) => `Main baby: ${n}% new species.`,
    none: 'These two are not linked: no new species.',
    same: 'Same species: the baby is that species.',
    mom: '♀ = if it is the mother.',
    extra: '+ extra siblings from the bottom row (31%, under 9 bugs).',
    title: 'HOW THE PYRAMID WORKS',
    body: [
      '• Each circle links neighbouring bugs. The % is the chance that the main baby is the new species.',
      '• Circle on a straight line: the two bugs of the same row can make the one above, between them.',
      '• Circle with 3 links: the bug below plus one of the two above can make the other one above.',
      '• If the roll fails, or the parents are not linked, the baby is the species of the parent lower in the pyramid (same row: the mother\'s). Two of the same species always make that species.',
      '• Extra babies: with fewer than 9 bugs in the tank, up to 2 siblings may be born (31% chance), each a random species from the bottom row.',
      '• Color does not affect the species.',
      '• You need a male and a female old enough. A female can breed again after 30 days.',
      '• Tap 2 species in the pyramid to see their odds.',
    ].join('\n'),
  },
  pt: {
    hint: 'Toque em 2 espécies para ver as chances.\nCírculo verde: cruzamento que você já pode fazer e dá espécie nova.',
    pair: (n: number) => `Filhote principal: ${n}% de espécie nova.`,
    none: 'Esses dois não estão ligados: não sai espécie nova.',
    same: 'Mesma espécie: o filhote é dessa espécie.',
    mom: '♀ = se for a mãe.',
    extra: '+ irmãos extras da fileira de baixo (31%, com menos de 9 besouros).',
    title: 'COMO FUNCIONA A PIRÂMIDE',
    body: [
      '• Cada círculo liga besouros vizinhos. O % é a chance de o filhote principal ser a espécie nova.',
      '• Círculo na linha reta: os dois da mesma fileira podem gerar o de cima, entre eles.',
      '• Círculo com 3 ligações: o de baixo com um dos dois de cima pode gerar o outro de cima.',
      '• Se o sorteio falhar, ou os pais não estiverem ligados, nasce a espécie do pai mais embaixo na pirâmide (mesma fileira: a da mãe). Dois da mesma espécie sempre geram essa espécie.',
      '• Filhotes extras: com menos de 9 besouros no insetário, podem nascer até 2 irmãos (31% de chance), cada um de uma espécie aleatória da fileira de baixo.',
      '• A cor não influencia a espécie.',
      '• É preciso um macho e uma fêmea com idade para cruzar. A fêmea só cruza de novo depois de 30 dias.',
      '• Toque em 2 espécies na pirâmide para ver as chances delas.',
    ].join('\n'),
  },
};
const tx = () => TX[getLang() === 'pt' ? 'pt' : 'en'];

/** o campo de texto do jogo vem centralizado; os parágrafos daqui ficam à esquerda */
const leftAlign = (c: MC) => { setTimeout(() => { const f = c?.tTxt; if (f) { f.align = 0; f.changed(); } }, 30); return c; };

// ───────────── desenho ─────────────
const CYAN = [0, 204, 255, 255], GREEN = [40, 190, 60, 255], DARK = [28, 40, 60, 255];
const ring = (x: number, y: number, r: number, c: number[], w = 4): ShapeDef => ({
  type: 'shape', bounds: [x - r - w, y - r - w, x + r + w, y + r + w],
  layers: [{ l: { w, c }, d: `M${x + r} ${y}A${r} ${r} 0 1 0 ${x - r} ${y}A${r} ${r} 0 1 0 ${x + r} ${y}Z` }],
});
const seg = (x1: number, y1: number, x2: number, y2: number, c: number[], w: number): ShapeDef => ({
  type: 'shape', bounds: [Math.min(x1, x2) - w, Math.min(y1, y2) - w, Math.max(x1, x2) + w, Math.max(y1, y2) + w],
  layers: [{ l: { w, c }, d: `M${x1} ${y1}L${x2} ${y2}` }],
});

let sel: number[] = [];

function centers(mc: MC): number[][] {
  // posição do hexágono (o besouro dentro dele aumentaria a caixa do desenho e tiraria o centro do lugar)
  return AID.map((_, i) => { const h = mc['mC_' + i]; return h ? [h._x, h._y] : [0, 0]; });
}

function redraw(mc: MC) {
  if (mc.removed) return;
  if (mc.mPyr) mc.removeChild(mc.mPyr); // depth negativa: removeMovieClip não remove (regra do AS2)
  const o: MC = mc.createEmptyMovieClip('mPyr', -15897);
  o.__d = 0;
  const C = centers(mc), have = _global.GAME?.aBug_have ?? [];
  const add = (d: ShapeDef, alpha = 100) => { const s: any = new ShapeInst(d); s._alpha = alpha; o.addChild(s, o.__d++); };
  // o círculo de % de um par fica no centro do triângulo pai-pai-filho
  const circle = (a: number, b: number, t: number) => [(C[a][0] + C[b][0] + C[t][0]) / 3, (C[a][1] + C[b][1] + C[t][1]) / 3];
  for (let i = 0; i < 15; i++) if (mc['mC_' + i]) mc['mC_' + i].filters = sel.includes(i) ? [new GlowFilter(0x00ccff, 1, 10, 10, 5)] : [];

  if (sel.length < 2) {
    // vias que dá para fazer agora: os dois pais no jogo e o filho ainda não
    for (let a = 0; a < 15; a++) for (let b = a + 1; b < 15; b++) {
      if (!have[a] || !have[b]) continue;
      const { target } = cross(a, b);
      if (target < 0 || have[target] || target === a || target === b) continue;
      const [x, y] = circle(a, b, target);
      add(ring(x, y, 19, GREEN, 4));
    }
    leftAlign(label(o, 10, 8, tx().hint, { size: 13, w: 240 }));
    return;
  }
  const [a, b] = sel, r = cross(a, b);
  const isNew = (s: number) => s >= 0 && s === r.target && s !== a && s !== b;
  const lines: string[] = [];
  if (a === b) lines.push(tx().same);
  else if (!isNew(r.target)) lines.push(tx().none);
  if (isNew(r.target)) {
    const [x, y] = circle(a, b, r.target);
    for (const s of [a, b, r.target]) { add(seg(C[s][0], C[s][1], x, y, DARK, 9), 85); add(seg(C[s][0], C[s][1], x, y, CYAN, 5), 85); }
    add(ring(x, y, 19, CYAN, 5));
    lines.push(tx().pair(r.odds.get(r.target) ?? 0));
  }
  // chance em cada espécie possível, no próprio hexágono
  for (const [s, p] of r.odds) {
    const t = label(o, C[s][0], C[s][1] - 16, `${p}%${r.mother && !isNew(s) ? ' ♀' : ''}`, { size: 24, color: isNew(s) ? 0x0a5c1a : 0x7a1a1a, align: 'center' });
    t.filters = [new GlowFilter(0xffffff, 1, 6, 6, 10)];
    t.name = 'odds_' + s;
  }
  if (r.mother) lines.push(tx().mom);
  lines.push(tx().extra);
  leftAlign(label(o, 10, 8, lines.join('\n'), { size: 13, w: 240 }));
}

function openHelp() {
  _root.mPyrHelp?.removeMovieClip();
  const c: MC = _root.createEmptyMovieClip('mPyrHelp', _root.getNextHighestDepth());
  // fundo que segura o clique (a pirâmide embaixo não reage); num clip filho, porque um onPress no próprio host
  // tiraria o clique dos botões dele (regra do AS2)
  const bg: MC = c.createEmptyMovieClip('bg', 0);
  bg.__d = 0;
  panel(bg, 10, 10, 620, 460);
  bg.onPress = () => {};
  bg.useHandCursor = false;
  c.__d = 1;
  label(c, 34, 24, tx().title, { size: 22 });
  leftAlign(label(c, 34, 70, tx().body, { size: 15, w: 572 }));
  button(c, 0, 420, 'CLOSE', () => c.removeMovieClip(), { right: 606 });
}

/** script do frame 7 do sprite 404 (pirâmide) */
export function pyramid(mc: MC) {
  sel = [];
  for (let i = 0; i < 15; i++) {
    const s = mc['mC_' + i];
    if (!s) continue;
    s.onRelease = () => {
      const k = sel.indexOf(i);
      if (k >= 0) sel.splice(k, 1); // tocar de novo tira
      else sel = sel.length >= 2 ? [i] : [...sel, i]; // terceiro toque recomeça
      redraw(mc);
    };
  }
  redraw(mc);
  const b = mc.attachSymbol(57, 'btPyrHelp', -15898, {
    _sLabel: ' ? ', _bOn: true, autoSize: 'left', bAni_visible: true, enabled: true, sSwitch: '', sPop: '', y_tPop: -50,
  }, true); // como o seletor de idioma: objeto do frame, sai junto com a tela
  if (!b) return;
  b._y = 8;
  b.onrelease = openHelp;
  setTimeout(() => { if (!b.removed) b._x = 632 - b._width; }, 0); // canto direito, depois que o rótulo define a largura
}
