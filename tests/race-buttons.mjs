export default async (page, h) => {
  await h.newGame();
  const st = () => h.ev(() => ({ cur: __player.root.mGame.cur, scr: __player.global.GAME?.nScreen, pops: __pops(), money: __player.global.GAME?.nMoney, boost: __player.global.GAME?.nRaceBoost }), null, 5000);
  const startRace = async () => {
    await h.ev(() => { for (const a of __player.global.GAME.aAdult) { a.nFed = a.nHeart = a.nHealth = 95; a.setNum(); } });
    await h.ev(async () => { await __clickObj(__player.root.mGame.m3, 1500); });
    await h.ev(async () => { const g = __player.root.mGame; const l = []; const f = o => { if (o.owner && o.owner.nBattle === -1 && o.owner.nId !== 0) l.push(o); (o.children || []).forEach(f); }; f(g); await __clickObj(l[0], 1200); });
    await h.ev(async () => { const pop = __player.root.children.find(c => c.name.startsWith('mPop')); for (const i of pop.children.filter(c => c.owner && c.owner.nSide === 0)) await __clickObj(i, 300); });
    await page.fill('#stage input', '10');
    await h.ev(async () => await __btn('START RACE'));
    await h.sleep(800);
  };
  await startRace();
  await page.screenshot({ path: 'tests/out-race-buttons.png' });
  // acelerar: mede o avanço em 2 s com 1X e com 4X
  const x = () => h.ev(() => __player.global.GAME.paRace.concat(__player.global.GAME.paRace_2).reduce((a, b) => a + b.vCurr.x, 0));
  let a = await x(); await h.sleep(2000); const d1 = (await x()) - a;
  await h.ev(async () => { await __btn('RACE SPEED 1X'); await __btn('RACE SPEED 2X'); });
  console.log('label', JSON.stringify(await st()));
  a = await x(); await h.sleep(2000); const d4 = (await x()) - a;
  console.log('avanço 1X', d1.toFixed(0), '4X', d4.toFixed(0));
  for (let i = 0; i < 30 && !(await st()).pops.length; i++) await h.sleep(1000);
  await h.ev(async () => { await __btn('OK'); await __sleep(1500); });
  console.log('após 1ª', JSON.stringify(await st()));
  await startRace();
  const t0 = Date.now();
  await h.ev(async () => await __btn('SKIP RACE'));
  await h.sleep(300);
  console.log('skip', Date.now() - t0, 'ms', JSON.stringify(await st()));
  await page.screenshot({ path: 'tests/out-race-skip.png' });
  await h.ev(async () => { await __btn('OK'); await __sleep(1500); });
  console.log('volta', JSON.stringify(await st()), await h.ev(() => !!__player.root.mGame.btRaceFast));
};
