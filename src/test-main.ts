// Página de teste do motor: mostra um símbolo isolado (?id=NNN&frame=N) ou a raiz sem scripts.
import { Player } from './engine/core';
import { _global, setRoot } from './engine/as2';

const BASE = import.meta.env.BASE_URL + 'assets/';
(async () => {
  const data = await (await fetch(BASE + 'swf.json')).json();
  const q = new URLSearchParams(location.search);
  const id = q.get('id');
  if (id) data.root = { frames: [[['p', 1, { c: +id, m: [1, 0, 0, 1, +(q.get('x') ?? 0), +(q.get('y') ?? 0)] }]]], labels: {} };
  const p = new Player(data, { frameScripts: {}, clipActions: {}, constructVars: {} }, document.getElementById('stage')!, BASE);
  p.global = _global; p.onRoot = setRoot;
  (window as any).__player = p;
  p.start();
  const fr = q.get('frame');
  if (fr) setTimeout(() => { const c = p.root.children[0] as any; c.gotoAndStop(isNaN(+fr) ? fr : +fr); }, 100);
  if (q.get('stop')) setTimeout(() => { const all = (o: any) => { o.stop?.(); o.children?.forEach(all); }; all(p.root); }, 100);
})();
