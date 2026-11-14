// Online (UI no canvas): trocas entre membros do mundo. Venda aceita, compra direta da lista de venda de um amigo e
// oferta cancelada: besouros e dinheiro mudam (ou voltam) dos dois lados, via inbox.
import { OUT, openScreen, tap, tapName, fill, startOnline, makeWorld, go, myId, pick, idle } from './online-lib.mjs';

const game = h => h.ev(() => { const g = __player.global.GAME; return { money: g.nMoney, bugs: g.aAdult.map(a => a.sUid ?? a.sNickName), sell: g.aAdult_sell.length }; });
const until = (h, f, arg) => h.page.waitForFunction(f, arg, { timeout: 15000 });
const toTrade = async x => { await go(x.h, 'shop'); await openScreen(x.h, 'trade'); };
const shut = async x => { await tap(x.h, 'CLOSE', 700); await x.h.sleep(900); };

export default async (page, h) => {
  const a = { page, h };
  const b = await h.newPage();
  const [A, B] = await Promise.all([startOnline(a.h, 'ana'), startOnline(b.h, 'bob')]);
  await makeWorld(a, b);
  const [aId, bId] = [await myId(a.h), await myId(b.h)];
  // Adam da Ana fica com idade para vender (≥ 150, regra da v1)
  const adam = await h.ev(() => { const x = __player.global.GAME.aAdult[0]; x.nAge_now = 200; return x.sUid ?? (x.sUid = crypto.randomUUID()); });

  // 1) Ana vende Adam por $ 300 (troca: ela dá o besouro, quer dinheiro) → reserva sai do jogo dela na hora
  await toTrade(a);
  await tap(a.h, 'TRADE WITH A FRIEND');
  await tapName(a.h, 'offer_' + bId);
  await pick(a.h, adam);
  await fill(a.h, 'inWant', '300');
  await a.h.shot(OUT + 'trade-1-compose.png');
  await tap(a.h, 'SEND OFFER', 1200);
  await until(a.h, u => !__player.global.GAME.aAdult.some(x => x.sUid === u), adam);
  await a.h.shot(OUT + 'trade-1-sent.png');
  await shut(a);
  await b.page.waitForFunction(() => __online.sync.state.offers > 0, null, { timeout: 15000 });
  await toTrade(b);
  await tap(b.h, 'OFFERS');
  await b.h.shot(OUT + 'trade-2-received.png');
  await tap(b.h, 'ACCEPT', 1200);
  await until(b.h, u => __player.global.GAME.aAdult.some(x => x.sUid === u), adam);
  await until(a.h, () => __player.global.GAME.nMoney === 1300);
  await shut(b);
  const [ga, gb] = [await game(a.h), await game(b.h)];
  console.log('venda: Ana', JSON.stringify(ga), 'Bob', JSON.stringify(gb));
  if (gb.money !== 700 || gb.bugs.length !== 3 || ga.bugs.length !== 1) throw new Error('venda não fechou certo');

  // 2) Bob põe a Hawaii (já adulta) na lista de venda por $ 900; Ana a vê em FOR SALE e compra → fecha na hora (o anúncio
  //    já é o aceite): Hawaii vai para a Ana, o dinheiro para o Bob e sai da lista dele; comprar de novo falha
  const hawaii = await b.h.ev(async () => {
    const { Adult_sell } = await import('/src/game/classes/Adult_sell.ts');
    const g = __player.global.GAME;
    const x = g.aAdult.find(v => v.sNickName === 'Hawaii');
    x.nAge_now = 200;
    const uid = x.sUid ?? (x.sUid = crypto.randomUUID());
    g.aAdult_sell.push(new Adult_sell(900, x)); // preço alto: abaixo disso os NPCs da loja compram na hora (v1)
    x.remove(); g.removeArray(g.aAdult, x);
    await __online.sync.pushNow(true);
    return uid;
  });
  await toTrade(a);
  await tap(a.h, 'FOR SALE');
  await a.h.shot(OUT + 'trade-3-forsale.png');
  await tapName(a.h, 'buy_' + hawaii);
  await until(a.h, u => __player.global.GAME.nMoney === 400 && __player.global.GAME.aAdult.some(x => x.sUid === u), hawaii);
  await until(b.h, () => __player.global.GAME.nMoney === 1600 && __player.global.GAME.aAdult_sell.length === 0);
  await a.h.shot(OUT + 'trade-3-bought.png');
  const twice = await a.h.ev(async ([s, u]) => { try { await __online.api.buyListed(s, u, 900); return 'comprou'; } catch (e) { return e.message; } }, [bId, hawaii]);
  console.log('compra direta: Ana 400 com a Hawaii, Bob 1600; comprar de novo:', twice);
  if (twice !== 'not for sale') throw new Error('o mesmo besouro foi vendido duas vezes');
  await shut(a);

  // 3) Bob oferece Adam de volta e cancela → Adam volta para o Bob
  await b.h.ev(u => { __player.global.GAME.aAdult.find(x => x.sUid === u).nAge_now = 300; }, adam);
  await toTrade(b);
  await tap(b.h, 'TRADE WITH A FRIEND');
  await tapName(b.h, 'offer_' + aId);
  await pick(b.h, adam);
  await fill(b.h, 'inWant', '50');
  await tap(b.h, 'SEND OFFER', 1200);
  await until(b.h, u => !__player.global.GAME.aAdult.some(x => x.sUid === u), adam);
  await tap(b.h, 'CANCEL', 1200);
  await until(b.h, u => __player.global.GAME.aAdult.some(x => x.sUid === u), adam);
  await b.h.shot(OUT + 'trade-4-history.png');
  // aceitar de novo uma oferta já resolvida falha no servidor (máquina de estados)
  const again = await b.h.ev(async () => { const os = await __online.api.offers(); try { await __online.api.respondOffer(os.find(o => o.status !== 'pending').id, true); return 'aceitou'; } catch (e) { return e.message; } });
  console.log('reaceitar oferta resolvida:', again);
  if (again === 'aceitou') throw new Error('oferta resolvida foi aceita de novo');
  // aba com versão antiga (função do banco que não existe mais): aviso para recarregar, não o erro do PostgREST
  const stale = await b.h.ev(async () => { try { await __online.api.rpcRaw('respond_offer', { p_id: 1, p_accept: true, p_want_bug: null }); return 'passou'; } catch (e) { return e.message; } });
  console.log('versão antiga:', stale);
  if (!/updated/.test(stale)) throw new Error('chamada de versão antiga não virou aviso de atualização');

  // 4) troca 2 por 1: Bob dá os dois besouros dele e pede a Hawaii da Ana
  await shut(b);
  const bobs = await b.h.ev(() => __player.global.GAME.aAdult.map(x => { x.nAge_now = Math.max(x.nAge_now, 300); return x.sUid ?? (x.sUid = crypto.randomUUID()); }));
  await a.h.ev(async () => { await __online.sync.pushNow(true); }); // insetário da Ana (com a Hawaii) no resumo público
  await toTrade(b);
  await tap(b.h, 'TRADE WITH A FRIEND');
  await tapName(b.h, 'offer_' + aId);
  for (const u of [...bobs, hawaii]) await pick(b.h, u);
  await b.h.ev(async () => { // rollover: atributos na caixa preta de info
    const v = __player.root.mGame.mOnline.v; const o = v.children.find(c => c.name?.startsWith('slot_')); const b = o.getBounds(); const c = __player.canvas; const r = c.getBoundingClientRect();
    c.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + (b.xMin + b.xMax) / 2, clientY: r.top + (b.yMin + b.yMax) / 2, bubbles: true })); await __sleep(400); });
  await b.h.shot(OUT + 'trade-5-multi.png');
  await tap(b.h, 'SEND OFFER', 1200);
  await until(b.h, () => __player.global.GAME.aAdult.length === 0);
  await shut(b);
  await a.page.waitForFunction(() => __online.sync.state.offers > 0, null, { timeout: 15000 });
  await toTrade(a);
  await tap(a.h, 'OFFERS');
  await a.h.shot(OUT + 'trade-5-multi-received.png');
  // VER: a oferta no layout da proposta (esquerda o que a Ana dá, direita o que recebe) e aceite por essa tela
  const oid = await a.h.ev(async () => (await __online.api.offers()).find(o => o.status === 'pending').id);
  await tapName(a.h, 'view_' + oid);
  const seen = await a.h.ev(() => __player.root.mGame.mOnline.v.children.filter(c => c.name?.startsWith('bug_')).map(c => c.name.slice(4)));
  await a.h.shot(OUT + 'trade-5-multi-view.png');
  console.log('VER: besouros na tela', seen.length);
  if (![...bobs, hawaii].every(u => seen.includes(u))) throw new Error('a tela da oferta não mostra os besouros dos dois lados');
  await tap(a.h, 'ACCEPT', 1200);
  await until(a.h, us => us.every(u => __player.global.GAME.aAdult.some(x => x.sUid === u)), bobs);
  await until(b.h, u => __player.global.GAME.aAdult.some(x => x.sUid === u), hawaii);
  const [ga4, gb4] = [await game(a.h), await game(b.h)];
  console.log('2 por 1: Ana', JSON.stringify(ga4), 'Bob', JSON.stringify(gb4));
  if (ga4.bugs.length !== 3 || gb4.bugs.length !== 1) throw new Error('troca 2 por 1 não fechou certo');
  console.log('ok: venda, compra direta, cancelamento e troca 2 por 1');
};
