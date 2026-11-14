export default async (page, h) => {
  await h.newGame();
  await h.ev(async () => { await __clickObj(__player.root.mGame.m0, 1200); });
  const r = await h.ev(async () => {
    const p = __player; const bar = p.root.mGame.mBar;
    const sliders = []; const f = o => { if (o.spriteId === 71) sliders.push(o); (o.children || []).forEach(f); }; f(bar);
    const info = sliders.map(s => ({ nNow: s.nNow, mid: s.btMid._x, gb: s.btMid.getBounds(), hasHold: typeof s.onhold }));
    // arrasta o primeiro slider (música) para a direita
    const s = sliders[0]; const b = s.btMid.getBounds(); const c = p.canvas; const rc = c.getBoundingClientRect();
    const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, { clientX: rc.left + x, clientY: rc.top + y, bubbles: true }));
    const x = (b.xMin + b.xMax) / 2, y = (b.yMin + b.yMax) / 2;
    ev('pointermove', x, y); await __sleep(50); ev('pointerdown', x, y); await __sleep(50);
    for (let i = 1; i <= 10; i++) { ev('pointermove', x - i * 6, y); await __sleep(40); }
    await __sleep(100); ev('pointerup', x - 60, y); await __sleep(100);
    return { info, after: { nNow: s.nNow, mid: s.btMid._x }, vol: { ...p.audio.volumes }, hover: p.hover?.name, pressedPick: null };
  });
  console.log(JSON.stringify(r));
};
