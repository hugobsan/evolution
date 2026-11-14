// Helpers dos testes online (2 usuários), para a UI no canvas do jogo (telas do multiplayer em src/online/kit.ts).
// Jogadores de teste usam nomes "qa-*" (limpeza por SQL, ver README).
export const OUT = process.env.OUT || 'tests/out-online/';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });

export const rid = () => Math.random().toString(36).slice(2, 6);
const HUD = { world: 'btWorld', friends: 'btFriends', pvp: 'btPvp', trade: 'btTrade' };

/** espera a tela terminar de carregar os dados e desenhar */
export const idle = async page => { await page.waitForFunction(() => !__online.kit.isBusy(), null, { timeout: 15000 }); await page.waitForTimeout(250); };
// dicas iniciais (mFirst): o jogo cria dentro do mGame
export const dismissHints = h => h.ev(() => { for (const p of [__player.root, __player.root.mGame]) p.children.filter(c => c.name.startsWith('mFirst')).forEach(c => c.removeMovieClip()); });
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
  await dismissHints(h); // o balão de tutorial do jogo reaparece sozinho e bloqueia o clique no HUD
  await h.ev(async n => { await __clickObj(__player.root.mGame[n], 1400); }, HUD[id]);
  await idle(h.page);
}
export const closeScreen = async h => { await tap(h, 'BACK', 700).catch(async () => tap(h, 'CLOSE', 700)); await h.sleep(900); };
/** tela de Configurações do jogo (botão de menu do HUD) */
export async function openSettings(h) {
  await h.ev(async () => { await __clickObj(__player.root.mGame.m0, 1200); });
}
export const closeSettings = h => h.ev(async () => { await __btn('RETURN TO GAME'); await __sleep(900); });

/** tela de criação do jogo (instruções) com o toggle MULTIPLAYER ligado e as opções carregadas */
export async function toCreation(h, player) {
  await h.ev(async () => { await __btn('PLAY GAME'); });
  if (await h.ev(() => __player.root.mGame.cur) === 30) {
    await h.page.fill('#stage input', player);
    await h.ev(async () => { await __btn('OK'); });
  }
  await h.ev(async () => { await __btn('NEW GAME'); await __sleep(900); });
  await h.ev(async () => { __player.root.mGame.mMp.mToggle.onRelease(); });
  await h.page.waitForFunction(() => !!(__find('START GAME') && (__txt('inMpName') != null || __txt('inMpWorld') != null || __find('LOAD CLOUD SAVE') || __find('SIGN OUT'))), null, { timeout: 15000 });
  await h.sleep(300);
}

/** novo jogo com o multiplayer ligado na criação (nome online; mundo novo). Devolve { name, code } */
export async function startOnline(h, prefix) {
  const name = 'qa-' + prefix + rid();
  await h.ev(() => __lang.set('en')); // os seletores usam os rótulos em inglês
  await toCreation(h, prefix);
  await fill(h, 'inMpName', name);
  await h.shot(OUT + `${prefix}-creation.png`);
  await h.ev(async () => { await __btn('START GAME'); });
  await h.page.waitForFunction(() => __player.root.mGame.cur === 38 && __online.sync.linked() && __player.global.GAME.nOnlineRev > 0, null, { timeout: 20000 });
  await h.sleep(1500); // transição (FADE) para o terrário: bloqueia cliques enquanto roda
  await dismissHints(h);
  const code = await h.ev(() => __online.api.formatCode(__online.api.storedCode()));
  return { name, code };
}

/** a e b criaram mundos próprios na criação do jogo: b encerra o dele e entra no de a pelo código. Devolve o código */
export async function makeWorld(a, b) {
  await openScreen(a.h, 'world');
  await waitTxt(a.h, 'worldCode').catch(async e => {
    await a.h.shot(OUT + 'DEBUG-world.png');
    console.log('DEBUG', JSON.stringify(await a.h.ev(async () => ({ view: __online.kit.currentView()?.title, open: __online.kit.isOpen(), busy: __online.kit.isBusy(), world: (await __online.api.myWorld())?.world?.code, cur: __player.root.mGame.cur, pops: __player.root.children.filter(c => c.name.startsWith('mPop') || c.name.startsWith('mFirst')).map(c => c.name) }))));
    throw e;
  });
  const code = await txt(a.h, 'worldCode');
  await openScreen(b.h, 'world');
  await tap(b.h, 'END MULTIPLAYER');
  await tap(b.h, 'YES', 1200);
  await waitBtn(b.h, 'JOIN');
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
