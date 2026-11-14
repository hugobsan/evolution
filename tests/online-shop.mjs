// Online (UI no canvas): presença na loja. Com os dois membros na loja, cada um vê o NPC do outro (com o nome); clicar
// abre o perfil; quando um sai da loja, o NPC some na loja do outro.
import { OUT, startOnline, makeWorld, go, txt } from './online-lib.mjs';

const npc = h => h.ev(() => {
  const n = [...__player.global.GAME.aSellman].find(s => s.fid);
  return n && n.mClip ? { name: n.fname, x: Math.round(n.mClip._x), y: Math.round(n.mClip._y), label: n.mClip.mName?.tTxt?.text } : null;
});

export default async (page, h) => {
  const a = { page, h };
  const b = await h.newPage();
  const [A, B] = await Promise.all([startOnline(a.h, 'ana'), startOnline(b.h, 'bob')]);
  await makeWorld(a, b);
  await Promise.all([go(a.h, 'shop'), go(b.h, 'shop')]);
  await page.waitForFunction(() => [...__player.global.GAME.aSellman].some(s => s.fid && s.mClip), null, { timeout: 20000 });
  await b.page.waitForFunction(() => [...__player.global.GAME.aSellman].some(s => s.fid && s.mClip), null, { timeout: 20000 });
  const na = await npc(a.h), nb = await npc(b.h);
  console.log('NPC na loja da Ana', JSON.stringify(na), '| na do Bob', JSON.stringify(nb));
  if (na?.name !== B.name || nb?.name !== A.name) throw new Error('NPC errado');
  await h.sleep(3000); // ele anda
  await a.h.shot(OUT + 'shop-1-friend-npc.png');
  // clicar no NPC abre o perfil do amigo (tela de Amigos)
  await page.waitForFunction(() => { const n = [...__player.global.GAME.aSellman].find(s => s.fid); return n?.mClip && n.mClip._x > 60 && n.mClip._x < 580; }, null, { timeout: 30000 });
  await h.ev(async () => { const n = [...__player.global.GAME.aSellman].find(s => s.fid); await __clickObj(n.mClip.mName, 1200); });
  await page.waitForFunction(() => __online.kit.isOpen() && !__online.kit.isBusy(), null, { timeout: 15000 });
  await h.sleep(300);
  const title = await txt(a.h, 'title');
  if (title !== B.name) throw new Error('perfil errado: ' + title);
  await a.h.shot(OUT + 'shop-2-profile.png');
  await h.ev(() => __online.kit.close());
  await h.sleep(900);
  // Bob sai da loja → o NPC some da loja da Ana
  await go(b.h, 'home');
  await page.waitForFunction(() => ![...__player.global.GAME.aSellman].some(s => s.fid && s.mClip), null, { timeout: 20000 });
  console.log('ok: NPC aparece, abre o perfil e some quando o amigo sai');
};
