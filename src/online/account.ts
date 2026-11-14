// Conta online dentro da tela de Configurações do jogo (sprite 404, frame "Setting", junto de Música/Som/Idioma/
// Sincronizar velocidade): nome, sincronização do save na nuvem, código de recuperação e entrar com o código.
// Mesmo estilo da tela: botões sprite 57 e campos de texto do jogo, sem HTML próprio.
import { _global, _root } from '../engine/as2';
import * as api from './api';
import * as sync from './sync';
import { label, button, input, act, flash, close, relabel, MC } from './kit';
import { confirm } from './world';

let hooks = { login: async () => {}, logout: async () => {} };
export const setAuthHooks = (login: () => Promise<void>, logout: () => Promise<void>) => { hooks = { login, logout }; };

const DEPTH = -15890;
const sections = new Set<MC>();

/** abre a tela de Configurações do jogo (fecha a tela do multiplayer antes) */
export function openSettings() {
  close(false, false);
  const bar = _root?.mGame?.mBar;
  if (bar?.goto && _global.GAME) bar.goto('Setting');
}

const localName = () => String(_root?.mGame?.sPlayer ?? '').slice(0, 16);
const GAME = () => _global.GAME;

/** monta (ou refaz) a seção de conta no clip da tela Setting `mc` (sprite 404) */
export function buildSettings(mc: MC) {
  const old = [...sections].find(s => s.parent === mc);
  if (old) { mc.removeChild(old); sections.delete(old); }
  const c = mc.createEmptyMovieClip('mOnline', DEPTH);
  c.timeline = true; c.placeKey = 'dyn'; c.__d = 0;
  sections.add(c);
  const redo = () => { if (!mc.removed) buildSettings(mc); };
  const X = 5, Y = 282;
  label(c, X, Y, 'ONLINE ACCOUNT', { size: 16 });
  if (!api.session) {
    label(c, X, Y + 28, 'Name:', { size: 15 });
    const name = input(c, X + 58, Y + 26, 120, 16, '^<>&"', localName());
    name.name = 'inName';
    button(c, X + 190, Y + 26, 'PLAY ONLINE', async () => {
      await api.start(name.value());
      await hooks.login();
      redo();
    });
    label(c, X, Y + 62, 'Recovery code:', { size: 15 });
    const code = input(c, X + 172, Y + 60, 250, 32, 'A-Za-z0-9-');
    code.name = 'inRecover';
    button(c, X, Y + 90, 'RECOVER', async () => {
      await api.recover(code.value());
      await hooks.login();
      redo();
    });
    return;
  }
  // com identidade
  const name = input(c, X, Y + 26, 150, 16, '^<>&"', api.me?.username ?? '');
  name.name = 'inRename';
  button(c, X + 162, Y + 26, 'SAVE NAME', async () => { await api.rename(name.value()); flash('Saved!'); redo(); });
  button(c, X + 150, Y - 2, 'SIGN OUT', () => confirm('Sign out ?\nKeep your recovery code!', async () => { await api.signOut(); await hooks.logout(); redo(); }), { scale: 90 });
  const code = api.storedCode();
  label(c, X, Y + 58, 'Recovery code:', { size: 15 });
  if (code) {
    const shown = api.formatCode(code);
    // o código fica numa linha própria (24 caracteres + hífens não cabem ao lado do rótulo em PT)
    const cl = label(c, X, Y + 78, shown, { size: 16, color: 0x0a2a5c });
    cl.name = 'recCode';
    button(c, X + 175, Y + 56, 'COPY', async () => { try { await navigator.clipboard.writeText(shown); flash('Copied!'); } catch { flash('Select the text and copy it.'); } }, { scale: 90 });
  } else if (api.session.user.is_anonymous) button(c, X + 175, Y + 56, 'CREATE RECOVERY CODE', async () => { await api.ensureCode(); redo(); }, { scale: 90 });
  // save na nuvem: só com um jogo aberto
  if (!GAME()) return;
  const row = Y + 104;
  if (sync.linked()) {
    label(c, X, row + 2, 'Cloud save: on', { size: 15 });
    button(c, X + 150, row, 'SYNC NOW', async () => { await sync.pushNow(true); flash('Saved!'); }, { scale: 90 });
  } else {
    // vínculo pendente: sem save na nuvem, vincula este jogo; com save, escolhe qual fica
    label(c, X, row + 2, 'Cloud save:', { size: 15 });
    const b = button(c, X + 100, row, '...', () => {}, { enabled: false, scale: 90 });
    api.getSave().then(s => {
      if (!s) { relabel(b, 'LINK THIS GAME'); b.enabled = true; b._alpha = 100; b.onrelease = () => act(async () => { await sync.linkThisGame(); flash('Linked!'); redo(); }); return; }
      b.removeMovieClip();
      button(c, X + 100, row, 'LOAD CLOUD SAVE', () => { sync.loadCloud(s); }, { scale: 90 });
      button(c, X + 260, row, 'USE THIS GAME', async () => { await sync.linkThisGame(s.rev); flash('Linked!'); redo(); }, { scale: 90 });
    }).catch(() => {});
  }
}
