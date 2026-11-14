import { _global, _root, forIn } from '../../engine/as2';
import { SFM } from './SFM';

export class Adult_sell {
  [k: string]: any;
  constructor(_nValue_c, ob?) {
    this.nId = 0;
    this.sNickName = '';
    this.nAge_now = 0;
    this.nGrow = 0;
    this.nValue = 0;
    this.nId_color = 0;
    this.nSex = 0;
    this.nValue_c = _nValue_c;
    for (const _loc3_ of forIn(this)) {
      if (ob?.[_loc3_] != undefined) {
        this[_loc3_] = ob[_loc3_];
      }
    }
  }
  selled() {
    _global.GAME.setMoney(this.nValue_c);
    SFM.addClip('Word', _root, { sTxt: 'You sold ' + this.sNickName + ' for $ ' + this.nValue_c + ' !', nTime: 100, _x: 635, _y: 355 });
    this.remove();
  }
  remove() {
    this.sNickName = undefined;
    _global.GAME?.removeArray(_global.GAME?.aAdult_sell, this);
  }
}
