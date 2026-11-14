import { _global } from '../../engine/as2';
import { Vector } from './Vector';
import { Mycolor } from './Mycolor';
import { Adult } from './Adult';

export class Ico {
  [k: string]: any;
  constructor(x, y, _nId, _nSide, _nId_2, _c) {
    this.nId = _nId;
    this.nId_2 = _nId_2;
    this.nId_color = _c;
    this.vCurr = new Vector(x, y);
    this.nSide = _nSide;
  }
  setClip(_mClip) {
    this.mClip = _mClip;
    this.mClip.owner = this;
    this.mClip.gotoAndStop(this.nId + 1);
    if (this.nId < 15) {
      this.mClip.mc?.gotoAndStop(this.nId + 1);
      this.mClip.mc?.mHead?.gotoAndStop(this.nId + 1);
      this.mClip.mc?.mBoot?.gotoAndStop(this.mClip.mc?.mBoot?._totalframes);
    }
    this.moveClip();
    if (this.nId_color != undefined && this.nId < 15) {
      Mycolor.colorMatrix(this.mClip, Adult.aColor[this.nId_color]);
    }
    this.mClip.onRollOver = function () {
      _global.GAME.rtRollOver(this.owner);
    };
    this.mClip.onPress = function () {
      _global.GAME.rtClick(this.owner);
    };
  }
  moveClip() {
    if (!this.mClip) return; // port: AS2 ignora atribuições em clip inexistente
    this.mClip._x = this.vCurr.x;
    this.mClip._y = this.vCurr.y;
  }
  remove() {
    this.mClip?.removeMovieClip();
    this.mClip = undefined;
    this.vCurr = undefined;
  }
}
