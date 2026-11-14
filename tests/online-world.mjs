// Online (UI no canvas): 2 jogadores entram com o nome (Configurações), criam/entram num mundo por código, veem a lista
// de amigos com presença e o perfil um do outro (dinheiro, pirâmide, insetário); o dono remove e encerra; o save local continua.
import { OUT, openScreen, closeScreen, tap, tapName, fill, txt, waitTxt, waitBtn, startOnline, makeWorld, idle } from './online-lib.mjs';

export default async (page, h) => {
  const a = { page, h };
  const b = await h.newPage();
  const [A, B] = await Promise.all([startOnline(a.h, 'ana'), startOnline(b.h, 'bob')]);
  console.log('jogadores', A.name, B.name, 'código de recuperação', A.code.length);
  const code = await makeWorld(a, b);
  console.log('mundo', code);
  // Mundo: lista de membros
  await openScreen(a.h, 'world');
  await a.h.shot(OUT + 'world-2-members.png');
  const members = await h.ev(() => __online.kit.currentView().title);
  console.log('tela', members);
  await closeScreen(a.h);
  // Amigos: presença (Bob conectado) e perfil
  await page.waitForFunction(() => __online.shop.online.size === 1, null, { timeout: 20000 });
  await openScreen(a.h, 'friends');
  await a.h.shot(OUT + 'world-3-friends.png');
  await tapName(a.h, 'fn_' + await b.h.ev(() => __online.api.session.user.id).catch(() => ''), 100).catch(() => {});
  await tap(a.h, 'PROFILE');
  await a.h.shot(OUT + 'world-4-profile.png');
  const prof = await h.ev(() => ({ slots: __player.root.mGame.mOnline.v.children.filter(c => c.name?.startsWith('bug_')).length, hex: __player.root.mGame.mOnline.v.children.filter(c => c.name?.startsWith('hx')).length }));
  console.log('perfil', JSON.stringify(prof));
  if (prof.slots !== 2) throw new Error('perfil incompleto');
  await tap(a.h, 'BACK');
  await closeScreen(a.h);
  // dono remove o Bob (confirmação no popup do jogo) → Bob fica sem mundo; o save local do Bob continua
  await openScreen(a.h, 'world');
  await tap(a.h, 'REMOVE');
  await tap(a.h, 'YES', 1200);
  await b.page.waitForFunction(() => !__online.sync.state.world, null, { timeout: 15000 });
  const bobLocal = await b.h.ev(() => __player.global.GAME.aAdult.length);
  if (bobLocal !== 2) throw new Error('save local do Bob mudou');
  await closeScreen(a.h);
  // Bob volta pelo código; a dona encerra o mundo
  await openScreen(b.h, 'world');
  await fill(b.h, 'inWorldCode', code);
  await tap(b.h, 'JOIN', 1500);
  await page.waitForFunction(() => __online.sync.state.friends.size === 1, null, { timeout: 15000 });
  await closeScreen(b.h);
  await openScreen(a.h, 'world');
  await tap(a.h, 'END MULTIPLAYER');
  await tap(a.h, 'YES', 1200);
  await b.page.waitForFunction(() => !__online.sync.state.world, null, { timeout: 15000 });
  await waitBtn(a.h, 'ENABLE MULTIPLAYER');
  await a.h.shot(OUT + 'world-5-ended.png');
  console.log('ok: expulsar, voltar e encerrar');
};
