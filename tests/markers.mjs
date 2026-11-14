export default async (page, h) => {
  await h.newGame();
  await h.ev(async () => { await __clickObj(__player.root.mGame.m3, 1500); });
  await h.ev(async () => { const g = __player.root.mGame; const list = []; const f = o => { if (o.owner && o.owner.nBattle === 1 && o.owner.nId !== 0) list.push(o); (o.children || []).forEach(f); }; f(g); await __clickObj(list[0], 1200); });
  for (const side of [1, 0]) {
    const r = await h.ev(async (side) => {
      const p = __player; const pop = p.root.children.find(c => c.name.startsWith('mPop'));
      const i = pop.children.find(c => c.owner && c.owner.nSide === side); const b = i.getBounds(); const c = p.canvas; const rc = c.getBoundingClientRect();
      c.dispatchEvent(new PointerEvent('pointermove', { clientX: rc.left + (b.xMin + b.xMax) / 2, clientY: rc.top + (b.yMin + b.yMax) / 2, bubbles: true })); await __sleep(400);
      const info = p.root.mGame.mInfo; return { frame: info.cur, ob: info.ob, marks: info.children.filter(c => c.name.startsWith('mBest_')).map(m => [m.name, Math.round(m._x), Math.round(m._y)]) };
    }, side);
    console.log('lado', side, JSON.stringify(r));
    await page.screenshot({ path: `tests/out-markers-${side}.png`, clip: { x: 150, y: 380, width: 340, height: 100 } });
  }
};
