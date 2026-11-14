// Harness headless para testar o jogo: node tests/harness.mjs <script.mjs>
// O script exporta `default async (page, h) => {...}` e usa os helpers de src/devtools.ts (window.__btn etc.).
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';

const URL_ = process.env.GAME_URL || 'http://localhost:5199/';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
const logs = [];
page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
const h = {
  // avalia com timeout (detecta travamentos)
  ev: (fn, arg, ms = 20000) => Promise.race([page.evaluate(fn, arg), new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT/travou')), ms))]),
  shot: path => page.screenshot({ path }),
  sleep: ms => new Promise(r => setTimeout(r, ms)),
  logs,
  // cria jogador (se preciso) e começa um jogo novo; termina na tela GameNow (frame 38)
  async newGame(name = 'Tester') {
    await h.ev(async () => { await __btn('PLAY GAME'); });
    if (await h.ev(() => __player.root.mGame.cur) === 30) {
      await page.fill('#stage input', name);
      await h.ev(async () => { await __btn('OK'); });
    }
    await h.ev(async () => { await __btn('NEW GAME'); await __btn('START GAME'); await __sleep(800); });
    const cur = await h.ev(() => __player.root.mGame.cur);
    if (cur !== 38) throw new Error('newGame terminou no frame ' + cur);
  },
};
let code = 0;
try {
  await page.goto(URL_);
  await page.waitForFunction(() => window.__player?.root?.mGame?.cur === 6, null, { timeout: 15000 });
  await h.sleep(1500); // transição (FADE) bloqueia cliques enquanto roda
  const mod = await import(pathToFileURL(process.argv[2]).href);
  await mod.default(page, h);
} catch (e) { console.log('FALHA:', e.message); code = 1; }
const errs = await page.evaluate(() => window.__errs || []).catch(() => ['(página travada)']);
console.log('erros do jogo:', JSON.stringify(errs.slice(0, 10), null, 1));
console.log('console:', JSON.stringify(logs.filter(l => !l.includes('favicon')).slice(0, 10), null, 1));
await browser.close();
process.exit(code || (errs.length ? 2 : 0));
