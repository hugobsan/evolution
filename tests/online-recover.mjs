// Online (UI no canvas): código de recuperação leva o jogador para outro aparelho (mesma conta, save da nuvem); depois os
// dois aparelhos gravam e o que ficou para trás recebe o aviso de conflito e carrega a nuvem.
import { OUT, startOnline, dismissHints, openSettings, fill, waitBtn, tap } from './online-lib.mjs';

export default async (page, h) => {
  const a = { page, h };
  const A = await startOnline(a.h, 'ana');
  // progresso no aparelho 1, enviado para a nuvem
  await h.ev(async () => { const g = __player.global.GAME; g.setMoney(4321 - g.nMoney); await __online.sync.pushNow(true); });
  const uid1 = await h.ev(() => __online.api.session.user.id);

  // aparelho 2: jogo novo (outro save local), entra com o código (nas Configurações)
  const b = await h.newPage();
  await b.h.ev(() => __lang.set('en'));
  await b.h.newGame('celular');
  await dismissHints(b.h);
  await openSettings(b.h);
  await fill(b.h, 'inRecover', A.code.toLowerCase().replace(/-/g, ' '));
  await b.h.ev(async () => { await __btn('RECOVER'); });
  await waitBtn(b.h, 'LOAD CLOUD SAVE', 20000);
  await b.h.sleep(500);
  await b.h.shot(OUT + 'recover-1-cloud.png');
  const uid2 = await b.h.ev(() => __online.api.session.user.id);
  if (uid1 !== uid2) throw new Error('o código entrou em outra conta');
  await b.h.ev(async () => { await __btn('LOAD CLOUD SAVE'); });
  await b.page.waitForFunction(() => __player.root.mGame.cur === 38 && __player.global.GAME?.nMoney === 4321 && __online.sync.linked(), null, { timeout: 20000 });
  console.log('aparelho 2 carregou o save da nuvem: $ 4321');

  // aparelho 2 joga e grava; o aparelho 1 (desatualizado) tenta gravar → conflito → carrega a nuvem
  await b.h.ev(async () => { const g = __player.global.GAME; g.setMoney(100); await __online.sync.pushNow(true); }); // 4421
  await h.ev(async () => { __player.global.GAME.setMoney(1); await __online.sync.pushNow(); }); // 4322, base desatualizada
  await page.waitForFunction(() => __player.root.children.some(c => c.name.startsWith('mPop')), null, { timeout: 15000 });
  await a.h.shot(OUT + 'recover-2-conflict.png');
  await h.ev(async () => { await __btn('YES'); });
  await page.waitForFunction(() => __player.root.mGame.cur === 38 && __player.global.GAME?.nMoney === 4421, null, { timeout: 20000 });
  console.log('ok: recuperação no aparelho 2 e conflito resolvido no aparelho 1');
};
