import { _global, _root, random, int, forIn } from '../../engine/as2';
import { Vector } from './Vector';
import { SFM } from './SFM';
import { Mycolor } from './Mycolor';

export class Adult {
  [k: string]: any;
  static aId = new Array([4,4],[4,3],[4,2],[4,1],[4,0],[3,3],[3,2],[3,1],[3,0],[2,2],[2,1],[2,0],[1,1],[1,0],[0,0]);
;
  static aColor = new Array([-1.37944996356964,2.40295004844666,0.226499825716019,0,-15.8749980926514,0.620549976825714,0.402949899435043,0.226500034332275,0,-15.8749990463257,0.620550096035004,2.4029495716095,-1.77349984645844,0,-15.8749980926514,0,0,0,1,0],[-1.43022680282593,1.82762169837952,0.852604806423187,0,-15.8749971389771,0.692676782608032,0.533090651035309,0.0242324136197567,0,-15.8749990463257,0.0565195865929127,2.80579876899719,-1.61231863498688,0,-15.8749961853027,0,0,0,1,0],[-1.28503143787384,1.14920711517334,1.38582408428192,0,-15.8749980926514,0.704722225666046,0.716285049915314,-0.171007409691811,0,-15.8749990463257,-0.490862786769867,2.98757982254028,-1.24671697616577,0,-15.8749990463257,0,0,0,1,0],[-0.961376905441284,0.449533700942993,1.76184296607971,0,-15.8749980926514,0.655233323574066,0.930436909198761,-0.335670351982117,0,-15.8749990463257,-0.955573916435242,2.92636609077454,-0.720792412757874,0,-15.8749961853027,0,0,0,1,0],[-0.49830037355423,-0.187008157372475,1.9353084564209,0,-15.875,0.550179123878479,1.14971661567688,-0.449895828962326,0,-15.8749990463257,-1.28156316280365,2.62954163551331,-0.0979787334799767,0,-15.8749971389771,0,0,0,1,0],[0.0483439490199089,-0.683641910552979,1.88529789447784,0,-15.875,0.402230888605118,1.34767556190491,-0.49990651011467,0,-15.875,-1.42951154708862,2.13290810585022,0.546603143215179,0,-15.8749971389771,0,0,0,1,0],[0.612623035907745,-0.980466187000275,1.61784315109253,0,-15.875,0.229233250021935,1.50043702125549,-0.479670375585556,0,-15.8749990463257,-1.38157391548157,1.49636626243591,1.13520753383636,0,-15.8749990463257,0,0,0,1,0],[1.1264762878418,-1.04167973995209,1.165203332901,0,-15.875,0.0520523115992546,1.58957576751709,-0.391628175973892,0,-15.8749990463257,-1.14353263378143,0.796692669391632,1.59683978557587,0,-15.8749980926514,0,0,0,1,0],[1.67413139343262,0.796692669391632,-1.22082412242889,0,-15.8749990463257,-0.315622210502625,1.22961473464966,0.336007356643677,0,-15.8749990463257,0.879962682723999,-1.04167973995209,1.41171705722809,0,-15.8750009536743,0,0,0,1,0],[1.35047674179077,1.49636626243591,-1.59684312343597,0,-15.8749990463257,-0.266133278608322,1.01546275615692,0.500670373439789,0,-15.8749980926514,1.34467399120331,-0.980466246604919,0.885792255401611,0,-15.8750009536743,0,0,0,1,0],[0.340755820274353,2.62954163551331,-1.72029769420624,0,-15.8749971389771,-0.013130895793438,0.598224222660065,0.66490650177002,0,-15.8749980926514,1.81861138343811,-0.187008142471313,-0.381603330373764,0,-15.8749990463257,0,0,0,1,0],[-0.223523288965225,2.92636609077454,-1.45284307003021,0,-15.8749961853027,0.159866750240326,0.445462793111801,0.644670307636261,0,-15.8749990463257,1.77067399024963,0.449533641338348,-0.970207691192627,0,-15.875,0,0,0,1,0],[-0.737376391887665,2.98757982254028,-1.00020337104797,0,-15.8749990463257,0.337047636508942,0.356324046850204,0.556628167629242,0,-15.8749990463257,1.53263258934021,1.14920711517334,-1.43183970451355,0,-15.875,0,0,0,1,0],[-1.13882577419281,2.80579876899719,-0.416973352432251,0,-15.8749961853027,0.497041344642639,0.341559499502182,0.411399066448212,0,-15.8749990463257,1.13319849967957,1.82762169837952,-1.71082031726837,0,-15.8749990463257,0,0,0,1,0],[-1.37944996356964,2.4029495716095,0.226500123739243,0,-15.8749971389771,0.620549976825714,0.402949929237366,0.226499915122986,0,-15.8749980926514,0.62054979801178,2.40295004844666,-1.77349984645844,0,-15.875,0,0,0,1,0],[0.887400209903717,2.13290810585022,-1.77030849456787,0,-15.8749980926514,-0.161079153418541,0.796183168888092,0.614895820617676,0,-15.8749980926514,1.67066323757172,-0.683641910552979,0.262978553771973,0,-15.875,0,0,0,1,0]);
;
  constructor(_nId, ob?) {
    this.nId = _nId;
    this.vCurr = new Vector(SFM.rdm_2(100, 540), SFM.rdm_2(100, 300));
    this.sNickName = 'Bug ' + (_global.GAME?.aAdult?.length + 1);
    this.nSex = _global.GAME?.ckSex();
    this.nRot = SFM.rdm_2(0, 3.14);
    this.nId_color = random(16);
    this.nRandom = Math.random();
    this.nAge_now = 0;
    this.nFed = 80;
    this.nHeart = 80;
    this.nHealth = 50;
    this.nGrow = 0;
    this.nSpeed = 0.3;
    this.bSex = false;
    this.nSex_time = 0;
    this.nDir = 0;
    this.bHit = false;
    this.nRot_2 = 0;
    for (const _loc4_ of forIn(ob)) {
      if (ob[_loc4_] != undefined) {
        this[_loc4_] = ob[_loc4_];
      }
    }
    this.vCurr = new Vector(this.vCurr.x, this.vCurr.y);
    this.setNum();
  }
  moveTime() {
    this.nAge_now = this.nAge_now + 1;
    this.nFed = SFM.formatNumber(this.nFed, -0.8, 0, 100);
    this.nHeart = SFM.formatNumber(this.nHeart, SFM.rdm_2(int(_global.GAME.nEnjoy), 1), 0, 100);
    this.nHealth = SFM.formatNumber(this.nHealth, (3 * this.nHeart + 5 * this.nFed) * 0.01 - 5, 0, 100);
    if (this.nAge_now < 1200) {
      this.nGrow += _global.DATA[this.nId][1] * this.nFed * this.nHeart * 0.0001;
    }
    this.setNum();
    if (this.nSex < 0 && this.bSex) {
      if (this.nAge_now - this.nSex_time > 300) {
        this.bSex = false;
      }
    }
    if (this.nHealth <= 0) {
      this.remove();
      return false;
    }
    if (this.nStatement != 8) {
      if (
        this.pFood != undefined ||
        (this.getHit_1(_global.GAME.mClip?.mGround?.mHit_1) && this.nFed < 90 && this.getFood_hit(_global.GAME.aFood))
      ) {
        if (this.nFed >= 95) {
          this.pFood = undefined;
        }
        this.nStatement = 2;
      } else if (this.nFed < 65) {
        this.nStatement = 3;
      } else if (this.nStatement == 5) {
        if (Math.random() > 0.85) {
          this.nStatement = 6;
        }
      } else if (this.nStatement == 6) {
        if (Math.random() > 0.85) {
          this.nStatement = 5;
        }
      } else if (Math.random() > 0.5) {
        this.nStatement = 5;
      } else {
        this.nStatement = 6;
      }
    }
    this.movementCase();
    return true;
  }
  movementCase() {
    let _loc4_;
    let _loc3_;
    switch (this.nStatement) {
      case 1:
        _loc4_ = this.sNickName != 'CPU ' ? _global.GAME.paBattle_2 : _global.GAME.paBattle;
        if (this.getEnemy(_loc4_)) {
          this.bBattle = true;
          this.randomAction(-1, 0.8, 0.5);
          this.nRot = this.sight(this.pTarget_enemy?.vCurr);
          if (this.pTarget_enemy) this.pTarget_enemy.nHp -= this.nPower;
        } else {
          this.walk(this.pTarget_enemy);
          this.bBattle = false;
        }
        return;
      case 2:
        this.mClip?.mBoot?.stop();
        _loc3_ = this.pFood?.eat?.(this.nId + 5 + this.nGrow * 0.1);
        if (_loc3_ == undefined) {
          this.pFood = undefined;
        } else {
          this.randomAction(-1, 0.8, 0.9);
          this.nFed = SFM.formatNumber(this.nFed, _loc3_[0], 0, 100);
          this.nHeart = SFM.formatNumber(this.nHeart, _loc3_[1], 0, 100);
          this.nHealth = SFM.formatNumber(this.nHealth, _loc3_[2], 0, 100);
          this.nGrow = SFM.formatNumber(this.nGrow, _loc3_[3], 0, 600);
          this.nRot = this.sight(this.pFood?.vCurr);
        }
        return;
      case 3:
        this.randomAction(0.9, 0.8, -1);
        this.walk(this.getFood_near(_global.GAME.aFood));
        return;
      case 5:
        this.randomAction(0.9, 0.8, -1);
        if (Math.random() > 0.99) {
          _global.GAME.addFeces(1, { vCurr: this.vCurr });
        }
        this.walk();
        return;
      case 6:
        this.randomAction(0.9, 0.8, 1);
        this.mClip?.mBoot?.stop();
        return;
      case 7:
        this.mClip?.mBoot?.gotoAndStop(this.mClip?.mBoot?._totalframes);
        return;
      case 8:
        return;
      default:
        return;
    }
  }
  setNum() {
    this.nValue = (this.nGrow + this.nRandom * 50) * (this.nId * 0.5 + 1);
    this.nHp = (_global.DATA[this.nId][3] + this.nGrow * 0.1) * this.nHealth * 0.01 + this.nRandom * 50;
    this.nPower = _global.DATA[this.nId][2] + this.nGrow * 0.1 + this.nRandom * 5;
    if (this.mClip) this.mClip._yscale = this.mClip._xscale = 10 + this.nGrow * 0.025 + this.nRandom;
    this.nSpeed = 0.3 + this.nGrow * 0.0005;
    this.nFly = this.nSpeed + _global.DATA[this.nId][4] + this.nRandom * 0.2;
  }
  randomAction(_n0, _n1, _n2) {
    Math.random() > _n0 && this.mClip?.mHead?.mY?.play();
    Math.random() > _n1 && this.mClip?.mBody?.play();
    Math.random() > _n2 && this.mClip?.mBoot?.play();
  }
  move() {
    switch (this.nStatement) {
      case 1:
        if (!this.bBattle) {
          if (!this.bHit) {
            this.vCurr.plus(this.getSpeed_v(this.nSpeed));
          }
          this.nRot = SFM.Rfloor(this.nRot + SFM.vpNum(-this.nDir, 0.03));
        }
        break;
      case 2:
        break;
      case 3:
        if (!this.bHit) {
          this.vCurr.plus(this.getSpeed_v(this.nSpeed));
        }
        this.nRot = SFM.Rfloor(this.nRot + SFM.vpNum(-this.nDir, 0.03));
        break;
      case 5:
        if (!this.bHit) {
          this.vCurr.plus(this.getSpeed_v(this.nSpeed));
        }
        this.nRot = SFM.Rfloor(this.nRot + SFM.vpNum(-this.nDir, 0.03));
        break;
      case 6:
        break;
      case 7:
        this.mClip?.mBody?.play();
        this.vCurr.plus(this.getSpeed_v(this.nFly + this.nRandom_speed));
        break;
      case 8:
    }
    if (this.nStatement != 8) {
      this.moveClip();
    }
    return true;
  }
  moveTime_battle() {
    if (this.nHp < 0) {
      this.mClip?.removeMovieClip();
      return false;
    }
    if (this.nStatement != 8) {
      this.nStatement = 1;
    }
    this.movementCase();
    return true;
  }
  moveTime_race() {
    if (this.nHp < 0) {
      this.mClip?.removeMovieClip();
      return false;
    }
    if (this.vCurr.x > 650) {
      this.mClip?.removeMovieClip();
      return false;
    }
    this.nRot = 0;
    if (this.nRandom_speed == undefined || Math.random() > 0.6) {
      _global.GAME.mClip?.mGround?.gotoAndStop(2);
      this.nRandom_speed = Math.random();
    }
    this.nStatement = 7;
    this.movementCase();
    return true;
  }
  getEnemy(_a) {
    let _loc4_ = 600;
    let _loc5_;
    let _loc2_;
    for (const _loc6_ of forIn(_a)) {
      if (_a[_loc6_]?.nStatement == 1) {
        _loc2_ = _a[_loc6_].vCurr.distance(this.vCurr);
        if (_loc2_ < _loc4_) {
          _loc4_ = _loc2_;
          _loc5_ = _loc6_;
        }
      }
    }
    this.pTarget_enemy = _a?.[_loc5_];
    if (
      _loc4_ <
      ((this.mClip?.mHead?.mHit_l?._x + 30) * this.mClip?._xscale) / 100 +
        ((this.pTarget_enemy?.mClip?.mHead?.mHit_l?._x + 30) * this.pTarget_enemy?.mClip?._xscale) / 100
    ) {
      return true;
    }
    return false;
  }
  walk(_v?) {
    const _loc3_ = this.getHit_2(_global.GAME.mClip?.mGround?.mHit_0);
    if (_loc3_ != 2) {
      this.nDir = _loc3_;
    } else {
      this.nDir = this.nDir == 0 ? (Math.random() <= 0.5 ? -1 : 1) : this.nDir;
    }
    let _loc4_;
    if (this.nDir != 0) {
      this.bHit = true;
    } else {
      this.bHit = false;
      if (_v != undefined) {
        _loc4_ = SFM.Rfloor(Math.atan2(_v.vCurr?.y - this.vCurr.y, _v.vCurr?.x - this.vCurr.x) - this.nRot);
        if (Math.abs(_loc4_) > 0.1) {
          this.nDir = SFM.vpNum(-_loc4_, 1);
        } else {
          this.nDir = 0;
        }
      } else {
        this.nRot_2 = 0;
      }
    }
    return true;
  }
  getSpeed_v(_n) {
    const _loc2_ = new Vector();
    _loc2_.polar(this.nRot, _n);
    return _loc2_;
  }
  sight(_v) {
    return SFM.Rfloor(Math.atan2(_v?.y - this.vCurr.y, _v?.x - this.vCurr.x));
  }
  getHit_2(mC) {
    let _loc3_ = 0;
    const _loc5_ = SFM.coordinateConvert(this.mClip?.mHead?.mHit_l, _root);
    const _loc4_ = SFM.coordinateConvert(this.mClip?.mHead?.mHit_r, _root);
    const _loc6_ = this.mClip?.mBoot?._currentframe;
    this.mClip?.gotoAndStop(this.mClip?._totalframes);
    if (mC?.hitTest(_loc5_.x, _loc5_.y, true)) {
      _loc3_ = -1;
    }
    if (mC?.hitTest(_loc4_.x, _loc4_.y, true)) {
      _loc3_ = _loc3_ != 0 ? 2 : 1;
    }
    this.mClip?.gotoAndStop(this.nId + 1);
    this.mClip?.mHead?.gotoAndStop(this.nId + 1);
    this.mClip?.mBoot?.gotoAndPlay(_loc6_);
    return _loc3_;
  }
  getHit_1(mC) {
    const _loc4_ = SFM.coordinateConvert(this.mClip?.mHead?.mHit_l, _root);
    const _loc3_ = SFM.coordinateConvert(this.mClip?.mHead?.mHit_r, _root);
    if (mC?.hitTest(_loc4_.x, _loc4_.y, true)) {
      return true;
    }
    if (mC?.hitTest(_loc3_.x, _loc3_.y, true)) {
      return true;
    }
    return false;
  }
  getFood_near(_a) {
    let _loc3_ = 600;
    let _loc5_;
    let _loc2_;
    for (const _loc6_ of forIn(_a)) {
      _loc2_ = _a[_loc6_].vCurr.distance(this.vCurr);
      if (_loc2_ < _loc3_) {
        _loc3_ = _loc2_;
        _loc5_ = _loc6_;
      }
    }
    return _a?.[_loc5_];
  }
  getFood_hit(_a): any {
    for (const _loc3_ of forIn(_a)) {
      if (this.getHit_1(_a[_loc3_].mClip)) {
        this.pFood = _a[_loc3_];
      }
    }
    return undefined;
  }
  funDrag_start() {
    this.mClip?.swapDepths(this.mClip?._parent?.getNextHighestDepth() - 1);
    this.mClip?.startDrag(true, 0, 0, 640, 380);
    this.nStatement = 8;
    this.pFood = undefined;
    this.pTarget_enemy = undefined;
    this.randomAction(-1, 0.8, -1);
  }
  funDrag_stop() {
    if (_root._xmouse < 200 && _root._ymouse < 70) {
      this.mClip._x = this.vCurr.x;
      this.mClip._y = this.vCurr.y;
    } else {
      this.vCurr.setTo(this.mClip._x, this.mClip._y);
    }
    this.mClip?.stopDrag();
    this.nStatement = 5;
    this.randomAction(1, 1, -1);
  }
  moveClip() {
    if (!this.mClip) return; // port: AS2 ignora atribuições em clip inexistente
    this.mClip._x = this.vCurr.x;
    this.mClip._y = this.vCurr.y;
    const _loc2_ = this.nRot * SFM.R_PI;
    this.mClip._rotation != _loc2_ && (this.mClip._rotation = _loc2_);
  }
  setClip(_mClip, _b?) {
    this.mClip = _mClip;
    this.mClip.owner = this;
    this.mClip.gotoAndStop(this.nId + 1);
    this.mClip.mHead?.gotoAndStop(this.nId + 1);
    Mycolor.colorMatrix(this.mClip, Adult.aColor[this.nId_color]);
    Mycolor.dropShadow(this.mClip, { blurX: 4, blurY: 4, distance: 2, strength: 0.5, quality: 0 });
    this.moveClip();
    this.setNum();
    this.nStatement = 5;
    this.mClip.onRollOver = function () {
      _global.GAME.mClip?.mInfo?.setFrame(_global.GAME.nScreen != 0 ? 'battle' : 'beetle', this.owner);
    };
    if (!_b) {
      this.mClip.onPress = function () {
        this.owner.funDrag_start();
      };
      this.mClip.onReleaseOutside = this.mClip.onRelease = function () {
        this.owner.funDrag_stop();
      };
    }
  }
  remove() {
    this.mClip?.removeMovieClip();
    this.mClip = undefined;
    this.vCurr = undefined;
  }
}
