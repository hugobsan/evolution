// Helpers dos testes online (2 usuários). Jogadores de teste usam nomes "qa-*" (limpeza por SQL, ver README).
export const OUT = process.env.OUT || 'tests/out-online/';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });

export const rid = () => Math.random().toString(36).slice(2, 6);

export async function openPanel(h) {
  await h.ev(async () => { await __clickObj(__player.root.mGame.btOnline, 300); });
  await h.page.waitForSelector('#evo-online');
}
export const idle = page => page.waitForFunction(() => !document.querySelector('#evo-online[data-busy]'), null, { timeout: 15000 });
export async function click(page, text, scope = '#evo-online') {
  await idle(page);
  await page.locator(`${scope} button:text-is("${text}")`).first().click();
  await page.waitForTimeout(50);
  await idle(page);
}
export async function waitMsg(page, text) {
  try { await page.waitForSelector(`#evo-online .evo-msg:has-text("${text}")`, { timeout: 15000 }); }
  catch (e) { throw new Error(`esperava "${text}", painel diz: "${await page.locator('#evo-online .evo-msg').innerText().catch(() => '?')}"`); }
}

/** novo jogo + jogador online (só o nome); o jogo é vinculado sozinho no 1º acesso. Devolve { name, code } */
export async function startOnline(h, prefix) {
  const page = h.page;
  const name = 'qa-' + prefix + rid();
  await h.ev(() => __lang.set(globalThis.LANG_PT ? 'pt' : 'en')); // os seletores usam os rótulos em inglês
  await h.newGame(prefix);
  await openPanel(h);
  await page.fill('#evo-name', name);
  await click(page, 'PLAY ONLINE');
  await page.waitForSelector('#evo-mycode', { timeout: 20000 });
  await page.waitForFunction(() => __online.sync.linked() && __player.global.GAME.nOnlineRev > 0, null, { timeout: 15000 });
  const code = await page.locator('#evo-mycode').innerText();
  return { name, code };
}

/** a cria o mundo; b entra pelo código. Devolve o código do mundo */
export async function makeWorld(a, b) {
  await click(a.page, 'WORLD');
  await click(a.page, 'CREATE WORLD');
  await a.page.waitForSelector('#evo-world');
  const code = await a.page.locator('#evo-world').innerText();
  await click(b.page, 'WORLD');
  await b.page.fill('#evo-world-code', code.toLowerCase());
  await click(b.page, 'JOIN');
  await waitMsg(b.page, 'Welcome to the world!');
  await b.page.waitForFunction(() => __online.sync.state.friends.size > 0, null, { timeout: 15000 });
  await a.page.waitForFunction(() => __online.sync.state.friends.size > 0, null, { timeout: 15000 });
  return code;
}
