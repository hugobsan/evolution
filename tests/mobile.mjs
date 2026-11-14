// Celular (toque): sem seleção/destaque ao tocar e arrastar, pinça amplia só o insetário (arrasto de besouro acerta
// com zoom; volta ao normal fora dele) e digitação nos campos sem o cursor pular ("hugo" virava "ugoH").
// GAME_URL=http://localhost:5300/ node tests/harness.mjs tests/mobile.mjs
import { mkdirSync } from 'node:fs';
const OUT = 'tests/out-mobile/';
mkdirSync(OUT, { recursive: true });

export default async (desk) => {
  const ctx = await desk.context().browser().newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://localhost:5300/');
  await page.waitForFunction(() => window.__player?.root?.mGame?.cur === 6, null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const cdp = await ctx.newCDPSession(page);
  const ok = (c, msg) => { if (!c) throw new Error(msg); console.log('ok:', msg); };
  // coordenadas do palco (640x480) → tela
  const scr = async (x, y) => ev(([x, y]) => { const r = __player.canvas.getBoundingClientRect(); return [r.left + x * r.width / 640, r.top + y * r.height / 480]; }, [x, y]);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });

  // ---- 1. sem destaque/seleção
  const css = await ev(() => {
    const s = getComputedStyle(document.body), c = getComputedStyle(__player.canvas);
    return { sel: c.userSelect, tap: s.webkitTapHighlightColor, ta: c.touchAction, vp: document.querySelector('meta[name=viewport]').content };
  });
  ok(css.sel === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(css.tap) && css.ta === 'none' && /user-scalable=no/.test(css.vp), 'canvas sem seleção/destaque de toque, página sem zoom ' + JSON.stringify(css));
  // toque longo + arrasto no canvas
  const [cx, cy] = await scr(320, 240);
  await touch('touchStart', [[cx, cy]]); await page.waitForTimeout(900);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', [[cx + i * 15, cy + i * 8]]); await page.waitForTimeout(40); }
  await touch('touchEnd', []);
  ok(await ev(() => String(getSelection()) === '' && getSelection().type !== 'Range'), 'toque longo + arrasto não seleciona nada');

  // ---- 3. nome digitado em ordem (tela de novo jogador)
  await ev(() => localStorage.clear());
  await ev(async () => { await __btn('PLAY GAME'); await __sleep(400); });
  ok(await ev(() => __player.root.mGame.cur) === 30, 'tela do nome do jogador');
  const inp = page.locator('#stage input');
  await inp.tap();
  ok(await ev(() => { const e = document.querySelector('#stage input'); return !e.hasAttribute('autocapitalize') && e.getAttribute('autocorrect') === 'off' && !e.spellcheck && e.maxLength === 8; }), 'nome: maiúscula do teclado mantida, sem autocorrect/spellcheck, maxlength desde a criação');
  // sequência do log do aparelho (Poco X7 Pro, Chrome 157, Gboard): no campo vazio a 1ª letra entra e o navegador
  // deixa o cursor ANTES dela (beforeinput insertText "h" sel=0 → input "h" sel=0); sem correção vira "ugoh"
  await ev(() => {
    const e = document.querySelector('#stage input');
    e.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 'h', cancelable: true }));
    e.value = 'h'; e.setSelectionRange(0, 0); // o que o Chrome do aparelho fez
    e.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: 'h' }));
  });
  for (const ch of 'ugo') await page.keyboard.type(ch);
  let s0 = await ev(() => { const e = document.querySelector('#stage input'); return { v: e.value, s: e.selectionStart }; });
  ok(s0.v === 'hugo' && s0.s === 4, 'sequência do log (cursor antes da 1ª letra) corrigida: ' + JSON.stringify(s0));
  await ev(() => { const e = document.querySelector('#stage input'); e.value = ''; e.dispatchEvent(new Event('input')); });
  // conta mudanças no <input> focado enquanto digita (o motor não deve reescrever nada a cada frame)
  await ev(() => { const e = document.querySelector('#stage input'); window.__muts = 0; new MutationObserver(m => { window.__muts += m.length; }).observe(e, { attributes: true, attributeFilter: ['maxlength', 'value', 'autocapitalize'] }); });
  const st = () => ev(() => { const e = document.querySelector('#stage input'); return { v: e.value, s: e.selectionStart, t: __player.root.mGame.zName.tTxt.text }; });
  // teclado com maiúscula automática: digita "h" e o teclado troca por "H" (insertReplacementText), depois "ugo"
  await page.keyboard.type('h');
  await ev(() => { const e = document.querySelector('#stage input'); e.setRangeText('H', 0, 1, 'end'); e.dispatchEvent(new InputEvent('input', { inputType: 'insertReplacementText', data: 'H' })); });
  for (const ch of 'ugo') { await page.keyboard.type(ch); await page.waitForTimeout(60); const s = await st(); ok(s.s === s.v.length, `cursor no fim após "${ch}" (${s.v}|${s.s})`); }
  let s = await st();
  ok(s.v === 'Hugo' && s.t === 'Hugo', 'nome digitado em ordem: ' + JSON.stringify(s));
  // IME (composição, como o Gboard): " bar" com espaço proibido no nome (restrict "^ _")
  for (const w of ['b', 'ba', 'bar']) await cdp.send('Input.imeSetComposition', { text: w, selectionStart: w.length, selectionEnd: w.length });
  await cdp.send('Input.insertText', { text: 'bar' });
  await page.keyboard.type(' ');
  s = await st();
  ok(s.v === 'Hugobar' && s.s === 7 && s.t === 'Hugobar', 'composição + restrict mantêm a ordem e o cursor: ' + JSON.stringify(s));
  // caractere removido pelo restrict no meio do texto: cursor fica onde estava
  await ev(() => document.querySelector('#stage input').setSelectionRange(4, 4));
  await page.keyboard.type('_'); await page.keyboard.type('X');
  s = await st();
  ok(s.v === 'HugoXbar' && s.s === 5, 'restrict no meio do texto não move o cursor: ' + JSON.stringify(s));
  ok(await ev(() => window.__muts) === 0, 'o <input> focado não foi reescrito durante a digitação');
  await page.screenshot({ path: OUT + 'name.png' });
  await ev(() => { const e = document.querySelector('#stage input'); e.value = 'Mobile'; e.dispatchEvent(new Event('input')); });
  await ev(async () => { await __btn('OK'); await __sleep(400); await __btn('NEW GAME'); await __btn('START GAME'); await __sleep(1000); });
  ok(await ev(() => __player.root.mGame.cur) === 38, 'insetário (frame 38)');
  await ev(() => { for (const p of [__player.root, __player.root.mGame]) p.children.filter(c => c.name.startsWith('mFirst')).forEach(c => c.removeMovieClip()); });

  // ---- 2. pinça no insetário
  const mat = () => ev(() => { const mg = __player.root.mGame; return { g: mg.mGround.m.slice(), bar: mg.instance78?.m.slice() ?? mg.children.find(c => c.charId === 350)?.m.slice(), z: __player.zoom && { s: __player.zoom.s, tx: __player.zoom.tx, ty: __player.zoom.ty } }; });
  ok(JSON.stringify((await mat()).g) === '[1,0,0,1,0,0]', 'insetário começa sem zoom');
  const pinch = async (sx, sy, d0, d1, dx = 0, dy = 0) => {
    const [x, y] = await scr(sx, sy), k = (await scr(1, 0))[0] - (await scr(0, 0))[0];
    await touch('touchStart', [[x - d0 * k, y], [x + d0 * k, y]]);
    for (let i = 1; i <= 8; i++) { const d = d0 + (d1 - d0) * i / 8; await touch('touchMove', [[x - d * k + dx * k * i / 8, y + dy * k * i / 8], [x + d * k + dx * k * i / 8, y + dy * k * i / 8]]); await page.waitForTimeout(30); }
    await touch('touchEnd', []); await page.waitForTimeout(150);
  };
  const bar0 = (await mat()).bar;
  await pinch(320, 190, 40, 100); // amplia 2,5x em volta do centro
  let m = await mat();
  ok(m.z && Math.abs(m.z.s - 2.5) < 0.05 && Math.abs(m.g[0] - m.z.s) < 1e-6, 'pinça amplia o insetário: ' + JSON.stringify(m.z));
  ok(JSON.stringify(m.bar) === JSON.stringify(bar0), 'barra do HUD não amplia');
  await page.screenshot({ path: OUT + 'zoom.png' });
  await pinch(320, 190, 40, 400, -300, -300); // além do limite e arrastando para fora: limita a 3x e à área do cenário
  m = await mat();
  ok(m.z.s === 3 && m.z.tx <= 0 && m.z.tx >= 640 * (1 - 3) && m.z.ty <= 0 && m.z.ty >= 380 * (1 - 3), 'zoom limitado a 3x sem sair do cenário: ' + JSON.stringify(m.z));
  await pinch(320, 190, 100, 50); // reduz pela metade: 1,5x
  m = await mat();
  ok(Math.abs(m.z.s - 1.5) < 0.05, 'pinça reduz o zoom: ' + JSON.stringify(m.z));
  await page.screenshot({ path: OUT + 'zoom-1.5.png' });

  // arrasto de besouro com zoom: o besouro vai para baixo do dedo (startDrag com lock)
  const bug = await ev(() => {
    const g = __player.global.GAME, z = __player.zoom;
    for (const [i, a] of g.aAdult.entries()) {
      const b = a.mClip.getBounds(__player.root), x = (b.xMin + b.xMax) / 2, y = (b.yMin + b.yMax) / 2;
      if (x > 60 && x < 580 && y > 80 && y < 320 && __player.pick(__player.root, x, y, [1, 0, 0, 1, 0, 0]) === a.mClip) return { i, x, y, s: z.s };
    }
    return null;
  });
  ok(bug, 'achou besouro visível e o toque (pick) acerta ele com zoom ' + JSON.stringify(bug));
  await ev(i => { __player.global.GAME.aAdult[i].mClip.onRollOver = null; }, bug.i);
  const [bx, by] = await scr(bug.x, bug.y), [ex, ey] = await scr(bug.x + 50, bug.y + 30);
  await touch('touchStart', [[bx, by]]); await page.waitForTimeout(80);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [[bx + (ex - bx) * i / 6, by + (ey - by) * i / 6]]); await page.waitForTimeout(30); }
  const drag = await ev(i => { const c = __player.global.GAME.aAdult[i].mClip; const p = { x: 0, y: 0 }; c.localToGlobal(p); return { x: p.x, y: p.y, st: __player.global.GAME.aAdult[i].nStatement }; }, bug.i);
  await touch('touchEnd', []); await page.waitForTimeout(100);
  ok(drag.st === 8 && Math.hypot(drag.x - (bug.x + 50), drag.y - (bug.y + 30)) < 25, 'besouro arrastado com zoom segue o dedo: ' + JSON.stringify(drag));
  // comida: o toque acerta o clip certo com zoom
  ok(await ev(() => {
    const f = __player.global.GAME.aFood[0]?.mClip; if (!f) return true;
    const b = f.getBounds(__player.root), x = (b.xMin + b.xMax) / 2, y = (b.yMin + b.yMax) / 2;
    return x < 0 || x > 640 || y < 0 || y > 380 || __player.pick(__player.root, x, y, [1, 0, 0, 1, 0, 0]) === f;
  }), 'toque na comida acerta com zoom');

  // ---- volta ao normal: tela Setting (menu do HUD) e loja
  await ev(async () => { await __clickObj(__player.root.mGame.m0, 1500); });
  m = await mat();
  ok(!m.z && JSON.stringify(m.g) === '[1,0,0,1,0,0]', 'abrir as Configurações desfaz o zoom');
  await ev(async () => { await __btn('RETURN TO GAME'); await __sleep(1200); });
  await pinch(320, 190, 40, 80);
  ok((await mat()).z?.s > 1.5, 'amplia de novo');
  await ev(async () => { await __clickObj(__player.root.mGame.m2, 1500); });
  ok(!(await ev(() => __player.zoom)), 'ir à loja desfaz o zoom');
  await pinch(320, 190, 40, 100);
  ok(!(await ev(() => __player.zoom)), 'pinça na loja não amplia nada');
  await ev(async () => { await __clickObj(__player.root.mGame.m1, 1500); });
  m = await mat();
  ok(await ev(() => __player.root.mGame.cur) === 38 && JSON.stringify(m.g) === '[1,0,0,1,0,0]', 'de volta ao insetário sem zoom');
  ok(errs.length === 0 && (await ev(() => window.__errs.length)) === 0, 'sem erros na página ' + JSON.stringify(errs));
  await ctx.close();
};
