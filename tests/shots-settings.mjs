// Configurações do jogo com a seção de conta online (sem login), EN e PT; e a tela Setting do menu
const OUT = process.env.OUT || 'tests/out-v2/';
export default async (page, h) => {
  await h.newGame();
  await h.ev(async () => { __player.root.children.filter(c => c.name.startsWith('mFirst')).forEach(c => c.removeMovieClip()); await __clickObj(__player.root.mGame.m0, 1200); });
  for (const lang of ['en', 'pt']) {
    await h.ev(async l => { __lang.set(l); await __sleep(400); }, lang);
    await page.screenshot({ path: `${OUT}set-${lang}.png` });
  }
};
