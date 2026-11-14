// Botão SPEED do HUD: visível só no insetário (o tempo não passa na loja nem na arena).
export default async (page, h) => {
  await h.newGame();
  const vis = () => h.ev(() => __player.root.mGame.children.find(c => c.depth === 199 - 16384)?._visible);
  const go = fr => h.ev(async f => { __player.root.mGame.gotoAndStop(f); await __sleep(600); }, fr);
  const r = { home: await vis() };
  await go(46); r.shop = await vis();
  await h.shot('tests/out-speed-shop.png');
  await go(43); r.arena = await vis();
  await go(38); r.back = await vis();
  console.log(JSON.stringify(r));
  if (!r.home || r.shop || r.arena || !r.back) throw new Error('SPEED visível fora do insetário (ou sumiu no insetário)');
  console.log('ok: SPEED só no insetário');
};
