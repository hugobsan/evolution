export default async (page, h) => {
  await h.newGame();
  await h.ev(async () => { const m = __player.root.mGame.children.find(c => c.spriteId === 299); m && (m.vis = false); });
  const res = await h.ev(async () => {
    const p = __player; const out = {};
    for (const [label, obj] of [['food', p.global.GAME.aFood[0]], ['bug', p.global.GAME.aAdult[0]]]) {
      const m = obj.mClip; const b = m.getBounds(); const c = p.canvas; const rc = c.getBoundingClientRect();
      const x = (b.xMin + b.xMax) / 2, y = (b.yMin + b.yMax) / 2;
      const ev = (t, x, y, ctrl) => c.dispatchEvent(new PointerEvent(t, { clientX: rc.left + x, clientY: rc.top + y, bubbles: true, ctrlKey: ctrl }));
      const r0 = m._rotation, p0 = [m._x, m._y];
      ev('pointermove', x, y, false); await __sleep(40); ev('pointerdown', x, y, false); await __sleep(40);
      for (let i = 1; i <= 10; i++) { ev('pointermove', x, y + i * 3, true); await __sleep(30); }
      const mid = { rot: m._rotation, pos: [m._x, m._y] };
      for (let i = 1; i <= 5; i++) { ev('pointermove', x + i * 10, y + 30, false); await __sleep(30); }
      ev('pointerup', x + 50, y + 30, false); await __sleep(200);
      out[label] = { r0, p0, mid, end: { rot: m._rotation, pos: [m._x, m._y], nRot: obj.nRot } };
    }
    return out;
  });
  console.log(JSON.stringify(res));
};
