// extra: ESC fecha/volta a tela aberta. Acha o botão de fechar/voltar visível mais acima (popups do jogo: corrida,
// luta, loja, confirmações; Configurações; telas do multiplayer) e o clica de verdade, pelo mesmo caminho de um clique
// do mouse: valem os scripts do botão, botões desabilitados e o bloqueio durante a transição (FADE).
import { _root } from '../engine/as2';

// rótulo interno (sLabel, sempre em inglês; a tradução é só na exibição), na ordem de preferência dentro da mesma tela
const LABELS = ['NO', 'CANCEL', 'BACK', 'CLOSE', 'OK', 'RETURN TO GAME', 'MAIN MENU'];
const NAMES = ['btAccBack']; // voltar sem rótulo padrão (Configurações da conta → Configurações)

function target(): any {
  let best: any = null, bestLayer = -1, bestRank = 99, layer = 0;
  const walk = (o: any, top: number) => {
    if (!o.vis || o.removed) return;
    const l = String(o.sLabel ?? '').trim();
    const rank = NAMES.includes(o.name) ? -1 : LABELS.indexOf(l);
    if ((rank >= 0 || NAMES.includes(o.name)) && o.enabled !== false) {
      // a camada mais acima ganha; na mesma camada, a ordem de LABELS
      if (top > bestLayer || (top === bestLayer && rank < bestRank)) { best = o; bestLayer = top; bestRank = rank; }
    }
    for (const c of o.children ?? []) walk(c, top);
  };
  // camadas: filhos do _root (popups mPop por cima do jogo) e, dentro do jogo, os filhos do mGame (telas por cima do cenário)
  for (const c of _root?.children ?? []) {
    if (c === _root.mGame) for (const g of c.children ?? []) walk(g, layer++);
    else walk(c, layer++);
  }
  return best;
}

export function installEscape() {
  addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.repeat) return;
    const b = target();
    const cv = document.querySelector<HTMLCanvasElement>('#stage canvas');
    if (!b || !cv) return;
    const ha = b.hitArea?.getBounds ? b.hitArea : b;
    const r = ha.getBounds(), cr = cv.getBoundingClientRect();
    const o = { clientX: cr.left + ((r.xMin + r.xMax) / 2) * cr.width / 640, clientY: cr.top + ((r.yMin + r.yMax) / 2) * cr.height / 480, bubbles: true, pointerId: 1 };
    e.preventDefault();
    const at = (ms: number, type: string) => setTimeout(() => cv.dispatchEvent(new PointerEvent(type, o)), ms);
    at(0, 'pointermove'); at(40, 'pointerdown'); at(100, 'pointerup'); // como um clique: hover, aperta, solta
  });
}
