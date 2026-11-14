// Cenário i18n: percorre as telas em PT e EN (troca de idioma em tempo de execução), tira screenshots
// tests/out-i18n-<lang>-<tela>.png e lista textos sem tradução (window.__i18nMiss).
// Uso: node tests/harness.mjs tests/i18n.mjs   (servidor dev em :5199)
import { chromium } from 'playwright-core';

const OUT = 'tests/out-i18n-';

export default async (page, h) => {
  const btn = (l) => h.ev(async (l) => await __btn(l), l);
  const click = (n, wait = 1200) => h.ev(async ([n, w]) => { await __clickObj(__player.root.mGame[n], w); }, [n, wait]);
  const st = () => h.ev(() => ({ cur: __player.root.mGame.cur, pops: __pops(), lang: __lang.get() }), null, 5000);
  const log = (...a) => console.log(...a);
  const pop = () => h.ev(() => __pops().length);
  const closePops = async () => { for (let i = 0; i < 4 && (await pop()); i++) { for (const b of ['CANCEL', 'OK', 'NO']) { if ((await btn(b)).startsWith('ok')) break; } await h.sleep(500); } };

  // ── detecção automática do idioma (novos contextos com locale; a escolha manual vence) ──
  const browser = page.context().browser();
  for (const [loc, stored, want] of [['pt-BR', null, 'pt'], ['en-US', null, 'en'], ['pt-PT', null, 'pt'], ['fr-FR', null, 'en'], ['pt-BR', 'en', 'en'], ['en-US', 'pt', 'pt']]) {
    const ctx = await browser.newContext({ locale: loc, viewport: { width: 640, height: 480 } });
    const p2 = await ctx.newPage();
    if (stored) await p2.addInitScript(v => localStorage.setItem('evolution.lang', v), stored);
    await p2.goto(process.env.GAME_URL || 'http://localhost:5199/');
    await p2.waitForFunction(() => window.__player?.root?.mGame?.cur === 6, null, { timeout: 15000 });
    const got = await p2.evaluate(() => __lang.get());
    log(`detecção locale=${loc} salvo=${stored} -> ${got}`, got === want ? 'OK' : 'ERRO (esperado ' + want + ')');
    if (got !== want) throw new Error('detecção de idioma errada: ' + loc);
    await ctx.close();
  }

  for (const lang of ['pt', 'en']) {
    log(`\n===== ${lang.toUpperCase()} =====`);
    // estado limpo a cada idioma (recarrega; o jogador salvo e o idioma escolhido ficam no localStorage)
    await page.reload();
    await page.waitForFunction(() => window.__player?.root?.mGame?.cur === 6, null, { timeout: 15000 });
    await h.sleep(1500);
    await h.ev(l => __lang.set(l), lang);
    const S = OUT + lang + '-';
    await h.sleep(300);
    await h.shot(S + 'menu.png');

    // instruções
    await btn('INSTRUCTIONS'); await h.sleep(800);
    await h.shot(S + 'help.png');
    await h.ev(async () => { const m = __player.root.mGame; if ((await __btn('BACK')).startsWith('nao')) m.gotoAndStop('Menu'); await __sleep(1200); });
    log('após help', JSON.stringify(await st()));

    // jogar: seleção/nome → novo jogo
    await btn('PLAY GAME'); await h.sleep(800);
    await h.shot(S + 'select.png');
    if ((await st()).cur === 30 || true) {
      const cur = (await st()).cur;
      if (cur === 30) {
        await page.fill('#stage input', 'Tester');
        await h.shot(S + 'newplayer.png');
        await btn('OK');
      }
    }
    await btn('NEW GAME'); await h.sleep(800);
    await h.shot(S + 'startgame.png');
    await btn('START GAME'); await h.sleep(1500);
    log('jogo', JSON.stringify(await st()));
    await h.shot(S + 'game-tip1.png');
    // dicas do tutorial (mFirst): avança com NEXT
    for (let i = 2; i <= 9; i++) {
      const r = await btn('NEXT'); if (!r.startsWith('ok')) break;
      await h.sleep(600);
      if (i % 2 === 0 || i === 9) await h.shot(S + `game-tip${i}.png`);
    }

    // info (rollOver) na comida e nos ícones
    await click('f0', 500); await h.shot(S + 'info-food.png');
    await click('f3', 500); await h.shot(S + 'info-drug.png');
    // popups: BREED / SELL / BUGS(RENAME)
    for (const [n, name] of [['t0', 'breed'], ['t1', 'sell'], ['t2', 'rename']]) {
      await click(n, 1200); await h.shot(S + `pop-${name}.png`); await closePops();
    }
    await click('t3', 1200); await h.shot(S + 'list.png'); await btn('BACK');
    await h.sleep(800);

    // mensagens (popWord) e caixas WARN / Y_N / money — via código do jogo
    await h.ev(async () => {
      const G = __player.global.GAME;
      G.popWord('You sold Bug 3 for $ 120!');
      await __sleep(400);
    });
    await h.shot(S + 'word-sold.png');
    await h.ev(async () => { __player.global.GAME.popWord('Female bug can only breed again in 12.5 days!'); await __sleep(400); });
    await h.shot(S + 'word-breed.png');
    await h.ev(async () => {
      const r = __player.root;
      r.attachMovie('mPop', 'mPop_t1', r.getNextHighestDepth(), { sTxt: 'You win!\nYou got $ 50!', sFrame: 'WARN' });
      await __sleep(700);
    });
    await h.shot(S + 'pop-win.png'); await closePops();
    await h.ev(async () => {
      const r = __player.root;
      r.attachMovie('mPop', 'mPop_t2', r.getNextHighestDepth(), { sTxt: ' Put the bug to \n sell list ? ', nNum: 100, sFrame: 'MONEY' });
      await __sleep(700);
    });
    await h.shot(S + 'pop-money.png'); await closePops();
    await h.ev(async () => {
      const r = __player.root;
      r.attachMovie('mPop', 'mPop_t4', r.getNextHighestDepth(), { sTxt: " Change the bug's price \nor remove it from sell list? ", nNum: 100, sFrame: 'MONEY2' });
      await __sleep(700);
    });
    await h.shot(S + 'pop-money2.png');
    // popup sintético (sem _Ico): fecha direto, sem rodar a lógica do botão
    await h.ev(() => { __player.root.children.filter(c => c.name.startsWith('mPop')).forEach(c => c.removeMovieClip()); __player.global.ENABLED(false); });
    await h.ev(async () => {
      const r = __player.root;
      r.attachMovie('mPop', 'mPop_t3', r.getNextHighestDepth(), { sTxt: 'Sell IT ?', sFrame: 'Y_N' });
      await __sleep(700);
    });
    await h.shot(S + 'pop-yn.png'); await closePops();

    // loja (Pause_1): assistente/vendedores + popup BUY
    await click('m2', 1500); await h.shot(S + 'shop.png');
    const sold = await h.ev(async () => {
      const g = __player.root.mGame, list = [];
      const f = o => { if (o.owner && o.owner.aSell_list !== undefined) list.push(o); (o.children || []).forEach(f); }; f(g);
      const t = list.find(o => o.owner.aSell_list.length > 0) || list[0]; if (!t) return 'sem vendedor';
      await __clickObj(t, 1200); return 'ok ' + list.length;
    });
    log('loja', sold, JSON.stringify(await st()));
    await h.shot(S + 'shop-buy.png');
    // seleciona um ícone de bicho/comida da lista de compra, se houver, para o painel de info
    await h.ev(async () => {
      const pop = __player.root.children.find(c => c.name.startsWith('mPop')); if (!pop) return;
      const ic = pop.children.find(c => c.owner && c.owner.nSide !== undefined); if (ic) await __clickObj(ic, 500);
    });
    await h.shot(S + 'shop-buy-sel.png');
    await closePops();
    await h.ev(async () => { await __clickObj(__player.root.mGame.m1, 1500); }); // casa

    // arena + competidor
    await click('m3', 1500); await h.shot(S + 'arena.png');
    const comp = await h.ev(async () => {
      const g = __player.root.mGame, list = [];
      const f = o => { if (o.owner && o.owner.nBattle !== undefined && o.owner.nId !== 0) list.push(o); (o.children || []).forEach(f); }; f(g);
      const t = list.find(o => o.owner.nBattle === 1) || list[0]; if (!t) return 'sem competidor';
      await __clickObj(t, 1200); return 'ok';
    });
    log('arena', comp, JSON.stringify(await st()));
    await h.shot(S + 'arena-pop.png'); await closePops();
    // corrida (nBattle -1): rótulos "Aposta/Máx." alinhados à direita não podem invadir os ícones
    await h.ev(async () => {
      const g = __player.root.mGame, list = [];
      const f = o => { if (o.owner && o.owner.nBattle !== undefined && o.owner.nId !== 0) list.push(o); (o.children || []).forEach(f); }; f(g);
      const t = list.find(o => o.owner.nBattle === -1); if (t) await __clickObj(t, 1200);
    });
    await h.shot(S + 'arena-race.png'); await closePops();
    await h.ev(async () => { await __clickObj(__player.root.mGame.m1, 1500); });

    // configurações + troca de idioma pelo botão (sprite 57)
    await click('m0', 1200); await h.shot(S + 'setting.png');
    const before = await h.ev(() => __lang.get());
    await btn('LANGUAGE: ' + before.toUpperCase()); await h.sleep(500);
    const after = await h.ev(() => __lang.get());
    log('idioma pelo botão:', before, '->', after);
    if (before === after) throw new Error('botão de idioma não trocou');
    await h.shot(S + 'setting-toggled.png');
    await btn('LANGUAGE: ' + after.toUpperCase()); await h.sleep(500); // volta
    if ((await h.ev(() => __lang.get())) !== before) throw new Error('não voltou');
    await h.shot(S + 'setting-back.png');
    await btn('RETURN TO GAME'); await h.sleep(800);

    // fim de jogo (Ultimate Bug / Oh no)
    await h.ev(async () => { __player.root.mGame.mBar.goto('Win'); await __sleep(2500); });
    await h.shot(S + 'end.png');
    await h.sleep(1200);
    await h.ev(async () => { await __btn('MAIN MENU'); await __sleep(1500); });
    log('fim', JSON.stringify(await st()));

    const miss = await h.ev(() => { const m = window.__i18nMiss || []; window.__i18nMiss = []; return m; });
    if (lang === 'pt') log('SEM TRADUÇÃO:', JSON.stringify(miss, null, 1));
  }
  await h.ev(() => __lang.set('en'));
};
