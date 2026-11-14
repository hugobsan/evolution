import { _global, _root, random, int } from '../../engine/as2';
import { Vector } from './Vector';
import { SFM } from './SFM';
import { addArenaBadge } from '../badges';

export class Battleman {
  [k: string]: any;
  constructor(x, y, _nId) {
    this.nId = _nId;
    this.vCurr = new Vector(x, y);
    this.aBug_have = [];
    this.aBug_age = [];
    this.aBug_color = [];
    this.aBug_random = [];
    let _loc3_;
    if (this.nId == 0) {
      this.nDir = -1;
      this.nFrame = 5;
      this.nBattle = 1;
      this.nDif = 1.1;
      _loc3_ = 0;
      while (_loc3_ < 3) {
        this.aBug_have[_loc3_] = _global.GAME.nLevel + _loc3_;
        this.aBug_age[_loc3_] = 1300;
        this.aBug_color[_loc3_] = random(16);
        this.aBug_random[_loc3_] = Math.random();
        _loc3_ = _loc3_ + 1;
      }
    } else {
      this.nFrame = random(4) + 2;
      this.nDir = Math.random() <= 0.5 ? -1 : 1;
      this.nBattle = Math.random() <= 0.5 ? -1 : 1;
      _loc3_ = 0;
      while (_loc3_ < 3) {
        this.aBug_have[_loc3_] = SFM.rdm_a(0, 14, [50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37, 36]);
        this.aBug_age[_loc3_] = int(SFM.rdm_2(600, 1400));
        this.aBug_color[_loc3_] = random(16);
        this.aBug_random[_loc3_] = Math.random();
        _loc3_ = _loc3_ + 1;
      }
      this.nDif = SFM.rdm_2(0.8, 1.6);
    }
  }
  setClip(_mClip) {
    this.mClip = _mClip;
    this.mClip.owner = this;
    this.moveClip();
    addArenaBadge(this.mClip, this.nBattle); // novo: ícone de luta/corrida sobre a cabeça
    if (this.nBattle == -1) {
      this.mClip.onRollOver = function () {
        _global.GAME.mClip?.mInfo?.setFrame('txt', { s_0: 'A competitor in the bug racing ring!', s_1: '', s_2: '' });
      };
      this.mClip.onPress = function () {
        _global.GAME.pSell = this.owner;
        SFM.addClip('mPop', _root, { sTxt: _global.GAME.getWin(), ob: this.owner, sFrame: 'RACE' });
      };
    } else {
      this.mClip.onRollOver = function () {
        _global.GAME.mClip?.mInfo?.setFrame('txt', { s_0: 'A competitor in the bug fighting ring!', s_1: '', s_2: '' });
      };
      this.mClip.onPress = function () {
        _global.GAME.pSell = this.owner;
        SFM.addClip('mPop', _root, { sTxt: _global.GAME.getWin(), ob: this.owner, sFrame: 'BATTLE' });
      };
    }
  }
  moveClip() {
    if (!this.mClip) return; // port: AS2 ignora atribuições em clip inexistente
    this.mClip._x = this.vCurr.x;
    this.mClip._y = this.vCurr.y;
    this.mClip._xscale = 100 * this.nDir;
    this.goto();
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
    this.mClip?.removeMovieClip();
    this.mClip = undefined;
    this.vCurr = undefined;
  }
}
