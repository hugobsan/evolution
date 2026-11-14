// Conta online nas Configurações do jogo (sprite 404, frame "Setting"): na tela base só o botão ACCOUNT SETTINGS (jogo
// multiplayer); ele abre a tela da conta no mesmo clip (some Música/Som/Idioma/Sincronizar, ficam SAIR PARA O MENU e
// VOLTAR AO JOGO): nome, código de recuperação, save na nuvem e sair. Mesmo estilo da tela: botões 57 e textos do jogo.
import { _global, _root } from '../engine/as2';
import * as api from './api';
import * as sync from './sync';
import { label, button, input, act, flash, close, relabel, MC } from './kit';
import { confirm } from './world';

let hooks = { login: async () => {}, logout: async () => {} };
export const setAuthHooks = (login: () => Promise<void>, logout: () => Promise<void>) => { hooks = { login, logout }; };

const DEPTH = -15890;

/** abre a tela de Configurações do jogo (fecha a tela do multiplayer antes) */
export function openSettings() {
  close(false, false);
  const bar = _root?.mGame?.mBar;
  if (bar?.goto && _global.GAME) bar.goto('Setting');
}

const localName = () => String(_root?.mGame?.sPlayer ?? '').slice(0, 16);
const GAME = () => _global.GAME;

/** (re)cria a camada da conta no clip da tela Setting */
function section(mc: MC): MC {
  mc.mOnline?.removeMovieClip();
  const c = mc.createEmptyMovieClip('mOnline', DEPTH);
  c.timeline = true; c.placeKey = 'dyn'; c.__d = 0;
  return c;
}

// controles da tela base que a tela da conta esconde (depth SWF: rótulos Música/Som e os dois sliders)
const BASE = [85, 87, 89, 101];
function showBase(mc: MC, v: boolean) {
  if (!v) mc.__base ??= mc.children.filter((k: MC) => k._visible && (BASE.includes(k.depth + 16384) || k.name === 'btLang' || k.name === 'btSync'));
  for (const k of mc.__base ?? []) k._visible = v;
  if (v) mc.__base = null;
}

/** tela base: botão ACCOUNT SETTINGS (só num jogo criado com o multiplayer; no menu inicial, nada) */
export function buildSettings(mc: MC) {
  showBase(mc, true);
  if (mc.bMenu || !sync.mpGame()) { mc.mOnline?.removeMovieClip(); return; }
  const c = section(mc);
  button(c, 5, 290, 'ACCOUNT SETTINGS', () => accountScreen(mc));
}

function accountScreen(mc: MC) {
  if (mc.removed) return;
  showBase(mc, false);
  const c = section(mc);
  const redo = () => accountScreen(mc);
  const X = 5;
  label(c, X, 88, 'ONLINE ACCOUNT', { size: 18 });
  button(c, X, 390, 'SETTINGS', () => buildSettings(mc)); // volta à tela base ('BACK' é ancorado à direita na tradução)
  if (!api.session) {
    label(c, X, 125, 'Name:', { size: 15 });
    const name = input(c, X, 147, 150, 16, '^<>&"', localName());
    name.name = 'inName';
    button(c, X + 162, 147, 'PLAY ONLINE', async () => { await api.start(name.value()); await hooks.login(); redo(); });
    label(c, X, 190, 'Recovery code:', { size: 15 });
    const code = input(c, X, 212, 250, 32, 'A-Za-z0-9-');
    code.name = 'inRecover';
    button(c, X + 262, 212, 'RECOVER', async () => { await api.recover(code.value()); await hooks.login(); redo(); });
    return;
  }
  label(c, X, 125, 'Name:', { size: 15 });
  const name = input(c, X, 147, 150, 16, '^<>&"', api.me?.username ?? '');
  name.name = 'inRename';
  button(c, X + 162, 147, 'SAVE NAME', async () => { await api.rename(name.value()); flash('Saved!'); redo(); });
  const code = api.storedCode();
  label(c, X, 190, 'Recovery code:', { size: 15 });
  if (code) {
    const shown = api.formatCode(code);
    const cl = label(c, X, 210, shown, { size: 16, color: 0x0a2a5c });
    cl.name = 'recCode';
    button(c, X + 175, 188, 'COPY', async () => { try { await navigator.clipboard.writeText(shown); flash('Copied!'); } catch { flash('Select the text and copy it.'); } }, { scale: 90 });
  } else if (api.session.user.is_anonymous) button(c, X + 175, 188, 'CREATE RECOVERY CODE', async () => { await api.ensureCode(); redo(); }, { scale: 90 });
  button(c, X, 330, 'SIGN OUT', () => confirm('Sign out ?\nKeep your recovery code!', async () => { await api.signOut(); await hooks.logout(); redo(); }));
  // save na nuvem: só com um jogo aberto
  if (!GAME()) return;
  const row = 255;
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
