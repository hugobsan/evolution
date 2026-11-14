import { forIn, ColorMatrixFilter, DropShadowFilter } from '../../engine/as2';

export class Mycolor {
  [k: string]: any;
  constructor() {}
  static tempFilters(_m, _ob) {
    const _loc1_ = _m.filters;
    _loc1_.push(_ob);
    return _loc1_;
  }
  static colorMatrix(_m, _a) {
    _m.filters = Mycolor.tempFilters(_m, new ColorMatrixFilter(_a));
  }
  static dropShadow(_m, _ob) {
    const _loc3_ = _m.filters.length;
    const _loc2_ = _m.filters;
    _loc2_.push(new DropShadowFilter());
    for (const _loc4_ of forIn(_ob)) {
      _loc2_[_loc3_][_loc4_] = _ob[_loc4_];
    }
    _m.filters = _loc2_;
  }
}
