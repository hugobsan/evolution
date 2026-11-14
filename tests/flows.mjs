export default async (page, h) => {
  await h.newGame();
  const G = () => h.ev(() => { const g = __player.global.GAME; return { money: g.nMoney, adults: g.aAdult.length, adorn: g.aAdorn.length, foodHave: g.aFood_have.join(','), sell: g.aAdult_sell.length, names: g.aAdult.map(a => a.sNickName), pops: __pops(), cur: __player.root.mGame.cur }; }, null, 5000);
  const popIco = (side, nId) => h.ev(async ([side, nId]) => {
    const pop = __player.root.children.find(c => c.name.startsWith('mPop')); if (!pop) return 'sem pop';
    const i = pop.children.find(c => c.owner && c.owner.nSide === side && (nId === undefined || c.owner.nId === nId)); if (!i) return 'sem ico';
    await __clickObj(i, 700); return 'ok';
  }, [side, nId]);
  // --- loja
  await h.ev(async () => { await __clickObj(__player.root.mGame.m2, 1500); });
  await h.ev(async () => { const s = __player.root.mGame.mGround_2.children.find(c => c.owner && c.owner.nId === 0); const b = s.getBounds(); await __click((b.xMin + b.xMax) / 2, b.yMin + 30); await __sleep(1000); });
  console.log('BUY aberto', JSON.stringify(await G()));
  console.log('ico bug', await popIco(1, 0)); console.log(await h.ev(async () => await __btn('YES')), JSON.stringify(await G()));
  console.log('ico comida', await popIco(1, 16)); console.log(await h.ev(async () => await __btn('BUY')), JSON.stringify(await G()));
  console.log('ico brinquedo', await popIco(1, 19)); console.log(await h.ev(async () => await __btn('YES')), JSON.stringify(await G()));
  await h.shot('tests/out-buy.png');
  await h.ev(async () => { await __btn('BACK'); await __clickObj(__player.root.mGame.m1, 1500); });
  // --- avança o tempo (400 "dias/10") mantendo os insetos alimentados
  await h.ev(() => { const g = __player.global.GAME; for (let i = 0; i < 400; i++) { for (const a of g.aAdult) { a.nFed = 90; a.nHeart = 90; a.nHealth = 90; } g.timeRun(); } });
  console.log('apos tempo', JSON.stringify(await G()), await h.ev(() => __player.global.GAME.aAdult.map(a => [a.nSex, a.nAge_now])));
  // --- cruzamento
  await h.ev(async () => { await __clickObj(__player.root.mGame.t0, 1200); });
  console.log('macho', await popIco(0), 'femea', await popIco(1));
  console.log(await h.ev(async () => await __btn('OK')), JSON.stringify(await G()));
  await h.shot('tests/out-baby.png');
  await h.ev(async () => { await __btn('OK'); });
  // --- venda
  await h.ev(async () => { await __clickObj(__player.root.mGame.t1, 1200); });
  console.log('vender', await h.ev(async () => { const pop = __player.root.children.find(c => c.name.startsWith('mPop')); const i = pop.children.find(c => c.owner && c.owner.nSide === 0 && c.owner.nId_2 === 0); await __clickObj(i, 700); return __pops(); })); await page.fill('#stage input', '500').catch(() => {});
  console.log(await h.ev(async () => await __btn('OK')), JSON.stringify(await G()));
  await h.ev(async () => { await __btn('BACK'); });
  // --- renomear
  await h.ev(async () => { await __clickObj(__player.root.mGame.t2, 1200); });
  console.log('renomear', await popIco(0)); await page.fill('#stage input', 'Bob').catch(() => {});
  console.log(await h.ev(async () => await __btn('OK')), JSON.stringify(await G()));
  await h.ev(async () => { await __btn('BACK'); });
  // --- save / load
  const before = await G();
  await h.ev(async () => { (await import('/src/engine/as2.ts')).SharedObject.flushAll(); });
  await page.reload(); await page.waitForFunction(() => window.__player?.root?.mGame?.cur === 6); await h.sleep(1500);
  await h.ev(async () => { await __btn('CONTINUE AS TESTER'); await __sleep(1200); });
  const after = await G();
  console.log('save/load', JSON.stringify({ before: [before.money, before.adults, before.names], after: [after.money, after.adults, after.names] }));
};
