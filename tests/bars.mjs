export default async (page, h) => {
  await h.newGame();
  // passa o mouse sobre um besouro para mostrar as barras de status
  await h.ev(async () => { const a = __player.global.GAME.aAdult[0]; const b = a.mClip.getBounds(); const c = __player.canvas; const r = c.getBoundingClientRect();
    c.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + (b.xMin + b.xMax) / 2, clientY: r.top + (b.yMin + b.yMax) / 2, bubbles: true })); await __sleep(300); });
  await h.shot('tests/out-bars.png');
};
