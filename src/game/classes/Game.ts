import { _global, _root, random, int, forIn, setIntervalAS, clearIntervalAS } from '../../engine/as2';
import { getSyncSpeed } from '../syncSpeed';
import { SFM } from './SFM';
import { Adult } from './Adult';
import { Adult_sell } from './Adult_sell';
import { Adorn } from './Adorn';
import { Food } from './Food';
import { Feces } from './Feces';
import { Sellman } from './Sellman';
import { Battleman } from './Battleman';
import { buildFences } from '../fence';

export class Game {
   [k: string]: any;
   constructor(_mClip, ob?)
   {
      this.nMoney = 1000;
      this.nScore = 0;
      this.nTime = 0;
      this.nLevel = 0;
      this.bfinal = false;
      this.aAdult = new Array();
      this.aAdult_sell = new Array();
      this.aFood = new Array();
      this.aAdorn = new Array();
      this.aFeces = new Array();
      this.aFence = new Array(); // novo: cercas do insetário [[x1,y1,x2,y2]]; saves antigos não têm
      this.aBug_have = new Array();
      this.aFood_have = new Array(20,0,0,0);
      this.addAdult(0,{sNickName:"Adam",nSex:1});
      this.addAdult(1,{sNickName:"Hawaii",nSex:-1});
      for (const _loc3_ of forIn(ob) as any)
      {
         this[_loc3_] = ob[_loc3_];
      }
      this.mClip = _mClip;
      this.mClip.owner = this;
      for (const _loc3_ of forIn(this.aAdult) as any)
      {
         this.aAdult[_loc3_] = new Adult(undefined,this.aAdult[_loc3_]);
      }
      for (const _loc3_ of forIn(this.aAdult_sell) as any)
      {
         this.aAdult_sell[_loc3_] = new Adult_sell(undefined,this.aAdult_sell[_loc3_]);
      }
      for (const _loc3_ of forIn(this.aFood) as any)
      {
         this.aFood[_loc3_] = new Food(undefined,this.aFood[_loc3_]);
      }
      for (const _loc3_ of forIn(this.aAdorn) as any)
      {
         this.aAdorn[_loc3_] = new Adorn(undefined,this.aAdorn[_loc3_]);
      }
      for (const _loc3_ of forIn(this.aFeces) as any)
      {
         this.aFeces[_loc3_] = new Feces(undefined,this.aFeces[_loc3_]);
      }
      this.aSellman = new Array();
      this.nTime_score = 0;
      this.bHints = true;
      this.nInterval = 1000;
   }
   socreFun_0()
   {
      // port: fase offline, sem envio/popup de highscore; só calcula o score
      this.setscore();
   }
   setscore()
   {
      this.nScore = this.nMoney;
      for (const _loc3_ of forIn(this.aAdult) as any)
      {
         this.nScore += this.aAdult[_loc3_].nValue + _global.DATA[21][this.aAdult[_loc3_].nId];
      }
      this.nScore *= 0.1;
      this.nScore = int(this.nScore);
   }
   socreFun_1()
   {
      this.nTime_score = this.nTime;
   }
   getEnjoy()
   {
      let _loc2_ = 0;
      for (const _loc3_ of forIn(this.aAdorn) as any)
      {
         _loc2_ += Adorn.aPer[this.aAdorn[_loc3_].nId];
      }
      this.nEnjoy = SFM.formatNumber(_loc2_ - this.aFeces.length * 0.3 - this.aAdult.length * 0.7,0,-10,0.5);
   }
   static getBabychance(_n0, _n1)
   {
      return (_n0 * 10 + _n1 * 10 + 40) / 2;
   }
   static getBaby(_aM, _aF)
   {
      let _loc6_ = _aM[0] - _aF[0];
      let _loc5_ = _aM[1] - _aF[1];
      let _loc4_ = _aM[0] + _aF[0];
      let _loc3_ = _aM[1] + _aF[1];
      let _loc7_ = random(100);
      if(Math.abs(_loc6_) > 1 || Math.abs(_loc5_) > 1 || _loc7_ > Game.getBabychance(_aM[0],_aF[0]))
      {
         if(_aM[0] > _aF[0])
         {
            return _aM;
         }
         return _aF;
      }
      if(_loc6_ == 0)
      {
         if(_loc5_ == 0)
         {
            if(_aM[0] > _aF[0])
            {
               return _aM;
            }
            return _aF;
         }
         return [_loc4_ / 2 - 1,(_loc3_ - 1) / 2];
      }
      if(_loc3_ == 0 || _loc3_ == _loc4_)
      {
         if(_aM[0] > _aF[0])
         {
            return _aM;
         }
         return _aF;
      }
      if(_loc5_ == 0)
      {
         return [(_loc4_ - 1) / 2,_loc3_ / 2 - 1];
      }
      return [(_loc4_ - 1) / 2,(_loc3_ + 1) / 2];
   }
   setAge(_n)
   {
      return _n / 10 + " Days";
   }
   clearMandF()
   {
      this.pMale = undefined;
      this.pFemale = undefined;
   }
   clear_paBattle()
   {
      this.paBattle = new Array();
      this.paBattle_2 = new Array();
   }
   clear_paRace()
   {
      this.paRace = new Array();
      this.paRace_2 = new Array();
   }
   initial_0()
   {
      this.stop();
      for (const _loc2_ of forIn(this.aAdorn) as any)
      {
         this.aAdorn[_loc2_].setClip(SFM.addClip("mAdorn",this.mClip?.mGround?.mHit_0));
      }
      for (const _loc2_ of forIn(this.aAdult) as any)
      {
         this.aAdult[_loc2_].vCurr.x > 640 && this.aAdult[_loc2_].vCurr.setTo(SFM.rdm_2(100,540),SFM.rdm_2(100,300));
         this.aAdult[_loc2_].setClip(SFM.addClip("beetle",this.mClip?.mGround?.mHit_0));
      }
      for (const _loc2_ of forIn(this.aFood) as any)
      {
         this.aFood[_loc2_].setClip(SFM.addClip("mFood",this.mClip?.mGround?.mHit_1));
      }
      for (const _loc2_ of forIn(this.aFeces) as any)
      {
         this.aFeces[_loc2_].setClip(SFM.addClip("feces",this.mClip?.mGround?.mHit_1));
      }
      buildFences();
      if(this.nTime == 0)
      {
         SFM.addClip("mFirst",this.mClip);
         this.bHints = false;
         this.addFood(0);
         this.addFood(0);
      }
      else
      {
         this.bHints = true;
      }
      this.setMoney(0);
      this.nScreen = 0;
      this.start();
   }
   initial_1()
   {
      this.stop();
      let _loc2_ = new Battleman(200,200,0);
      _loc2_.setClip(SFM.addClip("mPeople",this.mClip?.mGround_1,null,_loc2_.vCurr.y * 10));
      let _loc4_ = SFM.rdm_a(5,10,[30,25,20,15,10,5]);
      let _loc3_ = 0;
      while(_loc3_ < _loc4_)
      {
         _loc2_ = new Battleman(SFM.rdm_2(100,540),SFM.rdm_2(200,340),1);
         _loc2_.setClip(SFM.addClip("mPeople",this.mClip?.mGround_1,null,_loc2_.vCurr.y * 10));
         _loc3_ = _loc3_ + 1;
      }
      this.nScreen = 1;
      this.start();
   }
   initial_2()
   {
      this.stop();
      let _loc3_ = new Sellman(0);
      _loc3_.setClip(SFM.addClip("mPeople",this.mClip?.mGround_2));
      for (const _loc2_ of forIn(this.aSellman) as any)
      {
         this.aSellman[_loc2_].setClip(SFM.addClip("mPeople",this.mClip?.mGround_2));
      }
      this.nScreen = 2;
      this.start();
   }
   initial_3()
   {
      this.stop();
      this.paJoin = this.paBattle.concat();
      for (const _loc4_ of forIn(this.paBattle) as any)
      {
         this.paBattle[_loc4_].vCurr.setTo(SFM.rdm_2(100,540),SFM.rdm_2(250,350));
         this.paBattle[_loc4_].nRot = -1.57;
         this.paBattle[_loc4_].setClip(SFM.addClip("beetle",this.mClip?.mGround?.mHit_0),true);
      }
      let _loc3_;
      let _loc2_;
      for (const _loc4_ of forIn(this.pSell.aBug_have) as any)
      {
         _loc3_ = this.pSell.aBug_have[_loc4_];
         _loc2_ = new Adult(_loc3_,this.getTempbug(_loc3_,this.pSell.aBug_age[_loc4_],this.pSell.nDif,this.pSell.aBug_color[_loc4_],this.pSell.aBug_random[_loc4_]));
         this.paBattle_2.push(_loc2_);
         _loc2_.vCurr.setTo(SFM.rdm_2(100,540),SFM.rdm_2(50,150));
         _loc2_.nRot = 1.57;
         _loc2_.setClip(SFM.addClip("beetle",this.mClip?.mGround?.mHit_0),true);
      }
      this.nScreen = 3;
      this.start();
   }
   initial_4()
   {
      this.stop();
      this.paJoin = this.paRace.concat();
      for (const _loc2_ of forIn(this.paRace) as any)
      {
         this.paRace[_loc2_].vCurr.setTo(50,240 + _loc2_ * 80);
         this.paRace[_loc2_].nRot = 0;
         this.paRace[_loc2_].nFed = 70;
         this.paRace[_loc2_].nDir = 0;
         this.paRace[_loc2_].setClip(SFM.addClip("beetle",this.mClip?.mGround?.mHit_0),true);
      }
      let _loc2_ = 0;
      let _loc4_;
      let _loc3_;
      while(_loc2_ < 2)
      {
         _loc4_ = this.pSell.aBug_have[_loc2_];
         _loc3_ = new Adult(_loc4_,this.getTempbug(_loc4_,this.pSell.aBug_age[_loc2_],this.pSell.nDif,this.pSell.aBug_color[_loc2_],this.pSell.aBug_random[_loc2_]));
         this.paRace_2.push(_loc3_);
         _loc3_.vCurr.setTo(50,80 + _loc2_ * 80);
         _loc3_.nRot = 0;
         _loc3_.setClip(SFM.addClip("beetle",this.mClip?.mGround?.mHit_0),true);
         _loc2_ = _loc2_ + 1;
      }
      this.nScreen = 4;
      this.start();
   }
   getWin()
   {
      let _loc2_ = 0;
      for (const _loc3_ of forIn(this.pSell.aBug_age) as any)
      {
         _loc2_ += this.pSell.aBug_age[_loc3_] * (this.pSell.aBug_have[_loc3_] + 1);
      }
      return int(_loc2_ * 0.1);
   }
   battleEnd()
   {
      let _loc5_;
      let _loc6_;
      if(this.paBattle.length < 1)
      {
         for (const _loc4_ of forIn(this.paJoin) as any)
         {
            this.paJoin[_loc4_].nFed = 50;
            this.paJoin[_loc4_].nHeart = 50;
            this.paJoin[_loc4_].nHealth = 50;
            this.paJoin[_loc4_].setNum();
         }
         _loc5_ = int(this.pSell.nMoney);
         this.setMoney(- _loc5_);
         _loc6_ = SFM.addClip("mPop",_root,{sTxt:"You lose!\nYou lost $ " + _loc5_ + "!",sFrame:"WARN"});
         _loc6_.rtFun = function()
         {
            _global.FADE();
            _global.GAME.mClip?.gotoAndStop("Pause_0");
         };
      }
      else if(this.paBattle_2.length < 1)
      {
         if(this.pSell.nId == 0 && this.nLevel != 12)
         {
            this.nLevel = this.nLevel + 1;
         }
         for (const _loc4_ of forIn(this.paJoin) as any)
         {
            this.paJoin[_loc4_].nHeart = SFM.formatNumber(this.paJoin[_loc4_].nHeart,-20,0,100);
            this.paJoin[_loc4_].nHealth = SFM.formatNumber(this.paJoin[_loc4_].nHealth,-20,40,100);
            this.paJoin[_loc4_].setNum();
         }
         _loc5_ = int(this.pSell.nMoney);
         this.setMoney(_loc5_);
         _loc6_ = SFM.addClip("mPop",_root,{sTxt:"You win!\nYou got $ " + _loc5_ + "!",sFrame:"WARN"});
         _loc6_.rtFun = function()
         {
            _global.FADE();
            _global.GAME.mClip?.gotoAndStop("Pause_0");
         };
      }
   }
   raceEnd()
   {
      let _loc5_;
      let _loc6_;
      if(this.paRace_2.length < 1)
      {
         for (const _loc4_ of forIn(this.paJoin) as any)
         {
            this.paJoin[_loc4_].nFed = 50;
            this.paJoin[_loc4_].nHeart = 50;
            this.paJoin[_loc4_].nHealth = 50;
            this.paJoin[_loc4_].setNum();
         }
         _loc5_ = int(this.pSell.nMoney) * this.paJoin.length;
         this.setMoney(- _loc5_);
         _loc6_ = SFM.addClip("mPop",_root,{sTxt:"You lose!\nYou lost $ " + _loc5_ + "!",sFrame:"WARN"});
         _loc6_.rtFun = function()
         {
            _global.FADE();
            _global.GAME.mClip?.gotoAndStop("Pause_0");
         };
      }
      else if(this.paRace.length < 1)
      {
         for (const _loc4_ of forIn(this.paJoin) as any)
         {
            this.paJoin[_loc4_].nHeart = SFM.formatNumber(this.paJoin[_loc4_].nHeart,-20,0,100);
            this.paJoin[_loc4_].nHealth = SFM.formatNumber(this.paJoin[_loc4_].nHealth,-20,40,100);
            this.paJoin[_loc4_].setNum();
         }
         _loc5_ = int(this.pSell.nMoney) * this.paJoin.length;
         this.setMoney(_loc5_);
         _loc6_ = SFM.addClip("mPop",_root,{sTxt:"You win!\nYou got $ " + _loc5_ + "!",sFrame:"WARN"});
         _loc6_.rtFun = function()
         {
            _global.FADE();
            _global.GAME.mClip?.gotoAndStop("Pause_0");
         };
      }
   }
   hints()
   {
      if(this.bHints)
      {
         if(this.nTime % 7 == 0)
         {
            if(this.aFood.length < 1)
            {
               if(Math.random() > 0.5)
               {
                  this.popWord("Give enough food for bugs or they will die!");
               }
               else
               {
                  this.popWord("Each food has different energy values!");
               }
            }
            else if(this.aFeces.length > 5)
            {
               this.popWord("Clean bug\'s poo!");
            }
            else if(this.nEnjoy < -1.5)
            {
               if(Math.random() > 0.6)
               {
                  this.popWord("You need to keep bugs happy or they will die!");
               }
               else if(Math.random() > 0.3)
               {
                  this.popWord("Buy enough toys for bugs!");
               }
               else
               {
                  this.popWord("Some food can make bugs happy!");
               }
            }
         }
      }
   }
   getTempbug(_nId, _nAge, _nDif, _c, _r?)
   {
      // port: _r = aBug_random do competidor, para os atributos reais baterem com os do painel
      return {nAge_now:_nAge,nGrow:_nAge * _global.DATA[_nId][1] * _nDif,sNickName:"CPU ",nId_color:_c,nRandom:_r};
   }
   popWord(_s)
   {
      SFM.addClip("Word",_root,{sTxt:_s,nTime:100,_x:635,_y:355});
   }
   rtRollOver(_Ico)
   {
      let _loc5_;
      let _loc4_;
      let _loc9_;
      let _loc7_;
      let _loc8_;
      let _loc6_;
      if(this.nScreen == 0)
      {
         if(this.sorb == 1)
         {
            if(_Ico.nSide == 1)
            {
               this.mClip?.mInfo?.setFrame("sell",this.aAdult_sell[_Ico.nId_2]);
            }
            else
            {
               this.mClip?.mInfo?.setFrame("beetle",this.aAdult[_Ico.nId_2]);
            }
         }
         else
         {
            this.mClip?.mInfo?.setFrame("beetle",this.aAdult[_Ico.nId_2]);
         }
      }
      else if(this.nScreen == 1)
      {
         if(_Ico.nSide == 0)
         {
            this.mClip?.mInfo?.setFrame("battle",this.aAdult[_Ico.nId_2]);
         }
         else
         {
            _loc5_ = this.pSell.aBug_age[_Ico.nId_2];
            _loc4_ = _loc5_ * _global.DATA[_Ico.nId][1] * this.pSell.nDif;
            // port: o original exibia um HP diferente do usado (DATA3 + g×0,01) e os besouros da CPU corriam/lutavam
            // com outro aleatório. Agora o painel usa a mesma conta de Adult.setNum (nHealth padrão 50) e o mesmo
            // aBug_random que getTempbug passa para a corrida/luta.
            _loc6_ = this.pSell.aBug_random[_Ico.nId_2];
            _loc9_ = (_global.DATA[_Ico.nId][3] + _loc4_ * 0.1) * 50 * 0.01 + _loc6_ * 50;
            _loc7_ = 0.3 + _loc4_ * 0.0005 + _global.DATA[_Ico.nId][4] + _loc6_ * 0.2;
            _loc8_ = _global.DATA[_Ico.nId][2] + _loc4_ * 0.1 + _loc6_ * 5;
            _loc6_ = {sNickName:"CPU ",nAge_now:_loc5_,nHp:_loc9_,nFly:_loc7_,nPower:_loc8_,nGrow:_loc4_,nRandom:_loc6_};
            this.mClip?.mInfo?.setFrame("battle",_loc6_);
         }
      }
      else if(this.nScreen == 2)
      {
         if(_Ico.nSide == 0)
         {
            this.mClip?.mInfo?.setFrame("sell",{sNickName:this.aAdult[_Ico.nId_2].sNickName,nAge_now:this.aAdult[_Ico.nId_2].nAge_now,nSex:this.aAdult[_Ico.nId_2].nSex,nValue_c:int(this.pSell.aBuy_like[_Ico.nId] * _global.DATA[21][_Ico.nId] + this.aAdult[_Ico.nId_2].nValue)});
         }
         else if(_Ico.nId < 15)
         {
            this.mClip?.mInfo?.setFrame("sell",{sNickName:"No Name",nAge_now:0,nSex:this.pSell.aSell_sex[_Ico.nId_2],nValue_c:int(_global.DATA[21][_Ico.nId] * (1 + _Ico.nId / 10))});
         }
         else if(_Ico.nId < 19)
         {
            this.mClip?.mInfo?.setFrame("txt",{s_0:_global.DATA[20][(_Ico.nId - 15) * 2],s_1:_global.DATA[20][(_Ico.nId - 15) * 2 + 1],s_2:"Price : $ " + _global.TXTCOLOR("00ccff",_global.DATA[21][_Ico.nId])});
         }
         else
         {
            this.mClip?.mInfo?.setFrame("txt",{s_0:"Toys : " + _global.TXTCOLOR("00ccff","Happiness +" + Adorn.aPer[_Ico.nId - 19]),s_1:"",s_2:"Price : $ " + _global.TXTCOLOR("00ccff",_global.DATA[21][_Ico.nId])});
         }
      }
   }
   rtClick(_Ico)
   {
      let _loc6_;
      let _loc5_;
      let _loc4_;
      if(this.nScreen == 0)
      {
         if(this.sorb == 1)
         {
            if(_Ico.nSide == 0)
            {
               if(this.aAdult[_Ico.nId_2].nAge_now < 150)
               {
                  this.popWord("The bug is not old enough to sell!");
               }
               else
               {
                  _loc6_ = SFM.addClip("mPop",_root,{sTxt:" Put the bug to \n sell list ? ",nNum:_global.DATA[21][_Ico.nId],sFrame:"MONEY"});
                  _loc6_._Ico = _Ico;
                  _loc6_.rtFun = function(_n)
                  {
                     _global.GAME.aAdult_sell.push(new Adult_sell(_n,_global.GAME.aAdult[this._Ico.nId_2]));
                     _global.GAME.aAdult[this._Ico.nId_2].remove();
                     _global.GAME.popWord("You put " + _global.GAME.aAdult[this._Ico.nId_2].sNickName + " on the sell list!");
                     _global.GAME.removeArray(_global.GAME.aAdult,_global.GAME.aAdult[this._Ico.nId_2]);
                     this._Ico.owner.reset();
                  };
               }
            }
            else
            {
               _loc6_ = SFM.addClip("mPop",_root,{sTxt:" Change the bug\'s price \nor remove it from sell list? ",nNum:this.aAdult_sell[_Ico.nId_2].nValue_c,sFrame:"MONEY2"});
               _loc6_._Ico = _Ico;
               _loc6_.rtFun = function(_n)
               {
                  if(_n == undefined)
                  {
                     if(_global.GAME.aAdult.length != 12)
                     {
                        _global.GAME.addAdult(this._Ico.nId,_global.GAME.aAdult_sell[this._Ico.nId_2],true);
                        _global.GAME.aAdult_sell[this._Ico.nId_2].remove();
                        this._Ico.owner.reset();
                     }
                     else
                     {
                        this.popWord("Only 12 bugs you can fed!");
                     }
                  }
                  else
                  {
                     _global.GAME.aAdult_sell[this._Ico.nId_2].nValue_c = _n;
                  }
               };
            }
         }
         else if(this.sorb == 0)
         {
            _loc5_ = SFM.s_b(this.aAdult[_Ico.nId_2].nAge_now,300,3000);
            if(this.aAdult[_Ico.nId_2].nSex <= 0 ? _loc5_ == 0 : _loc5_ >= 0)
            {
               if(_Ico.nSide == 0)
               {
                  if(this.pMale == undefined)
                  {
                     this.pMale = _Ico;
                     _Ico.mClip._x = _Ico.owner.mM._x;
                     _Ico.mClip._y = _Ico.owner.mM._y;
                  }
                  else if(_Ico.mClip._x != _Ico.vCurr.x)
                  {
                     _Ico.moveClip();
                     this.pMale = undefined;
                  }
                  else
                  {
                     this.pMale.moveClip();
                     this.pMale = _Ico;
                     _Ico.mClip._x = _Ico.owner.mM._x;
                     _Ico.mClip._y = _Ico.owner.mM._y;
                  }
               }
               else if(this.pFemale == undefined)
               {
                  if(this.aAdult[_Ico.nId_2].bSex)
                  {
                     this.popWord("Female bug can only breed again in " + (this.aAdult[_Ico.nId_2].nSex_time + 300 - this.aAdult[_Ico.nId_2].nAge_now) * 0.1 + " days!");
                  }
                  else
                  {
                     this.pFemale = _Ico;
                     _Ico.mClip._x = _Ico.owner.mF._x;
                     _Ico.mClip._y = _Ico.owner.mF._y;
                  }
               }
               else if(_Ico.mClip._x != _Ico.vCurr.x)
               {
                  _Ico.moveClip();
                  this.pFemale = undefined;
               }
               else if(this.aAdult[_Ico.nId_2].bSex)
               {
                  this.popWord("Female bug can only breed again in " + (this.aAdult[_Ico.nId_2].nSex_time + 300 - this.aAdult[_Ico.nId_2].nAge_now) * 0.1 + " days!");
               }
               else
               {
                  this.pFemale.moveClip();
                  this.pFemale = _Ico;
                  _Ico.mClip._x = _Ico.owner.mF._x;
                  _Ico.mClip._y = _Ico.owner.mF._y;
               }
            }
            else if(_loc5_ < 0)
            {
               this.popWord("The bug is not old enough to breed!");
            }
            else
            {
               this.popWord("The bug is too old enough to breed!");
            }
         }
         else if(this.sorb == 2)
         {
            _loc6_ = SFM.addClip("mPop",_root,{sTxt:" New name !",sTxt_2:this.aAdult[_Ico.nId_2].sNickName,sFrame:"RENAME"});
            _loc6_._Ico = _Ico;
            _loc6_.rtFun = function(_s)
            {
               if(_s.length > 0)
               {
                  _global.GAME.aAdult[this._Ico.nId_2].sNickName = _s;
                  return true;
               }
               this.popWord("Enter a name please!");
               return false;
            };
         }
      }
      else if(this.nScreen == 1)
      {
         if(_Ico.nSide == 0)
         {
            if(this.pSell.nBattle == -1)
            {
               if(_Ico.vCurr.x == _Ico.mClip._x)
               {
                  if(this.aAdult[_Ico.nId_2].nHeart > 50)
                  {
                     _loc4_ = 0;
                     while(_loc4_ < 2)
                     {
                        if(this.paRace[_loc4_] == undefined)
                        {
                           this.paRace[_loc4_] = this.aAdult[_Ico.nId_2];
                           _Ico.mClip._x = _Ico.owner["mC_" + _loc4_]?._x;
                           _Ico.mClip._y = _Ico.owner["mC_" + _loc4_]?._y;
                           break;
                        }
                        _loc4_ = _loc4_ + 1;
                     }
                  }
                  else
                  {
                     this.popWord("The bug is unhappy!");
                  }
               }
               else
               {
                  _loc4_ = 0;
                  while(_loc4_ < 3)
                  {
                     if(_Ico.mClip._y == _Ico.owner["mC_" + _loc4_]?._y)
                     {
                        this.paRace[_loc4_] = undefined;
                        break;
                     }
                     _loc4_ = _loc4_ + 1;
                  }
                  _Ico.moveClip();
               }
            }
            else if(_Ico.vCurr.x == _Ico.mClip._x)
            {
               if(this.aAdult[_Ico.nId_2].nHeart > 50)
               {
                  _loc4_ = 0;
                  while(_loc4_ < 3)
                  {
                     if(this.paBattle[_loc4_] == undefined)
                     {
                        this.paBattle[_loc4_] = this.aAdult[_Ico.nId_2];
                        _Ico.mClip._x = _Ico.owner["mC_" + _loc4_]?._x;
                        _Ico.mClip._y = _Ico.owner["mC_" + _loc4_]?._y;
                        break;
                     }
                     _loc4_ = _loc4_ + 1;
                  }
               }
               else
               {
                  this.popWord("The bug is unhappy!");
               }
            }
            else
            {
               _loc4_ = 0;
               while(_loc4_ < 3)
               {
                  if(_Ico.mClip._y == _Ico.owner["mC_" + _loc4_]?._y)
                  {
                     this.paBattle[_loc4_] = undefined;
                     break;
                  }
                  _loc4_ = _loc4_ + 1;
               }
               _Ico.moveClip();
            }
         }
      }
      else if(this.nScreen == 2)
      {
         if(_Ico.nSide == 0)
         {
            _loc6_ = SFM.addClip("mPop",_root,{sTxt:"Sell IT ?",sFrame:"Y_N"});
            _loc6_._Ico = _Ico;
            _loc6_.rtFun = function(_b)
            {
               let _loc3_;
               if(_b)
               {
                  _loc3_ = int(_global.GAME.pSell.aBuy_like[this._Ico.nId] * _global.DATA[21][this._Ico.nId] + _global.GAME.aAdult[this._Ico.nId_2].nValue);
                  _global.GAME.setMoney(_loc3_);
                  _global.GAME.popWord("You sold " + _global.GAME.aAdult[this._Ico.nId_2].sNickName + " for $ " + _loc3_ + "!");
                  _global.GAME.aAdult[this._Ico.nId_2].remove();
                  _global.GAME.aAdult.splice(this._Ico.nId_2,1);
                  _Ico.owner.reset();
               }
            };
         }
         else if(this.nMoney >= _global.DATA[21][_Ico.nId])
         {
            if(_Ico.nId < 15)
            {
               _loc5_ = int(_global.DATA[21][_Ico.nId] * (1 + _Ico.nId / 10));
               if(this.aAdult.length == 12)
               {
                  this.popWord("Only 12 bugs you can fed!");
               }
               else if(this.nMoney >= _loc5_)
               {
                  _loc6_ = SFM.addClip("mPop",_root,{sTxt:"Buy the bug ?",sFrame:"Y_N"});
                  _loc6_._Ico = _Ico;
                  _loc6_.rtFun = function(_b)
                  {
                     let _loc3_;
                     if(_b)
                     {
                        _loc3_ = int(_global.DATA[21][this._Ico.nId] * (1 + this._Ico.nId / 10));
                        _global.GAME.addAdult(this._Ico.nId,{nId_color:_global.GAME.pSell.aSell_color[this._Ico.nId_2],nSex:_global.GAME.pSell.aSell_sex[this._Ico.nId_2]});
                        _global.GAME.setMoney(- _loc3_);
                        _global.GAME.popWord("You bought a bug with $ " + _loc3_ + "!");
                        _global.GAME.pSell.aSell_list.splice(this._Ico.nId_2,1);
                        _global.GAME.pSell.aSell_color.splice(this._Ico.nId_2,1);
                        _global.GAME.pSell.aSell_sex.splice(this._Ico.nId_2,1);
                        this._Ico.owner.reset();
                     }
                  };
               }
               else
               {
                  this.popWord("You don\'t have enough money!");
               }
            }
            else if(_Ico.nId < 19)
            {
               _loc6_ = SFM.addClip("mPop",_root,{nNum:5,sFrame:"FOOD"});
               _loc6_._Ico = _Ico;
               _loc6_.rtFun = function(_n)
               {
                  if(_global.DATA[21][this._Ico.nId] * _n > _global.GAME.nMoney)
                  {
                     _global.GAME.popWord("You don\'t have enough money!");
                     return false;
                  }
                  let _loc3_ = int(_global.DATA[21][this._Ico.nId] * _n);
                  _global.GAME.setMoney(- _loc3_);
                  _global.GAME.popWord("You bought some food with $ " + _loc3_ + "!");
                  _global.GAME.aFood_have[this._Ico.nId - 15] += _n;
                  return true;
               };
            }
            else if(this.aAdorn.length < 3)
            {
               _loc6_ = SFM.addClip("mPop",_root,{sTxt:"BUY IT ?",sFrame:"Y_N"});
               _loc6_._Ico = _Ico;
               _loc6_.rtFun = function(_b)
               {
                  let _loc3_;
                  if(_b)
                  {
                     _loc3_ = int(_global.DATA[21][this._Ico.nId]);
                     _global.GAME.aAdorn.push(new Adorn(this._Ico.nId - 19));
                     _global.GAME.setMoney(- _loc3_);
                     _global.GAME.popWord("You bought a toy with $ " + _loc3_ + "!");
                  }
               };
            }
            else
            {
               this.popWord("You have too many toys!");
            }
         }
         else
         {
            this.popWord("You don\'t have enough money!");
         }
      }
   }
   ckBattle(_n)
   {
      for (const _loc2_ of forIn(this.paBattle) as any)
      {
         if(this.paBattle[_loc2_] == undefined)
         {
            this.paBattle.splice(Number(_loc2_),1);
         }
      }
      if(this.paBattle.length < 1)
      {
         this.popWord("Please select at least one bug!");
         return false;
      }
      if(_n > this.getWin())
      {
         this.popWord("Bet too high!");
         return false;
      }
      if(_n > this.nMoney)
      {
         this.popWord("Not enough money to bet this amount!");
         return false;
      }
      this.pSell.nMoney = _n;
      return true;
   }
   ckRace(_n)
   {
      for (const _loc2_ of forIn(this.paRace) as any)
      {
         if(this.paRace[_loc2_] == undefined)
         {
            this.paRace.splice(Number(_loc2_),1);
         }
      }
      if(this.paRace.length < 1)
      {
         this.popWord("Please select at least one bug!");
         return false;
      }
      if(_n > this.getWin())
      {
         this.popWord("Bet too high!");
         return false;
      }
      if(_n > this.nMoney)
      {
         this.popWord("Not enough money to bet this amount!");
         return false;
      }
      this.pSell.nMoney = _n;
      return true;
   }
   ckSex()
   {
      let _loc2_ = Math.random() <= 0.5 ? -1 : 1;
      let _loc3_ = 0;
      for (const _loc4_ of forIn(this.aAdult) as any)
      {
         if(this.aAdult[_loc4_].nSex == _loc2_)
         {
            _loc3_ = _loc3_ + 1;
            if(_loc3_ > 5)
            {
               _loc2_ = - _loc2_;
            }
         }
      }
      return _loc2_;
   }
   ckBreed()
   {
      let _loc4_;
      let _loc5_;
      let _loc3_;
      if(this.aAdult.length != 12)
      {
         if(this.pMale == undefined || this.pFemale == undefined)
         {
            this.popWord("Please select a male bug and a female bug!");
            return false;
         }
         this.aAdult[this.pFemale.nId_2].bSex = true;
         this.aAdult[this.pFemale.nId_2].nSex_time = this.aAdult[this.pFemale.nId_2].nAge_now;
         _loc4_ = Game.getBaby(Adult.aId[this.pMale.nId],Adult.aId[this.pFemale.nId]);
         for (const _loc3_ of forIn(Adult.aId) as any)
         {
            if(Adult.aId[_loc3_][0] == _loc4_[0] && Adult.aId[_loc3_][1] == _loc4_[1])
            {
               this.addAdult(int(_loc3_),undefined,true);
               break;
            }
         }
         _loc5_ = SFM.rdm_a(0,2,[9,3,1]);
         if(this.aAdult.length < 9 && _loc5_ != 0)
         {
            _loc3_ = 0;
            while(_loc3_ < _loc5_)
            {
               this.addAdult(random(5),undefined,true);
               _loc3_ = _loc3_ + 1;
            }
            SFM.addClip("mPop",_root,{sTxt:"Bug babies!",nNum:_loc5_ + 1,sFrame:"BABY"});
            this.popWord("New bugs born!");
            this.sorb = -1;
            return true;
         }
         SFM.addClip("mPop",_root,{sTxt:"Bug baby!",nNum:1,sFrame:"BABY"});
         this.popWord("New bug born!");
         this.sorb = -1;
         return true;
      }
      this.popWord("Only 12 bugs you can fed!");
   }
   finalWin()
   {
      if(this.bfinal == false && this.aBug_have[14])
      {
         this.setscore();
         this.mClip?.mBar?.goto("Win");
         this.bfinal = undefined;
      }
   }
   setMoney(_n)
   {
      this.nMoney = int(SFM.formatNumber(this.nMoney,_n,0,6666666));
      if(this.mClip?.zMoney)
      {
         this.mClip.zMoney.sTxt = this.nMoney;
      }
   }
   addAdult(_n, ob?, _b?)
   {
      let _loc2_ = new Adult(_n,ob);
      this.aAdult.push(_loc2_);
      if(_b)
      {
         _loc2_.setClip(SFM.addClip("beetle",this.mClip?.mGround?.mHit_0));
      }
      if(!this.aBug_have[_n])
      {
         this.aBug_have[_n] = true;
      }
   }
   addFood(_n)
   {
      let _loc2_;
      if(this.aFood.length > 19)
      {
         this.popWord("There is too much food on the ground!");
      }
      else
      {
         if(this.aFood_have[_n] == 0)
         {
            this.popWord("Not available!");
            return false;
         }
         _loc2_ = new Food(_n);
         this.aFood.push(_loc2_);
         _loc2_.setClip(SFM.addClip("mFood",this.mClip?.mGround?.mHit_1));
         this.aFood_have[_n]--;
      }
      return true;
   }
   addFeces(_n, ob)
   {
      let _loc2_ = new Feces(_n,ob);
      this.aFeces.push(_loc2_);
      _loc2_.setClip(SFM.addClip("feces",this.mClip?.mGround?.mHit_1));
   }
   addSallman(_b)
   {
      let _loc2_ = new Sellman(2);
      this.aSellman.push(_loc2_);
      if(_b)
      {
         _loc2_.setClip(SFM.addClip("mPeople",this.mClip?.mGround_2));
      }
   }
   timeRun()
   {
      this.nTime = this.nTime + 1;
      this.mClip?.mInfo?.setFrame(this.mClip?.mInfo?.sFrame,this.mClip?.mInfo?.ob_0);
      if(this.nScreen == 0)
      {
         this.forinFun(this.aAdorn,"moveTime");
         this.forinFun(this.aAdult,"moveTime");
      }
   }
   run()
   {
      this.nTime_th >= 500 ? (this.nTime_th = 0) : this.nTime_th++;
      switch(this.nScreen)
      {
         case 0:
            if(this.nTime_th % 30 == 0)
            {
               this.getEnjoy();
               this.hints();
               this.addSallman(false);
            }
            this.forinFun(this.aAdult,"move");
            this.forinFun(this.aSellman,"move");
            return;
         case 1:
            return;
         case 2:
            if(this.nTime_th % 90 == 0)
            {
               this.addSallman(true);
            }
            this.forinFun(this.aSellman,"move");
            return;
         case 3:
            if(this.nTime_th % 30 == 0)
            {
               this.forinFun(this.paBattle,"moveTime_battle");
               this.forinFun(this.paBattle_2,"moveTime_battle");
               this.battleEnd();
            }
            this.forinFun(this.paBattle,"move");
            this.forinFun(this.paBattle_2,"move");
            return;
         case 4:
            if(this.nTime_th % 30 == 0)
            {
               this.forinFun(this.paRace,"moveTime_race");
               this.forinFun(this.paRace_2,"moveTime_race");
               this.raceEnd();
            }
            this.forinFun(this.paRace,"move");
            this.forinFun(this.paRace_2,"move");
            return;
         default:
            return;
      }
   }
   start()
   {
      clearIntervalAS(this.nTime_id);
      this.nTime_id = setIntervalAS(this,"timeRun",this.nInterval);
      this.mClip.onEnterFrame = function()
      {
         // port: opção "sincronizar insetos" — no terrário (nScreen 0) roda o loop `speed` vezes por frame
         // (movimento, nTime_th, getEnjoy/hints e colisões escalam juntos). Luta/corrida/loja: como no original.
         let _n = getSyncSpeed() && this.owner.nScreen == 0 ? Math.max(1, Math.round(1000 / this.owner.nInterval)) : 1;
         if (this.owner.nScreen == 4) _n = this.owner.nRaceBoost || 1; // novo: botão de acelerar a corrida
         for (let _i = 0; _i < _n; _i++) this.owner.run();
      };
   }
   stop()
   {
      this.nTime_th = 0;
      clearIntervalAS(this.nTime_id);
      delete this.mClip.onEnterFrame;
   }
   removeArray(_a, _ai)
   {
      let _loc2_;
      for (const _k of forIn(_a) as any)
      {
         _loc2_ = _k;
         if(_a[_loc2_] == _ai)
         {
            _a.splice(int(_loc2_),1);
            return -1;
         }
      }
      return _loc2_ != undefined ? 1 : 0;
   }
   forinFun(_a, _s)
   {
      let _loc2_;
      for (const _k of forIn(_a) as any)
      {
         _loc2_ = _k;
         if(!_a[_loc2_][_s]())
         {
            _a.splice(int(_loc2_),1);
            return -1;
         }
      }
      return _loc2_ != undefined ? 1 : 0;
   }
}
