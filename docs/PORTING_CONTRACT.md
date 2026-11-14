# Contrato de port AS2 → TypeScript (projeto Evolution)

Fonte original (somente leitura): `extracted/scripts/` (classes em `__Packages/`,
timeline em `DefineSprite_*/frame_*/` e `frame_*/`). Visão geral concatenada:
`extracted/timeline_all.txt`. O motor (em `src/engine/`) é escrito em paralelo; o
port usa **somente** a API abaixo. Os nomes são os mesmos do Flash AS2, então o
código portado fica quase linha a linha igual ao original.

## Imports disponíveis — `src/engine/as2.ts`

```ts
import {
  _global,            // objeto global AS2 (_global.GAME, _global.DATA, _global.SOUND, _global.FADE...)
  _root,              // live binding do MovieClip raiz (use direto: _root.attachMovie(...), _root._xmouse)
  random, int,        // random(n) = inteiro [0,n); int(x) = trunc, NaN/undefined -> 0
  getTimer,           // ms desde o início
  setIntervalAS, clearIntervalAS, // setIntervalAS(obj, "metodo", ms) ou setIntervalAS(fn, ms); retorna id
  setTimeoutAS,       // setTimeoutAS(fn, ms)
  getURL,             // getURL(url, target)
  updateAfterEvent, stopAllSounds,
  forIn,              // forIn(obj) -> string[] com as chaves NA ORDEM DO AS2 (arrays: índice maior -> menor)
  evalPath,           // evalPath(scopeClip, "_parent.ob.s_0") -> valor ou undefined (eval() do AS2)
  typeOfAS,           // typeOfAS(v) -> "movieclip" | "function" | "string" | "number" | "object" | "undefined" | "boolean"
  isMovieClip,        // isMovieClip(v) -> boolean  (substitui `v instanceof MovieClip`)
  Stage,              // Stage.width / Stage.height
  Selection,          // Selection.setFocus(textField)
  Sound,              // new Sound(clip); attachSound(linkage); start(); setVolume(n); getVolume()
  SharedObject,       // SharedObject.getLocal(name, path) -> { data, flush(), clear(), getSize() }
  ColorMatrixFilter, DropShadowFilter, GlowFilter, // == flash.filters.*
  ColorTransform, Transform, BitmapData,           // == flash.geom.* / flash.display.BitmapData
} from '../engine/as2';
```

## MovieClip (tipo `any` no port)

Propriedades/métodos com os nomes do AS2: `_x _y _xscale _yscale _rotation _alpha
_visible _width _height _name _parent _currentframe _totalframes _xmouse _ymouse
filters enabled useHandCursor hitArea cacheAsBitmap`, `play() stop() gotoAndStop(f)
gotoAndPlay(f) nextFrame() prevFrame() attachMovie(id,name,depth,init)
createEmptyMovieClip(name,depth) removeMovieClip() getNextHighestDepth() getDepth()
swapDepths(depthOuClip) hitTest(x,y,shapeFlag) hitTest(clip) localToGlobal(pt)
globalToLocal(pt) startDrag(lock,l,t,r,b) stopDrag() setMask(clip) attachBitmap(bmp,depth)
getBytesLoaded() getBytesTotal()`. Handlers: `onEnterFrame onPress onRelease
onReleaseOutside onRollOver onRollOut onDragOut onDragOver` (atribuir função comum;
o motor chama com `this` = clip). Filhos nomeados e variáveis de timeline são
propriedades do clip (`mc.mHead`, `mc.sTxt`).
- Propriedades `_X`/`_Y` maiúsculas do decompilado = `_x`/`_y`.

TextField (`mc.tTxt`): `text htmlText variable autoSize border borderColor background
backgroundColor selectable type maxChars restrict _x _y _width _height _visible
onChanged textColor`.

## Regras de tradução

1. **undefined silencioso**: em AS2, ler propriedade/chamar método de `undefined`
   não dá erro. Use `?.` em toda referência que pode não existir (clips removidos,
   `pSell`, `pFood`, `mClip`, `pTarget_enemy`, filhos que podem faltar no frame).
2. **for-in**: `for (var k in X)` → `for (const k of forIn(X))` (k é string, como no AS2).
   Isso importa: `SFM.rdm_a` depende da ordem reversa.
3. `random(n)`, `int(x)` → helpers. `Math.*` igual. `instanceof MovieClip` → `isMovieClip`.
   `typeof x == "movieclip"` → `typeOfAS(x) == "movieclip"`.
4. Globais AS2 (`GAME`, `SOUND`, `MUSIC`, `DATA`, `FADE`, `TXTCOLOR`, `WIDTH`, `HEIGHT`,
   `ENABLED`, `FWGURL`, `VIEWSCORE`, ...) → `_global.X`.
5. `_root` → import `_root`. `this` em métodos de classe continua `this`.
6. Classes: `export class Nome { [k: string]: any; ... }` (propriedades dinâmicas).
   Estáticos continuam `static`. Construtores que copiam `ob` mantêm `for (const k of forIn(ob))`.
   `this;` / `this = null;` soltos no fim de `remove()` → remover.
7. Não "melhorar" a lógica: port fiel, inclusive números mágicos e bugs aparentes.
   Comente `// port:` só onde precisar desviar (ex.: API inexistente).
8. Removido nesta fase (offline): MochiAd, envio de score (`LoadVars`, `sendAndLoad`),
   `VIEWSCORE`. Mantenha a função existindo como no-op quando referenciada.

## Scripts de timeline — formato (`src/game/timeline.ts`)

```ts
import type { FrameScripts, ClipActions } from '../engine/core';
// spriteId 0 = timeline raiz (scripts/frame_N)
export const frameScripts: FrameScripts = {
  434: {
    1: (mc) => { _global.GAMENAME = 'evolution'; /* ... */ },
  },
};
// chave: `${spriteId}:${frame}:${depth}` — vem do caminho
// DefineSprite_<spriteId>/frame_<frame>/PlaceObject2_<charId>_<depth>/CLIPACTIONRECORD on(evento).as
// eventos: load enterFrame unload press release releaseOutside rollOver rollOut dragOut dragOver
export const clipActions: ClipActions = {
  '84:1:95': { release() { this._parent.rtFun(false); this._parent.back(); } },
};
```
- `on(construct)` (só atribuições literais) é gerado automaticamente em
  `src/game/construct.gen.ts` — **não portar**.
- `on(rollOver,press)` → defina `rollOver` e `press`.
- Handlers de clip: `this` = a instância (use `function`/método, não arrow).
- Frame scripts recebem `mc` (o clip dono do frame). Variáveis/funções declaradas no
  nível do frame script viram propriedades: `var x = 1` → `mc.x = 1`;
  `function F(){...}` → `mc.F = function(){...}`. Dentro dessas funções, variáveis
  de timeline são `mc.x` (scope chain do AS2 aponta para o clip onde foram declaradas).
  `var x;` sem valor → omitir (no-op em AS2).
- Identificadores soltos dentro de handlers/frame scripts resolvem: variável de
  timeline do clip dono → `_global`. Ex.: em frame script, `GAME.stop()` →
  `_global.GAME?.stop()`; `stop()` → `mc.stop()`; `_parent` → `mc._parent`.
- `with(obj){ a = 1; f(); }` → `obj.a = 1; obj.f();`.
- `return undefined;` no meio de frame script → `return;`.
