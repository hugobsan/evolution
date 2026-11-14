// Botão de mutar a música (sobreposto ao canvas, canto inferior direito).
import type { Player } from '../engine/core';
import { getLang, onLangChange } from './i18n';

// mudo = volume da música em 0 (o slider de Music na tela Setting reflete isso)
const KEY = 'evolution.musicVolume', KEY_LAST = 'evolution.musicVolumeLast', LEGACY = 'evolution.musicMuted';
const ON = '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
const OFF = '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z"/></svg>';

export function addMuteButton(p: Player, container: HTMLElement) {
  const ls = (k: string, v?: string) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { /* sem storage */ } return null; };
  const vol = () => p.audio.volumes.music;
  const saved = ls(KEY) ?? (ls(LEGACY) === '1' ? '0' : null);
  if (saved !== null && !isNaN(+saved)) p.audio.setVolume('music', +saved);
  let lastVol = vol(), muted = vol() === 0;
  const btn = document.createElement('button');
  btn.type = 'button';
  Object.assign(btn.style, {
    position: 'absolute', zIndex: '20', padding: '4px', border: '1px solid rgba(255,255,255,.6)', borderRadius: '6px',
    background: 'rgba(0,0,0,.45)', color: '#fff', cursor: 'pointer', lineHeight: '0',
  } as CSSStyleDeclaration);
  const apply = () => {
    btn.innerHTML = muted ? OFF : ON;
    const pt = getLang() === 'pt';
    btn.title = btn.ariaLabel = muted ? (pt ? 'Ativar música' : 'Unmute music') : (pt ? 'Mutar música' : 'Mute music');
    btn.setAttribute('aria-pressed', String(muted));
  };
  btn.addEventListener('pointerdown', e => e.stopPropagation());
  btn.addEventListener('click', () => {
    if (vol() > 0) { ls(KEY_LAST, String(vol())); p.audio.setVolume('music', 0); }
    else p.audio.setVolume('music', +(ls(KEY_LAST) ?? 100) || 100);
    p.audio.resume();
  });
  onLangChange(apply);
  container.appendChild(btn);
  apply();
  // posiciona sobre o canvas: canto inferior direito, acima do "Credits"; só no menu inicial (frame "Menu").
  const place = () => {
    const cr = p.canvas.getBoundingClientRect(), pr = container.getBoundingClientRect();
    const k = cr.width / 640;
    const size = Math.max(22, 26 * k);
    // acompanha o volume (slider da tela Setting também muda) e persiste
    if (vol() !== lastVol) { lastVol = vol(); ls(KEY, String(lastVol)); }
    if ((vol() === 0) !== muted) { muted = vol() === 0; apply(); }
    const g = (p.root as any)?.mGame;
    btn.style.display = g && g._currentframe === g.def?.labels?.Menu && !g.mSetMenu ? 'block' : 'none';
    btn.style.width = btn.style.height = size + 'px';
    btn.style.left = (cr.left - pr.left + cr.width - size - 6 * k) + 'px';
    btn.style.top = (cr.top - pr.top + cr.height - size - 24 * k) + 'px';
    requestAnimationFrame(place);
  };
  requestAnimationFrame(place);
}
