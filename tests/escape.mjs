// ESC fecha/volta a tela aberta: popups do jogo (aviso, confirmação, luta da arena), Configurações e tela do multiplayer.
export default async (page, h) => {
  await h.newGame();
  const esc = async () => { await page.keyboard.press('Escape'); await h.sleep(700); };
  const pops = () => h.ev(() => __pops());
  const r = {};
  const fail = [];
  // 1) aviso (OK)
  await h.ev(async () => { const { SFM } = await import('/src/game/classes/SFM.ts'); SFM.addClip('mPop', __player.root, { sTxt: 'Teste', sFrame: 'WARN' }); await __sleep(500); });
  r.warn = (await pops()).length; await esc(); r.warnAfter = (await pops()).length;
  if (!(r.warn === 1 && r.warnAfter === 0)) fail.push('aviso');
  // 2) confirmação: ESC = NÃO (rtFun(false))
  await h.ev(async () => { const { SFM } = await import('/src/game/classes/SFM.ts'); const p = SFM.addClip('mPop', __player.root, { sTxt: 'Sell IT ?', sFrame: 'Y_N' }); p.rtFun = b => { window.__yn = b; }; await __sleep(500); });
  await esc(); r.yn = await h.ev(() => window.__yn); r.ynAfter = (await pops()).length;
  if (!(r.yn === false && r.ynAfter === 0)) fail.push('sim/não');
  // 3) popup de luta da arena: CANCELAR
  await h.ev(async () => { __player.root.mGame.gotoAndStop(43); await __sleep(800); });
  await h.ev(async () => { const { SFM } = await import('/src/game/classes/SFM.ts'); const g = __player.global.GAME; g.pSell = { nId: 0, nBattle: 1, nMoney: 50, nDif: 1, aBug_have: [0], aBug_color: [0], aBug_age: [200], aBug_random: [0] }; SFM.addClip('mPop', __player.root, { sTxt: 50, ob: g.pSell, sFrame: 'BATTLE' }); await __sleep(600); });
  await h.shot('tests/out-escape-battle.png');
  r.battle = (await pops()).length; await esc(); r.battleAfter = (await pops()).length;
  if (!(r.battle === 1 && r.battleAfter === 0)) fail.push('luta');
  await h.ev(async () => { __player.root.mGame.gotoAndStop(38); await __sleep(800); });
  // 4) Configurações: VOLTAR AO JOGO
  await h.ev(async () => { __player.root.mGame.mBar.goto('Setting'); await __sleep(600); });
  r.set = await h.ev(() => __player.root.mGame.mBar._currentframe); await esc(); r.setAfter = await h.ev(() => __player.root.mGame.mBar._currentframe);
  if (!(r.set !== 1 && r.setAfter === 1)) fail.push('configurações');
  // 5) tela do multiplayer (sem mundo: aviso + FECHAR)
  await h.ev(async () => { const m = await import('/src/online/trade.ts'); __online.kit.open(m.tradeView); await __sleep(1200); });
  r.online = await h.ev(() => !!__player.root.mGame.mOnline); await esc(); await h.sleep(600); r.onlineAfter = await h.ev(() => !!__player.root.mGame.mOnline);
  if (!(r.online && !r.onlineAfter)) fail.push('multiplayer');
  // 6) sem nada aberto: ESC não faz nada (continua no insetário)
  await esc(); r.idle = await h.ev(() => [__player.root.mGame.cur, __player.root.mGame.mBar._currentframe, __pops().length]);
  if (r.idle.join() !== '38,1,0') fail.push('insetário');
  console.log(JSON.stringify(r));
  if (fail.length) throw new Error('ESC não fechou: ' + fail.join(', '));
  console.log('ok: ESC fecha aviso, confirmação (NÃO), luta, Configurações e tela do multiplayer');
};
