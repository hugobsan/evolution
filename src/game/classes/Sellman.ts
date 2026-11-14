import { _global, _root, random, int, forIn } from '../../engine/as2';
import { Vector } from './Vector';
import { SFM } from './SFM';

export class Sellman {
  [k: string]: any;
  static aPoint = new Array([-40, 380], [320, 160], [540, 265], [680, 380]);
  constructor(_nId) {
    this.nSpeed = 3;
    this.nId = _nId;
    this.vCurr = new Vector();
    this.nFrame = random(4) + 2;
    this.aBuy_like = [];
    this.aSell_list = [];
    this.aSell_color = [];
    this.aSell_sex = [];
    let _loc3_;
    let _loc4_;
    let _loc5_;
    if (this.nId == 0) {
      this.aSell_list = [0, 1, 2, 3, 4, 15, 16, 17, 19, 20, 21, 22];
      this.aBuy_like = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      _loc3_ = 0;
      while (_loc3_ < 5) {
        this.aSell_color[_loc3_] = random(16);
        this.aSell_sex[_loc3_] = _global.GAME.ckSex();
        _loc3_ = _loc3_ + 1;
      }
      this.nDir = -1;
      this.vCurr.setTo(80, 260);
    } else {
      _loc4_ = SFM.rdm_a(1, 5, [20, 20, 10, 10, 5]);
      _loc3_ = 0;
      while (_loc3_ < _loc4_) {
        _loc5_ = SFM.rdm_a(5, 23, [80, 70, 60, 50, 40, 30, 20, 0, 0, 0, 0, 0, 0, 20, 0, 0, 0, 0, 30]);
        this.aSell_list[_loc3_] = _loc5_;
        this.aSell_color[_loc3_] = random(16);
        this.aSell_sex[_loc3_] = _global.GAME.ckSex();
        _loc3_ = _loc3_ + 1;
      }
      _loc3_ = 0;
      while (_loc3_ < 15) {
        this.aBuy_like[_loc3_] = SFM.rdm_2(0.5, 1.5);
        _loc3_ = _loc3_ + 1;
      }
      this.nDir = Math.random() <= 0.5 ? -1 : 1;
      this.aRoad = new Array();
      this.nTime = 0;
      _loc4_ = int(SFM.rdm_2(3, 7));
      _loc3_ = 0;
      while (_loc3_ < _loc4_) {
        if (_loc3_ == 0) {
          if (this.nDir > 0) {
            this.aRoad.push(this.pointOffset(Sellman.aPoint[3]));
          } else {
            this.aRoad.push(this.pointOffset(Sellman.aPoint[0]));
          }
        } else if (_loc3_ == _loc4_ - 2 && Math.random() > 0.7) {
          this.aRoad.push(this.pointOffset(Sellman.aPoint[2]));
        } else if (_loc3_ == _loc4_ - 1) {
          if (this.nDir > 0) {
            this.aRoad.push(this.pointOffset(Sellman.aPoint[0]));
          } else {
            this.aRoad.push(this.pointOffset(Sellman.aPoint[3]));
          }
        } else {
          this.aRoad[_loc3_] = [];
          this.aRoad[_loc3_][0] = SFM.rdm_2(40, 600);
          this.aRoad[_loc3_][1] = SFM.rdm_2(370 - SFM.linearCycle(this.aRoad[_loc3_][0], 560, 150), 370);
        }
        _loc3_ = _loc3_ + 1;
      }
      this.vCurr.setTo(this.aRoad[0][0], this.aRoad[0][1]);
    }
  }
  pointOffset(_a) {
    return [SFM.rdm_0(_a[0], 30), SFM.rdm_0(_a[1], 30)];
  }
  setClip(_mClip) {
    this.mClip = _mClip;
    this.mClip.owner = this;
    this.goto();
    this.moveClip();
    if (this.nId == 0) {
      this.addMouse();
      this.mClip.swapDepths(this.mClip._parent?.gui);
    }
  }
  addMouse() {
    if (!this.mClip) return; // port: AS2 ignora atribuições em clip inexistente
    this.mClip?.attachMovie('Word_2', 'Word_2', 0, { _y: -80, sTxt: 'I', _xscale: this.nDir * 100 });
    this.mClip.onPress = function () {
      if (this.owner.aSell_list.length > 0) {
        SFM.addClip('mPop', _root, { ob: this.owner, sFrame: 'BUY' });
        _global.GAME.pSell = this.owner;
      } else {
        _global.GAME.pSell = undefined;
        this.owner.removeMouse();
        this.owner.nTime = 0;
      }
    };
    if (this.nId == 0) {
      this.mClip.onRollOver = function () {
        _global.GAME.mClip?.mInfo?.setFrame('txt', {
          s_0: 'Shop Assistant : ' + _global.TXTCOLOR('00ccff', '5 basic bugs, food and toys.'),
          s_1: '',
          s_2: '',
        });
      };
    } else {
      this.mClip.onRollOver = function () {
        _global.GAME.mClip?.mInfo?.setFrame('txt', {
          s_0: 'Private Sellers : ' + _global.TXTCOLOR('00ccff', 'Some bugs or drug.'),
          s_1: '',
          s_2: '',
        });
      };
    }
  }
  addMouse_1(_n) {
    let _loc2_;
    switch (_n) {
      case 0:
        _loc2_ = 'J';
        break;
      case 1:
        _loc2_ = 'L';
        break;
      case 2:
        _loc2_ = 'K';
    }
    this.mClip?.attachMovie('Word_2', 'Word_2', 0, { _y: -80, sTxt: _loc2_, _xscale: this.nDir * 100 });
  }
  removeMouse() {
    this.mClip?.Word_2?.removeMovieClip();
    if (this.mClip) {
      delete this.mClip.onPress;
      delete this.mClip.onRollOver;
    }
  }
  move() {
    if (SFM.side_max(this.vCurr.x, this.vCurr.y, this.aRoad?.[0]?.[0], this.aRoad?.[0]?.[1]) < 2) {
      this.getNewRot();
    }
    if (this.aRoad?.length < 1 || this.aRoad == undefined) {
      this.remove();
      return false;
    }
    if (this.nTime == 0) {
      this.vCurr.plus(this.getSpeed_v());
      this.mClip?.play();
      this.moveClip();
      this.removeMouse();
    } else {
      this.nTime = this.nTime - 1;
    }
    return true;
  }
  getSpeed_v() {
    const _loc2_ = new Vector();
    _loc2_.polar(this.nRot, this.nSpeed);
    return _loc2_;
  }
  getNewRot() {
    this.nTime = int(SFM.rdm_2(30, 150));
    this.mClip?.gotoAndStop(1);
    let _loc2_;
    if (SFM.side_max(Sellman.aPoint[2][0], Sellman.aPoint[2][1], this.aRoad?.[0]?.[0], this.aRoad?.[0]?.[1]) < 30) {
      _loc2_ = this.buy();
      if (_loc2_) {
        this.addMouse_1(0);
      } else if (_loc2_ == undefined) {
        this.addMouse_1(1);
      } else {
        this.addMouse_1(2);
      }
    } else if (this.aSell_list.length > 0 && this.nTime > 120 && SFM.s_b(this.vCurr.x, 100, 540) == 0) {
      this.addMouse();
    }
    this.aRoad?.shift();
    this.nRot = Math.atan2(this.aRoad?.[0]?.[1] - this.vCurr.y, this.aRoad?.[0]?.[0] - this.vCurr.x);
    this.nDir = Math.abs(this.nRot) <= 1.57 ? -1 : 1;
  }
  buy() {
    let _loc3_;
    if (_global.GAME.aAdult_sell.length > 0) {
      for (const _loc4_ of forIn(_global.GAME.aAdult_sell)) {
        _loc3_ =
          this.aBuy_like[_global.GAME.aAdult_sell[_loc4_].nId] *
          (_global.DATA[21][_global.GAME.aAdult_sell[_loc4_].nId] + _global.GAME.aAdult_sell[_loc4_].nValue);
        if (_loc3_ > _global.GAME.aAdult_sell[_loc4_].nValue_c) {
          _global.GAME.aAdult_sell[_loc4_].selled();
          this.nTime = 20;
          if (this.mClip) this.mClip._xscale = -100;
          return true;
        }
      }
      return undefined;
    }
    return false;
  }
  moveClip() {
    let _loc2_;
    if (this.mClip?._x != undefined) {
      this.mClip._x = this.vCurr.x;
      this.mClip._y = this.vCurr.y;
      this.mClip._xscale = 100 * this.nDir;
      _loc2_ = int((this.vCurr.y - 100) * 800 + (this.vCurr.x + 100));
      this.mClip.swapDepths(_loc2_);
      if (this.mClip.getDepth() != _loc2_) {
        this.remove();
      }
    }
  }
  goto() {
    this.mClip?.mHead?.gotoAndStop(this.nFrame);
    this.mClip?.mArm_0?.gotoAndStop(this.nFrame);
    this.mClip?.mArm_1?.gotoAndStop(this.nFrame);
    this.mClip?.mBody?.gotoAndStop(this.nFrame);
    this.mClip?.mLeg_0?.gotoAndStop(this.nFrame);
    this.mClip?.mLeg_1?.gotoAndStop(this.nFrame);
  }
  remove() {
    this.mClip?.swapDepths(0);
    this.mClip?.removeMovieClip();
    this.mClip = undefined;
    this.vCurr = undefined;
    this.aRoad = undefined;
  }
}
