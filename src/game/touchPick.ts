// extra (celular): o toque não tem hover, então tocar num besouro para ver os atributos já o selecionava.
// Com o dedo: tocar mostra os atributos (caixa de info) sem selecionar; arrastar até a área dos selecionados seleciona
// e arrastar um selecionado para fora dela o tira. O mouse continua igual (o clique seleciona).
import { player } from '../engine/core';

export interface TouchPick {
  clip: any; // o que o dedo arrasta (ícone do besouro)
  info: () => void; // mostra os atributos
  isSel: () => boolean;
  inDrop: (x: number, y: number) => boolean; // ponto do palco dentro da área dos selecionados
  toggle: () => void; // seleciona/tira pelo mesmo caminho do clique
  hint?: () => void; // tocou sem arrastar: dica "arraste para selecionar"
}
const MOVE = 8; // px do palco: menos que isso é toque, não arrasto

/** liga em `hit` (quem recebe o toque: o próprio ícone ou o slot); press/release originais seguem valendo para o mouse */
export function touchPick(hit: any, o: TouchPick) {
  const press = hit.onPress, release = hit.onRelease, outside = hit.onReleaseOutside;
  let drag: { x: number; y: number; mx: number; my: number } | null = null;
  hit.onPress = function (this: any, ...a: any[]) {
    const P = player();
    if (P.pointerType !== 'touch') return press?.apply(this, a);
    o.info();
    const c = o.clip;
    drag = { x: c._x, y: c._y, mx: P.mouseX, my: P.mouseY };
    c.swapDepths(c._parent.getNextHighestDepth()); // por cima dos outros ícones e painéis enquanto arrasta
    c.startDrag(false);
  };
  const up = (orig: any) => function (this: any, ...a: any[]) {
    if (!drag) return orig?.apply(this, a);
    const P = player(), d = drag, c = o.clip;
    drag = null;
    c.stopDrag();
    c._x = d.x; c._y = d.y; // volta ao lugar antes de decidir (o jogo compara a posição para saber se está selecionado)
    if (Math.hypot(P.mouseX - d.mx, P.mouseY - d.my) < MOVE) { o.info(); o.hint?.(); return; }
    if (o.inDrop(P.mouseX, P.mouseY) !== o.isSel()) o.toggle();
  };
  hit.onRelease = up(release);
  hit.onReleaseOutside = up(outside);
}

/** retângulo (bounds no palco) com folga contém o ponto */
export const inBounds = (clips: any[], x: number, y: number, pad = 0) =>
  clips.some(c => { if (!c?.getBounds) return false; const b = c.getBounds(player().root); return x >= b.xMin - pad && x <= b.xMax + pad && y >= b.yMin - pad && y <= b.yMax + pad; });
