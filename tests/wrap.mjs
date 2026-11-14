export default async (page, h) => {
  await h.newGame();
  await h.ev(async () => { __player.global.GAME.mClip.mInfo.setFrame('txt', { s_0: 'Fighting and racing arena : ' + __player.global.TXTCOLOR('00ccff', 'This is where you can gamble with your top bugs and try to win some money! Extra words to force wrapping here.'), s_1: '', s_2: '' }); await __sleep(300); });
  await page.screenshot({ path: 'tests/out-wrap.png', clip: { x: 0, y: 380, width: 640, height: 100 } });
};
