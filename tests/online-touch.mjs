// Celular (toque emulado: PointerEvent pointerType 'touch'): no popup de luta/corrida da arena e no compose do PvP,
// tocar no besouro mostra os atributos sem selecionar; arrastar até o grupo/painel do time seleciona; arrastar para fora
// tira. Com o mouse o clique continua selecionando. GAME_URL=http://localhost:5300/ node tests/harness.mjs tests/online-touch.mjs
import { OUT, openScreen, tap, tapName, startOnline, makeWorld, go, slotUids, myId, idle } from './online-lib.mjs';

const ok = (c, msg) => { if (!c) throw new Error(msg); console.log('ok:', msg); };
// toque emulado no palco (coords 640x480): pointerdown → pointermove em passos → pointerup
const touch = (h, x0, y0, x1 = x0, y1 = y0) => h.ev(async ([x0, y0, x1, y1]) => {
  const c = __player.canvas, r = c.getBoundingClientRect(), k = r.width / 640;
  const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, { pointerType: 'touch', pointerId: 9, isPrimary: true, clientX: r.left + x * k, clientY: r.top + y * k, bubbles: true, cancelable: true }));
  ev('pointerdown', x0, y0); await __sleep(60);
  for (let i = 1; i <= 6; i++) { ev('pointermove', x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6); await __sleep(30); }
  ev('pointerup', x1, y1); await __sleep(300);
}, [x0, y0, x1, y1]);
const center = (h, expr) => h.ev(e => { const o = (0, eval)(e); const b = o.getBounds(__player.root); return [(b.xMin + b.xMax) / 2, (b.yMin + b.yMax) / 2]; }, expr);

async function arena(h) {
  // entra na arena até sortear um competidor (NPC) e abre o popup dele
  let opened = false;
  for (let tries = 0; tries < 6 && !opened; tries++) {
    await go(h, 'arena');
    opened = await h.ev(async () => {
      const list = []; const f = o => { if (o.owner && o.owner.nBattle !== undefined && o.owner.nId !== 0) list.push(o); (o.children || []).forEach(f); }; f(__player.root.mGame);
      if (!list.length) return false;
      await __clickObj(list[0], 1200); return __player.root.children.some(c => c.name.startsWith('mPop'));
    });
    if (!opened) await go(h, 'home');
  }
  ok(opened, 'popup de adversário da arena aberto');
  const st = () => h.ev(() => {
    const G = __player.global.GAME, pop = __player.root.children.find(c => c.name.startsWith('mPop'));
    const sel = (G.pSell.nBattle == -1 ? G.paRace : G.paBattle).filter(Boolean).length;
    const ico = pop.children.find(c => c.owner && c.owner.nSide === 0 && c.owner.nId_2 === 0);
    return { sel, moved: ico._x != ico.owner.vCurr.x, info: G.mClip.mInfo.cur, words: __player.root.children.filter(c => c.name.startsWith('Word')).length, kind: G.pSell.nBattle };
  });
  const ICO = `__player.root.children.find(c => c.name.startsWith('mPop')).children.find(c => c.owner && c.owner.nSide === 0 && c.owner.nId_2 === 0)`;
  const SLOT = `__player.root.children.find(c => c.name.startsWith('mPop')).mC_0`;
  await h.ev(() => __player.global.GAME.mClip.mInfo.setFrame());
  const s0 = await st();
  const [ix, iy] = await center(h, ICO);
  await touch(h, ix, iy);
  let s = await st();
  ok(s.sel === 0 && !s.moved && s.info !== s0.info && s.words === s0.words + 1, 'toque no besouro mostra os atributos, não seleciona e dá a dica de arrastar ' + JSON.stringify({ s0, s }));
  await h.shot(OUT + 'touch-arena-tap.png');
  const [sx, sy] = await center(h, SLOT);
  await touch(h, ix, iy, sx, sy);
  s = await st();
  ok(s.sel === 1 && s.moved, 'arrastar até o grupo seleciona ' + JSON.stringify(s));
  await h.shot(OUT + 'touch-arena-drag.png');
  const [jx, jy] = await center(h, ICO);
  await touch(h, jx, jy, ix, iy);
  s = await st();
  ok(s.sel === 0 && !s.moved, 'arrastar de volta tira da seleção ' + JSON.stringify(s));
  await touch(h, ix, iy, ix + 30, iy); // arrasto curto que não chega ao grupo: nada muda
  ok((await st()).sel === 0, 'arrastar sem chegar ao grupo não seleciona');
  await h.ev(async e => { await __clickObj((0, eval)(e), 500); }, ICO);
  ok((await st()).sel === 1, 'mouse: o clique continua selecionando');
  await h.ev(async () => { await __btn('CANCEL') ; await __sleep(1200); }).catch(() => {});
  if (await h.ev(() => __player.root.children.some(c => c.name.startsWith('mPop')))) await h.ev(async () => { for (const l of ['BACK', 'NO', 'CLOSE']) if (__find(l)) { await __btn(l); break; } await __sleep(1200); });
  await go(h, 'home');
}

async function compose(h, friend) {
  await go(h, 'arena');
  await openScreen(h, 'pvp');
  await tap(h, 'CHALLENGE A FRIEND');
  await tapName(h, 'fight_' + friend);
  const [u0] = await slotUids(h);
  const S = `__player.root.mGame.mOnline.v.children.find(c => c.name === 'slot_${u0}')`;
  const glow = () => h.ev(e => { const s = (0, eval)(e); return !!(s && s.flt.length); }, S);
  const info = () => h.ev(() => __player.root.mGame.mOnline.v.mInfoBox?.cur);
  const i0 = await info();
  const [x, y] = await center(h, S);
  await touch(h, x, y); await idle(h.page);
  ok(!(await glow()) && (await info()) !== i0, 'PvP: toque mostra os atributos sem escolher');
  await touch(h, x, y, 480, 200); await idle(h.page); // painel do time (340..620 × 92..332)
  ok(await glow(), 'PvP: arrastar até o painel do time escolhe');
  await h.shot(OUT + 'touch-pvp-drag.png');
  await touch(h, x, y, x + 140, y + 70); await idle(h.page); // de volta para a grade
  ok(!(await glow()), 'PvP: arrastar para fora do painel tira');
  await tapName(h, 'slot_' + u0, 300);
  ok(await glow(), 'PvP mouse: o clique continua escolhendo');
}

export default async (page, h) => {
  const a = { page, h };
  const b = await h.newPage();
  await Promise.all([startOnline(a.h, 'tch'), startOnline(b.h, 'tcb')]);
  await makeWorld(a, b);
  await arena(a.h); // desafio de amigo usa o mesmo popup (frames BATTLE/RACE do mPop)
  await compose(a.h, await myId(b.h));
};
