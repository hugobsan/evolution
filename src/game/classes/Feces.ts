import { _global, random, forIn } from '../../engine/as2';
import { Vector } from './Vector';
import { SFM } from './SFM';
import { Mycolor } from './Mycolor';

export class Feces {
  [k: string]: any;
  constructor(_nScale, ob?) {
    this.nScale = _nScale;
    this.vCurr = new Vector(SFM.rdm_2(100, 540), SFM.rdm_2(100, 300));
    for (const _loc3_ of forIn(ob)) {
      this[_loc3_] = ob[_loc3_];
    }
    this.vCurr = new Vector(this.vCurr.x, this.vCurr.y);
  }
  setClip(_mClip) {
    this.mClip = _mClip;
    this.mClip.owner = this;
    this.mClip._x = this.vCurr.x;
    this.mClip._y = this.vCurr.y;
    this.mClip._rotation = random(360);
    this.mClip._xscale = this.mClip._yscale = this.nScale * 100;
    Mycolor.dropShadow(this.mClip, { blurX: 2, blurY: 2, distance: 2 });
    this.mClip.onPress = function () {
      this.owner.remove();
    };
    this.mClip.onRollOver = function () {
      _global.GAME.mClip?.mInfo?.setFrame('txt', {
        s_0: "Bug's poo : " + _global.TXTCOLOR('00ccff', 'Click to clean it!'),
        s_1: '',
        s_2: 'Hint: ' + _global.TXTCOLOR('00ccff', 'Too much bug poo will make bugs unhappy!'),
      });
    };
  }
  remove() {
    _global.GAME?.removeArray(_global.GAME?.aFeces, this);
    this.mClip?.removeMovieClip();
    this.mClip = undefined;
    this.vCurr = undefined;
  }
}
