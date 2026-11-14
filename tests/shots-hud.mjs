// capturas do HUD nas 3 telas (terrário, arena, loja), em EN e PT: OUT=pasta
const OUT = process.env.OUT || 'tests/out-v2/';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });
export default async (page, h) => {
  await h.newGame();
  for (const lang of ['en', 'pt']) {
    await h.ev(async l => { __lang.set(l); await __sleep(300); }, lang);
    await page.screenshot({ path: `${OUT}hud-${lang}-home.png` });
    await h.ev(async () => { __player.root.mGame.mClip ?? 0; __player.global.FADE(); __player.global.GAME.mClip.gotoAndStop('Pause_0'); await __sleep(1200); });
    await page.screenshot({ path: `${OUT}hud-${lang}-arena.png` });
    await h.ev(async () => { __player.global.FADE(); __player.global.GAME.mClip.gotoAndStop('Pause_1'); await __sleep(1200); });
    await page.screenshot({ path: `${OUT}hud-${lang}-shop.png` });
    await h.ev(async () => { __player.global.FADE(); __player.global.GAME.mClip.gotoAndStop('GameNow'); await __sleep(1200); });
  }
};
