// Tela "WORLD" (Configuração do multiplayer): código do mundo, ativar (criar mundo), entrar por código, sair/encerrar,
// dono remove membros. A conta (nome, código de recuperação) fica na tela de Configurações do jogo.
import { _root } from '../engine/as2';
import { SFM } from '../game/classes/SFM';
import * as api from './api';
import * as sync from './sync';
import { online } from './shop';
import { WORLD_MAX } from './config';
import { View, label, button, panel, input, act, flash, t, refresh } from './kit';
import { openSettings } from './account';

/** confirmação no popup Sim/Não do jogo */
export function confirm(text: string, yes: () => any) {
  const p = SFM.addClip('mPop', _root, { sTxt: text, sFrame: 'Y_N' });
  p.rtFun = (ok: boolean) => { if (ok) act(yes); };
}

async function copy(s: string) {
  try { await navigator.clipboard.writeText(s); flash('Copied!'); } catch { flash('Select the text and copy it.'); }
}

export const worldView: View = {
  title: 'WORLD',
  load: async () => {
    if (!api.session) return { nosession: true };
    const w = await api.myWorld();
    if (!w) return { w: null };
    const snaps = new Map((await api.snapshots(w.members.map(m => m.id))).map(s => [s.user_id, s]));
    return { w, snaps };
  },
  build(v, d) {
    const me = sync.uid();
    if (d?.nosession) {
      panel(v, 60, 90, 520, 170);
      label(v, 90, 110, 'You need an online player to use multiplayer.', { w: 460 });
      label(v, 90, 160, 'Create it in the game settings (ONLINE ACCOUNT): only your name is needed.', { w: 460, size: 15 });
      button(v, 90, 215, 'OPEN SETTINGS', () => { openSettings(); }, { });
      return;
    }
    if (!sync.linked()) label(v, 20, 420, 'This game is not linked to your player yet: see the game settings (ONLINE ACCOUNT).', { size: 13, color: 0x8a1a1a, w: 600 });
    if (!d?.w) {
      panel(v, 40, 70, 560, 150);
      label(v, 60, 82, 'Enable multiplayer', { size: 20 });
      label(v, 60, 112, `Create a world and share its code with up to ${WORLD_MAX - 1} friends.`, { w: 520, size: 15 });
      button(v, 60, 180, 'ENABLE MULTIPLAYER', async () => { await api.createWorld(); await sync.refreshPending(); refresh(); });
      panel(v, 40, 240, 560, 150);
      label(v, 60, 252, 'Join a world', { size: 20 });
      label(v, 60, 285, 'World code:', { size: 15 });
      const code = input(v, 175, 282, 130, 8, 'A-Za-z0-9');
      code.name = 'inWorldCode';
      button(v, 60, 340, 'JOIN', async () => {
        await api.joinWorld(code.value());
        await sync.refreshPending();
        flash('Welcome to the world!');
        refresh();
      });
      return;
    }
    const { w, snaps } = d;
    const owner = w.world.owner === me;
    panel(v, 20, 62, 600, 56);
    label(v, 36, 76, 'World code:', { size: 16 });
    const c = label(v, 170, 68, w.world.code, { size: 30, color: 0x0a2a5c });
    c.name = 'worldCode';
    button(v, 300, 78, 'COPY', () => copy(w.world.code));
    label(v, 520, 80, `${w.members.length}/${WORLD_MAX} ${t('players')}`, { size: 14, align: 'left' });
    panel(v, 20, 126, 600, 12 + w.members.length * 29);
    w.members.forEach((m: api.Profile, i: number) => {
      const y = 134 + i * 29;
      const s = snaps.get(m.id);
      const on = m.id === me || online.has(m.id);
      dot(v, 40, y + 12, on);
      label(v, 54, y, m.username, { size: 15 });
      const tag = [m.id === w.world.owner ? t('(owner)') : '', m.id === me ? t('(you)') : ''].filter(Boolean).join(' ');
      if (tag) label(v, 205, y + 2, tag, { size: 13 });
      label(v, 295, y + 2, s ? `${'$ ' + s.money} · ${t(s.days + ' days')}` : t('(no game linked)'), { size: 13 });
      if (owner && m.id !== me) button(v, 520, y, 'REMOVE', () => confirm(`Remove ${m.username} ?`, async () => { await api.kickMember(m.id); await sync.refreshPending(); refresh(); }), { scale: 90 });
    });
    if (owner) button(v, 10, 446, 'END MULTIPLAYER', () => confirm('End the multiplayer for everyone ?', async () => { await api.endWorld(); await sync.refreshPending(); refresh(); }));
    else button(v, 10, 446, 'LEAVE WORLD', () => confirm('Leave the world ?', async () => { await api.leaveWorld(); await sync.refreshPending(); refresh(); }));
  },
};

import { ShapeInst } from '../engine/core';
import type { ShapeDef } from '../engine/render';
const circ = (r: number) => `M${r} 0A${r} ${r} 0 1 0 ${-r} 0A${r} ${r} 0 1 0 ${r} 0Z`;
const dotDef = (c: number[], hl: number[]): ShapeDef => ({
  type: 'shape', bounds: [-6, -6, 6, 6], layers: [
    { f: { t: 18, m: [5 / 819.2, 0, 0, 5 / 819.2, -1.5, -1.5], s: [[0, ...hl, 255], [1, ...c, 255]] }, d: circ(5) },
    { l: { w: 1, c: [28, 28, 38, 255] }, d: circ(5) },
  ],
});
const ON = dotDef([30, 150, 40], [190, 255, 170]), OFF = dotDef([120, 130, 140], [225, 230, 235]);
/** bolinha de presença: verde = conectado agora, cinza = fora */
export function dot(p: any, x: number, y: number, on: boolean) {
  const h = p.createEmptyMovieClip('d' + ++p.__d, ++p.__d);
  h.addChild(new ShapeInst(on ? ON : OFF), 0);
  h._x = x; h._y = y;
  return h;
}
