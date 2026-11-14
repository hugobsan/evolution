export default async (page, h) => {
  await h.newGame();
  const st = () => h.ev(() => ({ cur: __player.root.mGame.cur, bar: __player.root.mGame.mBar?.cur, scr: __player.global.GAME?.nScreen, pops: __pops() }), null, 5000);
  // configurações
  await h.ev(async () => { await __clickObj(__player.root.mGame.m0, 1200); });
  console.log('setting', JSON.stringify(await st()));
  await h.shot('tests/out-setting.png');
  await h.ev(async () => { await __btn('RETURN TO GAME'); });
  console.log('return', JSON.stringify(await st()));
  // lista
  await h.ev(async () => { await __clickObj(__player.root.mGame.t3, 1200); });
  console.log('list', JSON.stringify(await st()));
  await h.shot('tests/out-list.png');
  await h.ev(async () => { await __btn('BACK'); });
  // maçãs: 8 cliques
  for (let i = 0; i < 8; i++) await h.ev(async () => { await __clickObj(__player.root.mGame.f0, 150); });
  await h.sleep(3000);
  const bugs = await h.ev(() => __player.global.GAME.aAdult.map(a => { const m = a.mClip; return { vis: m?.vis, removed: m?.removed, x: m?._x, y: m?._y, xs: m?._xscale, b: m?.getBounds(), st: a.nStatement, flt: m?.flt?.length, cur: m?.cur }; }));
  console.log('bugs', JSON.stringify(bugs));
  await h.shot('tests/out-apples.png');
  // arena
  await h.ev(async () => { await __clickObj(__player.root.mGame.m3, 1500); });
  console.log('arena', JSON.stringify(await st()));
  await h.shot('tests/out-arena.png');
};
