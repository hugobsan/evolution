import { _global, _root, random, forIn } from '../../engine/as2';
import { Vector } from './Vector';
import { SFM } from './SFM';
import { Mycolor } from './Mycolor';

export class Adorn {
  [k: string]: any;
  static aPer = new Array(1, 1.5, 2, 3, 4);
  static aTime = new Array(1600, 1700, 1800, 1900, 2000);
  constructor(_nId, ob?) {
    this.nId = _nId;
    this.vCurr = new Vector(SFM.rdm_2(100, 540), SFM.rdm_2(100, 300));
    this.nTime = Adorn.aTime[this.nId];
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
    if (this.nId < 3) {
      this.mClip._rotation = random(360);
      Mycolor.dropShadow(this.mClip, { blurX: 8, blurY: 8, distance: 2 });
    }
    this.mClip.onRollOver = function () {
      _global.GAME.mClip?.mInfo?.setFrame('txt', {
        s_0: 'Toys : ' + _global.TXTCOLOR('00ccff', 'Happiness +' + Adorn.aPer[this.owner.nId]),
        s_1: '',
        s_2: 'Time remaining : ' + _global.TXTCOLOR('00ccff', this.owner.nTime * 0.1 + ' days'),
      });
    };
    this.mClip.onPress = function () {
      this.swapDepths(this._parent.getNextHighestDepth() - 1);
      this.startDrag(true, 0, 0, 640, 380);
    };
    this.mClip.onReleaseOutside = this.mClip.onRelease = function () {
      this.stopDrag();
      if (_root._xmouse < 200 && _root._ymouse < 70) {
        this._x = this.owner.vCurr.x;
        this._y = this.owner.vCurr.y;
      } else {
        this.owner.vCurr.setTo(this._x, this._y);
      }
      this.swapDepths(0);
    };
  }
  moveTime() {
    if (this.nTime > 0) {
      this.nTime = this.nTime - 1;
      return true;
    }
    this.remove();
    return false;
  }
  remove() {
    _global.GAME?.popWord('Your toy is broken!');
    this.mClip?.removeMovieClip();
    this.mClip = undefined;
    this.vCurr = undefined;
  }
}
