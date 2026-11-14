export default async (page, h) => {
  const muteBtn = () => page.locator('button[aria-pressed]');
  const st = () => h.ev(() => ({ vol: __player.audio.volumes.music, set: !!__player.root.mGame.mSetMenu, cur: __player.root.mGame.cur }));
  await page.screenshot({ path: 'tests/out-menu-4.png' });
  await muteBtn().click(); await h.sleep(300);
  console.log('mutou', JSON.stringify(await st()), await muteBtn().getAttribute('aria-pressed'));
  console.log(await h.ev(async () => await __btn('SETTINGS')));
  await h.sleep(500);
  const r = await h.ev(() => { const s = __player.root.mGame.mSetMenu; const sl = []; const f = o => { if (o.spriteId === 71) sl.push([o.nNow, o.btMid._x]); (o.children || []).forEach(f); }; f(s); return { sliders: sl, mute: getComputedStyle(document.querySelector('button[aria-pressed]')).display }; });
  console.log('setting', JSON.stringify(r), JSON.stringify(await st()));
  await page.screenshot({ path: 'tests/out-menu-setting.png' });
  console.log(await h.ev(async () => await __btn('CLOSE')));
  await h.sleep(500);
  console.log('fechou', JSON.stringify(await st()));
  await muteBtn().click(); await h.sleep(300);
  console.log('desmutou', JSON.stringify(await st()));
  await page.reload(); await page.waitForFunction(() => window.__player?.root?.mGame?.cur === 6); await h.sleep(800);
  console.log('reload', JSON.stringify(await st()));
};
