export default async (page, h) => {
  const mute = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.title || b.getAttribute('aria-label')); return b ? getComputedStyle(b).display : 'sem botão'; });
  console.log('menu:', await mute());
  await h.newGame();
  console.log('jogo:', await mute());
  await h.ev(async () => { await __clickObj(__player.root.mGame.m0, 1200); });
  console.log('setting:', await mute());
  for (const q of ['LOW', 'MEDIUM', 'BEST']) console.log(q, await h.ev(async (q) => { if (__player.root.mGame.mBar.cur !== 5) await __clickObj(__player.root.mGame.m0, 1200); await __btn(q); await __sleep(200); return [__player.quality, __player.dev]; }, q));
};
