export default async (page, h) => {
  const fs = await import('node:fs'); fs.writeFileSync('tests/out-debug.log', '');
  page.on('console', m => { if (m.type() === 'log') fs.appendFileSync('tests/out-debug.log', m.text() + '\n'); });
  await h.newGame();
  await h.ev(() => {
    const p = __player; const G = p.global.GAME; let n = 0;
    const L = (...a) => { if (n++ < 4000) console.log(...a); };
    const wrap = (obj, name, label) => { const f = obj[name]; obj[name] = function (...a) { L('>', label, name); const r = f.apply(this, a); L('<', label, name); return r; }; };
    wrap(p, 'tick', 'P'); wrap(p, 'render', 'P'); wrap(p, 'drain', 'P');
    for (const k of ['run', 'initial_2', 'addSallman', 'forinFun', 'timeRun']) wrap(G, k, 'G');
    const SP = G.aSellman[0]?.constructor?.prototype;
    if (SP) for (const k of ['move', 'moveClip', 'getNewRot', 'buy', 'setClip', 'goto', 'addMouse', 'remove']) wrap(SP, k, 'S');
    const g = p.root.mGame;
    const rm = g.remove; g.remove = function () { L('> remove keys', Object.keys(g).filter(k => g[k] && g[k].children).join(',')); rm.call(this); L('< remove'); };
    const bar = g.mBar; const gs = bar.gotoAndStop.bind(bar); bar.gotoAndStop = f => { L('> mBar.gotoAndStop', f); gs(f); L('< mBar.gotoAndStop'); };
    const MC = Object.getPrototypeOf(g); const rmc = Object.getPrototypeOf(MC).removeMovieClip;
    Object.getPrototypeOf(MC).removeMovieClip = function () { L('removeMovieClip', this.name, this.depth); return rmc.call(this); };
    setTimeout(() => { L('goto Pause_1'); p.root.mGame.gotoAndStop('Pause_1'); L('goto ok'); }, 0);
  });
  await h.sleep(4000);
};
