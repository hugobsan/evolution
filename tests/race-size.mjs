export default async (page, h) => {
  await h.newGame();
  await h.ev(async () => { await __clickObj(__player.root.mGame.m3, 1500); });
  for (const kind of [-1, 1]) {
    await h.ev(async (kind) => { const g = __player.root.mGame; const l = []; const f = o => { if (o.owner && o.owner.nBattle === kind && o.owner.nId !== 0) l.push(o); (o.children || []).forEach(f); }; f(g); await __clickObj(l[0], 1200); }, kind);
    for (const side of [1, 0]) {
      const r = await h.ev(async (side) => { const p = __player; const pop = p.root.children.find(c => c.name.startsWith('mPop')); const i = pop.children.find(c => c.owner && c.owner.nSide === side); const b = i.getBounds(); const c = p.canvas; const rc = c.getBoundingClientRect();
        c.dispatchEvent(new PointerEvent('pointermove', { clientX: rc.left + (b.xMin + b.xMax) / 2, clientY: rc.top + (b.yMin + b.yMax) / 2, bubbles: true })); await __sleep(400); return p.root.mGame.mInfo.ob; }, side);
      console.log(kind === -1 ? 'corrida' : 'luta', side ? 'cpu' : 'meu', JSON.stringify(r));
      await page.screenshot({ path: `tests/out-size-${kind === -1 ? 'race' : 'fight'}-${side}.png`, clip: { x: 0, y: 380, width: 640, height: 100 } });
    }
    await h.ev(async () => { await __btn('CANCEL'); });
  }
};
