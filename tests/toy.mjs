export default async (page, h) => {
  await h.newGame();
  await h.ev(async () => { await __clickObj(__player.root.mGame.m2, 1500); });
  await h.ev(async () => { const s = __player.root.mGame.mGround_2.children.find(c => c.owner && c.owner.nId === 0); const b = s.getBounds(); await __click((b.xMin + b.xMax) / 2, b.yMin + 30); await __sleep(1000); });
  await h.ev(async () => { const pop = __player.root.children.find(c => c.name.startsWith('mPop')); await __clickObj(pop.children.find(c => c.owner && c.owner.nSide === 1 && c.owner.nId === 19), 700); await __btn('YES'); await __btn('BACK'); await __clickObj(__player.root.mGame.m1, 1500); });
  await h.ev(() => { const a = __player.global.GAME.aAdorn[0]; a.nTime = 1263; });
  await h.ev(async () => { const m = __player.global.GAME.aAdorn[0].mClip; const b = m.getBounds(); const c = __player.canvas; const r = c.getBoundingClientRect();
    c.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + (b.xMin + b.xMax) / 2, clientY: r.top + (b.yMin + b.yMax) / 2, bubbles: true })); await __sleep(400); });
  console.log(JSON.stringify(await h.ev(() => __player.root.mGame.mInfo.ob)));
  await page.screenshot({ path: 'tests/out-toy.png', clip: { x: 90, y: 410, width: 370, height: 65 } });
};
