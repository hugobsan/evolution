// Helpers dos testes online (2 usuários), para a UI no canvas do jogo (telas do multiplayer em src/online/kit.ts).
// Jogadores de teste usam nomes "qa-*" (limpeza por SQL, ver README).
export const OUT = process.env.OUT || 'tests/out-online/';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });

export const rid = () => Math.random().toString(36).slice(2, 6);
const HUD = { world: 'btWorld', friends: 'btFriends', pvp: 'btPvp', trade: 'btTrade' };

/** espera a tela terminar de carregar os dados e desenhar */
export const idle = async page => { await page.waitForFunction(() => !__online.kit.isBusy(), null, { timeout: 15000 }); await page.waitForTimeout(250); };
export const dismissHints = h => h.ev(() => { __player.root.children.filter(c => c.name.startsWith('mFirst')).forEach(c => c.removeMovieClip()); });
/** clica no botão (rótulo em inglês) da tela atual; erro se não existir */
export async function tap(h, label, wait = 900) {
  await idle(h.page);
  const r = await h.ev(async ([l, w]) => { const b = __find(l); if (!b) return 'nao achou ' + l; await __clickObj(b, w); return 'ok'; }, [label, wait]);
  if (r !== 'ok') throw new Error(r);
  await idle(h.page);
}
export const tapName = async (h, name, wait = 900) => { await idle(h.page); await h.ev(async ([n, w]) => { await __tap(n, w); }, [name, wait]); await idle(h.page); };
export const fill = (h, name, v) => h.ev(([n, x]) => __fill(n, x), [name, v]);
export const txt = (h, name) => h.ev(n => __txt(n), name);
export const hasBtn = (h, label) => h.ev(l => !!__find(l), label);
export const waitBtn = (h, label, ms = 15000) => h.page.waitForFunction(l => !!__find(l), label, { timeout: ms });
export const waitTxt = (h, name, ms = 15000) => h.page.waitForFunction(n => __txt(n) != null, name, { timeout: ms });
/** abre uma tela do multiplayer pelo botão do HUD */
export async function openScreen(h, id) {
  await h.ev(async n => { await __clickObj(__player.root.mGame[n], 1400); }, HUD[id]);
  await idle(h.page);
}
export const closeScreen = async h => { await tap(h, 'BACK', 700).catch(async () => tap(h, 'CLOSE', 700)); await h.sleep(900); };
/** tela de Configurações do jogo (botão de menu do HUD) */
export async function openSettings(h) {
  await h.ev(async () => { await __clickObj(__player.root.mGame.m0, 1200); });
}
export const closeSettings = h => h.ev(async () => { await __btn('RETURN TO GAME'); await __sleep(900); });

/** novo jogo + jogador online (só o nome, nas Configurações); o jogo é vinculado sozinho no 1º acesso. Devolve { name, code } */
export async function startOnline(h, prefix) {
  const name = 'qa-' + prefix + rid();
  await h.ev(() => __lang.set('en')); // os seletores usam os rótulos em inglês
  await h.newGame(prefix);
  await dismissHints(h);
  await openSettings(h);
  await fill(h, 'inName', name);
  await h.shot(OUT + `${prefix}-settings-before.png`);
  await h.ev(async () => { await __btn('PLAY ONLINE'); });
  await waitTxt(h, 'recCode');
  await h.page.waitForFunction(() => __online.sync.linked() && __player.global.GAME.nOnlineRev > 0, null, { timeout: 20000 });
  const code = await txt(h, 'recCode');
  await h.shot(OUT + `${prefix}-settings-after.png`);
  await closeSettings(h);
  return { name, code };
}

/** a cria o mundo (ativa o multiplayer); b entra pelo código. Devolve o código do mundo */
export async function makeWorld(a, b) {
  await openScreen(a.h, 'world');
  await tap(a.h, 'ENABLE MULTIPLAYER');
  await waitTxt(a.h, 'worldCode');
  const code = await txt(a.h, 'worldCode');
  await openScreen(b.h, 'world');
  await fill(b.h, 'inWorldCode', code.toLowerCase());
  await tap(b.h, 'JOIN', 1500);
  await b.page.waitForFunction(() => __online.sync.state.friends.size > 0, null, { timeout: 15000 });
  await a.page.waitForFunction(() => __online.sync.state.friends.size > 0, null, { timeout: 15000 });
  await closeScreen(a.h); await closeScreen(b.h);
  return code;
}

/** vai para a tela do jogo (botões de navegação do HUD): home | arena | shop */
export async function go(h, where) {
  const n = { home: 'm1', arena: 'm3', shop: 'm2' }[where];
  await h.ev(async n => { await __clickObj(__player.root.mGame[n], 1500); }, n);
  await h.sleep(300);
}
/** uids dos besouros nos slots da tela atual (os slots se chamam slot_<uid>) */
export const slotUids = h => h.ev(() => __player.root.mGame.mOnline.v.children.filter(c => c.name?.startsWith('slot_')).map(c => c.name.slice(5)));
export const myId = h => h.ev(() => __online.api.session.user.id);
/** clica no slot de um besouro (pelo uid) */
export const pick = (h, uid) => tapName(h, 'slot_' + uid, 300);
