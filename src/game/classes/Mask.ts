import { _global, _root, BitmapData } from '../../engine/as2';

export class Mask {
  [k: string]: any;
  constructor(_nWidth, _nHeight, _mClip_mask_name) {
    this.nWidth = _nWidth;
    this.nHeight = _nHeight;
    this.bmpRoot = new BitmapData(this.nWidth, this.nHeight, false, 0);
    this.bmpRoot.draw(_root);
    this.mClip_mask = _root.attachMovie(_mClip_mask_name, 'mClip_mask', _root.getNextHighestDepth(), {
      _width: this.nWidth,
      _height: this.nHeight,
    });
    this.mClip_bmp = _root.createEmptyMovieClip('mClip_bmp', _root.getNextHighestDepth());
    this.mClip_bmp.attachBitmap(this.bmpRoot, 0);
    this.mClip_bmp.cacheAsBitmap = true;
    this.mClip_mask.owner = this;
    this.mClip_mask.ready = function () {
      this.owner.masknow();
    };
    this.mClip_mask.finish = function () {
      this.owner.remove();
    };
  }
  masknow() {
    this.mClip_bmp.setMask(this.mClip_mask);
    _global.ENABLED(true);
  }
  remove() {
    this.mClip_bmp?.removeMovieClip();
    this.mClip_mask?.removeMovieClip();
    this.bmpRoot.dispose();
    _global.ENABLED(false);
  }
}
