// Cercas no insetário: desenhar (botão direito / modo cerca no celular), insetos não atravessam (andando e voando),
// arrasto do jogador atravessa, excluir pela lixeira, persistência, limites e zoom com pinça.
// GAME_URL=http://localhost:5300/ node tests/harness.mjs tests/fence.mjs
import { mkdirSync } from 'node:fs';
const OUT = 'tests/out-fence/';
mkdirSync(OUT, { recursive: true });
const ok = (c, msg) => { if (!c) throw new Error(msg); console.log('ok:', msg); };

export default async (page, h) => {
  const ev = h.ev;
  const G = () => ev(() => JSON.stringify(__player.global.GAME.aFence));
  const fences = async () => JSON.parse(await G());
  const dragM = async (x1, y1, x2, y2, button = 'left', hold = 0) => {
    await page.mouse.move(x1, y1); await page.mouse.down({ button });
    for (let i = 1; i <= 10; i++) await page.mouse.move(x1 + (x2 - x1) * i / 10, y1 + (y2 - y1) * i / 10);
    if (hold) await h.sleep(hold);
    await page.mouse.up({ button }); await h.sleep(120);
  };
  const clean = () => ev(async () => {
    const R = __player.root; for (const p of [R, R.mGame]) p.children.filter(c => c.name.startsWith('mFirst')).forEach(c => c.removeMovieClip());
  });
  await h.newGame();
  await clean();
  await ev(() => { __player.global.GAME.stop(); }); // sem o relógio do jogo: os testes giram run() à mão

  // ---- 1. desenhar com o botão direito; menu do navegador suprimido; esquerdo não desenha
  ok(await ev(() => { const e = new MouseEvent('contextmenu', { cancelable: true, bubbles: true }); __player.canvas.dispatchEvent(e); return e.defaultPrevented; }), 'menu de contexto do navegador suprimido no canvas');
  await ev(() => { __player.global.GAME.aAdult.forEach(a => a.vCurr.setTo(600, 40)); });
  ok((await fences()).length === 0, 'jogo novo começa sem cercas');
  await dragM(100, 100, 300, 140, 'right');
  let f = await fences();
  ok(f.length === 1 && Math.hypot(f[0][0] - 100, f[0][1] - 100) < 1 && Math.hypot(f[0][2] - 300, f[0][3] - 140) < 1, 'botão direito + arrastar cria uma cerca do ponto apertado ao solto ' + JSON.stringify(f));
  await dragM(100, 220, 300, 220, 'left'); // esquerdo em área vazia não desenha
  ok((await fences()).length === 1, 'botão esquerdo no chão não cria cerca');
  await dragM(200, 300, 205, 303, 'right');
  ok((await fences()).length === 1, 'cerca curta demais (clique acidental) é descartada');
  await dragM(200, 330, 320, 470, 'right'); // termina dentro da barra do HUD: o fim é limitado ao insetário
  f = await fences();
  ok(f.length === 2 && f[1][3] <= 378 && f[1][3] >= 330, 'ponta solta sobre o HUD fica limitada ao insetário ' + JSON.stringify(f[1]));
  await ev(() => { __player.global.GAME.aFence.splice(1); __player.global.GAME.stop(); }); await h.sleep(100);
  await ev(() => __player.root.mGame.mGround.mFence.children.forEach(c => c.removeMovieClip())); // só para o print
  await page.mouse.click(250, 400, { button: 'right' }); // direito no HUD segue como antes (sem cerca)
  ok((await fences()).length === 1, 'direito sobre o HUD não desenha');

  // ---- 2. insetos não atravessam: vertical em x=320, de y=60 a 330
  await ev(() => { const g = __player.global.GAME; g.aFence.length = 0; g.aFence.push([320, 0, 320, 378]); __player.global.GAME.nScreen = 0; });
  const sim = (spec) => ev(async (s) => {
    const g = __player.global.GAME, a = g.aAdult[0];
    for (const o of g.aAdult.slice(1)) o.vCurr.setTo(600, 40);
    a.vCurr.setTo(s.x, s.y); a.nRot = s.rot; a.nStatement = s.st; a.nDir = 0; a.nFenceT = 0; a.nRandom_speed = 0.5; a.bHit = false;
    if (s.food) { g.aFood.forEach(x => x.remove?.()); g.aFood.length = 0; g.addFood(0); const fd = g.aFood[0]; fd.vCurr.setTo(s.food[0], s.food[1]); fd.mClip._x = s.food[0]; fd.mClip._y = s.food[1]; }
    let crossed = 0, bounces = 0, lastT = 0, minX = 1e9, maxX = -1e9, maxJump = 0, px = a.vCurr.x, py = a.vCurr.y;
    const side0 = Math.sign(s.x - 320);
    for (let i = 0; i < s.ticks; i++) {
      g.run();
      if (a.nStatement !== s.st) a.nStatement = s.st;
      if (i % 30 === 0) a.movementCase(); // o "relógio" do jogo (1 por segundo): walk()
      if (a.nFenceT === 3 && lastT !== 3) bounces++; lastT = a.nFenceT;
      if (Math.sign(a.vCurr.x - 320) !== side0) crossed++;
      maxJump = Math.max(maxJump, Math.hypot(a.vCurr.x - px, a.vCurr.y - py)); px = a.vCurr.x; py = a.vCurr.y;
      minX = Math.min(minX, a.vCurr.x); maxX = Math.max(maxX, a.vCurr.x);
    }
    return { crossed, bounces, minX, maxX, x: a.vCurr.x, y: a.vCurr.y, maxJump };
  }, spec);
  let r = await sim({ x: 300, y: 200, rot: 0, st: 5, ticks: 4000 });
  ok(r.crossed === 0 && r.bounces >= 1, `andando (estado 5) contra a cerca: não atravessa em 4000 ticks, ${r.bounces} quique(s) ${JSON.stringify(r)}`);
  r = await sim({ x: 340, y: 200, rot: Math.PI, st: 5, ticks: 4000 });
  ok(r.crossed === 0 && r.bounces >= 1, `andando do outro lado: não atravessa ${JSON.stringify(r)}`);
  r = await sim({ x: 300, y: 200, rot: 0, st: 3, food: [500, 200], ticks: 6000 });
  ok(r.crossed === 0 && r.bounces >= 1 && r.bounces < 6000 / 30 && r.maxJump < 3, `faminto (estado 3) com a comida do outro lado: não atravessa e sem tremer (${r.bounces} quiques em 6000 ticks) ${JSON.stringify(r)}`);
  r = await sim({ x: 300, y: 200, rot: 0.4, st: 7, ticks: 2500 });
  ok(r.crossed === 0 && r.bounces >= 1, `voando (estado 7, nFly) contra a cerca: não atravessa ${JSON.stringify(r)}`);
  r = await sim({ x: 300, y: 100, rot: 0.1, st: 1, ticks: 2000 });
  ok(r.crossed === 0, `estado 1 (movimento de luta) também respeita ${JSON.stringify(r)}`);
  // quase paralelo e de frente ao canto/ponta
  r = await sim({ x: 318, y: 200, rot: -Math.PI / 2 + 0.02, st: 5, ticks: 2000 });
  ok(r.crossed === 0 && r.maxJump < 3, `rente à cerca, subindo quase paralelo: sem atravessar nem saltos ${JSON.stringify(r)}`);
  // colado na cerca (solto em cima): sai andando, não fica preso
  r = await sim({ x: 320, y: 200, rot: 0, st: 5, ticks: 600 });
  ok(Math.abs(r.x - 320) > 3 || r.y !== 200, 'solto em cima da cerca, o inseto sai andando (não fica preso) ' + JSON.stringify(r));
  await ev(() => { const g = __player.global.GAME; g.aFood.forEach(x => x.remove?.()); g.aFood.length = 0; });

  // ---- 3. arrasto do jogador atravessa (esquerdo no besouro, solta do outro lado da cerca)
  await ev(() => { const g = __player.global.GAME, a = g.aAdult[0]; a.vCurr.setTo(280, 200); a.nStatement = 6; a.moveClip(); g.aFence.length = 0; g.aFence.push([320, 0, 320, 378]); __player.root.mGame.mGround.mFence && 0; });
  await ev(async () => { __fence.buildFences(); await __sleep(200); });
  const bp = await ev(() => { const a = __player.global.GAME.aAdult[0]; a.mClip.onRollOver = null; const b = a.mClip.getBounds(__player.root); return [(b.xMin + b.xMax) / 2, (b.yMin + b.yMax) / 2]; });
  await dragM(bp[0], bp[1], 400, 200, 'left');
  const x3 = await ev(() => __player.global.GAME.aAdult[0].vCurr.x);
  ok(x3 > 360, 'arrastar o inseto à mão atravessa a cerca (soltou em x=' + x3.toFixed(0) + ')');
  await page.screenshot({ path: OUT + 'desktop.png', clip: { x: 0, y: 0, width: 640, height: 380 } });

  // ---- 4. excluir: arrastar até a lixeira
  await ev(() => { __player.global.GAME.aAdult.forEach(a => a.vCurr.setTo(600, 40)); __player.global.GAME.aAdult.forEach(a => a.moveClip()); __player.global.GAME.aFence.length = 0; __player.global.GAME.aFence.push([150, 120, 350, 160]); });
  await ev(async () => { __fence.buildFences(); await __sleep(150); });
  ok(!(await ev(() => __player.root.mGame.mFenceTrash._visible)), 'lixeira escondida enquanto nada é arrastado');
  await dragM(250, 140, 250, 141, 'left'); // clique sem arrastar: nada muda
  ok(JSON.stringify(await fences()) === '[[150,120,350,160]]', 'clique na cerca sem arrastar não a muda');
  await page.mouse.move(250, 140); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(250 - i * 5, 140 + i * 20);
  await h.sleep(150);
  ok(await ev(() => __player.root.mGame.mFenceTrash._visible), 'arrastar a cerca faz a lixeira aparecer');
  await page.screenshot({ path: OUT + 'trash-show.png', clip: { x: 0, y: 0, width: 640, height: 380 } });
  await page.mouse.move(30, 350, { steps: 6 }); await h.sleep(150);
  ok(await ev(() => __player.root.mGame.mFenceTrash.hot._visible), 'sobre a lixeira ela destaca (vermelha)');
  await page.screenshot({ path: OUT + 'trash-hot.png', clip: { x: 0, y: 0, width: 640, height: 380 } });
  await page.mouse.up(); await h.sleep(150);
  ok((await fences()).length === 0, 'soltar sobre a lixeira exclui a cerca');
  ok(!(await ev(() => __player.root.mGame.mFenceTrash._visible)), 'lixeira some depois de soltar');
  // soltar fora da lixeira: a cerca é movida (decisão de desenho)
  await ev(() => { __player.global.GAME.aFence.push([150, 120, 350, 160]); });
  await ev(async () => { __fence.buildFences(); await __sleep(150); });
  await dragM(250, 140, 300, 240, 'left');
  f = await fences();
  ok(f.length === 1 && Math.abs(f[0][0] - 200) < 1.5 && Math.abs(f[0][1] - 220) < 1.5, 'soltar fora da lixeira move a cerca ' + JSON.stringify(f));
  await dragM(200, 220, 900, 900, 'left'); // arrastada para fora: as duas pontas continuam no insetário
  f = await fences();
  ok(f[0].every((n, i) => i % 2 ? n <= 378 && n >= 0 : n <= 640 && n >= 0), 'arrasto não leva a cerca para fora do insetário ' + JSON.stringify(f));

  // ---- 5. limite de cercas
  await ev(() => { __player.global.GAME.aFence.length = 0; });
  await ev(async () => { __fence.buildFences(); });
  for (let i = 0; i < 14; i++) await dragM(40 + i * 40, 60, 40 + i * 40, 130, 'right');
  ok((await fences()).length === 12, 'no máximo 12 cercas (' + (await fences()).length + ')');

  // ---- 6. persistência: recarregar a página e continuar
  await ev(() => { __player.global.GAME.aFence.length = 2; });
  await ev(async () => { __fence.buildFences(); (await import('/src/engine/as2.ts')).SharedObject.flushAll(); });
  const saved = await G();
  await page.reload(); await page.waitForFunction(() => window.__player?.root?.mGame?.cur === 6); await h.sleep(1500);
  await ev(async () => { await __btn('CONTINUE AS TESTER'); await __sleep(1500); });
  ok(await ev(() => __player.root.mGame.cur) === 38 && (await G()) === saved, 'cercas voltam ao recarregar a página ' + saved);
  ok(await ev(() => __player.root.mGame.mGround.mFence.children.length) === 2, 'e os clips das cercas são refeitos');
  // save antigo (sem aFence) carrega; lixo no save não quebra
  const edit = fn => ev(fn => { new Function('g', fn)(__player.global.GAME); __player.root.mGame.soData.flush(); }, fn); // o save é o próprio GAME (pagehide regrava)
  await edit('delete g.aFence');
  await page.reload(); await page.waitForFunction(() => window.__player?.root?.mGame?.cur === 6); await h.sleep(1500);
  await ev(async () => { await __btn('CONTINUE AS TESTER'); await __sleep(1500); });
  ok(await ev(() => __player.root.mGame.cur) === 38 && (await G()) === '[]', 'save antigo, sem cercas, continua carregando');
  await edit("g.aFence = [[1, 2, 3, 4], 'lixo', [null, 1, 2, 3], [10, 10, 90, 90]]");
  await page.reload(); await page.waitForFunction(() => window.__player?.root?.mGame?.cur === 6); await h.sleep(1500);
  await ev(async () => { await __btn('CONTINUE AS TESTER'); await __sleep(1500); });
  ok(await ev(() => __player.root.mGame.cur) === 38 && (await G()) === '[[1,2,3,4],[10,10,90,90]]', 'entradas inválidas do save são descartadas ' + await G());

  // ---- 7. outras telas: sem cerca fora do insetário; ESC com cercas
  await ev(async () => { __player.root.mGame.mBar.goto('Setting'); await __sleep(600); });
  await dragM(100, 100, 300, 140, 'right');
  ok((await fences()).length === 2, 'direito nas Configurações não desenha cerca');
  await page.keyboard.press('Escape'); await h.sleep(700);
  ok(await ev(() => __player.root.mGame.mBar._currentframe) === 1, 'ESC continua fechando a tela com cercas no jogo');
  await ev(async () => { await __clickObj(__player.root.mGame.m2, 1500); });
  ok(await ev(() => !__player.root.mGame.mFenceBtn && !__player.root.mGame.mFenceTrash), 'botão e lixeira somem fora do insetário (loja)');
  await ev(async () => { await __clickObj(__player.root.mGame.m1, 1500); });
  ok(await ev(() => __player.root.mGame.mGround.mFence.children.length) === 2, 'voltando da loja, as cercas estão lá');
  await mobile(page);
};

// ───────────────────────── celular (toque emulado) ─────────────────────────
export async function mobile(desk) {
  const ctx = await desk.context().browser().newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://localhost:5300/');
  await page.waitForFunction(() => window.__player?.root?.mGame?.cur === 6, null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const cdp = await ctx.newCDPSession(page);
  const scr = (x, y) => ev(([x, y]) => { const r = __player.canvas.getBoundingClientRect(); return [r.left + x * r.width / 640, r.top + y * r.height / 480]; }, [x, y]);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const tdrag = async (x1, y1, x2, y2, hold = 0) => {
    const [a, b] = await scr(x1, y1), [c, d] = await scr(x2, y2);
    await touch('touchStart', [[a, b]]); await page.waitForTimeout(60);
    for (let i = 1; i <= 8; i++) { await touch('touchMove', [[a + (c - a) * i / 8, b + (d - b) * i / 8]]); await page.waitForTimeout(25); }
    if (hold) await page.waitForTimeout(hold);
    await touch('touchEnd', []); await page.waitForTimeout(150);
  };
  const ttap = async (x, y) => { const [a, b] = await scr(x, y); await touch('touchStart', [[a, b]]); await page.waitForTimeout(60); await touch('touchEnd', []); await page.waitForTimeout(150); };
  const fences = () => ev(() => __player.global.GAME.aFence);
  const state = () => ev(() => { const m = __player.root.mGame, b = m.mFenceBtn; const gb = b.getBounds(__player.root); return { vis: b._visible, mode: !!b.children.find(c => c.name === 'on')._visible, gb, ptr: __player.pointerType }; });

  await ev(() => localStorage.clear());
  await ev(async () => { await __btn('PLAY GAME'); await __sleep(400); });
  await page.fill('#stage input', 'Mobile');
  await ev(async () => { await __btn('OK'); await __sleep(400); await __btn('NEW GAME'); await __btn('START GAME'); await __sleep(1000); });
  ok(await ev(() => __player.root.mGame.cur) === 38, 'celular: insetário (frame 38)');
  await ev(() => { const R = __player.root; for (const p of [R, R.mGame]) p.children.filter(c => c.name.startsWith('mFirst')).forEach(c => c.removeMovieClip()); __player.global.GAME.stop(); __player.global.GAME.aAdult.forEach(a => { a.vCurr.setTo(600, 40); a.moveClip(); }); });

  let s = await state();
  ok(!s.vis, 'botão do modo cerca escondido antes de qualquer toque (sem toque detectado: não é celular)');
  await ttap(320, 200);
  s = await state();
  ok(s.ptr === 'touch' && s.vis, 'após o 1º toque (Player.pointerType = touch) o botão aparece');
  ok(s.gb.xMax <= 640 && s.gb.yMax <= 380 && s.gb.xMax > 590 && s.gb.yMax > 330, 'botão no canto inferior direito do insetário, acima da barra do HUD ' + JSON.stringify([s.gb.xMin, s.gb.yMin, s.gb.xMax, s.gb.yMax].map(Math.round)));
  ok(await ev(() => { const m = __player.root.mGame; const b = m.mFenceBtn.getBounds(__player.root); return [m.m0, m.m1, m.m2, m.m3, m.mBar].every(o => { const r = o.getBounds(__player.root); return b.yMax <= r.yMin + 1 || b.xMax < r.xMin || b.xMin > r.xMax || b.yMin >= r.yMax; }); }), 'botão não cobre os botões do HUD');
  const gb0 = s.gb;
  await page.screenshot({ path: OUT + 'mobile-off.png' });

  // modo desligado: arrastar o dedo no chão não desenha
  await tdrag(100, 100, 300, 140);
  ok((await fences()).length === 0, 'modo desligado: arrastar o dedo não cria cerca');
  // liga o modo
  await ttap(s.gb.xMin + 20, s.gb.yMin + 20);
  s = await state();
  ok(s.mode, 'tocar no botão liga o modo cerca');
  await page.screenshot({ path: OUT + 'mobile-on.png' });
  await tdrag(100, 100, 300, 140);
  let f = await fences();
  ok(f.length === 1 && Math.hypot(f[0][0] - 100, f[0][1] - 100) < 2 && Math.hypot(f[0][2] - 300, f[0][3] - 140) < 2, 'modo ligado: arrastar o dedo desenha a cerca ' + JSON.stringify(f));
  // com o modo ligado o dedo sobre um besouro desenha (não arrasta o besouro)
  await ev(() => { const a = __player.global.GAME.aAdult[0]; a.vCurr.setTo(200, 250); a.nStatement = 6; a.moveClip(); a.mClip.onRollOver = null; });
  await tdrag(200, 250, 320, 250);
  f = await fences();
  ok(f.length === 2 && (await ev(() => __player.global.GAME.aAdult[0].nStatement)) === 6, 'modo ligado: o dedo no besouro desenha cerca e não arrasta o besouro');
  await ttap(s.gb.xMin + 20, s.gb.yMin + 20); // desliga
  ok(!(await state()).mode, 'tocar de novo desliga o modo');
  await tdrag(200, 250, 100, 300); // agora arrasta o besouro (nStatement 8 durante o arrasto → depois 5)
  ok(Math.abs((await ev(() => __player.global.GAME.aAdult[0].vCurr.x)) - 100) < 25, 'modo desligado: o dedo arrasta o besouro como antes');
  await ev(() => { __player.global.GAME.aAdult[0].vCurr.setTo(600, 40); __player.global.GAME.aAdult[0].moveClip(); });
  // excluir pelo toque: arrasta a 1ª cerca até a lixeira
  const L = TRASH_STAGE;
  await ev(() => { __player.global.GAME.aFence.length = 1; });
  await ev(() => __fence.buildFences());
  await tdrag(200, 120, L[0], L[1], 80);
  ok((await fences()).length === 0, 'toque: arrastar a cerca até a lixeira a exclui');
  // fora da lixeira: move
  await ev(() => { __player.global.GAME.aFence.push([100, 100, 300, 140]); __fence.buildFences(); });
  await tdrag(200, 120, 260, 200);
  f = await fences();
  ok(f.length === 1 && Math.abs(f[0][0] - 160) < 2.5 && Math.abs(f[0][1] - 180) < 2.5, 'toque: soltar fora da lixeira move a cerca ' + JSON.stringify(f));

  // ---- zoom com pinça: desenhar e excluir no espaço do mGround
  await ev(() => { __player.global.GAME.aFence.length = 0; __fence.buildFences(); });
  const pinch = async (sx, sy, d0, d1) => {
    const [x, y] = await scr(sx, sy), k = (await scr(1, 0))[0] - (await scr(0, 0))[0];
    await touch('touchStart', [[x - d0 * k, y], [x + d0 * k, y]]);
    for (let i = 1; i <= 8; i++) { const d = d0 + (d1 - d0) * i / 8; await touch('touchMove', [[x - d * k, y], [x + d * k, y]]); await page.waitForTimeout(30); }
    await touch('touchEnd', []); await page.waitForTimeout(150);
  };
  await pinch(320, 190, 40, 100);
  const z = await ev(() => __player.zoom && { s: __player.zoom.s, tx: __player.zoom.tx, ty: __player.zoom.ty });
  ok(z && z.s > 2, 'zoom ligado (' + JSON.stringify(z) + ')');
  s = await state();
  const btnZ = s.gb;
  ok(Math.abs(btnZ.xMin - gb0.xMin) < 1 && Math.abs(btnZ.yMin - gb0.yMin) < 1, 'o botão não acompanha o zoom do insetário');
  await ttap(btnZ.xMin + 20, btnZ.yMin + 20);
  ok((await state()).mode, 'modo cerca ligado com zoom');
  const [ax, ay] = [150, 120], [bx, by] = [450, 200]; // pontos do PALCO (tela), não do mGround
  await tdrag(ax, ay, bx, by);
  f = (await fences())[0];
  const exp = await ev(([ax, ay, bx, by]) => { const g = __player.root.mGame.mGround; return [...g.globalToLocalXY(ax, ay), ...g.globalToLocalXY(bx, by)]; }, [ax, ay, bx, by]);
  ok(f && f.every((n, i) => Math.abs(n - exp[i]) < 1.5) && (Math.abs(exp[0] - ax) > 20), 'com zoom a cerca é gravada no espaço do mGround ' + JSON.stringify(f) + ' esperado ' + JSON.stringify(exp.map(Math.round)));
  ok(await ev(([ax, ay, bx, by]) => { const mx = (ax + bx) / 2, my = (ay + by) / 2; const t = __player.pick(__player.root, mx, my, [1, 0, 0, 1, 0, 0]); return !!t && t.name === 'f0'; }, [ax, ay, bx, by]), 'com zoom, o ponto do traço na tela acerta a cerca (arte e toque no mesmo lugar)');
  await page.screenshot({ path: OUT + 'mobile-zoom-fence.png' });
  // pinça no meio do traço descarta o traço (não vira cerca) e dá zoom
  const nBefore = (await fences()).length;
  { const [a, b] = await scr(100, 250), [c, d] = await scr(300, 250), [e, f2] = await scr(500, 100);
    await touch('touchStart', [[a, b]]); await page.waitForTimeout(40);
    await touch('touchMove', [[(a + c) / 2, b]]); await page.waitForTimeout(40);
    await touch('touchStart', [[(a + c) / 2, b], [e, f2]]); await page.waitForTimeout(40); // 2º dedo: pinça
    await touch('touchMove', [[(a + c) / 2 - 20, b], [e + 30, f2]]); await page.waitForTimeout(40);
    await touch('touchEnd', []); await page.waitForTimeout(150); }
  ok((await fences()).length === nBefore && !(await ev(() => !!__player.root.mGame.mGround.mFence.children.find(c => c.name === 'mPrev'))), 'segundo dedo (pinça) descarta o traço em andamento, sem cerca nem prévia sobrando');
  // colisão com zoom (dados no espaço do mGround): vertical em x=320
  await ev(() => { const g = __player.global.GAME; g.aFence.length = 0; g.aFence.push([320, 0, 320, 378]); __fence.buildFences(); });
  const sim = await ev(() => {
    const g = __player.global.GAME, a = g.aAdult[0]; a.vCurr.setTo(300, 200); a.nRot = 0; a.nStatement = 5; a.nFenceT = 0; let crossed = 0;
    for (let i = 0; i < 3000; i++) { g.run(); if (i % 30 === 0) a.movementCase(); if (a.vCurr.x > 320) crossed++; }
    return crossed;
  });
  ok(sim === 0, 'com zoom ligado a colisão continua valendo');
  // excluir com zoom: arrasta a cerca (na tela) até a lixeira (que fica fora do zoom)
  const mid = await ev(() => { const g = __player.root.mGame.mGround; const p = { x: 320, y: 190 }; g.localToGlobal(p); return [p.x, p.y]; });
  const tr = await ev(() => { const b = __player.root.mGame.mFenceTrash; return b.getBounds(__player.root); });
  ok(Math.abs(tr.xMin - 6) < 1.5 && Math.abs(tr.yMax - 374) < 1.5, 'lixeira fica fixa na tela (fora do zoom): ' + JSON.stringify([tr.xMin, tr.yMin, tr.xMax, tr.yMax].map(Math.round)));
  ok(!(await state()).mode, 'refazer as cercas (nova entrada no insetário) desliga o modo cerca'); // buildFences zera o modo
  await tdrag(mid[0], mid[1], 30, 350, 80);
  ok((await fences()).length === 0, 'com zoom: arrastar a cerca até a lixeira a exclui');
  ok(errs.length === 0 && (await ev(() => window.__errs.length)) === 0, 'sem erros na página ' + JSON.stringify(errs));
  await ctx.close();
}
const TRASH_STAGE = [30, 350];
