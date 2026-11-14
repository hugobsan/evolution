// Online: presença na loja. Com os dois membros na loja, cada um vê o NPC do outro (com o nome); clicar abre o
// perfil; quando um sai da loja, o NPC some na loja do outro.
import { OUT, startOnline, makeWorld } from './online-lib.mjs';

const toShop = h => h.ev(async () => { await __clickObj(__player.root.mGame.m2, 1500); });
const toHome = h => h.ev(async () => { await __clickObj(__player.root.mGame.m0, 1500); });
const npc = h => h.ev(() => {
  const n = [...__player.global.GAME.aSellman].find(s => s.fid);
  return n && n.mClip ? { name: n.fname, x: Math.round(n.mClip._x), y: Math.round(n.mClip._y), label: n.mClip.mName?.tTxt?.text } : null;
});

export default async (page, h) => {
  const a = { page, h };
  const b = await h.newPage();
  const [A, B] = await Promise.all([startOnline(a.h, 'ana'), startOnline(b.h, 'bob')]);
  await makeWorld(a, b);
  for (const x of [a, b]) await x.page.locator('#evo-online button:text-is("CLOSE")').click();
  await Promise.all([toShop(a.h), toShop(b.h)]);
  await page.waitForFunction(() => [...__player.global.GAME.aSellman].some(s => s.fid && s.mClip), null, { timeout: 20000 });
  await b.page.waitForFunction(() => [...__player.global.GAME.aSellman].some(s => s.fid && s.mClip), null, { timeout: 20000 });
  const na = await npc(a.h), nb = await npc(b.h);
  console.log('NPC na loja da Ana', JSON.stringify(na), '| na do Bob', JSON.stringify(nb));
  if (na?.name !== B.name || nb?.name !== A.name) throw new Error('NPC errado');
  await h.sleep(3000); // ele anda
  await a.h.shot(OUT + 'shop-1-friend-npc.png');
  // clicar no NPC abre o perfil do amigo
  await page.waitForFunction(() => { const n = [...__player.global.GAME.aSellman].find(s => s.fid); return n?.mClip && n.mClip._x > 60 && n.mClip._x < 580; }, null, { timeout: 30000 });
  await h.ev(async () => { const n = [...__player.global.GAME.aSellman].find(s => s.fid); await __clickObj(n.mClip.mName, 600); });
  await page.waitForSelector('#evo-online .evo-name', { timeout: 15000 });
  const title = await page.locator('#evo-online .evo-name').innerText();
  if (title !== B.name) throw new Error('perfil errado: ' + title);
  await a.h.shot(OUT + 'shop-2-profile.png');
  await page.locator('#evo-online button:text-is("CLOSE")').click();
  // Bob sai da loja → o NPC some da loja da Ana
  await toHome(b.h);
  await page.waitForFunction(() => ![...__player.global.GAME.aSellman].some(s => s.fid && s.mClip), null, { timeout: 20000 });
  console.log('ok: NPC aparece, abre o perfil e some quando o amigo sai');
};
