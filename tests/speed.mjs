// Cenário "sincronizar insetos com a velocidade do jogo": distância percorrida em N s, opção OFF vs ON (SPEED 1X/4X),
// persistência após reload e botão em EN/PT (screenshots tests/out-speed-*.png).
// Uso: node tests/harness.mjs tests/speed.mjs   (servidor dev em :5199)
const T = 5000; // ms de medição
export default async (page, h) => {
  const btn = (l) => h.ev(async (l) => await __btn(l), l);
  const lsv = () => page.evaluate(() => localStorage.getItem('evolution.syncSpeed'));
  // soma do deslocamento (px) de todos os insetos vivos amostrando a cada 50 ms
  const dist = () => h.ev(async (T) => {
    const G = __player.global.GAME, A = G.aAdult;
    // determinismo: insetos fixos em "passeio" (statement 5) e sem tick de dia (moveTime) — só o movimento por frame conta
    A.forEach(a => { a.moveTime = () => true; a.nStatement = 5; });
    if (!G.__runPatched) { const r = G.run; G.run = function () { G.__runs = (G.__runs || 0) + 1; return r.apply(this, arguments); }; G.__runPatched = true; }
    G.__runs = 0;
    const last = A.map(a => [a.vCurr.x, a.vCurr.y]); let tot = 0; const t0 = performance.now();
    while (performance.now() - t0 < T) {
      await __sleep(50);
      A.forEach((a, i) => { if (!a.vCurr) return; tot += Math.hypot(a.vCurr.x - last[i][0], a.vCurr.y - last[i][1]); last[i] = [a.vCurr.x, a.vCurr.y]; });
    }
    return { tot: Math.round(tot), n: A.length, nInt: G.nInterval, runsPerSec: Math.round(G.__runs / (T / 1000)) };
  }, T + 1000, T + 8000);
  const speedTo = async (x) => { for (let i = 0; i < 3; i++) { const r = await h.ev(() => __player.global.GAME.nInterval); if (1000 / r === x) return; await h.ev(async () => { const b = __find('SPEED 1X') || __find('SPEED 2X') || __find('SPEED 4X'); await __clickObj(b, 300); }); } };
  const openSetting = async () => { await h.ev(async () => { await __clickObj(__player.root.mGame.m0, 1200); }); };
  const sync = () => h.ev(() => { const b = __find('SYNC BUGS SPEED: ON') || __find('SYNC BUGS SPEED: OFF'); return b && b.sLabel.trim(); });

  await h.ev(() => __lang.set('en'));
  await h.newGame();
  // ── botão na Setting, EN e PT ──
  await openSetting();
  console.log('EN rótulo:', await sync(), '| ls:', await lsv());
  await h.shot('tests/out-speed-en-off.png');
  await h.ev(() => __lang.set('pt')); await h.sleep(400);
  await h.shot('tests/out-speed-pt-off.png');
  await h.ev(async () => { await __clickObj(__find('SYNC BUGS SPEED: OFF'), 500); });
  console.log('PT após clicar:', await sync(), '| ls:', await lsv());
  await h.shot('tests/out-speed-pt-on.png');
  await h.ev(() => __lang.set('en')); await h.sleep(400);
  await h.shot('tests/out-speed-en-on.png');
  await h.ev(async () => { await __clickObj(__find('SYNC BUGS SPEED: ON'), 500); });
  console.log('EN após clicar de novo:', await sync(), '| ls:', await lsv());
  await btn('RETURN TO GAME'); await h.sleep(1200);

  // ── medições ──
  const res = {};
  const set = (v) => page.evaluate(v => localStorage.setItem('evolution.syncSpeed', v ? '1' : '0'), v);
  // liga/desliga pelo botão (o módulo guarda o estado em memória)
  const toggle = async (want) => {
    await openSetting();
    const on = (await sync()) === 'SYNC BUGS SPEED: ON';
    if (on !== want) await h.ev(async () => { await __clickObj(__find('SYNC BUGS SPEED: ON') || __find('SYNC BUGS SPEED: OFF'), 500); });
    await btn('RETURN TO GAME'); await h.sleep(1200);
  };
  for (const [name, want, sp] of [['off-1x', false, 1], ['off-4x', false, 4], ['on-4x', true, 4], ['on-2x', true, 2], ['on-1x', true, 1]]) {
    await toggle(want); await speedTo(sp);
    res[name] = await dist();
    console.log(name, JSON.stringify(res[name]));
  }
  console.log('razão on-4x / off-4x =', (res['on-4x'].tot / res['off-4x'].tot).toFixed(2), '(esperado ~4)');
  console.log('razão off-4x / off-1x =', (res['off-4x'].tot / res['off-1x'].tot).toFixed(2), '(esperado ~1)');
  console.log('razão on-2x / off-1x  =', (res['on-2x'].tot / res['off-1x'].tot).toFixed(2), '(esperado ~2)');
  console.log('razão on-1x / off-1x  =', (res['on-1x'].tot / res['off-1x'].tot).toFixed(2), '(esperado ~1)');

  // ── persistência após reload (opção ligada) ──
  await toggle(true);
  await page.reload(); await page.waitForFunction(() => window.__player?.root?.mGame?.cur === 6, null, { timeout: 15000 }); await h.sleep(1500);
  console.log('após reload ls:', await lsv());
  // pelo menu inicial (bMenu)
  await btn('SETTINGS'); await h.sleep(800);
  console.log('menu inicial rótulo:', await sync());
  await h.shot('tests/out-speed-menu.png');
  await h.ev(async () => { await __clickObj(__find('SYNC BUGS SPEED: ON'), 500); });
  console.log('menu inicial após clicar:', await sync(), '| ls:', await lsv());
  await h.shot('tests/out-speed-menu-off.png');
};
