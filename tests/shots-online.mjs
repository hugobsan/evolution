// Capturas de todas as telas do multiplayer com dados (EN e PT): 2 jogadores, mundo, desafio recebido, bug à venda,
// oferta recebida. Saída em tests/out-v2/o-<idioma>-<tela>.png (olhe-as ao lado das telas originais do jogo).
import { openScreen, closeScreen, tap, tapName, fill, startOnline, makeWorld, go, myId, pick, slotUids, openSettings, closeSettings, idle } from './online-lib.mjs';
const OUT = process.env.OUT || 'tests/out-v2/';

export default async (page, h) => {
  const a = { page, h };
  const b = await h.newPage();
  const [A, B] = await Promise.all([startOnline(a.h, 'ana'), startOnline(b.h, 'bob')]);
  await makeWorld(a, b);
  const [aId, bId] = [await myId(a.h), await myId(b.h)];
  // Bob lista a Hawaii por $ 900
  await b.h.ev(async () => {
    const { Adult_sell } = await import('/src/game/classes/Adult_sell.ts');
    const g = __player.global.GAME; const x = g.aAdult.find(v => v.sNickName === 'Hawaii'); x.nAge_now = 200;
    x.sUid ??= crypto.randomUUID(); g.aAdult_sell.push(new Adult_sell(900, x)); x.remove(); g.removeArray(g.aAdult, x);
    await __online.sync.pushNow(true);
  });
  await a.h.ev(() => { __player.global.GAME.aAdult[0].nAge_now = 200; });
  // Ana desafia o Bob (corrida, aposta 100) e oferece o Adam por $ 300
  await go(a.h, 'arena'); await openScreen(a.h, 'pvp'); await tap(a.h, 'CHALLENGE A FRIEND');
  await tapName(a.h, 'race_' + bId);
  for (const u of (await slotUids(a.h)).slice(0, 2)) await pick(a.h, u);
  await fill(a.h, 'inBet', '100'); await tap(a.h, 'SEND CHALLENGE', 1200); await tap(a.h, 'CLOSE', 700); await a.h.sleep(900);
  await go(a.h, 'shop'); await openScreen(a.h, 'trade'); await tap(a.h, 'TRADE WITH A FRIEND'); await tapName(a.h, 'offer_' + bId);
  await pick(a.h, (await slotUids(a.h))[0]); await fill(a.h, 'inWant', '300'); await tap(a.h, 'SEND OFFER', 1200); await tap(a.h, 'CLOSE', 700); await a.h.sleep(900);
  await b.page.waitForFunction(() => __online.sync.state.pending >= 2, null, { timeout: 20000 });
  await a.page.waitForFunction(() => __online.shop.online.size === 1, null, { timeout: 20000 });
  const shot = (x, name) => { console.log('shot', name); return x.page.screenshot({ path: `${OUT}o-${name}.png` }); };
  console.log('preparado');
  for (const lang of ['en', 'pt']) {
    await b.h.ev(l => __lang.set(l), lang);
    await a.h.ev(l => __lang.set(l), lang);
    // terrário (HUD com os botões novos), arena (PvP) e loja (troca) do Bob
    await go(b.h, 'home'); await shot(b, `${lang}-hud-home`);
    await openScreen(b.h, 'world'); await shot(b, `${lang}-world`); await closeScreen(b.h);
    await openScreen(b.h, 'friends'); await shot(b, `${lang}-friends`);
    await tap(b.h, 'PROFILE'); await shot(b, `${lang}-profile`); await b.h.ev(() => __online.kit.close(false)); await b.h.sleep(900);
    await go(b.h, 'arena'); await shot(b, `${lang}-hud-arena`);
    await openScreen(b.h, 'pvp'); await shot(b, `${lang}-pvp-in`);
    await tap(b.h, 'CHALLENGE A FRIEND'); await shot(b, `${lang}-pvp-new`);
    await tap(b.h, 'HISTORY'); await shot(b, `${lang}-pvp-hist`);
    await tap(b.h, 'CHALLENGES'); await tap(b.h, 'ACCEPT'); await shot(b, `${lang}-pvp-accept`);
    await b.h.ev(() => __online.kit.close(false)); await b.h.sleep(900);
    await go(b.h, 'shop'); await shot(b, `${lang}-hud-shop`);
    await openScreen(b.h, 'trade'); await shot(b, `${lang}-trade-sale`);
    await tap(b.h, 'OFFERS'); await shot(b, `${lang}-trade-offers`);
    await tap(b.h, 'TRADE WITH A FRIEND'); await shot(b, `${lang}-trade-friends`);
    await tapName(b.h, 'offer_' + aId); await shot(b, `${lang}-trade-compose`);
    await b.h.ev(() => __online.kit.close(false)); await b.h.sleep(900);
    await go(a.h, 'shop'); await openScreen(a.h, 'trade'); await tap(a.h, 'FOR SALE'); await shot(a, `${lang}-trade-sale-a`);
    await a.h.ev(() => __online.kit.close(false)); await a.h.sleep(900);
    await go(b.h, 'home'); await openSettings(b.h); await shot(b, `${lang}-settings-account`); await closeSettings(b.h);
  }
  console.log('textos sem tradução (PT):', JSON.stringify(await b.h.ev(() => window.__i18nMiss || [])));
  console.log('ok: capturas em', OUT);
};
