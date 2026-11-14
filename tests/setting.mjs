export default async (page, h) => {
  await h.newGame();
  await h.ev(async () => { await __clickObj(__player.root.mGame.m0, 1200); });
  await h.shot('tests/out-setting.png');
  console.log(await h.ev(() => __player.dev));
};
