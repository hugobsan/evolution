// Harness headless para testar o jogo: node tests/harness.mjs <script.mjs>
// O script exporta `default async (page, h) => {...}` e usa os helpers de src/devtools.ts (window.__btn etc.).
// Multiplayer: `const b = await h.newPage()` abre outro contexto de navegador (outro usuário, outro localStorage);
// `b.page` e `b.h` têm os mesmos helpers.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';

const URL_ = process.env.GAME_URL || 'http://localhost:5199/';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const logs = [];
const pages = [];

function helpers(page, tag) {
  const h = {
    page,
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
    async newPage() {
      const ctx = await browser.newContext({ viewport: { width: 640, height: 480 } });
      const pg = await ctx.newPage();
      return { page: pg, h: await open(pg, 'p' + (pages.length + 1)) };
    },
  };
  return h;
}

async function open(page, tag) {
  pages.push(page);
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().startsWith('[online]'))) logs.push(tag + ': ' + m.text().slice(0, 300)); });
  page.on('pageerror', e => logs.push(tag + ' pageerror: ' + e.message));
  page.on('response', async r => { if (r.status() >= 400 && r.url().includes('supabase.co')) logs.push(`${tag} HTTP ${r.status()} ${new URL(r.url()).pathname} ${(await r.text().catch(() => '')).slice(0, 160)}`); });
  await page.goto(URL_);
  await page.waitForFunction(() => window.__player?.root?.mGame?.cur === 6, null, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500)); // transição (FADE) bloqueia cliques enquanto roda
  return helpers(page, tag);
}

let code = 0;
const first = await browser.newPage({ viewport: { width: 640, height: 480 } });
try {
  const h = await open(first, 'p0');
  const mod = await import(pathToFileURL(process.argv[2]).href);
  await mod.default(first, h);
} catch (e) { console.log('FALHA:', e.message, (e.stack || '').split('\n').filter(l => l.includes('/tests/') && !l.includes('harness')).slice(0, 3).map(l => l.trim()).join(' | ')); code = 1; }
const errs = [];
for (const pg of pages) errs.push(...await pg.evaluate(() => window.__errs || []).catch(() => ['(página travada)']));
console.log('erros do jogo:', JSON.stringify(errs.slice(0, 10), null, 1));
console.log('console:', JSON.stringify(logs.filter(l => !l.includes('favicon')).slice(0, 10), null, 1));
await browser.close();
process.exit(code || (errs.length ? 2 : 0));
