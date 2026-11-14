// Prints dos textos novos da cerca (caixa de informações do HUD e aviso de limite) em PT e EN, para conferir overflow.
// GAME_URL=http://localhost:5300/ node tests/harness.mjs tests/fence-texts.mjs
import { mkdirSync } from 'node:fs';
const OUT = 'tests/out-fence/';
mkdirSync(OUT, { recursive: true });
export default async (page, h) => {
  await h.newGame();
  await h.ev(() => { const R = __player.root; for (const p of [R, R.mGame]) p.children.filter(c => c.name.startsWith('mFirst')).forEach(c => c.removeMovieClip()); __player.global.GAME.aAdult.forEach(a => { a.vCurr.setTo(600, 40); a.moveClip(); }); __player.global.GAME.stop(); });
  await page.mouse.move(100, 100); await page.mouse.down({ button: 'right' }); await page.mouse.move(300, 140, { steps: 8 }); await page.mouse.up({ button: 'right' });
  for (const lang of ['pt', 'en']) {
    await h.ev(l => __lang.set(l), lang); await h.sleep(300);
    await page.mouse.move(500, 300); await h.sleep(200);
    await page.mouse.move(200, 120, { steps: 4 }); await h.sleep(300); // sobre a cerca: dica
    await page.screenshot({ path: `${OUT}text-${lang}-cerca.png`, clip: { x: 0, y: 380, width: 640, height: 100 } });
    await h.ev(() => { __player.root.mGame.mFenceBtn._visible = true; __player.root.mGame.mFenceBtn.onRollOver(); }); await h.sleep(300); // dica do botão (celular)
    await page.screenshot({ path: `${OUT}text-${lang}-botao.png`, clip: { x: 0, y: 380, width: 640, height: 100 } });
    await h.ev(() => __player.global.GAME.popWord('There are too many fences!')); await h.sleep(500);
    await page.screenshot({ path: `${OUT}text-${lang}-limite.png` });
  }
};
