export default async (page, h) => {
  await h.newGame();
  const hover = async (path, name) => {
    await h.ev(async (path) => { const o = path.split('.').reduce((a, k) => a[k], __player.root); const b = o.getBounds(); const c = __player.canvas; const r = c.getBoundingClientRect();
      c.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + (b.xMin + b.xMax) / 2, clientY: r.top + (b.yMin + b.yMax) / 2, bubbles: true })); await __sleep(300); }, path);
    await page.screenshot({ path: `tests/out-hud-${name}.png`, clip: { x: 0, y: 380, width: 640, height: 100 } });
  };
  for (const [p, n] of [['mGame.m0', 'menu'], ['mGame.t3', 'pyramid'], ['mGame.f1', 'food'], ['mGame.m2', 'shop']]) await hover(p, n);
  await h.ev(async () => { __lang.set('en'); await __sleep(200); });
  await hover('mGame.m0', 'menu-en');
};
