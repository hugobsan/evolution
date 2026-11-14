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
      if (o.sLabel && o.vis) { const l = String(o.sLabel).trim(); if (l === label || l.startsWith(label + ' (')) return o; } // "ABA (2)": a contagem do multiplayer fica no rótulo
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
  // clips por nome (telas do multiplayer nomeiam os campos e botões que os testes usam)
  w.__named = (name: string) => {
    const f = (o: any): any => {
      if (o.name === name && !o.removed) return o;
      for (const ch of o.children || []) { const r = f(ch); if (r) return r; }
      return null;
    };
    return f(p.root);
  };
  w.__fill = (name: string, v: string) => { const c = w.__named(name); if (!c) throw new Error('sem campo ' + name); c.tTxt.setInputValue(v); };
  w.__txt = (name: string) => { const c = w.__named(name); return c ? String(c.sTxt ?? c.tTxt?.text ?? '') : null; };
  w.__tap = async (name: string, wait = 900) => { const c = w.__named(name); if (!c) throw new Error('sem clip ' + name); await w.__clickObj(c, wait); };
  w.__pops = () => p.root.children.filter(c => c.name.startsWith('mPop')).map(c => c.name + '@' + (c as any).cur);
  w.__sleep = sleep;
  w.__lang = { get: getLang, set: setLang };
}
