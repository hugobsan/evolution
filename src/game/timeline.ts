// Port dos scripts de timeline AS2 (DoAction + CLIPACTIONRECORD) — ver docs/PORTING_CONTRACT.md.
// Fonte: extracted/scripts/DefineSprite_*/frame_*/ e extracted/scripts/frame_*/.
// on(construct) NÃO é portado (gerado em construct.gen.ts).
//
// Convenções deste arquivo:
//  - frame script: variável/função de nível de frame = propriedade do clip (mc.x / mc.F);
//    temporários puros do frame (i, t, mT, _loc*) viram `let/const` locais (ninguém os lê depois).
//  - handlers de clip: `this` = instância; identificadores soltos = this.<var> → _global.<var>.
//  - chamar função/valor indefinido é no-op em AS2 → `?.()` / `?.` onde pode faltar.
import type { FrameScripts, ClipActions } from '../engine/core';
import {
  _global, _root, random, int, getTimer, setTimeoutAS, getURL, updateAfterEvent,
  stopAllSounds, forIn, evalPath, typeOfAS, Stage, Selection, Sound, SharedObject,
  ColorTransform, Transform,
} from '../engine/as2';
import { Game } from './classes/Game';
import { Ico } from './classes/Ico';
import { SFM } from './classes/SFM';
import { Mask } from './classes/Mask';
import { Mycolor } from './classes/Mycolor';
import { getLang, setLang, fitRight } from './i18n';
import { getSyncSpeed, setSyncSpeed } from './syncSpeed';

// ───────────────────────── helpers ─────────────────────────

// `x()` com x não-função → undefined (AS2 não dá erro). Chama com this = clip.
const callAS = (mc: any, f: any) => (typeof f === 'function' ? f.call(mc) : undefined);
// TXTCOLOR("00ccff", s) — única cor usada nos textos de info
const C = (s: any) => _global.TXTCOLOR("00ccff", s);
// GAME.mClip.mInfo.setFrame("txt", {s_0, s_1, s_2})
const info = (s_0: any, s_1: any = "", s_2: any = "") =>
  _global.GAME?.mClip?.mInfo?.setFrame("txt", { s_0, s_1, s_2 });
const stopFrame = (mc: any) => { mc.stop(); };
// setTimeout(function(){ zName.typing(n, restrict) }, 30)
const typingLater = (mc: any, n: number, restrict: string) =>
  setTimeoutAS(() => { mc.zName?.typing?.(n, restrict); }, 30);
// new Ico(slot._x, slot._y, id, side, idx, color); t.setClip(SFM.addClip("mIco", mc)); t.owner = mc;
/** novo (não existe no original): na tela da corrida, botões para acelerar (1X/2X/4X) e pular até o resultado.
 *  Depth ≥ 0: o remove() do próximo frame (volta à arena) limpa os botões. */
function addRaceButtons(mc: any) {
  const G = _global.GAME;
  if (!G) return;
  G.nRaceBoost = 1;
  const mk = (name: string, label: string, depth: number, y: number) => {
    const b = mc.attachSymbol(57, name, depth, {
      _sLabel: label, _bOn: true, autoSize: "left", bAni_visible: true, enabled: true, sSwitch: "", sPop: "", y_tPop: -50,
    }, true);
    if (b) { b._x = 470; b._y = y; }
    return b;
  };
  const fast = mk("btRaceFast", " RACE SPEED 1X ", 300, 395);
  const skip = mk("btRaceSkip", " SKIP RACE ", 301, 435);
  if (fast) fast.onrelease = function () {
    G.nRaceBoost = G.nRaceBoost >= 4 ? 1 : G.nRaceBoost * 2;
    fast.sLabel = " RACE SPEED " + G.nRaceBoost + "X ";
    fast.Frame?.();
  };
  if (skip) skip.onrelease = function () {
    // roda o loop da corrida até um dos lados terminar; raceEnd() (no tick) abre o popup do resultado
    for (let i = 0; i < 100000 && G.nScreen == 4 && G.paRace?.length && G.paRace_2?.length; i++) G.run();
    fast?.removeMovieClip();
    skip.removeMovieClip();
  };
}

/** port: as 3 linhas do painel (sprite 76, campo tTxt sem quebra) estouravam a borda com textos longos (PT).
 *  No frame "txt", uma linha cujas seguintes estão vazias quebra palavras para dentro delas. */
const INFO_LINES = [28, 45, 47];
function wrapInfoLines(info: any, on: boolean) {
  const lines = INFO_LINES.map(d => info.children.find((c: any) => c.depth === d - 16384)?.tTxt);
  lines.forEach((t: any, k: number) => {
    if (!t) return;
    const nextEmpty = on && [1, 2].slice(0, 2 - k).every(j => !String(info.ob?.["s_" + (k + j)] ?? "").trim());
    t.wordWrap = nextEmpty && k < 2;
    if (t.wordWrap) t.rect.w = 320; // largura útil do painel preto (v2: o painel recuou para a coluna de botões novos)
    t.changed();
  });
}

/** barras do frame "battle" do painel de info: depth SWF → atributo do besouro */
const BATTLE_BARS: Record<number, string> = { 13: "nPower", 18: "nFly", 23: "nHp" };
const BEST_MARK_SPRITE = 351; // quadrado 20x20 usado como preenchimento das barras
function addBestMarkers(info: any) {
  const G = _global.GAME;
  const mine: any[] = G?.aAdult ?? [];
  if (!mine.length) return;
  // corrida com besouros já selecionados: a marca passa a ser o PIOR selecionado em cada atributo
  // (o time só termina quando o mais lento cruza a linha); sem seleção, o melhor besouro do jogador
  const sel: any[] = G?.pSell?.nBattle === -1 ? (G.paRace ?? []).filter(Boolean) : [];
  let i = 0;
  for (const [swfDepth, key] of Object.entries(BATTLE_BARS)) {
    const bar = info.children.find((c: any) => c.depth === Number(swfDepth) - 16384 && c.spriteId === 355);
    if (!bar) continue;
    const vals = (sel.length ? sel : mine).map(a => Number(a[key]) || 0);
    const best = sel.length ? Math.min(...vals) : Math.max(...vals);
    const max = Number(bar.nMax) || 1, w = Number(bar.nWidth) || bar._width, hgt = Number(bar.nHeight) || bar._height;
    const k = Math.min(1, Math.max(0, best / max));
    const mk = info.attachSymbol(BEST_MARK_SPRITE, "mBest_" + key, -200 + i++, {}, true);
    if (!mk) continue;
    mk.cx = [0, 0, 0, 1, 255, 30, 30, 0]; // vermelho
    mk._width = 2; mk._height = hgt + 6;
    mk._x = bar._x + k * w - 1; mk._y = bar._y - 3;
  }
}

function addIco(mc: any, slot: any, id: any, side: any, idx: any, color: any) {
  const t = new Ico(slot?._x, slot?._y, id, side, idx, color);
  t.setClip(SFM.addClip("mIco", mc));
  t.owner = mc;
  return t;
}

// sprites 5 / 76 (texto): Replace() + resolução de sTxt
function textInit(mc: any) {
  mc.Replace = function () {
    if (mc.sVariable?.length != 0) {
      mc.tTxt.variable = mc.sVariable;
    }
    mc.tTxt.autoSize = mc.autoSize;
    if (mc.autoSize == "right") {
      mc.tTxt._x = -Math.floor(mc.tTxt._width);
    } else if (mc.autoSize == "center") {
      mc.tTxt._x = -Math.floor(mc.tTxt._width / 2);
    } else {
      mc.tTxt._x = 0;
    }
  };
}
function textResolve(mc: any) {
  const t = (p: any) => typeOfAS(evalPath(mc, p));
  if (t(mc.sTxt) == "function") {
    mc.sTxt = callAS(mc, mc.sTxt); // port: original chama `sTxt()` (a string) → undefined; mantido
  } else if (t(mc.sTxt) == "string" || t(mc.sTxt) == "number") {
    mc.sTxt = evalPath(mc, mc.sTxt);
  } else {
    mc.sTxt = String(mc.sTxt);
  }
}

// handlers comuns dos botões 57 / 331 / 357
function wireButton(mc: any) {
  mc.onRollOver = function () {
    mc.bIn = true;
    mc.Frame();
  };
  mc.onDragOut = mc.onRollOut = function () {
    mc.bIn = false;
    mc.Frame();
  };
  mc.onPress = function () {
    mc.bFlag_down = true;
    mc.Frame();
    mc.onpress?.();
  };
  mc.onReleaseOutside = mc.onRelease = function () {
    mc.bFlag_down = false;
    mc.Frame();
    mc.onrelease?.();
  };
}

// handlers de botão do mPop (sprite 84): _parent.back()
const back = function (this: any) { this._parent?.back?.(); };
// on(load) dos textos com caixa preta/borda branca (sprite 76 dentro de Word/mFirst)
const loadTextBox = function (this: any) {
  this.tTxt.border = true;
  this.tTxt.borderColor = 16777215;
  this.tTxt.background = true;
  this.tTxt.backgroundColor = 0;
};
// botões de comida (357 em 434:38): press = addFood + info; rollOver = info
const food = (idx: number, dataIdx: number) => {
  const show = () => info(
    _global.DATA[20][dataIdx], "",
    "Number remaining : " + C(_global.GAME?.aFood_have?.[idx]),
  );
  return {
    press(this: any) {
      if (!_global.GAME?.addFood(idx)) {
        this.enabled = false;
      }
      show();
    },
    rollOver() { show(); },
  };
};

// ───────────────────────── frame scripts ─────────────────────────

export const frameScripts: FrameScripts = {
  // ── timeline raiz ──
  0: {
    1: (mc) => {
      // port: ContextMenu não existe no navegador (no-op); MochiAd.showPreGameAd removido (offline)
      // port: sem preloader nem animação da FreeWorldGroup — vai direto para o jogo (menu inicial)
      mc.gotoAndStop("Game");
    },
    3: (mc) => {
      if (_root.getBytesLoaded() < _root.getBytesTotal()) {
        mc.gotoAndStop("Loading");
      }
    },
    10: stopFrame,
  },

  // ── logo FWG ──
  2: {
    1: (mc) => {
      mc.onPress = function () {
        _global.FWGURL?.();
      };
      mc.cacheAsBitmap = true;
    },
  },

  // ── texto com construct (sTxt/sVariable/autoSize) + campo de entrada ──
  5: {
    1: (mc) => {
      textInit(mc);
      mc.typing = function (_n: any, _s: any) {
        mc.tTxt.selectable = true;
        mc.tTxt.type = "input";
        mc.tTxt.border = true;
        mc.tTxt.maxChars = _n;
        mc.tTxt.restrict = _s;
        mc.tTxt._height = 27;
        Selection.setFocus(mc.tTxt);
      };
      textResolve(mc);
      mc.tTxt.onChanged = function () {
        mc.Replace();
      };
      mc.Replace();
    },
  },

  // ── preloader ──
  6: {
    1: (mc) => {
      mc._x = Stage.width / 2;
      mc._y = Stage.height / 2 - 30;
      mc.mLogo._alpha = 0;
      mc.mLoading._alpha = 0;
      mc.rate = "";
      mc.all = _root.getBytesTotal();
      mc.onEnterFrame = function () {
        const loaded = _root.getBytesLoaded();
        mc.rate = int(loaded / mc.all * 100) + "%";
        if (mc.mLogo._alpha < 100) {
          mc.mLogo._alpha += 5;
        } else {
          mc.mLogo._alpha = 100;
          mc.mLoading._alpha = SFM.nolinearCycle(getTimer(), 1000, 100);
          if (loaded == mc.all) {
            delete mc.onEnterFrame;
            // port: `if(_root._mochiad instanceof MovieClip != true)` — MochiAd removido, _mochiad nunca existe
            _root.play();
          }
        }
      };
    },
  },

  9: {
    1: (mc) => {
      mc._x = Stage.width / 2;
      mc._y = Stage.height / 2;
      _root.gotoAndStop("Logo");
      return;
    },
  },

  // ── intro FWG ──
  33: {
    1: (mc) => {
      mc._x = Stage.width / 2;
      mc._y = Stage.height / 2;
      _root.stop();
      mc.onPress = function () {
        getURL("http://www.freeworldgroup.com/", "_blank");
      };
    },
    114: (mc) => {
      mc.stop();
      mc.onEnterFrame = function () {
        if (mc._alpha <= 0) {
          _root.gotoAndStop("Game");
          delete mc.onEnterFrame;
        } else {
          mc._alpha = mc._alpha - 5;
        }
      };
    },
  },

  // ── botão de texto (sound + bOn) ──
  57: {
    1: (mc) => {
      mc.Frame = function () {
        let f: string;
        if (mc.bIn && mc.bFlag_down) {
          f = "Down";
          mc.bOn = !mc.bOn;
        } else if (mc.bIn || mc.bFlag_down) {
          f = "Over";
          _global.SOUND?.attachSound("btn");
          _global.SOUND?.start();
        } else {
          f = "Up";
        }
        mc.gotoAndStop(f);
        mc.mAni?.gotoAndStop(f);
        mc.mSwitch?.gotoAndStop(mc.bOn?.toString());
        mc.tLabel.autoSize = mc.autoSize;
        if (!mc.bAni_visible) {
          if (mc.mAni) mc.mAni._visible = false;
        } else if (mc.mAni) {
          mc.mAni._width = mc.tLabel._width;
          mc.mAni._height = Math.round(mc.tLabel._height);
        }
        if (mc.autoSize == "right") {
          mc.tLabel._x = -Math.floor(mc.tLabel._width);
          if (mc.mAni) mc.mAni._x = -Math.floor(mc.mAni._width);
        } else if (mc.autoSize == "center") {
          mc.tLabel._x = -Math.floor(mc.tLabel._width / 2);
          if (mc.mAni) mc.mAni._x = -Math.floor(mc.mAni._width / 2);
        } else {
          mc.tLabel._x = 0;
          if (mc.mAni) mc.mAni._x = 0;
        }
       fitRight(mc);
      };
      mc.sLabel = evalPath(mc, mc._sLabel) != undefined ? evalPath(mc, mc._sLabel) : mc._sLabel;
      mc.bOn = evalPath(mc, mc._bOn) != undefined ? evalPath(mc, mc._bOn) : Boolean(mc._bOn);
      mc.mSwitch = mc.attachMovie(mc.sSwitch, mc.sSwitch, 10);
      mc.bIn = false;
      mc.bFlag_down = false;
      mc.Frame();
      wireButton(mc);
      mc.hitArea = mc.tLabel;
    },
  },

  // ── slider ──
  71: {
    1: (mc) => {
      mc.reset = function () {
        mc._rotation = 90 * Number(!mc.horizontal);
        mc.btMid._x = mc.nNow;
        mc.btLeft._x = (-mc.btMid._width) / 2;
        mc.btRight._x = mc.btMid._width / 2 + mc.nMax;
        mc.btBack._x = (-mc.btMid._width) / 2;
        mc.btBack._width = mc.nMax + mc.btMid._width;
        mc.btMid._y = mc.btBack._y = mc.btRight._y = mc.btLeft._y = 0;
      };
      mc.dir_hold = function (vx: any) {
        if (mc.nTimeNow == 0 || mc.nTimeNow == mc.nTimeMax) {
          if (vx != 0) {
            mc.btMid._x += mc.nPer * vx;
          } else {
            mc.btMid._x -= SFM.vpNum(mc.btMid._x - mc._xmouse) * mc.btMid._width;
          }
          if (mc.btMid._x < 0) {
            mc.btMid._x = 0;
          } else if (mc.btMid._x > mc.nMax) {
            mc.btMid._x = mc.nMax;
          }
          mc.nNow = mc.btMid._x;
        }
        if (mc.nTimeNow < mc.nTimeMax) mc.nTimeNow++;
      };
      mc.getTop = function () {
        return mc.btLeft._width + mc.btMid._width / 2;
      };
      mc.getSide = function () {
        return mc.btMid._height / 2;
      };
      mc.getValue = function () {
        return int(mc.nNow);
      };
      mc.setValue = function (n: any) {
        mc.nNow = n;
        mc.reset();
      };
      const t = typeOfAS(evalPath(mc, mc.nNow));
      if (t == "function") {
        // port: o original faz `nNow = nNow()` sobre a string do caminho → undefined e o slider
        // começava no zero. Aqui chamamos a função resolvida (ex.: MUSIC.getVolume) para refletir o volume atual.
        mc.nNow = callAS(mc, evalPath(mc, mc.nNow));
      } else if (t == "number") {
        mc.nNow = evalPath(mc, mc.nNow);
      } else {
        mc.nNow = Number(mc.nNow);
      }
      mc.nTimeMax = 15;
      mc.nTimeNow = 0;
      mc.bRoll = false;
      // with(this._parent){ bRoll = true; onEnterFrame = function(){...} } → p = slider
      mc.btMid.onPress = function () {
        this.startDrag(false, 0, 0, this._parent.nMax, 0); // startDrag(this,0,0,0,nMax,0)
        const p = this._parent;
        p.bRoll = true;
        p.onEnterFrame = function () {
          p.nNow = p.btMid._x;
          p.onhold?.(0);
        };
      };
      mc.btBack.onPress = function () {
        const p = this._parent;
        p.bRoll = true;
        p.onEnterFrame = function () {
          p.dir_hold(0);
          p.onhold?.(2);
        };
      };
      mc.btRight.onPress = function () {
        const p = this._parent;
        p.bRoll = true;
        p.onEnterFrame = function () {
          p.dir_hold(1);
          p.onhold?.(1);
        };
      };
      mc.btLeft.onPress = function () {
        const p = this._parent;
        p.bRoll = true;
        p.onEnterFrame = function () {
          p.dir_hold(-1);
          p.onhold?.(-1);
        };
      };
      mc.btMid.onReleaseOutside = mc.btMid.onRelease = function () {
        this.stopDrag();
        const p = this._parent;
        p.bRoll = false;
        delete p.onEnterFrame;
        p.onreleas?.(0);
      };
      mc.btBack.onDragOut = mc.btBack.onRelease = function () {
        const p = this._parent;
        p.bRoll = false;
        delete p.onEnterFrame;
        p.onreleas?.(2);
        p.nTimeNow = 0;
      };
      mc.btLeft.onReleaseOutside = mc.btLeft.onRelease =
        mc.btRight.onReleaseOutside = mc.btRight.onRelease = function () {
          const p = this._parent;
          p.bRoll = false;
          delete p.onEnterFrame;
          p.onreleas?.(1);
          p.nTimeNow = 0;
        };
      mc.reset();
    },
  },

  // ── texto simples ──
  76: {
    1: (mc) => {
      textInit(mc);
      textResolve(mc);
      mc.Replace();
    },
  },

  // ── mPop (popups) ──
  84: {
    1: (mc) => {
      mc.back = function () {
        for (const k of forIn(_root)) {
          if (typeOfAS(_root[k]) == "movieclip" && _root[k] != mc && _root[k]?._name?.substr(0, 4) == "mPop") {
            mc.removeMovieClip();
            return;
          }
        }
        if (_global.GAME?.mClip?.mBar?._currentframe != 1) {
          mc.removeMovieClip();
          return;
        }
        _global.GAME?.start();
        mc.removeMovieClip();
      };
      mc.mBack.cacheAsBitmap = true;
      mc.mBack.useHandCursor = false;
      mc.mBack._width = _global.WIDTH;
      mc.mBack._height = _global.HEIGHT;
      mc.mBack.onRollOver = function () {
        _global.GAME?.mClip?.mInfo?.setFrame();
      };
      mc._x = _global.WIDTH / 2;
      mc._y = _global.HEIGHT / 2;
      _global.GAME?.stop();
      _global.SOUND?.attachSound("wn");
      _global.SOUND?.start();
      mc.gotoAndStop(mc.sFrame);
    },
    3: (mc) => {
      const A: any[] = _global.GAME?.aAdult ?? [];
      let i = 0;
      while (i < mc.nNum) {
        const o = A[A.length - 1 - i];
        addIco(mc, mc["mB_" + i], o?.nId, 0, Number(A.length - 1 - i), o?.nId_color);
        i++;
      }
    },
    4: (mc) => { typingLater(mc, 5, "0-9"); },
    5: (mc) => { typingLater(mc, 5, "0-9"); },
    6: (mc) => { typingLater(mc, 10, "^ "); },
    10: (mc) => {
      mc.reset = function () {
        SFM.addClip("mPop", _root, { sFrame: "BUY" });
        mc.removeMovieClip();
      };
      const P = _global.GAME?.pSell;
      for (const k of forIn(P?.aSell_list)) {
        addIco(mc, mc["mS_" + k], P.aSell_list[k], 1, Number(k), P.aSell_color?.[k]);
      }
      const A = _global.GAME?.aAdult;
      for (const k of forIn(A)) {
        addIco(mc, mc["mB_" + k], A[k]?.nId, 0, Number(k), A[k]?.nId_color);
      }
    },
    11: (mc) => {
      mc.reset = function () {
        SFM.addClip("mPop", _root, { sFrame: "SELL" });
        mc.removeMovieClip();
      };
      const S = _global.GAME?.aAdult_sell;
      for (const k of forIn(S)) {
        addIco(mc, mc["mS_" + k], S[k]?.nId, 1, Number(k), S[k]?.nId_color);
      }
      const A = _global.GAME?.aAdult;
      for (const k of forIn(A)) {
        addIco(mc, mc["mB_" + k], A[k]?.nId, 0, Number(k), A[k]?.nId_color);
      }
    },
    12: (mc) => {
      const A = _global.GAME?.aAdult;
      for (const k of forIn(A)) {
        addIco(mc, mc["mB_" + k], A[k]?.nId, 0, Number(k), A[k]?.nId_color);
      }
    },
    13: (mc) => {
      _global.GAME?.clearMandF();
      mc.pnMale = 0;
      mc.pnFemale = 0;
      const A = _global.GAME?.aAdult;
      for (const k of forIn(A)) {
        if (A[k]?.nSex > 0) {
          addIco(mc, mc["mM_" + mc.pnMale], A[k].nId, 0, Number(k), A[k].nId_color);
          mc.pnMale++;
        } else {
          addIco(mc, mc["mF_" + mc.pnFemale], A[k]?.nId, 1, Number(k), A[k]?.nId_color);
          mc.pnFemale++;
        }
      }
    },
    14: (mc) => {
      _global.GAME?.clear_paBattle();
      const A = _global.GAME?.aAdult;
      for (const k of forIn(A)) {
        addIco(mc, mc["mB_" + k], A[k]?.nId, 0, Number(k), A[k]?.nId_color);
      }
      for (const k of forIn(mc.ob?.aBug_have)) {
        addIco(mc, mc["mS_" + k], mc.ob.aBug_have[k], 1, Number(k), mc.ob.aBug_color?.[k]);
      }
      typingLater(mc, 5, "0-9");
    },
    15: (mc) => {
      _global.GAME?.clear_paRace();
      const A = _global.GAME?.aAdult;
      for (const k of forIn(A)) {
        addIco(mc, mc["mB_" + k], A[k]?.nId, 0, Number(k), A[k]?.nId_color);
      }
      let i = 0;
      while (i < 2) {
        addIco(mc, mc["mS_" + i], mc.ob?.aBug_have?.[i], 1, Number(i), mc.ob?.aBug_color?.[i]);
        i++;
      }
      typingLater(mc, 5, "0-9");
    },
  },

  91: { 25: (mc) => { mc.gotoAndPlay(1); } },

  // ── sprites só com stop() no frame 1 ──
  100: { 1: stopFrame }, 103: { 1: stopFrame }, 106: { 1: stopFrame }, 107: { 1: stopFrame },
  109: { 1: stopFrame }, 115: { 1: stopFrame }, 121: { 1: stopFrame }, 123: { 1: stopFrame },
  129: { 1: stopFrame }, 136: { 1: stopFrame }, 142: { 1: stopFrame }, 144: { 1: stopFrame },
  148: { 1: stopFrame }, 152: { 1: stopFrame }, 158: { 1: stopFrame }, 162: { 1: stopFrame },
  174: { 1: stopFrame }, 179: { 1: stopFrame }, 184: { 1: stopFrame }, 189: { 1: stopFrame },
  194: { 1: stopFrame }, 199: { 1: stopFrame }, 204: { 1: stopFrame }, 209: { 1: stopFrame },
  216: { 1: stopFrame },
  270: { 1: stopFrame }, // mPeople
  305: { 1: stopFrame },
  433: { 1: stopFrame },

  // ── Word (balão de texto) ──
  237: {
    1: (mc) => {
      if (mc.nTime == undefined) {
        mc.nTime = 30;
      }
      mc.onEnterFrame = function () {
        if (mc.nTime == 0) {
          mc.play();
          delete mc.onEnterFrame;
        } else {
          mc.nTime--;
        }
      };
      _global.SOUND?.attachSound("popinfo");
      _global.SOUND?.start();
    },
    11: stopFrame,
    21: (mc) => {
      mc.rtFun?.();
      mc.removeMovieClip();
    },
  },

  // ── máscaras de transição (frame 1 = só `var ready; var finish;`) ──
  240: {
    2: (mc) => {
      mc.stop();
      mc.ready?.();
      mc.nTime = 0;
      mc.nT = 20;
      mc.nRdm = Math.random();
      mc.onEnterFrame = function () {
        mc.nTime++;
        const v = 50 - SFM.nolinearCycle(mc.nTime, mc.nT, 50);
        if (mc.nRdm > 0.5) {
          mc.mC2._yscale = mc.mC1._yscale = v;
        } else {
          mc.mC2._xscale = mc.mC1._xscale = v;
        }
        if (mc.nTime == mc.nT / 2) {
          mc.finish?.();
          delete mc.onEnterFrame;
        }
      };
    },
  },
  243: {
    2: (mc) => {
      mc.stop();
      mc.ready?.();
      mc.nTime = 0;
      mc.nT = 20;
      mc.nRdm = Math.round(Math.random() * 4);
      mc.onEnterFrame = function () {
        mc.nTime++;
        const v = 100 - SFM.nolinearCycle(mc.nTime, mc.nT, 100);
        switch (mc.nRdm) {
          case 0:
            mc.mC1._yscale = v;
            mc.mC2._yscale = v;
            break;
          case 1:
            mc.mC1._yscale = v;
            mc.mC2._xscale = v;
            break;
          case 2:
            mc.mC1._xscale = v;
            mc.mC2._yscale = v;
            break;
          case 3:
            mc.mC1._xscale = v;
            mc.mC2._xscale = v;
            break;
          case 4:
            mc.mC1._xscale = v;
            mc.mC2._xscale = v;
            mc.mC1._yscale = v;
            mc.mC2._yscale = v;
        }
        if (mc.nTime == mc.nT / 2) {
          mc.finish?.();
          delete mc.onEnterFrame;
        }
      };
    },
  },
  244: {
    2: (mc) => {
      mc.stop();
      mc.ready?.();
      mc.nTime = 0;
      mc.nT = 20;
      mc.nRdm = Math.random();
      mc.onEnterFrame = function () {
        mc.nTime++;
        const v = 100 - SFM.nolinearCycle(mc.nTime, mc.nT, 100);
        if (mc.nRdm > 0.5) {
          mc.mC4._yscale = mc.mC3._yscale = mc.mC2._yscale = mc.mC1._yscale = v;
        } else {
          mc.mC4._xscale = mc.mC3._xscale = mc.mC2._xscale = mc.mC1._xscale = v;
        }
        if (mc.nTime == mc.nT / 2) {
          mc.finish?.();
          delete mc.onEnterFrame;
        }
      };
    },
  },
  245: {
    2: (mc) => {
      mc.stop();
      mc.ready?.();
      mc.nTime = 0;
      mc.nT = 20;
      mc.nRdm = Math.round(Math.random() * 2);
      mc.nRdm_2 = Math.random();
      mc.onEnterFrame = function () {
        mc.nTime++;
        const v = 100 - SFM.nolinearCycle(mc.nTime, mc.nT, 100);
        switch (mc.nRdm) {
          case 0:
            mc.mC1._xscale = 150;
            mc.mC1._yscale = v;
            break;
          case 1:
            mc.mC1._xscale = v;
            mc.mC1._yscale = 150;
            break;
          case 2:
            mc.mC1._yscale = v;
            mc.mC1._xscale = v;
        }
        if (mc.nRdm_2 > 0.5) {
          if (mc.nRdm_2 > 0.75) {
            mc.mC1._rotation = 180 - SFM.nolinearCycle(mc.nTime, mc.nT, 180);
          } else {
            mc.mC1._rotation = SFM.nolinearCycle(mc.nTime, mc.nT, 180);
          }
        }
        if (mc.nTime == mc.nT / 2) {
          mc.finish?.();
          delete mc.onEnterFrame;
        }
      };
    },
  },

  // ── mFirst (dicas iniciais) ──
  299: {
    1: (mc) => {
      mc.stop();
      mc._alpha = 80;
    },
    11: (mc) => {
      SFM.addClip("Word", _root, { sTxt: "Good luck!", nTime: 100, _x: 630, _y: 355 });
      _global.GAME.pHints = true;
      mc.removeMovieClip();
    },
  },

  307: {
    1: (mc) => {
      stopAllSounds();
      mc._visible = false;
      mc.cacheAsBitmap = true;
    },
    2: stopFrame,
  },

  // ── botão de texto simples ──
  331: {
    1: (mc) => {
      mc.Frame = function () {
        if (mc.bIn && mc.bFlag_down) {
          mc.gotoAndStop("Down");
        } else if (mc.bIn || mc.bFlag_down) {
          mc.gotoAndStop("Over");
        } else {
          mc.gotoAndStop("Up");
        }
        mc.tLabel.autoSize = mc.autoSize;
        if (mc.autoSize == "right") {
          mc.tLabel._x = -Math.floor(mc.tLabel._width);
        } else if (mc.autoSize == "center") {
          mc.tLabel._x = -Math.floor(mc.tLabel._width / 2);
        } else {
          mc.tLabel._x = 0;
        }
       fitRight(mc);
      };
      mc.sLabel = evalPath(mc, mc._sLabel) != undefined ? evalPath(mc, mc._sLabel) : mc._sLabel;
      mc.bIn = false;
      mc.bFlag_down = false;
      mc.Frame();
      wireButton(mc);
      mc.hitArea = mc.tLabel;
    },
  },

  333: { 1: (mc) => { mc.nextFrame(); } },

  // ── barra (nValue / nMax) ──
  355: {
    1: (mc) => {
      mc.replace = function (_nValue: any, _nMax: any) {
        mc.nValue = _nValue != undefined ? _nValue : mc.nValue;
        mc.nMax = _nMax != undefined ? _nMax : mc.nMax;
        let v = mc.nValue / mc.nMax * 100;
        if (v > 100) {
          v = 100;
        } else if (v < 0) {
          v = 0;
        }
        mc.mMc._xscale = v;
        mc._height = mc.nHeight;
        mc._width = mc.nWidth;
      };
      const t = typeOfAS(evalPath(mc, mc.nValue));
      if (t == "function") {
        // port: original faz `nValue = nValue()` sobre a string do caminho → undefined (mantido)
        mc.nValue = callAS(mc, mc.nValue);
      } else if (t == "number") {
        mc.nValue = evalPath(mc, mc.nValue);
      } else {
        mc.nValue = Number(mc.nValue);
      }
      const colorTrans = new ColorTransform();
      colorTrans.rgb = mc.nColor;
      new Transform(mc.mMc).colorTransform = colorTrans;
      mc.replace(mc.nValue, mc.nMax);
    },
  },

  // ── painel de info ──
  356: {
    1: (mc) => {
      mc.setFrame = function (_s: any, _ob: any) {
        mc.sFrame = _s;
        mc.ob_0 = _ob;
        mc.gotoAndStop("undefined");
        mc.gotoAndStop(_s);
        const o = mc.ob_0;
        switch (_s) {
          case "beetle":
            mc.ob = {
              s_0: o?.sNickName, s_1: _global.GAME?.setAge(o?.nAge_now), s_2: (o?.nSex <= 0 ? "Female" : "Male"),
              n_0: o?.nFed, n_1: o?.nHeart, n_2: o?.nHealth,
            };
            return;
          case "battle":
            mc.ob = {
              s_0: o?.sNickName, s_1: _global.GAME?.setAge(o?.nAge_now), s_2: (o?.nSex <= 0 ? "Female" : "Male"),
              n_0: o?.nPower, n_1: o?.nFly, n_2: o?.nHp,
            };
            return;
          case "sell":
            mc.ob = {
              s_0: o?.sNickName, s_1: _global.GAME?.setAge(o?.nAge_now), s_2: (o?.nSex <= 0 ? "Female" : "Male"),
              s_3: "$ " + o?.nValue_c,
            };
            return;
          default:
            mc.ob = o;
            return;
        }
      };
      // novo (não existe no original): no modo "battle" marca sobre cada barra (Attack/Speed/HP)
      // onde fica o atributo do MEU melhor besouro naquela categoria, para comparar com o adversário.
      const setFrame0 = mc.setFrame;
      mc.setFrame = function (_s: any, _ob: any) {
        setFrame0(_s, _ob);
        if (_s === "battle") {
          // novo: na corrida mostra o tamanho (escala do besouro, 10 + nGrow × 0,025) no lugar do sexo
          if (_global.GAME?.pSell?.nBattle === -1) {
            const sexLabel = mc.children.find((c: any) => c.depth === 11 - 16384);
            if (sexLabel) sexLabel.sTxt = "Size :";
            mc.ob.s_2 = (10 + (Number(_ob?.nGrow) || 0) * 0.025 + (Number(_ob?.nRandom) || 0)).toFixed(1);
          }
          addBestMarkers(mc);
        }
        wrapInfoLines(mc, _s === "txt");
      };
      mc.stop();
    },
  },

  // ── botão de ícone ──
  357: {
    1: (mc) => {
      mc.Frame = function () {
        let f: string;
        if (mc.bIn && mc.bFlag_down) {
          f = "Down";
          mc.bOn = !mc.bOn;
        } else if (mc.bIn || mc.bFlag_down) {
          f = "Over";
        } else {
          f = "Up";
        }
        mc.gotoAndStop(f);
        mc.mAni?.gotoAndStop(f);
        mc.mSwitch?.gotoAndStop(mc.bOn?.toString());
        if (mc.mAni) {
          mc.mAni._width = mc.nWidth;
          mc.mAni._height = mc.nHeight;
        }
        mc.mIco?.gotoAndStop(mc.nIco);
      };
      mc.bOn = evalPath(mc, mc._bOn) != undefined ? evalPath(mc, mc._bOn) : Boolean(mc._bOn);
      mc.mIco = mc.attachMovie(mc.sIco, mc.sIco, 9, { _x: mc.nWidth / 2, _y: mc.nHeight / 2 });
      mc.mSwitch = mc.attachMovie(mc.sSwitch, mc.sSwitch, 10);
      mc.bIn = false;
      mc.bFlag_down = false;
      mc.Frame();
      wireButton(mc);
    },
  },

  360: { 1: (mc) => { mc.cacheAsBitmap = true; } },

  // ── chance de bebê (nome do clip: "<x>_<a>_<b>") ──
  362: {
    1: (mc) => {
      mc.a = mc._name.split("_", 3);
      mc.s = Game.getBabychance(mc.a[1], mc.a[2]) + "%";
    },
  },
  364: {
    1: (mc) => {
      mc.a = mc._name.split("_", 3);
      mc.s = Game.getBabychance(mc.a[1], mc.a[2]) + "%";
    },
  },

  // ── fim de jogo ──
  403: { 360: stopFrame },

  // ── menu de pausa / configurações ──
  404: {
    1: (mc) => {
      mc.goto = function (_s: any) {
        _global.FADE?.();
        mc._parent?.remove?.();
        if (_s == "Return" || mc.sFrame == _s) {
          mc.sFrame = undefined;
          _global.GAME?.start();
          mc.gotoAndStop("Return");
        } else {
          mc.sFrame = _s;
          _global.GAME?.stop();
          mc.gotoAndStop(_s);
        }
      };
      mc.stop();
    },
    3: (mc) => { mc.gotoAndStop(1); },
    5: (mc) => {
      // port: qualidade fica sempre máxima; botões LOW/MEDIUM/HIGH/BEST e rótulo "Quality :" escondidos
      for (const id of ["LOW", "MEDIUM", "HIGH", "BEST"]) if (mc[id]) mc[id]._visible = false;
      const qLabel = mc.children.find((c: any) => c.depth === 83 - 16384);
      if (qLabel) qLabel._visible = false;
      // novo (não existe no original): seletor de idioma EN/PT, no lugar do rótulo "Quality :"
      const label = () => " LANGUAGE: " + getLang().toUpperCase() + " ";
      const lb = mc.attachSymbol(57, "btLang", -15900, {
        _sLabel: label(), _bOn: true, autoSize: "left", bAni_visible: true, enabled: true, sSwitch: "", sPop: "", y_tPop: -50,
      }, true);
      if (lb && mc.LOW) {
        lb._x = mc.LOW._x;
        lb._y = mc.LOW._y - 40;
        lb.onrelease = function () {
          setLang(getLang() == "pt" ? "en" : "pt");
          lb.sLabel = label();
          lb.Frame?.();
        };
        // novo: sincronizar insetos com a velocidade do jogo (botão SPEED); padrão desligado
        const sLabel = () => " SYNC BUGS SPEED: " + (getSyncSpeed() ? "ON" : "OFF") + " ";
        const sb = mc.attachSymbol(57, "btSync", -15899, {
          _sLabel: sLabel(), _bOn: true, autoSize: "left", bAni_visible: true, enabled: true, sSwitch: "", sPop: "", y_tPop: -50,
        }, true);
        if (sb) {
          sb._x = lb._x;
          sb._y = lb._y + 40;
          sb.onrelease = function () {
            setSyncSpeed(!getSyncSpeed());
            sb.sLabel = sLabel();
            sb.Frame?.();
          };
        }
      }
    },
    7: (mc) => {
      for (const i of forIn(_global.GAME?.aBug_have)) {
        const n = Number(i); // `_i` no original (variável de timeline)
        const slot = mc["mC_" + i];
        if (_global.GAME.aBug_have[i]) {
          slot?.attachMovie("beetle", "beetle", 0);
          const b = slot?.beetle; // with(this["mC_"+i].beetle)
          if (b) {
            b._rotation = -45;
            b._yscale = b._xscale = 25 + Math.ceil(n / 3);
            b.gotoAndStop(n + 1);
            b.mHead?.gotoAndStop(n + 1);
            b.mBoot?.gotoAndStop(b.mBoot._totalframes);
          }
          if (slot?.mTxt) slot.mTxt._visible = false;
        } else if (slot?.mTxt) {
          slot.mTxt._visible = true;
        }
      }
    },
  },

  // ── Game (menus + HUD) ──
  434: {
    1: (mc) => {
      _global.GAMENAME = "evolution";
      _global.WIDTH = 640;
      _global.HEIGHT = 480;
      _global.MUSIC = new Sound(_root.mMusic);
      _global.SOUND = new Sound(mc);
      _global.VIEWSCORE = function () {
        // port: highscore online removido (offline) → no-op
      };
      _global.FWGURL = function () {
        getURL("http://www.freeworldgroup.com/", "_blank");
      };
      _global.ADDGAME = function () {
        getURL("http://www.freeworldgroup.com/koalafiles.htm", "_blank");
      };
      _global.DOWNLOAD = function () {
        getURL("http://www.ifungames.com", "_blank");
      };
      _global.ENABLED = function (b: any) {
        if (b) {
          _root.createEmptyMovieClip("mEnabled", _root.getNextHighestDepth());
          _root.mEnabled.enabled = false;
          _root.mEnabled.hitArea = _root;
          _root.mEnabled.onPress = function () {};
          updateAfterEvent();
        } else {
          delete _root.mEnabled?.onPress;
          _root.mEnabled?.removeMovieClip();
          updateAfterEvent();
        }
      };
      _global.FADE = function () {
        _global.SOUND.attachSound("sword");
        _global.SOUND.start();
        new Mask(_global.WIDTH, _global.HEIGHT, "mMask_" + SFM.rdm_a(1, 4, [2, 6, 5, 2]));
      };
      _global.TXTCOLOR = function (_sColor: any, _s: any) {
        const a = "<font color='#";
        const b = "'>";
        const c = "</font>";
        return a + _sColor + b + _s + c;
      };
      const DATA: any[] = (_global.DATA = []);
      DATA[0] = [360, 0.12, 12, 160, 0.21, 5, 50];
      DATA[1] = [360, 0.1, 10, 150, 0.3, 5, 50];
      DATA[2] = [360, 0.13, 13, 190, 0.22, 5, 50];
      DATA[3] = [360, 0.11, 11, 150, 0.28, 5, 50];
      DATA[4] = [360, 0.15, 14, 160, 0.29, 5, 50];
      DATA[5] = [360, 0.2, 21, 210, 0.2, 5, 50];
      DATA[6] = [360, 0.21, 20, 170, 0.31, 5, 50];
      DATA[7] = [360, 0.23, 22, 180, 0.4, 5, 50];
      DATA[8] = [360, 0.25, 24, 190, 0.22, 5, 50];
      DATA[9] = [360, 0.3, 32, 250, 0.3, 5, 50];
      DATA[10] = [360, 0.32, 33, 200, 0.22, 5, 50];
      DATA[11] = [360, 0.35, 34, 210, 0.3, 5, 50];
      DATA[12] = [360, 0.4, 41, 220, 0.26, 5, 50];
      DATA[13] = [360, 0.45, 42, 230, 0.25, 5, 50];
      DATA[14] = [360, 0.55, 50, 250, 0.24, 5, 50];
      DATA[20] = [];
      DATA[20][0] = "Apple : " + C("Hunger+9");
      DATA[20][1] = C("");
      DATA[20][2] = "Watermelon : " + C("Hunger+6. Happiness+1");
      DATA[20][3] = C("");
      DATA[20][4] = "Grape : " + C("Hunger+3. Happiness+2. Health+1");
      DATA[20][5] = C("");
      DATA[20][6] = "Drug : " + C("Hunger+3. Happiness-2. Health-5. Growth+1.5");
      DATA[20][7] = C("");
      DATA[21] = [100, 110, 130, 140, 150, 310, 330, 360, 400, 820, 900, 1000, 2300, 3000, 7400, 10, 20, 40, 200, 200, 300, 600, 900, 1200];
      mc._x = 0;
      mc._y = 0;
      mc.swapDepths(100);
    },
    5: () => { _global.FADE?.(); },
    // menu principal
    6: (mc) => {
      mc.reset = function () {
        const ids = ["btPlay", "btHelp", "btHighScore", "btDownload", "btMoreGame", "btAddGame", "btV", "btCredits", "btCopyright"];
        const labels = [" PLAY GAME ", " INSTRUCTIONS ", " VIEW HIGHSCORES ", " DOWNLOAD GAMES ", " MORE ONLINE GAMES ", " ADD THIS GAME TO YOUR SITE ", " V 1.0 ", " Credits ", " Copyright 2007 freeworldgroup.com "];
        const autoSize = "left";
        const bAni = true;
        const step = 30;
        const x0 = mc.mPinButtons._x;
        const y0 = mc.mPinButtons._y;
        let i = 0;
        while (i < ids.length) {
          const b = mc[ids[i]];
          b._sLabel = labels[i];
          if (i < ids.length - 3) {
            b.autoSize = autoSize;
            b.bAni = bAni;
            b._x = x0;
            b._y = y0 + i * step;
          }
          i = i + 1;
        }
        mc.btV._x = Stage.width;
        mc.btV._y = 0;
        mc.btCredits._x = Stage.width;
        mc.btCredits._y = Stage.height - mc.btCredits._height;
        mc.btCopyright._x = 0;
        mc.btCopyright._y = Stage.height - mc.btCopyright._height;
        mc.btMoreGame.onpress = mc.btCopyright.onpress = function () {
          _global.FWGURL?.();
        };
        mc.btAddGame.onpress = function () {
          _global.ADDGAME?.();
        };
        mc.btDownload.onpress = function () {
          _global.DOWNLOAD?.();
        };
        mc.btHighScore.onpress = function () {
          _global.VIEWSCORE?.();
        };
        mc.btCredits.onpress = function () {
          _global.FADE?.();
          mc.gotoAndStop("Credits");
        };
        mc.btPlay.onrelease = function () {
          _global.FADE?.();
          mc.gotoAndStop("A_0");
        };
        mc.btHelp.onrelease = function () {
          _global.FADE?.();
          mc.gotoAndStop("Help");
        };
        // port: versão offline sem highscore nem links de portal
        for (const id of ["btHighScore", "btDownload", "btMoreGame", "btAddGame"]) mc[id]._visible = false;
      };
      // novo (não existe no original): "CONTINUE AS <nome>" carrega direto o último jogo salvo.
      // Desabilitado (translúcido) quando não há jogador ou jogo salvo.
      mc.addContinue = function () {
        const so = SharedObject.getLocal("evolution_player", "/");
        const list = so.data.aPlayer;
        const name = list && list.length ? list[list.length - 1] : undefined;
        const soData = name !== undefined ? SharedObject.getLocal("evolution" + name, "/") : undefined;
        const can = !!soData && soData.getSize() > 0;
        const label = name !== undefined ? " CONTINUE AS " + String(name).toUpperCase() + " " : " CONTINUE ";
        const BUTTON = 57; // sprite do botão padrão do jogo
        const x0 = mc.mPinButtons._x, y0 = mc.mPinButtons._y;
        const bt = mc.attachSymbol(BUTTON, "btContinue", -16000, {
          _sLabel: label, _bOn: true, autoSize: "left", bAni_visible: true, enabled: true, sSwitch: "", sPop: "", y_tPop: -50,
        }, true);
        // novo: SETTINGS no menu inicial abre a mesma tela Setting do jogo (sprite 404) por cima do menu
        const bs = mc.attachSymbol(BUTTON, "btSetting", -15999, {
          _sLabel: " SETTINGS ", _bOn: true, autoSize: "left", bAni_visible: true, enabled: true, sSwitch: "", sPop: "", y_tPop: -50,
        }, true);
        bs.onrelease = function () {
          const st = mc.attachSymbol(404, "mSetMenu", 200, { bMenu: true }, true);
          st?.gotoAndStop("Setting");
        };
        // layout: botões maiores e centralizados na coluna antiga de 6
        const list3 = [bt, mc.btPlay, mc.btHelp, bs];
        list3.forEach((b: any, i: number) => { b._x = x0; b._y = y0 + 10 + i * 42; b._xscale = b._yscale = 125; });
        if (!can) { bt.enabled = false; bt._alpha = 45; }
        bt.onrelease = function () {
          if (!can) return;
          mc.soPlayer = so;
          mc.sPlayer = name;
          mc.soData = soData;
          _global.FADE?.();
          mc.gotoAndStop("Initial_load");
        };
      };
      mc.remove = function () {
        for (const k of forIn(mc)) {
          if (typeOfAS(mc[k]) == "movieclip") {
            mc[k].removeMovieClip();
          }
        }
      };
      mc.stop();
      _global.GAME?.stop();
      _global.GAME = undefined;
      mc.owner = undefined;
      mc.reset();
      mc.remove();
      delete mc.sPlayer;
      mc.addContinue();
    },
    // seleção de jogo
    26: (mc) => {
      mc.soPlayer = SharedObject.getLocal("evolution_player", "/");
      if (mc.soPlayer.data.aPlayer == undefined || mc.soPlayer.data.aPlayer.length < 1) {
        mc.soPlayer.data.aPlayer = [];
        mc.gotoAndStop("A_2");
      } else {
        mc.sPlayer = mc.soPlayer.data.aPlayer[mc.soPlayer.data.aPlayer.length - 1];
        mc.soData = SharedObject.getLocal("evolution" + mc.sPlayer, "/");
      }
      if (mc.soData?.getSize() == 0) {
        mc.zContinue._visible = false;
      }
    },
    // seleção de jogador
    28: (mc) => {
      mc.reset = function () {
        const list = () => mc.soPlayer.data.aPlayer;
        let i = 0;
        while (i < 5) {
          const m = mc["m_" + i];
          if (list()[i] != undefined) {
            mc["zP_" + i].sTxt = list()[i];
            const score = SharedObject.getLocal("evolution" + list()[i], "/").data.GAME?.nScore;
            let lv = int(score / 1000) + 1;
            if (lv > 15) lv = 15;
            m.gotoAndStop(lv);
            m.mHead?.gotoAndStop(lv);
            m.mBoot?.gotoAndStop(m.mBoot._totalframes);
            m.onPress = function () {
              const p = list().splice(Number(this._name.charAt(2)), 1)[0];
              list().push(p);
              _global.FADE?.();
              mc.gotoAndStop("A_0");
            };
          } else {
            mc["zP_" + i].sTxt = "NO DATA";
            m.gotoAndStop(m._totalframes);
          }
          i = i + 1;
        }
        if (list().length < 1) {
          mc.zDelete._visible = false;
          mc.zBack._visible = false;
        } else if (list().length > 4) {
          mc.zNew._visible = false;
        } else {
          mc.zBack._visible = true;
          mc.zNew._visible = true;
          mc.zDelete._visible = true;
        }
      };
      mc.reset();
    },
    // novo jogador
    30: (mc) => {
      mc.addNew = function (_s: any) {
        const list = mc.soPlayer.data.aPlayer;
        if (_s?.length < 1) {
          SFM.addClip("mPop", _root, { sTxt: "PLEASE ENTER A NAME !", sFrame: "WARN" });
          return false;
        }
        for (const k of forIn(list)) {
          if (list[k] == _s) {
            SFM.addClip("mPop", _root, { sTxt: "ALREADY HAVE !\nCHANGE ANOTHER ONE !", sFrame: "WARN" });
            return false;
          }
        }
        mc.soPlayer.data.aPlayer.push(_s);
        mc.soData = SharedObject.getLocal("evolution" + _s, "/");
        return true;
      };
      typingLater(mc, 8, "^ _");
      if (mc.soPlayer.data.aPlayer.length < 1) {
        mc.zBack._visible = false;
      }
    },
    // novo jogo
    34: (mc) => {
      _global.GAME = new Game(mc);
      mc.soData.clear();
      mc.soData.data.GAME = _global.GAME;
      mc.gotoAndStop("GameNow");
    },
    // continuar jogo
    36: (mc) => {
      _global.GAME = new Game(mc, mc.soData.data.GAME);
      mc.soData.clear();
      mc.soData.data.GAME = _global.GAME;
      mc.gotoAndStop("GameNow");
    },
    38: (mc) => {
      _global.GAME?.initial_0();
      mc.mBar?.gotoAndStop(1);
    },
    43: (mc) => {
      _global.GAME?.initial_1();
      mc.remove?.();
      mc.mBar?.gotoAndStop(1);
    },
    46: (mc) => {
      _global.GAME?.initial_2();
      mc.remove?.();
      mc.mBar?.gotoAndStop(1);
    },
    49: (mc) => {
      _global.GAME?.initial_3();
      mc.remove?.();
      mc.mBar?.gotoAndStop(1);
    },
    52: (mc) => {
      _global.GAME?.initial_4();
      mc.remove?.();
      mc.mBar?.gotoAndStop(1);
      addRaceButtons(mc);
    },
  },
};

// ───────────────────────── clip actions ─────────────────────────
// chave: `${spriteId}:${frame}:${depth}` (PlaceObject2_<charId>_<depth> / _<name>_<depth>)

export const clipActions: ClipActions = {
  // ── mPop (84) ──
  '84:1:95': {
    release() {
      this._parent?.rtFun?.(false);
      this._parent?.back?.();
    },
  },
  '84:1:100': {
    release() {
      this._parent?.rtFun?.(true);
      this._parent?.back?.();
    },
  },
  '84:2:95': {
    release() {
      this._parent?.rtFun?.();
      this._parent?.back?.();
    },
  },
  '84:3:82': {
    release() {
      _global.GAME?.finalWin();
      this._parent?.back?.();
    },
  },
  '84:4:82': { release: back },
  '84:4:87': {
    release() {
      this._parent?.rtFun?.(Number(this._parent?.zName?.tTxt?.text));
      this._parent?.back?.();
    },
  },
  '84:5:82': {
    release() {
      this._parent?.rtFun?.();
      this._parent?.back?.();
    },
  },
  '84:5:87': {
    release() {
      this._parent?.rtFun?.(Number(this._parent?.zName?.tTxt?.text));
      this._parent?.back?.();
    },
  },
  '84:6:82': {
    release() {
      if (this._parent?.rtFun?.(this._parent?.zName?.tTxt?.text)) {
        this._parent?.back?.();
      }
    },
  },
  '84:7:68': { release: back },
  '84:7:73': {
    release() {
      if (this._parent?.rtFun?.(this._parent?.nNum)) {
        this._parent?.back?.();
      }
    },
  },
  '84:7:80': {
    load() {
      const slider = this; // `_parent` solto resolve no escopo do clip (slider), não no `this` da chamada
      this.onhold = function () {
        slider._parent.nNum = this.getValue();
      };
    },
  },
  '84:8:68': {
    // port: envio de highscore (LoadVars.sendAndLoad) removido (offline) → só fecha o popup
    release() {
      this._parent?.back?.();
    },
  },
  '84:8:73': { release: back },
  '84:10:55': { release: back },
  '84:13:55': { release: back },
  '84:13:60': {
    release() {
      if (_global.GAME?.ckBreed()) {
        this._parent?.back?.();
      }
    },
  },
  '84:14:55': { press: back },
  '84:14:60': {
    press() {
      if (_global.GAME?.ckBattle(Number(this._parent?.zName?.tTxt?.text))) {
        _global.FADE?.();
        _global.GAME?.mClip?.gotoAndStop("Pause_2");
        this._parent?.removeMovieClip();
      }
    },
  },
  '84:15:60': {
    press() {
      if (_global.GAME?.ckRace(Number(this._parent?.zName?.tTxt?.text))) {
        _global.FADE?.();
        _global.GAME?.mClip?.gotoAndStop("Pause_3");
        this._parent?.removeMovieClip();
      }
    },
  },

  // ── mIco (235): besouro no frame 56 ──
  '235:56:1': {
    load() {
      this.stop();
      this.mHead?.stop();
      this.mBoot?.gotoAndStop(this.mBoot?._totalframes);
    },
  },

  // ── Word (237) ──
  '237:1:1': { load: loadTextBox },
  '237:21:1': { load: loadTextBox },

  // ── mFirst (299) ──
  '299:1:4': {
    load: loadTextBox,
    release() {
      this._parent?.nextFrame();
    },
  },

  // ── fundo de confete (344) ──
  '344:1:1': {
    load() {
      let i = 0;
      while (i < 25) {
        const mT = this.attachMovie("ye", "ye" + i, i, {
          _x: SFM.rdm_2(20, 620),
          _y: SFM.rdm_2(20, 360),
          _rotation: random(360),
          _xscale: SFM.rdm_2(80, 120),
          _yscale: SFM.rdm_2(80, 120),
        });
        Mycolor.dropShadow(mT, { blurX: 2, blurY: 2, distance: 1 });
        i++;
      }
    },
  },

  // ── tela de fim de jogo (403) ──
  '403:360:117': {
    release() {
      _global.FADE?.();
      _root.mGame?.gotoAndStop("Menu");
    },
  },
  '403:360:122': {
    release() {
      this._parent?._parent?.goto?.("Return");
    },
  },
  '403:360:127': {
    // port: versão offline sem envio de score — botão escondido
    load() { this._visible = false; },
    release() {
      _global.GAME?.socreFun_0();
    },
  },

  // ── menu de pausa (404) ──
  '404:5:113': {
    load() { if (this._parent?.bMenu) this._visible = false; },
    release() {
      _global.FADE?.();
      _root.mGame?.gotoAndStop("Menu");
    },
  },
  '404:5:138': {
    load() {
      // aberta pelo menu inicial: o botão fecha a tela (sem jogo para retornar)
      if (this._parent?.bMenu) { this._y = 420; this.sLabel = " CLOSE "; this.Frame?.(); }
    },
    release() {
      if (this._parent?.bMenu) { this._parent.removeMovieClip(); return; }
      this._parent?.goto?.("Return");
    },
  },
  '404:5:143': {
    // port: versão offline sem envio de score — botão escondido
    load() { this._visible = false; },
    release() {
      _global.GAME?.socreFun_0();
    },
  },
  '404:5:89': {
    load() {
      this.onhold = function () {
        _global.MUSIC?.setVolume(this.nNow);
      };
    },
  },
  '404:5:101': {
    load() {
      this.onhold = function () {
        _global.SOUND?.setVolume(this.nNow);
      };
    },
  },
  '404:5:1': {
    load() {
      this.enabled = false;
      this._width = _global.WIDTH;
      this._height = _global.HEIGHT;
    },
    press() {}, // bloqueia cliques no fundo
  },
  '404:7:113': {
    release() {
      this._parent?.goto?.("Return");
    },
  },

  // ── mPeople na loja (424) ──
  '424:1:101': {
    load() {
      this.nFrame = 1;
      this.mHead?.gotoAndStop(this.nFrame);
      this.mArm_0?.gotoAndStop(this.nFrame);
      this.mArm_1?.gotoAndStop(this.nFrame);
      this.mBody?.gotoAndStop(this.nFrame);
      this.mLeg_0?.gotoAndStop(this.nFrame);
      this.mLeg_1?.gotoAndStop(this.nFrame);
    },
    rollOver() {
      info("Your shop : " + C(""));
    },
  },

  // ── Game (434) ──
  '434:6:481': {
    load() {
      this._y = 10;
      this._x = 10;
      // port: logo da FreeWorldGroup removida (ocupava a área do jogo)
      this._visible = false;
    },
  },
  '434:11:103': {
    release() {
      _global.FADE?.();
      this._parent?.gotoAndStop("Menu");
    },
  },
  '434:26:462': {
    release() {
      _global.FADE?.();
      this._parent?.gotoAndStop("Help");
    },
  },
  '434:26:467': {
    release() {
      _global.FADE?.();
      this._parent?.gotoAndStop("Initial_load");
    },
  },
  '434:26:474': {
    release() {
      _global.FADE?.();
      this._parent?.gotoAndStop("A_1");
    },
  },
  '434:28:110': {
    release() {
      _global.FADE?.();
      this._parent?.gotoAndStop("A_2");
    },
  },
  '434:28:115': {
    release() {
      // `_parent` solto no rtFun resolve no escopo do botão (timeline do jogo)
      const parent = this._parent;
      const mT = SFM.addClip("mPop", _root, {
        sTxt: "DELETE " + parent.soPlayer.data.aPlayer[parent.soPlayer.data.aPlayer.length - 1] + " ?",
        sFrame: "Y_N",
      });
      mT.rtFun = function (_b: any) {
        if (_b) {
          SharedObject.getLocal("evolution" + parent.soPlayer.data.aPlayer.pop(), "/").clear();
          parent.reset();
        }
      };
    },
  },
  '434:28:462': {
    release() {
      _global.FADE?.();
      this._parent?.gotoAndStop("A_0");
    },
  },
  '434:30:110': {
    release() {
      if (this._parent?.addNew(this._parent?.zName?.tTxt?.text)) {
        _global.FADE?.();
        this._parent?.gotoAndStop("A_0");
      }
    },
  },
  '434:30:115': {
    release() {
      _global.FADE?.();
      this._parent?.gotoAndStop("A_1");
    },
  },
  '434:32:110': {
    load() {
      if (this._parent?.sPlayer == undefined) {
        this._visible = false;
      }
    },
    release() {
      _global.FADE?.();
      this._parent?.gotoAndStop("Initial_new");
    },
  },

  // HUD (434 frame 38)
  // port: dinheiro (rótulo + valor) e botão SPEED um pouco mais à direita
  '434:38:195': { load() { this._x = 215; } },
  '434:38:197': { load() { this._x = 215; } },
  '434:38:199': {
    load() { this._x = 355; }, // v2: um pouco mais à esquerda (a coluna de botões do multiplayer ocupa a direita)
    release() {
      _global.GAME?.stop();
      switch (_global.GAME?.nInterval) {
        case 1000:
          _global.GAME.nInterval = 500;
          break;
        case 500:
          _global.GAME.nInterval = 250;
          break;
        case 250:
          _global.GAME.nInterval = 1000;
      }
      this.sLabel = " SPEED " + 1000 / _global.GAME?.nInterval + "X ";
      _global.GAME?.start();
    },
    rollOver() {
      info("Change game speed!" + C(""));
    },
  },
  '434:38:1': {
    load() {
      this._width = _global.WIDTH;
      this._height = _global.HEIGHT;
      this.useHandCursor = false;
    },
    rollOver() {
      _global.GAME?.mClip?.mInfo?.setFrame();
    },
  },
  '434:38:204': food(0, 0),
  '434:38:206': food(3, 6),
  '434:38:208': food(1, 2),
  '434:38:210': food(2, 4),
  '434:38:212': {
    release() {
      _global.GAME.sorb = 0;
      SFM.addClip("mPop", _root, { sFrame: "BREED" });
    },
    rollOver() {
      info("Breeding lab : " + C("Get new bug babies!"));
    },
  },
  '434:38:214': {
    release() {
      _global.GAME.sorb = 1;
      SFM.addClip("mPop", _root, { sFrame: "SELL" });
    },
    rollOver() {
      info(
        "Sell list : " + C("You can add your bug to the sell list and"),
        C("wait for someone to buy it!"),
        "Hint: " + C("Do not over-price your bug or it will not sell!"),
      );
    },
  },
  '434:38:216': {
    release() {
      _global.GAME.sorb = 2;
      SFM.addClip("mPop", _root, { sFrame: "BUGS" });
    },
    rollOver() {
      info("Rename bug : " + C("You can change your bug's name!"));
    },
  },
  '434:38:218': {
    release() {
      this._parent?.mBar?.goto?.("List");
    },
    rollOver() {
      info("Bug list : " + C(""));
    },
  },
  '434:38:220': {
    press() {
      _global.FADE?.();
      _global.GAME?.mClip?.gotoAndStop("Pause_1");
    },
    rollOver() {
      info(
        "Pet market : " + C("This is where you can buy food, toys, medicine"),
        C("and other bugs!"),
      );
    },
  },
  '434:38:222': {
    press() {
      _global.FADE?.();
      _global.GAME?.mClip?.gotoAndStop("GameNow");
    },
    rollOver() {
      info(
        "Your home :",
        C("You have " + _global.GAME?.aAdult?.length + " bugs in your tank!"),
        C("You are currently selling " + _global.GAME?.aAdult_sell?.length + " bugs!"),
      );
    },
  },
  '434:38:224': {
    press() {
      _global.FADE?.();
      _global.GAME?.mClip?.gotoAndStop("Pause_0");
    },
    rollOver() {
      info(
        "Fighting and racing arena : " + C("This is where you can gamble") + C(""),
        C("with your top bugs and try to win some money!"),
      );
    },
  },
  '434:38:226': {
    release() {
      this._parent?.mBar?.goto?.("Setting");
    },
    rollOver() {
      info("Menu : " + C("Sound. Music. Language. Main menu.")); // port: sem Quality/Submit score
    },
  },
};
