export class Vector {
  [k: string]: any;
  constructor(px?, py?) {
    this.x = px == undefined ? 0 : px;
    this.y = py == undefined ? 0 : py;
  }
  polar(r, l) {
    this.x = l * Math.cos(r);
    this.y = l * Math.sin(r);
    return this;
  }
  setTo(px, py) {
    this.x = px;
    this.y = py;
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }
  cross(v) {
    return this.x * v.y - this.y * v.x;
  }
  plus(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  plusNew(v) {
    return new Vector(this.x + v.x, this.y + v.y);
  }
  minus(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  minusNew(v) {
    return new Vector(this.x - v.x, this.y - v.y);
  }
  mult(s) {
    this.x *= s;
    this.y *= s;
    return this;
  }
  multNew(s) {
    return new Vector(this.x * s, this.y * s);
  }
  distance(v) {
    const _loc3_ = this.x - v.x;
    const _loc2_ = this.y - v.y;
    return Math.sqrt(_loc3_ * _loc3_ + _loc2_ * _loc2_);
  }
  magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  normalize(n?) {
    n = n != undefined ? n : 1;
    const _loc3_ = Math.sqrt(this.x * this.x + this.y * this.y);
    this.x *= this.x == 0 ? 0 : n / _loc3_;
    this.y *= this.y == 0 ? 0 : n / _loc3_;
    return this;
  }
  vertical(n) {
    let _loc2_;
    if (n > 0) {
      _loc2_ = new Vector(-this.y, this.x);
    } else {
      _loc2_ = new Vector(this.y, -this.x);
    }
    return _loc2_.normalize(Math.abs(n));
  }
  unzero() {
    if (this.x != 0 && this.y != 0) {
      return true;
    }
    return false;
  }
  project(b) {
    const _loc5_ = this.dot(b);
    const _loc4_ = b.x * b.x + b.y * b.y;
    const _loc3_ = new Vector(0, 0);
    _loc3_.x = (_loc5_ / _loc4_) * b.x;
    _loc3_.y = (_loc5_ / _loc4_) * b.y;
    return _loc3_;
  }
  toString(b?) {
    const _loc2_ = '(x=' + this.x + ',y=' + this.y + ')';
    return _loc2_;
  }
}
