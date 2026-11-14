// Utilitários de teste (só em `vite dev`): cliques simulados e captura de erros.
import type { Player } from './engine/core';
import { getLang, setLang } from './game/i18n';

export function installDevtools(p: Player) {
  const w = window as any;
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  w.__errs = [] as string[];
  p.onError = e => { w.__errs.push(String((e as any)?.stack || e).split('\n').slice(0, 3).join(' | ')); console.error(e); };
  w.__click = async (x: number, y: number) => {
    const c = p.canvas, r = c.getBoundingClientRect();
    const o = { clientX: r.left + x * r.width / 640, clientY: r.top + y * r.height / 480, bubbles: true, pointerId: 1 };
    c.dispatchEvent(new PointerEvent('pointermove', o)); await sleep(40);
    c.dispatchEvent(new PointerEvent('pointerdown', o)); await sleep(60);
    c.dispatchEvent(new PointerEvent('pointerup', o));
  };
  w.__clickObj = async (b: any, wait = 900) => {
    const ha = b?.hitArea?.getBounds ? b.hitArea : b;
    const r = ha.getBounds();
    await w.__click((r.xMin + r.xMax) / 2, (r.yMin + r.yMax) / 2);
    await sleep(wait);
  };
  w.__find = (label: string) => {
    const f = (o: any): any => {
      if (o.sLabel && String(o.sLabel).trim() === label && o.vis) return o;
      for (const ch of o.children || []) { const r = f(ch); if (r) return r; }
      return null;
    };
    return f(p.root);
  };
  w.__btn = async (label: string) => {
    const b = w.__find(label);
    if (!b) return 'nao achou ' + label;
    await w.__clickObj(b);
    return 'ok ' + (p.root as any).mGame?.cur;
  };
  w.__pops = () => p.root.children.filter(c => c.name.startsWith('mPop')).map(c => c.name + '@' + (c as any).cur);
  w.__sleep = sleep;
  w.__lang = { get: getLang, set: setLang };
}
