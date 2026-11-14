import { _global, _root, random, int, forIn } from '../../engine/as2';
import { Vector } from './Vector';
import { SFM } from './SFM';
import { Mycolor } from './Mycolor';

export class Food {
  [k: string]: any;
  static aPer = new Array([9, 0, 0, 0], [6, 1, 0, 0], [3, 2, 1, 0], [3, -2, -5, 1.5]);
  static aValue = new Array(400, 800, 800, 600);
  constructor(_nId, ob?) {
    this.nId = _nId;
    this.nValue = Food.aValue[this.nId];
    this.vCurr = new Vector(SFM.rdm_2(100, 540), SFM.rdm_2(100, 300));
    for (const _loc3_ of forIn(ob)) {
      this[_loc3_] = ob[_loc3_];
    }
    this.vCurr = new Vector(this.vCurr.x, this.vCurr.y);
  }
  setClip(_mClip) {
    this.mClip = _mClip;
    this.mClip.owner = this;
    this.mClip.gotoAndStop(this.nId + 1);
    this.mClip._x = this.vCurr.x;
    this.mClip._y = this.vCurr.y;
    this.mClip._rotation = random(360);
    Mycolor.dropShadow(this.mClip, { blurX: 8, blurY: 8, distance: 2 });
    this.mClip.onRollOver = function () {
      _global.GAME.mClip?.mInfo?.setFrame('txt', {
        s_0: _global.DATA[20][this.owner.nId * 2],
        s_1: '',
        s_2: 'Amount remaining : ' + _global.TXTCOLOR('00ccff', int(this.owner.nValue)),
      });
    };
    this.mClip.onPress = function () {
      this.startDrag(true, 0, 0, 640, 380);
    };
    this.mClip.onReleaseOutside = this.mClip.onRelease = function () {
      if (_root._xmouse < 200 && _root._ymouse < 70) {
        this._x = this.owner.vCurr.x;
        this._y = this.owner.vCurr.y;
      } else {
        this.owner.vCurr.setTo(this._x, this._y);
      }
      this.stopDrag();
    };
  }
  eat(_n) {
    if (this.nValue <= 0) {
      this.remove();
      return undefined;
    }
    this.nValue -= _n;
    return Food.aPer[this.nId];
  }
  remove() {
    _global.GAME?.removeArray(_global.GAME?.aFood, this);
    this.mClip?.removeMovieClip();
    this.mClip = undefined;
    this.vCurr = undefined;
  }
}
