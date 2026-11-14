// Online: trocas entre membros do mundo. Venda aceita, pedido de compra recusado e oferta cancelada:
// besouros e dinheiro mudam (ou voltam) dos dois lados, via inbox.
import { OUT, click, waitMsg, startOnline, makeWorld } from './online-lib.mjs';

const game = h => h.ev(() => { const g = __player.global.GAME; return { money: g.nMoney, bugs: g.aAdult.map(a => a.sUid ?? a.sNickName) }; });
const until = (h, f, arg) => h.page.waitForFunction(f, arg, { timeout: 15000 });

async function toProfile(x, name) {
  await click(x.page, 'WORLD');
  await x.page.locator(`#evo-online .evo-row:has-text("${name}") button:text-is("PROFILE")`).click();
  await x.page.waitForSelector('#evo-online .evo-card');
}

export default async (page, h) => {
  const a = { page, h };
  const b = await h.newPage();
  const [A, B] = await Promise.all([startOnline(a.h, 'ana'), startOnline(b.h, 'bob')]);
  await makeWorld(a, b);
  // Adam da Ana fica com idade para vender (≥ 150, regra da v1)
  const adam = await h.ev(() => { const x = __player.global.GAME.aAdult[0]; x.nAge_now = 200; return x.sUid; });

  // 1) Ana vende Adam por $ 300 → reserva sai do jogo dela na hora
  await toProfile(a, B.name);
  await click(page, 'OFFER TRADE');
  await page.locator(`#evo-online .evo-card[data-uid="${adam}"]`).first().click();
  await page.fill('#evo-want_money', '300');
  await a.h.shot(OUT + 'trade-1-compose.png');
  await click(page, 'SEND OFFER');
  await waitMsg(page, 'Offer sent!');
  await until(a.h, u => !__player.global.GAME.aAdult.some(x => x.sUid === u), adam);
  await b.page.waitForFunction(() => __online.sync.state.pending > 0, null, { timeout: 15000 });
  await click(b.page, 'OFFERS');
  await b.h.shot(OUT + 'trade-2-received.png');
  await click(b.page, 'ACCEPT');
  await until(b.h, u => __player.global.GAME.aAdult.some(x => x.sUid === u), adam);
  await until(a.h, () => __player.global.GAME.nMoney === 1300);
  const [ga, gb] = [await game(a.h), await game(b.h)];
  console.log('venda: Ana', JSON.stringify(ga), 'Bob', JSON.stringify(gb));
  if (gb.money !== 700 || gb.bugs.length !== 3 || ga.bugs.length !== 1) throw new Error('venda não fechou certo');

  // 2) Ana pede para comprar a Hawaii do Bob por $ 100 → reserva o dinheiro; Bob recusa → devolve
  const hawaii = await b.h.ev(() => __player.global.GAME.aAdult.find(x => x.sNickName === 'Hawaii').sUid);
  await b.h.ev(() => __online.sync.pushNow(true)); // resumo do Bob atualizado (agora com Adam)
  await toProfile(a, B.name);
  await click(page, 'OFFER TRADE');
  await page.locator(`#evo-online .evo-card[data-uid="${hawaii}"]`).last().click();
  await page.fill('#evo-give_money', '100');
  await click(page, 'SEND OFFER');
  await waitMsg(page, 'Offer sent!');
  await until(a.h, () => __player.global.GAME.nMoney === 1200);
  await click(b.page, 'OFFERS');
  await b.page.waitForSelector('#evo-online button:text-is("DECLINE")', { timeout: 15000 });
  await click(b.page, 'DECLINE');
  await until(a.h, () => __player.global.GAME.nMoney === 1300);
  console.log('pedido recusado: dinheiro da Ana voltou para 1300');

  // 3) Bob oferece Adam de volta e cancela → Adam volta para o Bob
  await b.h.ev(u => { __player.global.GAME.aAdult.find(x => x.sUid === u).nAge_now = 300; }, adam);
  await toProfile(b, A.name);
  await click(b.page, 'OFFER TRADE');
  await b.page.locator(`#evo-online .evo-card[data-uid="${adam}"]`).first().click();
  await b.page.fill('#evo-want_money', '50');
  await click(b.page, 'SEND OFFER');
  await waitMsg(b.page, 'Offer sent!');
  await until(b.h, u => !__player.global.GAME.aAdult.some(x => x.sUid === u), adam);
  await click(b.page, 'CANCEL');
  await until(b.h, u => __player.global.GAME.aAdult.some(x => x.sUid === u), adam);
  await b.h.shot(OUT + 'trade-3-history.png');
  // aceitar de novo uma oferta já resolvida falha no servidor (máquina de estados)
  const again = await b.h.ev(async () => { const os = await __online.api.offers(); try { await __online.api.respondOffer(os.find(o => o.status !== 'pending').id, true); return 'aceitou'; } catch (e) { return e.message; } });
  console.log('reaceitar oferta resolvida:', again);
  if (again === 'aceitou') throw new Error('oferta resolvida foi aceita de novo');
  console.log('ok: venda, recusa e cancelamento');
};
