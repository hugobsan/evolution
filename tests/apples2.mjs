export default async (page, h) => {
  await h.newGame();
  const probe = () => h.ev(() => {
    const p = __player; const a = p.global.GAME.aAdult[0]; const m = a.mClip;
    let calls = []; const orig = p.drawFiltered;
    p.drawFiltered = function (ctx, o, mm, pm, pc, v, fx) { calls.push({ me: o === m, idx: this.poolIdx, lb: o.localBounds().map(x => Math.round(x)), poolLen: this.pool.length }); return orig.apply(this, arguments); };
    p.render(); p.drawFiltered = orig;
    const mine = calls.filter(c => c.me);
    return { n: calls.length, mine, food: p.global.GAME.aFood.length, sizes: p.pool.slice(0, 30).map(c => c.width + 'x' + c.height).join(' ') };
  });
  console.log('antes', JSON.stringify(await probe()));
  for (let i = 0; i < 25; i++) await h.ev(async () => { await __clickObj(__player.root.mGame.f0, 60); });
  await h.sleep(1000);
  console.log('depois', JSON.stringify(await probe()));
};
