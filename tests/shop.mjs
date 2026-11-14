export default async (page, h) => {
  // passo a passo com timeouts curtos para achar o travamento
  await h.newGame();
  console.log('em jogo:', await h.ev(() => __player.root.mGame.cur));
  await h.ev(() => { setTimeout(() => __player.root.mGame.gotoAndStop('Pause_1'), 0); });
  for (let i = 0; i < 5; i++) {
    await h.sleep(500);
    console.log('t', i, await h.ev(() => ({ cur: __player.root.mGame.cur, sell: __player.global.GAME.aSellman.length, scr: __player.global.GAME.nScreen }), null, 5000));
  }
  await h.shot('tests/out-shop.png');
};
