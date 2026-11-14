// Online: desafio assíncrono de corrida e de luta. O desafiado aceita, escolhe o time e assiste (parte em velocidade
// normal, depois pula); o desafiante revê o replay pulando direto. Replay = resultado gravado; aposta vai ao vencedor.
import { OUT, click, waitMsg, startOnline, makeWorld, openPanel } from './online-lib.mjs';

const until = (h, f, arg, ms = 20000) => h.page.waitForFunction(f, arg, { timeout: ms });
// roda a simulação até o fim (como o botão SKIP RACE, que só existe na corrida)
const skip = h => h.ev(() => { const G = __player.global.GAME; for (let i = 0; i < 300000 && (G.nScreen == 3 || G.nScreen == 4) && (G.nScreen == 3 ? G.paBattle.length && G.paBattle_2.length : G.paRace.length && G.paRace_2.length); i++) G.run(); }, null, 60000);
const okPopup = h => h.ev(async () => { await __sleep(400); await __btn('OK'); await __sleep(1500); });

async function challenge(a, b, bName, kind, bet) {
  if (!await a.page.$('#evo-online')) await openPanel(a.h);
  await click(a.page, 'WORLD');
  await a.page.locator(`#evo-online .evo-row:has-text("${bName}") button:text-is("PROFILE")`).click();
  await a.page.waitForSelector('#evo-online .evo-card');
  await click(a.page, kind === 'race' ? 'CHALLENGE: RACE' : 'CHALLENGE: FIGHT');
  for (let i = 0; i < 2; i++) await a.page.locator('#evo-online .evo-card').nth(i).click();
  await a.page.fill('#evo-bet', String(bet));
  await click(a.page, 'SEND CHALLENGE');
  await waitMsg(a.page, 'Challenge sent!');
}

async function acceptAndWatch(b, kind) {
  await b.page.waitForFunction(() => __online.sync.state.pending > 0, null, { timeout: 15000 });
  if (!await b.page.$('#evo-online')) await openPanel(b.h);
  await click(b.page, 'CHALLENGES');
  await click(b.page, 'ACCEPT');
  await b.page.waitForSelector('#evo-online .evo-card.pick');
  const cards = b.page.locator('#evo-online .evo-card.pick');
  for (let i = 0; i < 2; i++) await cards.nth(i).click();
  await b.h.shot(OUT + `match-${kind}-1-team.png`);
  await click(b.page, 'START');
  const screen = kind === 'race' ? 4 : 3;
  await until(b.h, s => __player.global.GAME.nScreen === s && __online.match.current(), screen);
  await b.h.sleep(2500); // um pedaço em velocidade normal
  await b.h.shot(OUT + `match-${kind}-2-live.png`);
  await skip(b.h);
  await until(b.h, () => window.__lastMatch);
  const live = await b.h.ev(() => window.__lastMatch);
  await b.h.shot(OUT + `match-${kind}-3-result.png`);
  await okPopup(b.h);
  return live;
}

async function replay(a, kind) {
  await a.h.ev(() => { window.__lastMatch = null; });
  await openPanel(a.h);
  await click(a.page, 'CHALLENGES');
  await a.page.locator('#evo-online button:text-is("WATCH")').first().click();
  await until(a.h, s => __player.global.GAME.nScreen === s && __online.match.current(), kind === 'race' ? 4 : 3);
  await skip(a.h);
  await until(a.h, () => window.__lastMatch);
  const r = await a.h.ev(() => window.__lastMatch);
  await a.h.shot(OUT + `match-${kind}-4-replay.png`);
  await okPopup(a.h);
  return r;
}

export default async (page, h) => {
  const a = { page, h };
  const b = await h.newPage();
  const [, B] = await Promise.all([startOnline(a.h, 'ana'), startOnline(b.h, 'bob')]);
  await makeWorld(a, b);
  for (const [kind, bet] of [['race', 100], ['battle', 50]]) {
    const ma0 = await a.h.ev(() => __player.global.GAME.nMoney), mb0 = await b.h.ev(() => __player.global.GAME.nMoney);
    await challenge(a, b, B.name, kind, bet);
    await until(a.h, m => __player.global.GAME.nMoney === m, ma0 - bet); // aposta reservada
    const live = await acceptAndWatch(b, kind);
    const winA = live.winner === 'a';
    await until(a.h, m => __player.global.GAME.nMoney === m, ma0 - bet + (winA ? 2 * bet : 0));
    await until(b.h, m => __player.global.GAME.nMoney === m, mb0 - bet + (winA ? 0 : 2 * bet));
    const rep = await replay(a, kind);
    console.log(kind, 'ao vivo', JSON.stringify(live), 'replay', JSON.stringify(rep));
    if (rep.winner !== live.winner || rep.steps !== live.steps || rep.official !== live.winner) throw new Error(kind + ': replay diferente do resultado');
  }
  console.log('ok: corrida e luta, replay idêntico, apostas pagas');
};
