// Online: 2 jogadores entram com o nome, criam/entram num mundo por código, veem o perfil um do outro
// (dinheiro, pirâmide, coleção); o dono expulsa e encerra; o save local continua.
import { OUT, openPanel, click, waitMsg, startOnline, makeWorld } from './online-lib.mjs';

export default async (page, h) => {
  const a = { page, h };
  const b = await h.newPage();
  const [A, B] = await Promise.all([startOnline(a.h, 'ana'), startOnline(b.h, 'bob')]);
  console.log('jogadores', A.name, B.name, 'código de recuperação', A.code.length);
  await a.h.shot(OUT + 'world-1-account.png');
  const code = await makeWorld(a, b);
  console.log('mundo', code);
  await a.h.shot(OUT + 'world-2-members.png');
  // perfil do Bob visto pela Ana
  await page.locator(`#evo-online .evo-row:has-text("${B.name}") button:text-is("PROFILE")`).click();
  await page.waitForSelector('#evo-online .evo-card');
  const prof = await h.ev(() => ({
    cards: document.querySelectorAll('#evo-online .evo-card').length,
    pyr: document.querySelectorAll('#evo-online .evo-pyr img:not(.off)').length,
    text: document.querySelector('#evo-online .evo-body').innerText.slice(0, 200),
  }));
  console.log('perfil', JSON.stringify(prof));
  if (prof.cards !== 2 || prof.pyr !== 2 || !prof.text.includes('$ 1000')) throw new Error('perfil incompleto');
  await a.h.shot(OUT + 'world-3-profile.png');
  // fechar o painel retoma o jogo
  await click(page, 'CLOSE');
  if (!await h.ev(() => typeof __player.global.GAME.mClip.onEnterFrame === 'function')) throw new Error('jogo não retomou');
  // dono expulsa o Bob (dois cliques) → Bob recebe o aviso e fica sem mundo; o save local do Bob continua
  await openPanel(a.h);
  await click(page, 'WORLD');
  const kick = page.locator(`#evo-online .evo-row:has-text("${B.name}") button:text-is("REMOVE")`);
  await kick.click();
  await page.locator(`#evo-online .evo-row:has-text("${B.name}") button:text-is("SURE?")`).click();
  await b.page.waitForFunction(() => !__online.sync.state.world, null, { timeout: 15000 });
  const bobLocal = await b.h.ev(() => __player.global.GAME.aAdult.length);
  if (bobLocal !== 2) throw new Error('save local do Bob mudou');
  // Bob volta pelo código; a dona encerra o mundo
  await openPanel(b.h);
  await click(b.page, 'WORLD');
  await b.page.fill('#evo-world-code', code);
  await click(b.page, 'JOIN');
  await waitMsg(b.page, 'Welcome to the world!');
  await page.waitForFunction(() => __online.sync.state.friends.size === 1, null, { timeout: 15000 });
  await click(page, 'WORLD');
  await click(page, 'END MULTIPLAYER');
  await click(page, 'SURE?');
  await b.page.waitForFunction(() => !__online.sync.state.world, null, { timeout: 15000 });
  await page.waitForSelector('#evo-online button:text-is("CREATE WORLD")');
  await a.h.shot(OUT + 'world-4-ended.png');
  console.log('ok: expulsar, voltar e encerrar');
};
