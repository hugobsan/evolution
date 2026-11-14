import { _global, _root, forIn, updateAfterEvent, isMovieClip, typeOfAS } from '../../engine/as2';

export class SFM {
  [k: string]: any;
  static R_PI = 57.29577951308232;
  constructor() {}
  static rdm_2(a, b) {
    return Math.random() * (b - a) + a;
  }
  static rdm_0(a, l) {
    return Math.round(a - Math.random() * l + l / 2);
  }
  static rdm_a(a1, a2, A) {
    let _loc3_ = 0;
    const _loc5_ = Math.random();
    let _loc4_ = 0;
    const _loc2_ = A.concat();
    let _loc1_;
    for (const _loc6_ of forIn(_loc2_)) {
      _loc1_ = 0;
      while (_loc1_ < Number(_loc6_)) {
        _loc2_[_loc6_] += _loc2_[_loc1_];
        _loc1_ = _loc1_ + 1;
      }
      _loc3_ < _loc2_[_loc6_] && (_loc3_ = _loc2_[_loc6_]);
      _loc2_[_loc6_] /= _loc3_;
      if (_loc5_ >= _loc2_[_loc6_]) {
        _loc4_ = Number(_loc6_) + 1;
        break;
      }
    }
    return a1 + (_loc4_ * (a2 - a1)) / (_loc2_.length - 1);
  }
  static formatNumber(_n, _d, _nMin, _nMax) {
    _n += _d;
    if (_n < _nMin) {
      _n = _nMin;
    } else if (_n > _nMax) {
      _n = _nMax;
    }
    return _n;
  }
  static distance(x0, y0, xt, yt) {
    return Math.sqrt(Math.pow(xt - x0, 2) + Math.pow(yt - y0, 2));
  }
  static side_min(x0, y0, xt, yt) {
    return Math.min(Math.abs(xt - x0), Math.abs(yt - y0));
  }
  static side_max(x0, y0, xt, yt) {
    return Math.max(Math.abs(xt - x0), Math.abs(yt - y0));
  }
  static Rfloor(r) {
    if (r >= 3.141592653589793) {
      r -= 6.283185307179586;
    }
    if (r <= -3.141592653589793) {
      r += 6.283185307179586;
    }
    return r;
  }
  static Rfloor_n(r) {
    if (r >= 180) {
      r -= 360;
    }
    if (r <= -180) {
      r += 360;
    }
    return r;
  }
  static s_b(n, a, b) {
    if (a < n && n < b) {
      return 0;
    }
    if (n <= a) {
      return -1;
    }
    return 1;
  }
  static vpNum(n, t?) {
    if (n == 0) {
      return 0;
    }
    if (n > 0) {
      return t == undefined ? 1 : t;
    }
    return t == undefined ? -1 : -t;
  }
  static formatTime(n) {
    let _loc3_;
    let _loc4_;
    let _loc2_;
    if (n < 60) {
      _loc4_ = _loc3_ = 0;
      _loc2_ = n;
    } else if (n < 3600) {
      _loc3_ = 0;
      _loc4_ = Math.floor(n / 60);
      _loc2_ = n % 60;
    } else {
      _loc3_ = Math.floor(n / 3600);
      _loc4_ = Math.floor(n / 60) % 60;
      _loc2_ = n % 60;
    }
    const _loc7_ = _loc3_ >= 10 ? _loc3_ : '0' + _loc3_;
    const _loc6_ = _loc4_ >= 10 ? _loc4_ : '0' + _loc4_;
    const _loc5_ = _loc2_ >= 10 ? _loc2_ : '0' + _loc2_;
    return _loc7_ + ':' + _loc6_ + ':' + _loc5_;
  }
  static format_n(n, l) {
    let _loc1_;
    let _loc3_;
    if (l != 0) {
      if (l > 0) {
      }
    }
    return _loc1_;
  }
  static nolinearCycle(x, T, r) {
    const _loc1_ = T / 2;
    const _loc2_ = -r / (_loc1_ * _loc1_);
    return _loc2_ * Math.pow((x % T) - _loc1_, 2) + r;
  }
  static linearCycle(x, T, r) {
    const _loc1_ = T / 2;
    if (x % T > _loc1_) {
      return (1 - (x % _loc1_) / _loc1_) * r;
    }
    if (x % T < _loc1_) {
      return ((x % _loc1_) / _loc1_) * r;
    }
    return r;
  }
  static coordinateConvert(mc1, mc2, x?, y?) {
    const _loc2_: any = { x: x == undefined ? 0 : x, y: y == undefined ? 0 : y };
    mc1?.localToGlobal(_loc2_);
    if (mc2 != undefined && mc2 != _root) {
      mc2.globalToLocal(_loc2_);
    }
    return _loc2_;
  }
  static addClip(sId, mC, oBject?, nDepth?) {
    if (nDepth == undefined) {
      nDepth = mC.getNextHighestDepth();
    }
    return mC.attachMovie(sId, sId + nDepth, nDepth, oBject);
  }
  static shield(_b, _m) {
    if (_b) {
      _m.createEmptyMovieClip('mEnabled', _m.getNextHighestDepth());
      _m.mEnabled.hitArea = _root;
      _m.mEnabled.enabled = false;
      _m.mEnabled.onPress = function () {};
    } else {
      if (_m.mEnabled) delete _m.mEnabled.onPress;
      _m.mEnabled?.removeMovieClip();
    }
    updateAfterEvent();
  }
  static parabolaRot(x0, y0, xt, yt, nV, nG) {
    const _loc5_ = xt - x0;
    const _loc7_ = yt - y0;
    const _loc2_ = (nG * _loc5_ * _loc5_) / (2 * nV * nV);
    const _loc1_ = _loc5_;
    const _loc6_ = _loc2_ - _loc7_;
    const _loc4_ = _loc1_ * _loc1_ - 4 * _loc2_ * _loc6_;
    if (_loc4_ < 0) {
      return undefined;
    }
    const _loc3_: any = {};
    if (_loc5_ > 0) {
      _loc3_.x1 = Math.atan((-_loc1_ - Math.sqrt(_loc4_)) / (2 * _loc2_));
      _loc3_.x2 = Math.atan((-_loc1_ + Math.sqrt(_loc4_)) / (2 * _loc2_));
    } else {
      _loc3_.x1 = Math.atan((-_loc1_ - Math.sqrt(_loc4_)) / (2 * _loc2_)) - 3.141592653589793;
      _loc3_.x2 = Math.atan((-_loc1_ + Math.sqrt(_loc4_)) / (2 * _loc2_)) - 3.141592653589793;
    }
    return _loc3_;
  }
  // port: sem Button/__constructor__/__proto__ em JS; cópia profunda estrutural (não usada no jogo)
  static deepObjectCopy(obj) {
    if (typeof obj != 'object' || obj === null || isMovieClip(obj) || typeOfAS(obj) == 'movieclip') {
      return obj;
    }
    const _loc3_: any = obj instanceof Array ? [] : {};
    for (const _loc4_ of forIn(obj)) {
      if (Object.prototype.hasOwnProperty.call(obj, _loc4_)) {
        _loc3_[_loc4_] = SFM.deepObjectCopy(obj[_loc4_]);
      }
    }
    return _loc3_;
  }
}
