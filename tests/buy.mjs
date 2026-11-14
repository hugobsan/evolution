export default async (page, h) => {
  await h.newGame();
  await h.ev(async () => { await __clickObj(__player.root.mGame.m2, 1500); });
  const r = await h.ev(async () => {
    const p = __player; const g2 = p.root.mGame.mGround_2;
    const s = g2.children.find(c => c.owner && c.owner.nId === 0);
    const b = s.getBounds(); const pts = [];
    for (let y = b.yMin; y <= b.yMax; y += 10) { const hit = p.pick(p.root, (b.xMin + b.xMax) / 2, y, [1,0,0,1,0,0]); pts.push([Math.round(y), hit ? (hit.name + '/' + hit.spriteId) : null]); }
    return { b, depth: s.depth, inter: s.isInteractive(), pts, gui: g2.gui && [g2.gui.depth, g2.gui.getBounds()] };
  });
  console.log(JSON.stringify(r));
};
