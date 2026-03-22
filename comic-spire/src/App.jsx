import { useState, useEffect, useCallback, useMemo, useRef, useReducer } from "react";
import { createAudioSystem } from "./audio";

/* ═══════════════════════════════════════════════════════
   COMIC SPIRE v9 — POTENTIAL MAN
   Fixed: charge persist, panel sizes, cross-synergies,
   keyword tooltips, thorough debug
   ═══════════════════════════════════════════════════════ */

// CSV data loaded dynamically from file (see useEffect below)
const FALLBACK_CSV=`Name,Power,Strength,Magic,Intelligence,Speed,Defense,Poison,Rage,Favorite_Color,isVillain
Fallback Hero,40,40,40,40,40,40,20,30,0x666666,False`;


function parseCSV(raw){const ls=raw.trim().split('\n'),hd=ls[0].split(',').map(h=>h.trim());return ls.slice(1).map(l=>{const v=l.split(',').map(s=>s.trim()),o={};hd.forEach((h,i)=>o[h]=v[i]||'');return o;})}
const $=v=>parseInt(v,10)||0,clr=h=>'#'+(h||'888').replace('0x','').padStart(6,'0');
const uid=()=>Math.random().toString(36).slice(2,10),pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v)),shuffle=a=>[...a].sort(()=>Math.random()-0.5);
const SK=['Power','Strength','Magic','Intelligence','Speed','Defense','Poison','Rage'];

const ROWS=2,COLS=2;
const TOTAL_PANELS=ROWS*COLS;

function panelSpanForCard(card){
  // Use the card's shape definition as the source of truth for panel span
  if(card.shape&&SHAPES[card.shape])return SHAPES[card.shape].length;
  const energyCost=card.keyword==='blood'?1:Math.max(1,card.cost||1);
  if(energyCost>=4)return 4;
  if(energyCost>=2)return 2;
  return 1;
}

function panelIdx(r,c){
  return r*COLS+c;
}

function idxToPos(i){
  return { r:Math.floor(i/COLS), c:i%COLS };
}

function getIntentVisibility(speed){
  return clamp(1+Math.floor((speed||0)/30),1,4);
}

function cardToIntent(card,en){
  const hits=card.hits||1;
  const str=$(en.Strength||0),pow=$(en.Power||0),mag=$(en.Magic||0);
  const intel=$(en.Intelligence||0),def=$(en.Defense||0),poi=$(en.Poison||0);
  const atkMult=1+(str*0.003+pow*0.002);
  const magMult=1+(mag*0.003+intel*0.002);
  const defMult=1+def*0.004;
  const poiMult=1+poi*0.005;
  switch(card.type){
    case 'attack':case 'rage':{
      if(card.keyword==='shieldbash')return{...card,intent:'shieldbash',intentVal:Math.max(0,en.block||0)};
      if(card.keyword==='catalyze')return{...card,intent:'catalyze',intentVal:en.poisonStacks||0};
      const val=Math.max(1,Math.floor(card.value*atkMult))*hits;
      return{...card,intent:'attack',intentVal:val};
    }
    case 'magic':{
      const val=Math.max(1,Math.floor(card.value*magMult));
      if(card.keyword==='channel'||card.keyword==='overchannel')return{...card,intent:'channel',intentVal:val};
      return{...card,intent:'magic',intentVal:val};
    }
    case 'defend':return{...card,intent:'defend',intentVal:Math.max(1,Math.floor(card.value*defMult))};
    case 'poison':{
      const val=Math.max(1,Math.floor(card.value*poiMult));
      if(card.keyword==='corrode'||card.keyword==='overchannel')return{...card,intent:'corrode',intentVal:val};
      return{...card,intent:'poison',intentVal:val};
    }
    case 'heal':return{...card,intent:'heal',intentVal:Math.max(1,Math.floor(card.value*defMult))};
    default:return{...card,intent:'buff',intentVal:Math.floor((en.atk||3)*0.15)+1};
  }
}
function makeEnemyPlan(en){
  if(!en.deck||en.deck.length===0)return Array.from({length:TOTAL_PANELS},()=>rollIntent(en));
  const shuffled=shuffle([...en.deck]);
  const planCards=[];
  while(planCards.length<TOTAL_PANELS)planCards.push(...shuffled.slice(0,TOTAL_PANELS-planCards.length));
  return planCards.slice(0,TOTAL_PANELS).map(card=>cardToIntent(card,en));
}

// ═══ KEYWORD DEFINITIONS (shown on hover) ═══
const KW_INFO={
  combo:{name:'COMBO',color:'#ff4455',desc:'Each COMBO card played this turn adds +2 damage to the next COMBO card.'},
  channel:{name:'CHANNEL',color:'#bb55ff',desc:'Stacks magic damage. Releases at end of turn. Pierces ALL block and applies Weaken.'},
  momentum:{name:'MOMENTUM',color:'#33ddff',desc:'Each card played adds +1. At 3: ONE free card.'},
  fortify:{name:'FORTIFY',color:'#4499ff',desc:'50% of your Block carries over to next turn.'},
  corrode:{name:'CORRODE',color:'#44dd66',desc:'Poison that NEVER decays. Stacks permanently.'},
  blood:{name:'BLOOD',color:'#ff7722',desc:'Costs HP instead of energy. High-risk, high-reward strikes.'},
  charge:{name:'CHARGE',color:'#ffaa33',desc:'Doesn\'t resolve this turn. Fires NEXT turn at +50% power.'},
  echo:{name:'ECHO',color:'#dd88ff',desc:'When resolved, copies the PREVIOUS card\'s effect at 50%.'},
  shieldbash:{name:'SHIELD BASH',color:'#55aaff',desc:'Deals damage equal to your current Block.'},
  catalyze:{name:'CATALYZE',color:'#88ff44',desc:'Deals instant damage equal to enemy\'s total Poison.'},
  overchannel:{name:'OVERCHANNEL',color:'#aa44dd',desc:'Channels damage AND applies Corrode poison.'},
  frenzy:{name:'FRENZY',color:'#ff55aa',desc:'Costs 0 energy but takes 2 panel slots.'},
};

const ATTR_INFO=[
  {key:'Strength',icon:'💪',color:'#ff5544',desc:'Base 40. +2 atk per 12 pts above 40'},
  {key:'Magic',icon:'✨',color:'#bb55ff',desc:'Base 40. +2 magic per 12 pts above 40'},
  {key:'Defense',icon:'🛡️',color:'#4499ff',desc:'Base 40. +1 def stat; +2 block per 12 pts'},
  {key:'Speed',icon:'⚡',color:'#33ddff',desc:'Base 40. +1 draw card per 6 pts above 40'},
  {key:'Vitality',icon:'❤️',color:'#ff4466',desc:'+8 max HP per pt (no base stat)'},
  {key:'Poison',icon:'☠️',color:'#44dd66',desc:'Base 40. +2 poison stacks per 12 pts'},
  {key:'Rage',icon:'🔥',color:'#ff7722',desc:'Base 40. +2 rage dmg; -1 blood cost per 12 pts'},
  {key:'Power',icon:'⭐',color:'#ffd700',desc:'Base 40. +1% crit per 6 pts above 40'},
];

// Panel shape definitions: array of [row_offset, col_offset] from placement point
const SHAPES={
  s1:[[0,0]],          // 1 slot
  h2:[[0,0],[0,1]],    // 2 horizontal
  v2:[[0,0],[1,0]],    // 2 vertical
  h3:[[0,0],[0,1],[0,2]],// full row (3 horizontal)
  l2:[[0,0],[1,0],[0,1]],// L-shape
};

// ═══ SIGNATURES with varied shapes and cross-synergy keywords ═══
function getSignature(hero){
  const stats={};SK.forEach(k=>stats[k]=$(hero[k]));
  const sorted=Object.entries(stats).sort((a,b)=>b[1]-a[1]);
  const[best,bestVal]=sorted[0];
  const[second]=sorted[1];
  const threat=sorted[0][1]+sorted[1][1]+sorted[2][1];
  const tier=threat>=260?3:threat>=220?2:1;
  const baseVal=clamp(5+tier*3+Math.floor(bestVal*0.05),6,17);

  // Determine keyword: primary from best stat, sometimes cross-synergy from second stat
  let kw,type,desc,shape,hits=1,debuff=0,bloodCost=0,isCharge=false;
  const val=baseVal;

  // Cross-synergy: 30% chance to get a hybrid keyword based on top 2 stats
  const crossRoll=Math.random();
  const secondStat=second?second[0]:'Power';

  if(crossRoll<0.2&&best==='Defense'&&['Power','Strength'].includes(secondStat)){
    kw='shieldbash';type='attack';desc=`SHIELD BASH: Deal dmg = your Block`;shape=tier>=3?'h3':tier>=2?'h2':'s1';
  }else if(crossRoll<0.2&&best==='Poison'&&['Power','Strength'].includes(secondStat)){
    kw='catalyze';type='attack';desc=`CATALYZE: Deal dmg = enemy Poison`;shape=tier>=3?'h3':'h2';
  }else if(crossRoll<0.2&&['Magic','Intelligence'].includes(best)&&best==='Magic'&&secondStat==='Poison'){
    kw='overchannel';type='magic';desc=`OVERCHANNEL ${val}: channels + corrodes ${Math.ceil(val*0.4)}`;shape=tier>=2?'h2':'s1';
  }else if(crossRoll<0.15&&['Speed'].includes(best)){
    kw='frenzy';type='attack';desc=`FRENZY: Deal ${val}×2 (costs 0⚡, takes 2 slots)`;shape='h2';hits=2;
  }else if(crossRoll<0.15&&['Intelligence'].includes(best)){
    kw='echo';type='magic';desc=`ECHO: copies previous card at 50%`;shape='s1';
  }else if(tier>=2&&Math.random()<0.25){
    // Charge variant
    isCharge=true;const cv=Math.floor(val*1.5);
    if(['Power','Strength'].includes(best)){kw='combo';type='attack';desc=`⏳CHARGE: Deal ${cv}. COMBO +3`;shape=tier>=3?'h3':'h2';}
    else if(['Magic','Intelligence'].includes(best)){kw='channel';type='magic';desc=`⏳CHARGE: CHANNEL ${cv} + Weaken`;shape=tier>=3?'h3':'h2';debuff=2;}
    else if(best==='Defense'){kw='fortify';type='defend';desc=`⏳CHARGE: Gain ${cv} Block. FORTIFY`;shape='v2';}
    else if(best==='Poison'){kw='corrode';type='poison';desc=`⏳CHARGE: CORRODE ${Math.ceil(cv*0.6)}`;shape='h2';}
    else if(best==='Speed'){kw='momentum';type='attack';desc=`⏳CHARGE: Deal ${cv}×2. MOMENTUM`;shape='h2';hits=2;}
    else{kw='blood';type='rage';desc=`⏳CHARGE: Deal ${cv}. BLOOD 5HP. 2× low`;shape='h2';bloodCost=5;}
  }else{
    // Standard signatures
    if(['Power','Strength'].includes(best)){kw='combo';type='attack';desc=`Deal ${val}. COMBO +3/atk`;shape=tier>=3?'h3':tier>=2?'h2':'s1';}
    else if(['Magic','Intelligence'].includes(best)){kw='channel';type='magic';desc=`CHANNEL ${val}: burst EOT, Weaken`;shape=tier>=3?'v2':tier>=2?'h2':'s1';debuff=2;}
    else if(best==='Speed'){kw='momentum';type='attack';desc=`Deal ${val}×2. MOMENTUM`;shape=tier>=2?'h2':'s1';hits=2;}
    else if(best==='Defense'){kw='fortify';type='defend';desc=`Gain ${val} Block. FORTIFY`;shape=tier>=2?'v2':'s1';}
    else if(best==='Poison'){kw='corrode';type='poison';desc=`CORRODE ${Math.ceil(val*0.6)}`;shape=tier>=2?'h2':'s1';}
    else{kw='blood';type='rage';desc=`Deal ${val}. BLOOD 5HP. 2× low`;shape=tier>=2?'h2':'s1';bloodCost=5;}
  }

  const chargeVal=isCharge?Math.floor(val*1.5):val;
  const kwInfo=KW_INFO[kw]||KW_INFO.combo;

  return{id:uid(),name:`${hero.Name}'s ${kwInfo.name}`,desc,type,icon:kwInfo.color==='#ff4455'?'💥':kwInfo.color==='#bb55ff'?'✨':kwInfo.color==='#33ddff'?'⚡':kwInfo.color==='#4499ff'?'🛡️':kwInfo.color==='#44dd66'?'☠️':kwInfo.color==='#ff7722'?'🔥':kwInfo.color==='#dd88ff'?'🪞':kwInfo.color==='#55aaff'?'🏰':kwInfo.color==='#88ff44'?'💀':kwInfo.color==='#aa44dd'?'🌀':'⚔️',
    value:isCharge?chargeVal:val,cost:kw==='blood'?0:kw==='frenzy'?0:(tier>=3?2:1),
    shape,panelSize:SHAPES[shape]?.length||1,hits,debuff,keyword:kw,bloodCost,charge:isCharge,
    heroName:hero.Name,color:clr(hero.Favorite_Color),isVillain:hero.isVillain==='True',
    tier,copiedFrom:hero.Name,bestStat:best,bestStatVal:bestVal,threat,archetype:kwInfo.name};
}

function makeStarterDeck(){
  const mk=(nm,d,t,ic,v,kw='',cost=1)=>({id:uid(),name:nm,desc:d,type:t,icon:ic,value:v,cost,shape:'s1',panelSize:1,hits:1,debuff:0,keyword:kw,bloodCost:0,charge:false,heroName:'Potential Man',color:'#888',tier:0,copiedFrom:null,threat:0,bestStat:null,archetype:''});
  return[
    mk('Punch','Deal 4','attack','👊',4),mk('Punch','Deal 4','attack','👊',4),mk('Punch','Deal 4','attack','👊',4),mk('Punch','Deal 4','attack','👊',4),mk('Punch','Deal 4','attack','👊',4),
    mk('Guard','Gain 4 Block','defend','🤲',4),mk('Guard','Gain 4 Block','defend','🤲',4),mk('Guard','Gain 4 Block','defend','🤲',4),mk('Guard','Gain 4 Block','defend','🤲',4),mk('Guard','Gain 4 Block','defend','🤲',4),
    mk('Spark','Deal 3 magic (30% pierces block)','magic','✨',3),mk('Spark','Deal 3 magic (30% pierces block)','magic','✨',3),
    mk('Adapt','Heal 4','heal','🔄',4),mk('Adapt','Heal 4','heal','🔄',4),
    mk('Rally','Draw 2 extra superpowers next turn','draw','📖',2)];
}

function makeEnemy(hero,floor,isBoss,isElite,ngPlus=0){
  const stats={};SK.forEach(k=>stats[k]=$(hero[k]));const sorted=Object.values(stats).sort((a,b)=>b-a);
  const threat=sorted[0]+sorted[1]+sorted[2];
  // Classify based on threat vs floor-scaled thresholds — strong enemies in normal slots become sub-elite
  const normalCeiling=135+floor*6;
  const effectiveClass=isBoss?'boss':isElite?'elite':threat>normalCeiling*1.45?'elite':threat>normalCeiling*1.8?'boss':'normal';
  // Floor-relative multiplier: elite is always 20% harder than normal, boss 40%; early floors get a soft nerf
  const baseM=1+floor*0.1;
  const earlyFactor=floor<3?0.65+floor*0.12:1.0;// floor0=0.65, floor1=0.77, floor2=0.89, floor3+=1.0
  const typeM=effectiveClass==='boss'?1.4:effectiveClass==='elite'?1.2:1.0;
  const ngM=1+(ngPlus||0)*0.35;// NG+: +35% scaling per ascension
  const m=baseM*typeM*earlyFactor*ngM;
  const hp=Math.floor((28+stats.Defense*0.25+stats.Strength*0.08)*m);
  return{...hero,gameHp:hp,gameMaxHp:hp,block:0,poisonStacks:0,corrodeStacks:0,weakened:0,
    atk:Math.floor(3+(stats.Strength*0.07+stats.Power*0.05)*m+floor*0.4),
    mag:Math.floor(2+(stats.Magic*0.06+stats.Intelligence*0.04)*m+floor*0.3),
    def:Math.floor(stats.Defense*0.12*m+2),speed:stats.Speed,color:clr(hero.Favorite_Color),floor,
    isBoss:effectiveClass==='boss',isElite:effectiveClass==='elite',effectiveClass,threat,
    intent:null,intentVal:0,signature:getSignature(hero),deck:makeEnemyDeck(hero,floor)};
}
// ═══ ENEMY DECK — archetype-themed card pools ═══
function makeEnemyDeck(hero,floor){
  const stats={};SK.forEach(k=>stats[k]=$(hero[k]));
  const sorted=Object.entries(stats).sort((a,b)=>b[1]-a[1]);
  const best=sorted[0][0];
  const hn=hero.Name,hc=clr(hero.Favorite_Color);
  // Early floors get softened card values; later floors scale up normally
  const earlyCardScale=floor<3?0.6+floor*0.13:1.0;// floor0=0.6, floor1=0.73, floor2=0.86, floor3+=1.0
  const s=n=>Math.max(1,Math.floor(n*earlyCardScale*(1+floor*0.08)));
  // mk: name, desc, type, icon, baseVal, keyword='', cost=1, hits=1, charge=false, bloodCost=0
  const mk=(nm,d,t,ic,val,kw='',cost=1,hits=1,ch=false,bc=0)=>({
    id:uid(),name:nm,desc:d,type:t,icon:ic,value:s(val),cost,shape:'s1',panelSize:1,
    hits,debuff:0,keyword:kw,bloodCost:bc,charge:ch,
    heroName:hn,color:hc,tier:1,copiedFrom:hn,threat:0,bestStat:best,archetype:best});

  const sig=getSignature(hero);// always include the signature card in the deck pool

  if(['Power','Strength'].includes(best))return[sig,
    mk('Heavy Strike','Deal 8. COMBO +3 per hit','attack','💥',8,'combo'),
    mk('Haymaker','Deal 12. COMBO +3','attack','👊',12,'combo'),
    mk('War Cry','Deal 5, hits twice','attack','⚔️',5,'combo',1,2),
    mk('Body Slam','Deal 10','attack','💢',10),
    mk('Iron Will','Gain 8 Block','defend','🛡️',8),
    mk('Shield Counter','Deal dmg = your Block. SHIELD BASH','attack','🏰',8,'shieldbash'),
    mk('Berserker','Deal 12. BLOOD 5HP. 2× when low','rage','🔥',12,'blood',0,1,false,5),
    mk('Charged Haymaker','⏳ Deal 20 next turn','attack','⚡',20,'combo',1,1,true)];

  if(best==='Magic')return[sig,
    mk('Mind Blast','CHANNEL 10: bursts EOT, pierces ALL block','magic','✨',10,'channel'),
    mk('Psychic Wave','CHANNEL 15: bursts EOT + Weaken','magic','🌀',15,'channel'),
    mk('Laser Burst','Deal 8 magic (40% pierces block)','magic','🔮',8),
    mk('Reality Warp','ECHO: copies previous card at 50%','magic','🪞',3,'echo'),
    mk('Arcane Shield','Gain 7 Block. FORTIFY 50% carries','defend','🔷',7,'fortify'),
    mk('Focused Beam','⏳ CHANNEL 22 next turn. Full pierce','magic','⚡',22,'channel',1,1,true),
    mk('Overchannel','OVERCHANNEL 10: channels + corrodes 4','magic','🌀',10,'overchannel'),
    mk('Solar Ray','Deal 7 magic laser (40% pierces)','magic','☀️',7)];

  if(best==='Intelligence')return[sig,
    mk('Aerial Strike','Deal 6 from above, then draw 1 next turn','attack','🦅',6),
    mk('Wind Slash','Deal 5, hits twice. Aerial agility','attack','💨',5,'momentum',1,2),
    mk('Healing Wind','Heal 8 HP','heal','🌿',8),
    mk('Tactical Read','Draw 2 extra superpowers next turn','draw','📖',2),
    mk('Air Shield','Gain 8 Block. FORTIFY','defend','🌪️',8,'fortify'),
    mk('Dive Bomb','⏳ Deal 16 next turn. Fly-by strike','attack','🦅',16,'',1,1,true),
    mk('Stratosphere','CHANNEL 10: altitude beam, full pierce','magic','☁️',10,'channel'),
    mk('Recovery','Heal 6 HP + draw 1 next turn','heal','💚',6)];

  if(best==='Speed')return[sig,
    mk('Blitz','Deal 7×2. FRENZY. Free, 2 slots','attack','⚡',7,'frenzy',0,2),
    mk('Rapid Jabs','Deal 4, hits 3 times. COMBO','attack','👊',4,'combo',1,3),
    mk('Dash Strike','Deal 10. MOMENTUM +1','attack','💨',10,'momentum'),
    mk('Phase Shift','Gain 6 Block. MOMENTUM +1','defend','💨',6,'momentum'),
    mk('Afterburn','Deal 8. COMBO +3','attack','🔥',8,'combo'),
    mk('Lightning Reflexes','Gain 8 Block','defend','🛡️',8),
    mk('Overdrive','⏳ Deal 16×2 next turn. MOMENTUM','attack','⚡',16,'momentum',1,2,true),
    mk('Speed Blitz','Deal 5. FRENZY. Free','attack','💥',5,'frenzy',0,1)];

  if(best==='Defense')return[sig,
    mk('Iron Wall','Gain 10 Block. FORTIFY 50% carries','defend','🏰',10,'fortify'),
    mk('Fortress Mode','Gain 12 Block. FORTIFY','defend','🛡️',12,'fortify'),
    mk('Shield Slam','Deal dmg = your Block. SHIELD BASH','attack','🏰',10,'shieldbash'),
    mk('Bulwark','Gain 8 Block','defend','🔷',8),
    mk('Counter Bash','Deal Block+5. SHIELD BASH','attack','🏰',12,'shieldbash'),
    mk('Barrier','Gain 6 Block. FORTIFY','defend','🔵',6,'fortify'),
    mk('Titan Guard','⏳ Gain 20 Block next turn. FORTIFY','defend','⚡',20,'fortify',1,1,true),
    mk('Reactive Armor','Gain 8 Block. +2 Block per card played','defend','🛡️',8)];

  if(best==='Poison')return[sig,
    mk('Toxic Bite','CORRODE +5 permanent poison','poison','☠️',5,'corrode'),
    mk('Venom Spit','Poison +8','poison','🐍',8),
    mk('Plague Cloud','CORRODE +4 permanent','poison','☠️',4,'corrode'),
    mk('Acid Splash','Deal 5 + Poison +4','attack','🧪',5),
    mk('Catalyze','CATALYZE: deal dmg = enemy Poison stacks','attack','💀',0,'catalyze'),
    mk('Toxic Shield','Gain 6 Block','defend','🛡️',6),
    mk('Overchannel Venom','OVERCHANNEL 6: channels + corrodes 2','magic','🌀',6,'overchannel'),
    mk('Corrosive Burst','⏳ CORRODE +10 next turn','poison','☠️',10,'corrode',1,1,true)];

  // Rage / default archetype
  return[sig,
    mk('Blood Frenzy','Deal 12. BLOOD 5HP. 2× when low','rage','🔥',12,'blood',0,1,false,5),
    mk('Desperate Strike','Deal 16. BLOOD 8HP. 2× when low','rage','💢',16,'blood',0,1,false,8),
    mk('Rage Combo','Deal 8. COMBO +3','attack','😤',8,'combo'),
    mk('Battle Roar','Gain 6 Block','defend','😤',6),
    mk('Wild Swing','Deal 10×2. FRENZY. Free','attack','💢',10,'frenzy',0,2),
    mk('Pain to Power','Deal 10. BLOOD 3HP','rage','🔥',10,'blood',0,1,false,3),
    mk('Berserker Charge','⏳ Deal 20. BLOOD 5HP next turn','rage','⚡',20,'blood',1,1,true,5),
    mk('Fury Strike','Deal 6. COMBO +3','attack','💥',6,'combo')];}

function rollIntent(en){const r=Math.random(),ac=0.45+$(en.Rage)/300;
  if(r<ac)return{intent:'attack',intentVal:Math.max(1,en.atk-(en.weakened||0))+Math.floor(Math.random()*3)};
  if(r<ac+0.2)return{intent:'magic',intentVal:Math.max(1,en.mag)+Math.floor(Math.random()*3)};
  if(r<ac+0.35)return{intent:'defend',intentVal:en.def+Math.floor(Math.random()*3)};
  return{intent:'buff',intentVal:Math.floor(en.atk*0.2)+2};}
function pickEnemy(heroes,floor,isBoss,isElite,evilness=50,ngPlus=0){
  // Heroes fight villains; villains fight heroes; neutral fights anyone
  const al=evilness<=40?'hero':evilness>=60?'villain':'neutral';
  let pool=heroes;
  if(al==='hero')pool=heroes.filter(h=>h.isVillain==='True');
  else if(al==='villain')pool=heroes.filter(h=>h.isVillain!=='True');
  if(pool.length<2)pool=heroes;// fallback if not enough typed heroes
  const wt=pool.map(h=>{const st={};SK.forEach(k=>st[k]=$(h[k]));const s=Object.values(st).sort((a,b)=>b-a);return{hero:h,threat:s[0]+s[1]+s[2]}}).sort((a,b)=>a.threat-b.threat);
  const t=wt.length;let lo,hi;
  if(isBoss){lo=Math.floor(t*0.75);hi=t;}else if(isElite){lo=Math.floor(t*0.5);hi=Math.floor(t*0.85);}
  else{const p=floor/14;const spread=floor<3?0.18:0.25;lo=Math.floor(t*Math.max(0,p-spread));hi=Math.floor(t*Math.min(0.7+p*0.3,p+spread));}
  return makeEnemy(pick(wt.slice(clamp(lo,0,t-1),clamp(hi,lo+1,t))).hero,floor,isBoss,isElite,ngPlus);}

function makeMap(){
  const struct=[1,3,3,3,2,3,3,3,2,2,2,2,1,1,1,1];
  const mergeTypes=[null,null,null,null,['shop','rest'],null,null,null,['shop','rest'],null,null,null,['rest'],['elite'],['shop'],['boss']];
  const battleTypes=['battle','battle','battle','event','shop'];
  const map=[];
  for(let f=0;f<struct.length;f++){
    const cnt=struct[f];const nodes=[];
    for(let i=0;i<cnt;i++){
      let type;if(mergeTypes[f])type=mergeTypes[f][i%mergeTypes[f].length];else if(f===0)type='start';else type=pick(battleTypes);
      if(f<2&&type==='shop')type='battle';
      nodes.push({id:`${f}-${i}`,floor:f,idx:i,type,visited:false,conns:[]});}
    map.push(nodes);}
  for(let f=0;f<struct.length-1;f++){
    const cur=map[f],next=map[f+1];
    if(cur.length===1){cur[0].conns=next.map(n=>n.id);}
    else if(next.length===1){cur.forEach(n=>{n.conns=[next[0].id];});}
    else{cur.forEach((n,i)=>{
      // Proportionally map index, then also connect to 1 adjacent neighbor for real branching
      const main=Math.round(i*(next.length-1)/(cur.length-1));
      const ids=new Set([next[main].id]);
      if(main+1<next.length)ids.add(next[main+1].id);
      if(main-1>=0)ids.add(next[main-1].id);
      n.conns=[...ids].slice(0,2);// max 2 choices per node
    });}}
  return map;}

const EVENTS=[
  // Classic neutral events
  {title:'Mysterious Stranger',opts:[{text:'💪 Upgrade a card',fx:'upgrade'},{text:'🗑️ Remove a basic card',fx:'remove'},{text:'💚 +10 HP',fx:'heal',v:10}]},
  {title:'Abandoned Lab',opts:[{text:'🔬 +1 energy (−15 max HP)',fx:'maxEn'},{text:'💰 +25 gold',fx:'gold',v:25},{text:'💚 +5 HP',fx:'heal',v:5}]},
  {title:'The Mirror',opts:[{text:'🪞 Duplicate best card',fx:'dupe'},{text:'🔄 Upgrade weakest',fx:'upWeak'},{text:'💚 +12 HP',fx:'heal',v:12}]},
  {title:'Mysterious Signal',opts:[{text:'📡 Follow it — duplicate best card',fx:'dupe'},{text:'🔮 Ignore it — +20 gold',fx:'gold',v:20},{text:'💚 Rest — +15 HP',fx:'heal',v:15}]},
  {title:'Temporal Rift',opts:[{text:'⏩ Leap forward — +1 energy (−15 max HP)',fx:'maxEn'},{text:'🔄 Rewind — upgrade weakest',fx:'upWeak',evil:-2},{text:'⚡ Absorb — +20 gold',fx:'gold',v:20,evil:2}]},
  // Hero-leaning events
  {title:'Wounded Civilian',opts:[{text:'🩹 Help them — +15 HP',fx:'heal',v:15,evil:-6},{text:'💰 Demand payment — +15 gold',fx:'gold',v:15,evil:4},{text:'🚶 Walk away',fx:'nothing',evil:2}]},
  {title:'Hero Code',opts:[{text:'📖 Study heroics — upgrade a card',fx:'upgrade',evil:-5},{text:'🛒 Sell the book — +20 gold',fx:'gold',v:20,evil:3},{text:'🔥 Burn it — remove a basic',fx:'remove',evil:5}]},
  {title:'Fan Encounter',opts:[{text:'✍️ Sign autograph — +10 gold',fx:'gold',v:10,evil:-3},{text:'😠 Brush them off',fx:'nothing',evil:0},{text:'💀 Intimidate them — +25 gold',fx:'gold',v:25,evil:6}]},
  {title:'Crisis Hotline',opts:[{text:'🦸 Talk them down — +12 HP',fx:'heal',v:12,evil:-6},{text:'📵 Refuse the call',fx:'nothing',evil:3},{text:'💰 Send someone else — +20 gold',fx:'gold',v:20,evil:-2}]},
  // Villain-leaning events
  {title:"Villain's Cache",opts:[{text:'💰 Take the loot — +30 gold',fx:'gold',v:30,evil:7},{text:'🗑️ Destroy it — remove a basic',fx:'remove',evil:-5},{text:'🚶 Leave it',fx:'nothing',evil:0}]},
  {title:'Dark Merchant',opts:[{text:'🛒 Buy contraband — +1 energy (−15 max HP)',fx:'maxEn',evil:6},{text:'🚔 Report them — +20 gold',fx:'gold',v:20,evil:-5},{text:'💰 Negotiate — +15 gold',fx:'gold',v:15,evil:2}]},
  {title:'Hostage Situation',opts:[{text:'🦸 Rescue them — +15 HP',fx:'heal',v:15,evil:-7},{text:'🤝 Negotiate — duplicate best card',fx:'dupe',evil:3},{text:'💀 Use it to your advantage — +30 gold',fx:'gold',v:30,evil:8}]},
  {title:'Suspicious Alley',opts:[{text:'👀 Investigate — remove a basic',fx:'remove',evil:-2},{text:'💰 Accept the bribe — +25 gold',fx:'gold',v:25,evil:4},{text:'🚶 Keep walking',fx:'nothing',evil:0}]},
];

const ALL_RELICS=[
  {id:'r1',name:'Spiked Gauntlets',desc:'COMBO: +4 not +3',icon:'🥊',syn:'COMBO',fx:'comboPow',alignBias:'villain'},
  {id:'r2',name:'First Blood',desc:'1st attack +4',icon:'🩸',syn:'COMBO',fx:'firstStrike',alignBias:'villain'},
  {id:'r3',name:'Focus Crystal',desc:'Channel +30%',icon:'🔮',syn:'CHANNEL',fx:'chanPow',alignBias:'any'},
  {id:'r4',name:'Mana Siphon',desc:'Channel heals 25%',icon:'💎',syn:'CHANNEL',fx:'chanHeal',alignBias:'hero'},
  {id:'r5',name:'Titanium Shell',desc:'Fortify 65%',icon:'🐢',syn:'FORTIFY',fx:'fortUp',alignBias:'hero'},
  {id:'r6',name:'Regenerator',desc:'+2 HP/turn',icon:'💗',syn:'FORTIFY',fx:'regen',alignBias:'hero'},
  {id:'r7',name:'Lightning Boots',desc:'MOMENTUM surges at 3 stages (instead of 4)',icon:'👟',syn:'MOMENTUM',fx:'momDown',alignBias:'any'},
  {id:'r8',name:'Afterimage',desc:'+2 Block/card',icon:'👤',syn:'MOMENTUM',fx:'cardBlk',alignBias:'any'},
  {id:'r9',name:'Plague Mask',desc:'All poison +2',icon:'🎭',syn:'CORRODE',fx:'poisUp',alignBias:'villain'},
  {id:'r10',name:'Blood Ruby',desc:'Blood costs 3',icon:'💎',syn:'BLOOD',fx:'bloodCheap',alignBias:'villain'},
  {id:'r12',name:'Echo Chamber',desc:'Echo copies at 75%',icon:'🔊',syn:'ECHO',fx:'echoUp',alignBias:'any'},
  {id:'r13',name:'Reactive Armor',desc:'Shield Bash +5',icon:'🛡️',syn:'SHIELD BASH',fx:'bashUp',alignBias:'hero'},
  {id:'r14',name:'Toxic Catalyst',desc:'Catalyze also heals',icon:'💉',syn:'CATALYZE',fx:'catHeal',alignBias:'hero'},
  {id:'r15',name:'Gold Tooth',desc:'+10 gold/fight',icon:'🦷',syn:'any',fx:'goldUp',alignBias:'any'},
  {id:'r16',name:'Thick Skin',desc:'+8 max HP',icon:'💪',syn:'any',fx:'hpUp',alignBias:'hero'},
  {id:'r17',name:'Energy Cell',desc:'+1 energy',icon:'🔋',syn:'any',fx:'enUp',alignBias:'any'},
  {id:'r18',name:'Lucky Coin',desc:'+5% crit',icon:'🪙',syn:'any',fx:'critSmall',alignBias:'any'},
  {id:'r19',name:'Charge Capacitor',desc:'Charge cards deal/gain +3 extra when they fire',icon:'⏳',syn:'CHARGE',fx:'chargePow',alignBias:'villain'},
  {id:'r20',name:'War Paint',desc:'+10% crit',icon:'🎨',syn:'any',fx:'critUp',alignBias:'villain'},
  {id:'r21',name:'Page Turner',desc:'Draw +1 superpower each turn',icon:'📄',syn:'any',fx:'drawUp',alignBias:'hero'},
  {id:'r22',name:'Utility Belt',desc:'Start each turn with 6 superpowers',icon:'🎒',syn:'any',fx:'handSize',alignBias:'any'},
];
const pickRelics=(owned,n=3)=>shuffle(ALL_RELICS.filter(r=>!owned.some(o=>o.id===r.id))).slice(0,n);

const FD="'Bangers','Impact',cursive",FB="'Courier Prime','Courier New',monospace";
const FURL="https://fonts.googleapis.com/css2?family=Bangers&family=Courier+Prime:wght@400;700&display=swap";
const TC={attack:'#ff4455',magic:'#bb55ff',defend:'#4499ff',poison:'#44dd66',rage:'#ff7722',heal:'#55ddbb',draw:'#33ddff'};
const NI={start:'★',battle:'⚔',elite:'💀',boss:'👑',shop:'🛒',event:'?',rest:'🏕'};
const NC={start:'#ffcc33',battle:'#ff5555',elite:'#ff3366',boss:'#ffd700',shop:'#55ddbb',event:'#bb88ff',rest:'#66bb66'};

// 4-panel placement by energy cost on a 2x2 board in panel order 1->4
function canPlace(grid,r,c,card){
  const span=panelSpanForCard(card);
  const start=panelIdx(r,c);
  if(start+span>TOTAL_PANELS)return false;
  for(let i=0;i<span;i++){
    const {r:rr,c:cc}=idxToPos(start+i);
    if(grid[rr][cc]!==null)return false;
  }
  return true;
}
function doPlace(grid,r,c,card,id){
  const ng=grid.map(row=>[...row]);
  const span=panelSpanForCard(card);
  const start=panelIdx(r,c);
  for(let i=0;i<span;i++){
    const {r:rr,c:cc}=idxToPos(start+i);
    ng[rr][cc]=id;
  }
  return ng;
}
function getValid(grid,card){
  const s=new Set();for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(canPlace(grid,r,c,card))s.add(`${r}-${c}`);return s;
}

// ═══ PROJECTED DAMAGE — shown on cards in hand during battle ═══
function calcProjectedDmg(card,battle,relics,en){
  if(!en)return null;
  const hasR=fx=>relics?.some(r=>r.fx===fx);
  const chB=card.charge&&hasR('chargePow')?3:0;
  if(card.keyword==='echo')return{label:'≈ prev',color:'#dd88ff'};
  if(card.keyword==='shieldbash'){const dmg=battle.playerBlock+(hasR('bashUp')?5:0);return{label:`${dmg} dmg (= block)`,color:'#55aaff'};}
  if(card.keyword==='catalyze'){return{label:`${en.poisonStacks||0} dmg (= poison)`,color:'#88ff44'};}
  if(card.keyword==='channel'||card.keyword==='overchannel'){
    const pow=hasR('chanPow')?1.3:1;const add=Math.floor((card.value+chB)*pow);
    const projected=Math.min(40,battle.channelStacks+add);
    return{label:`+${add}ch → ${projected} burst${projected>=40?' (MAX)':''}`,color:'#bb55ff'};}
  switch(card.type){
    case 'attack':case 'rage':{
      const cb=Math.min(card.keyword==='combo'?(battle.comboCount*(hasR('comboPow')?3:2)):0,10);
      const fb=battle.comboCount===0&&hasR('firstStrike')?4:0;
      const defMit=Math.floor((en.def||0)*0.35);
      let tot=0;let blkUsed=0;
      for(let h=0;h<(card.hits||1);h++){
        let raw=Math.floor((card.value+cb+fb+chB)/(card.hits||1));
        let d=Math.max(1,raw-defMit);
        const bl=Math.min(Math.max(0,(en.block||0)-blkUsed),d);blkUsed+=bl;d-=bl;tot+=d;}
      const parts=[];
      if(defMit>0)parts.push(`-${defMit} def`);
      if((en.block||0)>0)parts.push(`-${en.block} blk`);
      const sfx=parts.length?` (${parts.join(', ')})` :'';
      return{label:`${tot} dmg${sfx}`,color:'#ff4455'};}
    case 'magic':{
      const defMit=Math.floor((en.def||0)*0.18);
      let d=Math.max(1,Math.floor(card.value+chB)-defMit);
      const p2=Math.floor(d*0.4),b2=d-p2,bl=Math.min(en.block||0,b2);
      const actual=p2+b2-bl;
      const parts=[];if(defMit>0)parts.push(`-${defMit} def`);if((en.block||0)>0)parts.push(`${p2} pierce`);
      const sfx=parts.length?` (${parts.join(', ')})` :'';
      return{label:`${actual} dmg${sfx}`,color:'#bb55ff'};}
    case 'defend':return{label:`+${card.value+chB} block`,color:'#4499ff'};
    case 'poison':{const extra=hasR('poisUp')?2:0;const amt=Math.ceil(card.value||3)+extra+chB;
      const corrodeNote=card.keyword==='corrode'?` (corrode, total ${(en.corrodeStacks||0)+amt})`:`→ ${(en.poisonStacks||0)+amt} total`;
      return{label:`+${amt} poison${corrodeNote}`,color:'#44dd66'};}
    case 'heal':return{label:`+${card.value+chB} HP`,color:'#55ddbb'};
    case 'draw':return{label:`draw +${card.value+chB}`,color:'#33ddff'};
    default:return null;
  }
}

// ═══ RESOLVE CARD (called during END_TURN in reading order) ═══
function resolveCard(card,en,st,relics,pHp,pMaxHp,healFn,prevCard,pAttrs={}){
  const hasR=fx=>relics?.some(r=>r.fx===fx);
  // Stats from full player object: base CSV (40) + attrs bonus. Delta above 40 drives bonuses.
  const pStr=((pAttrs.Strength||40)-40);const pMag=((pAttrs.Magic||40)-40);
  const pDef=((pAttrs.Defense||40)-40);const pPoi=((pAttrs.Poison||40)-40);
  const pRag=((pAttrs.Rage||40)-40);const pPow=((pAttrs.Power||40)-40);
  const crit=Math.random()*100<(10+Math.floor(pPow/6)+(hasR('critUp')?10:0)+(hasR('critSmall')?5:0));
  const cm=(crit?1.5:1);
  const chB=card.charge&&hasR('chargePow')?3:0;
  let msg='';

  // ECHO: copy previous card at 50% (or 75% with relic)
  if(card.keyword==='echo'&&prevCard){
    const echoPct=hasR('echoUp')?0.75:0.5;
    const echoVal=Math.floor((prevCard.value||0)*echoPct);
    // Replay previous card's effect at reduced value
    const fakeCard={...prevCard,value:echoVal,keyword:'',charge:false,name:'Echo'};
    const echoMsg=resolveCard(fakeCard,en,st,relics,pHp,pMaxHp,healFn,null,pAttrs);
    return `🪞 ECHO (${Math.floor(echoPct*100)}%): ${echoMsg}`;
  }

  // SHIELD BASH: damage = current block
  if(card.keyword==='shieldbash'){
    const bashDmg=st.playerBlock+(hasR('bashUp')?5:0);
    const bl=Math.min(en.block,bashDmg);en.block-=bl;const d=bashDmg-bl;
    en.gameHp=Math.max(0,en.gameHp-d);
    return `🏰 SHIELD BASH: ${bashDmg} dmg (= your block${hasR('bashUp')?'+5':''})`;
  }

  // CATALYZE: damage = enemy poison
  if(card.keyword==='catalyze'){
    const catDmg=en.poisonStacks;
    en.gameHp=Math.max(0,en.gameHp-catDmg);
    if(hasR('catHeal'))healFn(Math.floor(catDmg*0.3));
    return `💀 CATALYZE: ${catDmg} dmg (= enemy poison)${hasR('catHeal')?' + heal':''}`;
  }

  // OVERCHANNEL: channel + corrode
  if(card.keyword==='overchannel'){
    const pow=hasR('chanPow')?1.3:1;
    const chVal=Math.floor((card.value+Math.floor(pMag/12)*2+chB)*cm*pow);
    st.channelStacks+=chVal;
    const poisAmt=Math.ceil(card.value*0.4)+Math.floor(pPoi/12)*2;
    en.poisonStacks+=poisAmt;en.corrodeStacks=(en.corrodeStacks||0)+poisAmt;
    if(card.debuff)en.weakened=(en.weakened||0)+card.debuff;
    return `🌀 OVERCHANNEL +${chVal} channel + ${poisAmt} corrode`;
  }

  switch(card.type){
    case 'attack':case 'rage':{
      const rawCb=card.keyword==='combo'?(st.comboCount*(hasR('comboPow')?3:2)):0;
      const cb=Math.min(rawCb,10);// cap combo bonus at +10 total
      const fb=st.comboCount===0&&hasR('firstStrike')?4:0;
      // Enemy defense (from CSV Defense stat) mitigates physical damage
      const defMit=Math.floor((en.def||0)*0.35);
      const physBonus=Math.floor(pStr/12)*2+(card.type==='rage'?Math.floor(pRag/12)*2:0);
      let tot=0;for(let h=0;h<card.hits;h++){let raw=Math.floor((card.value+physBonus+cb+fb+chB)*cm/card.hits);let d=Math.max(1,raw-defMit);const bl=Math.min(en.block,d);en.block-=bl;d-=bl;en.gameHp=Math.max(0,en.gameHp-d);tot+=d;}
      msg=`${card.icon} ${card.name} → ${tot}${crit?' CRIT!':''}${cb>0?' +'+cb+' combo':''}${defMit>0?` (−${defMit} def)`:''}`;
      // Only COMBO keyword cards increment the combo counter (not all attacks)
      if(card.keyword==='combo')st.comboCount++;
      st.momentum++;break;}
    case 'magic':{
      if(card.keyword==='channel'){
        const pow=hasR('chanPow')?1.3:1;const gain=Math.floor((card.value+Math.floor(pMag/12)*2+chB)*cm*pow);
        st.channelStacks=Math.min(40,st.channelStacks+gain);
        if(card.debuff)en.weakened=(en.weakened||0)+card.debuff;
        msg=`✨ CHANNEL +${gain} [${st.channelStacks}${st.channelStacks>=40?' MAX':''}]`;
      }else{
        // Magic partially mitigated by defense (half as effective as physical)
        const defMit=Math.floor((en.def||0)*0.18);
        let d=Math.max(1,Math.floor((card.value+Math.floor(pMag/12)*2+chB)*cm)-defMit);const p2=Math.floor(d*0.4),b2=d-p2,bl=Math.min(en.block,b2);en.block-=bl;d=p2+b2-bl;en.gameHp=Math.max(0,en.gameHp-d);
        msg=`${card.icon} ${card.name} → ${d}${bl>0?` (${bl} blk, ${p2} pierced)`:''}`; }
      st.momentum++;break;}
    case 'defend':{const blkAmt=card.value+Math.floor(pDef/12)*2+chB;st.playerBlock+=blkAmt;msg=`🛡️ +${blkAmt} Block${card.keyword==='fortify'?' [FORTIFY]':''}`;st.momentum++;break;}
    case 'poison':{const extra=(hasR('poisUp')?2:0)+Math.floor(pPoi/12)*2;const amt=Math.ceil(card.value||card.override||3)+extra+chB;
      en.poisonStacks+=amt;if(card.keyword==='corrode'){en.corrodeStacks=(en.corrodeStacks||0)+amt;msg=`☠️ CORRODE +${amt} [permanent]`;}else msg=`☠️ +${amt} Poison`;st.momentum++;break;}
    case 'heal':healFn(card.value+chB);msg=`💚 +${card.value+chB} HP`;st.momentum++;break;
    case 'draw':st.extraDraw=(st.extraDraw||0)+(card.value+chB);msg=`📖 Draw +${card.value+chB} extra superpowers next turn`;st.momentum++;break;
  }
  if(hasR('cardBlk'))st.playerBlock+=2;
  return msg;
}

// ═══ BATTLE REDUCER ═══
const INIT_B={hand:[],drawPile:[],discardPile:[],energy:3,maxEnergy:3,playerBlock:0,
  enemy:null,page:Array(ROWS).fill(null).map(()=>Array(COLS).fill(null)),
  enemyPlan:[],enemyPlanIdx:0,
  queuedPages:[],
  placedCards:[],pendingCharges:[],activeCharges:[],// activeCharges = from last turn, visually on page
  turn:1,phase:'player',log:[],turnLogStart:0,victory:false,defeat:false,
  comboCount:0,channelStacks:0,momentum:0,momentumUsed:false,extraDraw:0,
  playerPoison:0,playerCorrode:0};

function bReduce(state,action){
  const s={...state};
  switch(action.type){
    case 'INIT':{
      const{enemy,deck,maxEn,relics}=action;const sh=shuffle(deck),hs=Math.min(5,sh.length);
      const en={...enemy};if(relics?.some(r=>r.fx==='startPois'))en.poisonStacks=2;
      const enemyPlan=makeEnemyPlan(en);
      // Carry over activeCharges from previous state if any? No — new battle.
      return{...INIT_B,enemy:en,hand:sh.slice(0,hs),drawPile:sh.slice(hs),maxEnergy:maxEn,energy:maxEn,
        enemyPlan,log:[`⚔ ${enemy.Name}!`,`🔓 Win → ${enemy.signature.name} [${enemy.signature.archetype}]`]};}

    case 'PLACE_CARD':{
      const{card,row,col,relics}=action;
      const hasR=fx=>relics?.some(r=>r.fx===fx);
      const pRageAttr=(action.playerAttrs?.Rage||40)-40;
      if(card.keyword==='blood'){const rageCostReduce=Math.floor(pRageAttr/12);const cost=Math.max(1,(hasR('bloodCheap')?3:card.bloodCost)-rageCostReduce);if(action.playerHp<=cost)return s;action.payBlood(cost);}
      else if(card.keyword==='frenzy'){/* frenzy costs 0 energy */}
      else{if(s.energy<card.cost)return s;s.energy-=card.cost;}
      // Place on grid using shape
      if(!canPlace(s.page,row,col,card))return s;
      s.page=doPlace(s.page,row,col,card,card.id);
      if(card.charge){
        s.pendingCharges=[...s.pendingCharges,{...card,row,col}];
        s.log=[...s.log,`⏳ ${card.name} CHARGING. Fires next turn!`];
      }else{
        s.placedCards=[...s.placedCards,{...card,row,col}];
      }
      s.hand=s.hand.filter(c=>c.id!==card.id);

      // Auto-save a full 2x2 page so the player can continue placing more cards.
      const isPageFull=s.page.every(rowCells=>rowCells.every(cell=>cell!==null));
      if(isPageFull){
        const pageCardCount=s.placedCards.length;
        s.queuedPages=[...s.queuedPages,{cards:[...s.placedCards],cardCount:pageCardCount}];
        s.page=Array(ROWS).fill(null).map(()=>Array(COLS).fill(null));
        s.placedCards=[];
        s.log=[...s.log,`📚 Page ${s.queuedPages.length} saved (${pageCardCount} card${pageCardCount===1?'':'s'})`];
      }

      // MOMENTUM cards advance stage meter; at threshold: +1 Energy and reset
      if(card.keyword==='momentum'){
        const momT=hasR('momDown')?3:4;
        s.momentum++;
        if(s.momentum>=momT){
          s.momentum=0;
          s.energy=Math.min(s.maxEnergy+1,s.energy+1);
          s.log=[...s.log,`⚡ MOMENTUM SURGE! +1 Energy (${momT}/${momT})`];
        }else{
          s.log=[...s.log,`⚡ MOMENTUM ${s.momentum}/${momT}`];
        }
      }
      return s;}

    case 'END_TURN':{
      if(s.phase!=='player')return s;s.phase='resolving';
      const en={...s.enemy};const{relics,playerHp,playerMaxHp}=action;
      const pAttrs=action.playerAttrs||{};
      const hasR=fx=>relics?.some(r=>r.fx===fx);
      s.comboCount=0;s.playerBlock=0;

      // Accumulate all healing during resolution so setPlayerHp gets the correct final value
      let totalHeal=0;const localHealFn=amt=>{totalHeal+=Math.max(0,amt);};

      // 1. Resolve ACTIVE CHARGES (from last turn) in reading order
      if(s.activeCharges.length>0){
        s.log=[...s.log,'⏳ Charged cards fire!'];
        const sorted=[...s.activeCharges].sort((a,b)=>(a.row*COLS+a.col)-(b.row*COLS+b.col));
        let prev=null;
        sorted.forEach(card=>{if(en.gameHp<=0)return;const msg=resolveCard(card,en,s,relics,playerHp,playerMaxHp,localHealFn,prev,pAttrs);if(msg)s.log=[...s.log,msg];prev=card;});
      }

      // 2. Resolve THIS turn's saved pages + current page in order
      const pagesToResolve=[...s.queuedPages];
      if(s.placedCards.length>0)pagesToResolve.push({cards:[...s.placedCards],cardCount:s.placedCards.length});
      if(pagesToResolve.length>0){
        s.log=[...s.log,'📖 Reading saved pages...'];
        s.comboCount=0;
        let prev=s.activeCharges.length>0?s.activeCharges[s.activeCharges.length-1]:null;
        pagesToResolve.forEach((pg,pi)=>{
          if(en.gameHp<=0||!pg.cards?.length)return;
          s.log=[...s.log,`📄 Page ${pi+1} (${pg.cardCount||pg.cards.length} cards)`];
          const sorted=[...pg.cards].sort((a,b)=>(a.row*COLS+a.col)-(b.row*COLS+b.col));
          sorted.forEach(card=>{if(en.gameHp<=0)return;const msg=resolveCard(card,en,s,relics,playerHp,playerMaxHp,localHealFn,prev,pAttrs);if(msg)s.log=[...s.log,msg];prev=card;});
        });
      }

      // 3. Channel burst — 15% of stacks carry to next turn (rewards building deep channel)
      if(s.channelStacks>0){
        const burst=s.channelStacks;
        en.gameHp=Math.max(0,en.gameHp-burst);en.weakened=(en.weakened||0)+2;
        if(hasR('chanHeal'))localHealFn(Math.floor(burst*0.25));
        const carry=Math.floor(burst*0.15);
        s.log=[...s.log,`✨ BURST! ${burst} piercing + Weaken${carry>0?' ('+carry+' carries)':''}`];
        s.channelStacks=carry;}

      if(hasR('regen'))localHealFn(2);

      // Passive alignment bonuses
      const ev=action.evilness??50;
      if(ev<=20){s.playerBlock+=3;s.log=[...s.log,'🛡️ RIGHTEOUS: +3 Block'];}
      if(ev>=80){en.poisonStacks=(en.poisonStacks||0)+1;en.corrodeStacks=(en.corrodeStacks||0)+1;s.log=[...s.log,'☠️ CORRUPT: +1 Corrode'];}

      // Enemy poison tick
      if(en.poisonStacks>0){en.gameHp=Math.max(0,en.gameHp-en.poisonStacks);
        s.log=[...s.log,`☠ Poison: ${en.poisonStacks}`];
        const corr=en.corrodeStacks||0;en.poisonStacks=corr+Math.max(0,en.poisonStacks-corr-1);}

      // Player poison tick
      if((s.playerPoison||0)>0){
        totalHeal-=s.playerPoison;// applied as negative heal so setPlayerHp sees it
        s.log=[...s.log,`☠️ You: -${s.playerPoison} poison${s.playerCorrode>0?' (corrode)':''}`];
        const pc=s.playerCorrode||0;s.playerPoison=pc+Math.max(0,s.playerPoison-pc-1);}

      if(en.gameHp<=0){s.enemy=en;s.victory=true;s.phase='done';return s;}

      // 4. Enemy acts — one panel per turn, cycling through the plan
      let pHp=Math.min(playerMaxHp,playerHp+totalHeal);let pBlk=s.playerBlock;
      const pDef=action.playerDef||2;// player's defense stat reduces incoming physical damage
      // Block decay each turn: prevents runaway stacking; FORTIFY enemies decay slower
      if(en.block>0){const hasFortDeck=en.deck?.some(c=>c.keyword==='fortify');en.block=Math.floor(en.block*(hasFortDeck?0.85:0.65));}
      const intentCard=s.enemyPlan[s.enemyPlanIdx]||s.enemyPlan[0];
      if(intentCard&&pHp>0){
        const panelNum=s.enemyPlanIdx+1;
        const cn=intentCard.name?(intentCard.name.split("'s ")[1]||intentCard.name):'';
        switch(intentCard.intent){
          case 'attack':{
            let d=Math.max(1,(intentCard.intentVal-(en.weakened||0))-pDef);
            const bl=Math.min(pBlk,d);pBlk-=bl;d-=bl;if(d>0)pHp=Math.max(0,pHp-d);if(action.damageFn&&d>0)action.damageFn();
            s.log=[...s.log,`🔴 [${panelNum}] ${en.Name} ${cn}: ${d} dmg${bl>0?' ('+bl+' blk)':''}${pDef>0?` [−${pDef} def]`:''}`];break;}
          case 'magic':{let d=Math.max(1,intentCard.intentVal-Math.floor(pDef*0.5));const p2=Math.floor(d*0.3),b2=d-p2,bl=Math.min(pBlk,b2);pBlk-=bl;d=p2+b2-bl;pHp=Math.max(0,pHp-d);
            s.log=[...s.log,`🟣 [${panelNum}] ${en.Name} ${cn}: ${d} magic${bl>0?` (${bl} blk, ${p2} pierced)`:''}`];break;}
          case 'channel':{const d=intentCard.intentVal;pHp=Math.max(0,pHp-d);
            s.log=[...s.log,`✨ [${panelNum}] ${en.Name} ${cn}: CHANNEL ${d} (full pierce)`];break;}
          case 'defend':en.block+=intentCard.intentVal;s.log=[...s.log,`🔵 [${panelNum}] ${en.Name} ${cn}: +${intentCard.intentVal} Blk`];break;
          case 'buff':en.atk+=intentCard.intentVal;s.log=[...s.log,`🟡 [${panelNum}] ${en.Name} ${cn}: ATK +${intentCard.intentVal}`];break;
          case 'poison':{const stacks=intentCard.intentVal;const bl=Math.min(pBlk,Math.floor(stacks*0.5));pBlk-=bl;const applied=Math.max(0,stacks-bl);s.playerPoison=(s.playerPoison||0)+applied;
            s.log=[...s.log,`☠️ [${panelNum}] ${en.Name} ${cn}: +${applied} Poison${bl>0?' ('+bl+' blk)':''} → ${s.playerPoison} total`];break;}
          case 'corrode':{const stacks=intentCard.intentVal;s.playerPoison=(s.playerPoison||0)+stacks;s.playerCorrode=(s.playerCorrode||0)+stacks;
            s.log=[...s.log,`☠️ [${panelNum}] ${en.Name} ${cn}: CORRODE +${stacks} (pierces, total ${s.playerPoison})`];break;}
          case 'heal':{en.gameHp=Math.min(en.gameMaxHp,en.gameHp+intentCard.intentVal);
            s.log=[...s.log,`💚 [${panelNum}] ${en.Name} ${cn}: heals ${intentCard.intentVal}`];break;}
          case 'shieldbash':{const d=Math.max(0,en.block-(en.weakened||0));const bl=Math.min(pBlk,d);pBlk-=bl;pHp=Math.max(0,pHp-(d-bl));
            s.log=[...s.log,`🏰 [${panelNum}] ${en.Name} ${cn}: BASH ${d} (= enemy block)`];break;}
          case 'catalyze':{const d=en.poisonStacks||0;pHp=Math.max(0,pHp-d);
            s.log=[...s.log,`💀 [${panelNum}] ${en.Name} ${cn}: CATALYZE ${d} (= enemy poison)`];break;}
          default:break;
        }
      }
      // Advance to next panel; regenerate plan when the cycle completes
      const nextIdx=(s.enemyPlanIdx+1)%s.enemyPlan.length;
      s.enemyPlanIdx=nextIdx;
      if(nextIdx===0){
        s.enemyPlan=makeEnemyPlan(en);
        // Block resets each full plan cycle — FORTIFY carries a fraction, less so early floors
        const hasFort=en.deck?.some(c=>c.keyword==='fortify');
        const fl=en.floor||0;
        en.block=hasFort?Math.floor(en.block*(fl<3?0.25:0.45)):0;
      }

      // Sync remaining block after enemy consumed some (needed for accurate Fortify carry)
      s.playerBlock=pBlk;
      action.setPlayerHp(pHp);
      if(pHp<=0){s.enemy=en;s.defeat=true;s.phase='done';return s;}
      s.enemy=en;

      // Fortify carry — uses remaining block after enemy attacks
      const allPlacedCards=s.queuedPages.flatMap(p=>p.cards||[]).concat(s.placedCards);
      const hasFort=[...allPlacedCards,...s.activeCharges].some(c=>c.keyword==='fortify');
      const carry=hasFort?Math.floor(s.playerBlock*(hasR('fortUp')?0.65:0.5)):0;

      // Discard: resolved cards (placed + old activeCharges) + unplayed hand
      const disc=[...s.discardPile,...s.hand,...allPlacedCards,...s.activeCharges];
      let draw=[...s.drawPile];
      const baseHand=5+(hasR('handSize')?1:0)+(hasR('drawUp')?1:0)+Math.floor(((pAttrs.Speed||40)-40)/6);
      const neededHand=Math.max(1,baseHand+(s.extraDraw||0));
      if(draw.length<neededHand){draw=[...draw,...shuffle(disc)];s.discardPile=[];}else{s.discardPile=disc;}
      const hs=Math.min(neededHand,draw.length);s.hand=draw.slice(0,hs);s.drawPile=draw.slice(hs);
      s.extraDraw=0;

      // NEW PAGE: pending charges from THIS turn become active charges (stay on page)
      const newPage=Array(ROWS).fill(null).map(()=>Array(COLS).fill(null));
      // Place activeCharges (from pendingCharges) onto the new page
      const newActive=[...s.pendingCharges];
      newActive.forEach(card=>{
        const span=panelSpanForCard(card);
        const start=panelIdx(card.row,card.col);
        for(let i=0;i<span;i++){
          if(start+i<TOTAL_PANELS){
            const {r:rr,c:cc}=idxToPos(start+i);
            newPage[rr][cc]=card.id;
          }
        }
      });

      s.page=newPage;s.activeCharges=newActive;s.pendingCharges=[];
      s.queuedPages=[];
      s.placedCards=[];s.energy=s.maxEnergy;s.playerBlock=carry;
      s.comboCount=0;s.momentum=0;s.momentumUsed=false;s.turn++;s.phase='player';
      if(carry>0)s.log=[...s.log,`🛡️ Fortify: ${carry}`];
      if(newActive.length>0)s.log=[...s.log,`⏳ ${newActive.length} charged card(s) ready to fire next turn!`];
      s.turnLogStart=s.log.length;
      return s;}
    default:return s;
  }
}

// ═══ MAIN ═══
export default function ComicSpire(){
  const[heroes,setHeroes]=useState([]);
  const[csvLoading,setCsvLoading]=useState(true);
  
  // Load CSV from file on mount
  useEffect(()=>{
    const loadCSV=async()=>{
      try{
        // Try to fetch from public folder (Vite, local development)
        const res=await fetch('/heroes.csv');
        if(res.ok){
          const csv=await res.text();
          setHeroes(parseCSV(csv));
          setCsvLoading(false);
          return;
        }
      }catch(e){}
      
      // Try alternate paths
      const paths=['/HackBeta - Superhero CSV.csv','./heroes.csv','../heroes.csv'];
      for(const path of paths){
        try{
          const res=await fetch(path);
          if(res.ok){
            const csv=await res.text();
            setHeroes(parseCSV(csv));
            setCsvLoading(false);
            return;
          }
        }catch(e){}
      }
      
      // Fallback to embedded CSV if file fetch fails
      setHeroes(parseCSV(FALLBACK_CSV));
      setCsvLoading(false);
    };
    loadCSV();
  },[]);
  
  const[screen,setScreen]=useState('title');
  const[tutStep,setTutStep]=useState(0);
  const[player,setPlayer]=useState(null);
  const[deck,setDeck]=useState([]);
  const[gold,setGold]=useState(0);
  const[evilness,setEvilness]=useState(50);
  const alignment=evilness<=40?'hero':evilness>=60?'villain':'neutral';
  const alignLabel=evilness<=20?'RIGHTEOUS':evilness<=40?'VALIANT':evilness<=59?'ROGUE':evilness<=79?'RUTHLESS':'CORRUPT';
  const alignColor=alignment==='hero'?'#33aaff':alignment==='villain'?'#ff3366':'#aaaaaa';
  const accent=alignment==='villain'?'#ff3366':alignment==='hero'?'#33aaff':'#ffaa33';
  const bg1=alignment==='villain'?'#12060f':alignment==='hero'?'#060d18':'#0d0d14';
  const bg2=alignment==='villain'?'#200e1c':alignment==='hero'?'#0c1628':'#14141e';
  const[hexMap,setHexMap]=useState(null);
  const[curFloor,setCurFloor]=useState(0);
  const[curNodeId,setCurNodeId]=useState(null);
  const[shopItems,setShopItems]=useState([]);
  const[shopRelics,setShopRelics]=useState([]);
  const[curEvent,setCurEvent]=useState(null);
  const[selectedCardId,setSelectedCardId]=useState(null);
  const[mapLog,setMapLog]=useState([]);
  const[maxEnergy,setMaxEnergy]=useState(3);
  const[relics,setRelics]=useState([]);
  const[copiedAbilities,setCopiedAbilities]=useState([]);
  const[potLv,setPotLv]=useState(1);
  const[ngPlus,setNgPlus]=useState(0);
  const[attrPoints,setAttrPoints]=useState(0);
  const[pendingAttrs,setPendingAttrs]=useState({Strength:0,Magic:0,Defense:0,Speed:0,Vitality:0,Poison:0,Rage:0,Power:0});
  const[showCodex,setShowCodex]=useState(false);
  const[codexTab,setCodexTab]=useState('powers');
  const[pendingBattle,setPendingBattle]=useState(null);
  const enemyCache=useRef({});
  const[rewardPhase,setRewardPhase]=useState('absorb');
  const[rewardRelics,setRewardRelics]=useState([]);
  const[rewardCards,setRewardCards]=useState([]);
  const[selectedAbsorbCard,setSelectedAbsorbCard]=useState(null);
  const[absorbedCardIds,setAbsorbedCardIds]=useState([]);
  const[tooltip,setTooltip]=useState(null);
  const[battle,dispatch]=useReducer(bReduce,INIT_B);
  const[floaters,setFloaters]=useState([]);
  const[slatePreview,setSlatePreview]=useState(null);
  const[showLog,setShowLog]=useState(false);
  const[restPopup,setRestPopup]=useState(null);
  const[damageFlash,setDamageFlash]=useState(false);
  const prevHpRef=useRef(null);
  const prevAlignLabelRef=useRef(null);
  const prevScreenRef=useRef('title');
  const prevMusicAlignRef=useRef(alignment);
  const prevQueuedPagesRef=useRef(0);
  const prevTurnAudioRef=useRef(null);
  const loadedSlateRef=useRef(new Set());
  const[slateReadyTick,setSlateReadyTick]=useState(0);
  const mapScrollRef=useRef(null);
  const cinematicBtnRef=useRef(null);
  const[shake,setShake]=useState(false);
  const[animPhase,setAnimPhase]=useState(null);
  const[alignNotif,setAlignNotif]=useState(null);
  const audio=useMemo(()=>createAudioSystem(),[]);
  // Clear tooltip and floaters on any screen change
  useEffect(()=>{setTooltip(null);setFloaters([]);},[screen]);
  // Cutscene: scroll to bottom whenever map or opening cinematic opens
  useEffect(()=>{
    if(screen==='map'){
      window.scrollTo({top:0});
      setTimeout(()=>window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'}),350);
    }
    if(screen==='openingCinematic'){
      window.scrollTo({top:0});
      const DURATION=5200;
      let start=null;let raf=null;
      const step=ts=>{
        if(!start)start=ts;
        const t=Math.min((ts-start)/DURATION,1);
        const ease=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
        const btn=cinematicBtnRef.current;
        const target=btn?Math.max(0,btn.offsetTop+btn.offsetHeight-window.innerHeight+100):document.body.scrollHeight;
        window.scrollTo({top:ease*target});
        if(t<1)raf=requestAnimationFrame(step);
      };
      const tid=setTimeout(()=>{raf=requestAnimationFrame(step);},600);
      return()=>{clearTimeout(tid);if(raf)cancelAnimationFrame(raf);};
    }
  },[screen]);

  // Preload slate overlay assets so flash renders reliably on first use
  useEffect(()=>{
    const variants=['Bubble','Brutal','Action'];
    for(let p=1;p<=4;p++){
      variants.forEach(v=>{
        const key=`${v}_${p}`;
        const img=new Image();
        img.onload=()=>{
          if(!loadedSlateRef.current.has(key)){
            loadedSlateRef.current.add(key);
            setSlateReadyTick(t=>t+1);
          }
        };
        img.src=`/assets/${v}_Comic_Slate_${p}.png`;
      });
    }
  },[]);

  // Alignment tier change notification
  useEffect(()=>{
    if(prevAlignLabelRef.current===null){prevAlignLabelRef.current=alignLabel;return;}
    if(prevAlignLabelRef.current!==alignLabel){
      const c=evilness<=20?'#33aaff':evilness<=40?'#55ccff':evilness<=59?'#ffaa33':evilness<=79?'#ff6633':'#ff3366';
      setAlignNotif({label:alignLabel,color:c,sub:evilness<=20?'🛡️ +3 Block/turn passive unlocked':evilness>=80?'☠️ +1 Corrode/turn passive unlocked':evilness<=40?'Enemies: Villains flee you':evilness>=60?'Enemies: Heroes hunt you':'Enemies: Anyone'});
      prevAlignLabelRef.current=alignLabel;
      setTimeout(()=>setAlignNotif(null),3500);
    }
  },[alignLabel]);
  const addFloat=useCallback((t,c,side='enemy')=>{const id=uid();setFloaters(p=>[...p,{id,text:t,color:c,x:side==='enemy'?60+Math.random()*24:6+Math.random()*24,y:18+Math.random()*22}]);setTimeout(()=>setFloaters(p=>p.filter(f=>f.id!==id)),1400);},[]);
  const doShake=useCallback(()=>{setShake(true);setTimeout(()=>setShake(false),350);},[]);
  const healPlayer=useCallback((amt)=>{
    const healAmt=Math.max(0,amt||0);
    if(healAmt<=0)return;
    audio.unlock();
    audio.playPlace('echo');
    setPlayer(p=>p?{...p,hp:Math.min(p.maxHp,p.hp+healAmt)}:p);
  },[audio]);
  useEffect(()=>{
    const hp=player?.hp;
    if(hp==null){prevHpRef.current=hp;return;}
    if(prevHpRef.current!=null&&hp<prevHpRef.current){setDamageFlash(true);setTimeout(()=>setDamageFlash(false),500);}
    prevHpRef.current=hp;
  },[player?.hp]);
  const hasR=useCallback(fx=>relics.some(r=>r.fx===fx),[relics]);
  const applyRelic=useCallback(r=>{setRelics(p=>[...p,r]);if(r.fx==='hpUp')setPlayer(p=>({...p,maxHp:p.maxHp+8,hp:p.hp+8}));if(r.fx==='enUp')setMaxEnergy(p=>Math.min(5,p+1));},[]);
  useEffect(()=>()=>audio.stopBgm(),[audio]);

  useEffect(()=>{
    const enteredScreen=prevScreenRef.current!==screen;
    const alignChanged=prevMusicAlignRef.current!==alignment;

    audio.unlock();
    if(screen==='battle'){
      if(enteredScreen)audio.playCombatBgm(alignment);
    }else if(enteredScreen||alignChanged){
      audio.playMenuBgm(alignment);
    }

    if(enteredScreen&&screen==='victory'){
      audio.playJingle('victory',alignment);
    }

    prevScreenRef.current=screen;
    prevMusicAlignRef.current=alignment;
  },[screen,alignment,audio]);

  useEffect(()=>{
    if(screen!=='battle'||battle.phase!=='player')return;
    if(battle.hand.length===0)return;
    if(prevTurnAudioRef.current===battle.turn)return;
    prevTurnAudioRef.current=battle.turn;
    audio.unlock();
    audio.playDraw();
  },[screen,battle.phase,battle.turn,battle.hand.length,audio]);

  useEffect(()=>{
    const onButtonSelect=(ev)=>{
      if(screen==='battle')return;
      const target=ev.target;
      if(!(target instanceof Element))return;
      if(!target.closest('button'))return;
      audio.unlock();
      audio.playSelect();
    };
    document.addEventListener('pointerdown',onButtonSelect,true);
    return ()=>document.removeEventListener('pointerdown',onButtonSelect,true);
  },[screen,audio]);

  useEffect(()=>{if(battle.victory&&screen==='battle'){
    const en=battle.enemy;setGold(p=>p+15+Math.floor(Math.random()*20)+curFloor*3+(en?.isBoss?50:en?.isElite?20:0)+(hasR('goldUp')?10:0));
    setCopiedAbilities(p=>[...p,{name:en.Name,sig:en.signature.name,arch:en.signature.archetype,icon:en.signature.icon,kw:en.signature.keyword}]);
    setPotLv(p=>p+1);
    setAttrPoints(p=>p+8);
    setRewardRelics(pickRelics(relics,3));setRewardPhase('absorb');
    setSelectedAbsorbCard(null);setAbsorbedCardIds([]);
    setRewardCards(en.deck||[en.signature]);
    setTimeout(()=>setScreen('battleWin'),500);}},[battle.victory]);
  useEffect(()=>{if(battle.defeat&&screen==='battle')setTimeout(()=>setScreen('gameOver'),600);},[battle.defeat]);

  useEffect(()=>{
    const currQueued=battle.queuedPages.length;
    const prevQueued=prevQueuedPagesRef.current;

    if(screen!=='battle'){
      prevQueuedPagesRef.current=currQueued;
      return;
    }

    if(battle.phase==='player'&&currQueued>prevQueued){
      const page=battle.queuedPages[currQueued-1];
      const cardData=(page?.cards||[]).slice(0,4).map(c=>({type:c.type,icon:c.icon,row:c.row,col:c.col}));
      if(cardData.length>0){
        const slateVariant=pick(['Bubble','Brutal','Action']);
        audio.unlock();
        audio.playPlace('charge');
        setSlatePreview({cards:cardData,variant:slateVariant});
        setTimeout(()=>setSlatePreview(null),900);
      }
    }

    if(battle.phase==='player'&&currQueued>0){
      dispatch({type:'RESOLVE_NEXT_PAGE',relics,playerHp:player?.hp||0,playerMaxHp:player?.maxHp||1,setPlayerHp:hp=>setPlayer(p=>p?{...p,hp}:p)});
      doShake();
    }

    prevQueuedPagesRef.current=battle.queuedPages.length;
  },[battle.queuedPages,battle.phase,screen,relics,player?.hp,player?.maxHp,doShake,audio]);

  const startGame=useCallback(()=>{
    audio.unlock();
    audio.startBgm();
    setPlayer({name:'Potential Man',hp:55,maxHp:55,critChance:10,def:2,Power:40,Strength:40,Magic:40,Intelligence:40,Speed:40,Defense:40,Poison:40,Rage:40,attrs:{Strength:0,Magic:0,Defense:0,Speed:0,Vitality:0,Poison:0,Rage:0,Power:0}});
    setDeck(makeStarterDeck());setGold(25);setEvilness(50);setMaxEnergy(3);
    setPotLv(1);setNgPlus(0);setCopiedAbilities([]);setRelics([]);setAttrPoints(0);setPendingAttrs({Strength:0,Magic:0,Defense:0,Speed:0,Vitality:0,Poison:0,Rage:0,Power:0});
    enemyCache.current={};
    const m=makeMap();m[0][0].visited=true;setHexMap(m);setCurFloor(0);setCurNodeId(m[0][0].id);
    setMapLog(['Find a route through the unknown city. Branches lock in for 3 floors.']);setScreen('openingCinematic');
  },[audio]);

  const startNewGamePlus=useCallback((currentNgPlus)=>{
    const nextNg=currentNgPlus+1;
    setNgPlus(nextNg);
    setAttrPoints(0);
    setPendingAttrs({Strength:0,Magic:0,Defense:0,Speed:0,Vitality:0,Poison:0,Rage:0,Power:0});
    enemyCache.current={};
    // Full HP restore as reward for completing the run
    setPlayer(p=>p?{...p,hp:p.maxHp}:p);
    const m=makeMap();m[0][0].visited=true;setHexMap(m);setCurFloor(0);setCurNodeId(m[0][0].id);
    setMapLog([`⚡ ASCENSION ${nextNg}. Enemies are ${Math.round(nextNg*35)}% stronger!`]);
    setScreen('map');
  },[]);

  const commitBattle=useCallback(()=>{if(!pendingBattle)return;const{nodeId,en}=pendingBattle;const[f]=nodeId.split('-').map(Number);
    setHexMap(prev=>prev.map((row,fi)=>fi===f?row.map(n=>n.id===nodeId?{...n,visited:true}:n):row));
    setCurFloor(f);setCurNodeId(nodeId);const enWithIntent={...en,...rollIntent(en)};
    dispatch({type:'INIT',enemy:enWithIntent,deck,maxEn:maxEnergy,relics});setSelectedCardId(null);setPendingBattle(null);setScreen('battle');
  },[pendingBattle,hexMap,deck,maxEnergy,relics]);

  const placeCard=useCallback((card,r,c)=>{
    audio.unlock();
    if(card.keyword==='momentum'){
      const stage=Math.min(4,(battle.momentum||0)+1);
      audio.playMomentumStage(stage);
    }else{
      audio.playPlace(card.keyword, card.type);
    }
    dispatch({type:'PLACE_CARD',card,row:r,col:c,relics,playerHp:player?.hp||1,playerAttrs:player||{},payBlood:cost=>setPlayer(p=>p?{...p,hp:Math.max(1,p.hp-cost)}:p)});
    setSelectedCardId(null);
  },[audio,relics,player,battle]);

  const endTurn=useCallback(()=>{
    audio.unlock();audio.playSelect();
    if(battle.phase!=='player')return;setAnimPhase('r');
    // Evilness shifts based on card keywords played this turn
    const allPlayedCards=[...battle.queuedPages.flatMap(p=>p.cards||[]),...battle.placedCards];
    if(allPlayedCards.length>0){
      const EVIL_KW={frenzy:5,blood:5,corrode:3,overchannel:3,catalyze:3};
      const GOOD_KW={fortify:-4,shieldbash:-2,echo:0,channel:0,momentum:0,combo:0,charge:0};
      const TYPE_SHIFT={poison:3,rage:3,heal:-3,defend:-3,draw:-2,attack:0,magic:0};
      let shift=0;
      allPlayedCards.forEach(c=>{
        if(c.keyword&&EVIL_KW[c.keyword]!==undefined)shift+=EVIL_KW[c.keyword];
        else if(c.keyword&&GOOD_KW[c.keyword]!==undefined)shift+=GOOD_KW[c.keyword];
        else shift+=(TYPE_SHIFT[c.type]||0);
      });
      if(shift!==0)setEvilness(p=>clamp(p+shift,0,100));
    }
    const finalPages=[...battle.queuedPages];
    if(battle.placedCards.length>0)finalPages.push({cards:battle.placedCards});
    if(finalPages.length>0){
      // Build slate preview: one entry per actual card placed (up to 4)
      const allCards=finalPages.flatMap(pg=>pg.cards||[]);
      const cardData=allCards.slice(0,4).map(c=>({type:c.type,icon:c.icon,row:c.row,col:c.col}));
      const slateVariant=pick(['Bubble','Brutal','Action']);
      audio.unlock();
      audio.playPlace('charge');
      setSlatePreview({cards:cardData,variant:slateVariant});
      setTimeout(()=>setSlatePreview(null),1500);
    }
    setTimeout(()=>{
      dispatch({type:'END_TURN',relics,playerHp:player?.hp||0,playerMaxHp:player?.maxHp||1,playerDef:player?.def||2,
        evilness,playerAttrs:player||{},getPlayerHp:()=>player?.hp||0,setPlayerHp:hp=>setPlayer(p=>p?{...p,hp}:p),healFn:healPlayer,damageFn:()=>{audio.unlock();audio.playPlace('', 'attack');}});
      doShake();setAnimPhase(null);
    },400);
  },[battle,player,relics,doShake,healPlayer,evilness,audio]);

  const selectNode=useCallback(nodeId=>{
    if(!hexMap)return;const[f,i]=nodeId.split('-').map(Number);
    const[cf,ci]=(curNodeId||'0-0').split('-').map(Number);const cur=hexMap[cf]?.[ci];
    if(!cur?.conns?.includes(nodeId)&&f!==0)return;const node=hexMap[f][i];
    audio.unlock();audio.playSelect();
    if(['battle','elite','boss'].includes(node.type)){
      if(!enemyCache.current[nodeId])enemyCache.current[nodeId]=pickEnemy(heroes,f,node.type==='boss',node.type==='elite',evilness,ngPlus);
      setPendingBattle({nodeId,en:enemyCache.current[nodeId]});return;}
    setHexMap(prev=>prev.map((row,fi)=>fi===f?row.map(n=>n.id===nodeId?{...n,visited:true}:n):row));setCurFloor(f);setCurNodeId(nodeId);
    if(node.type==='shop'){
      const al=evilness<=40?'hero':evilness>=60?'villain':'neutral';
      let shopPool=heroes;
      if(al==='hero')shopPool=heroes.filter(h=>h.isVillain!=='True');// heroes buy from hero-type vendors
      else if(al==='villain')shopPool=heroes.filter(h=>h.isVillain==='True');// villains buy from villain-type vendors
      if(shopPool.length<4)shopPool=heroes;
      setShopItems(shuffle(shopPool).slice(0,4).map(h=>{const s=getSignature(h);s.price=Math.floor(18+s.tier*12+s.value);return s;}));
      const alignedRelics=ALL_RELICS.filter(r=>!relics.some(o=>o.id===r.id)&&(r.alignBias==='any'||r.alignBias===al||!r.alignBias));
      setShopRelics(shuffle(alignedRelics.length>=2?alignedRelics:ALL_RELICS.filter(r=>!relics.some(o=>o.id===r.id))).slice(0,2).map(r=>({...r,price:r.syn==='any'?30:45})));
      audio.playJingle('shop',al);
      setScreen('shop');}
    else if(node.type==='event'){
      const al=evilness<=40?'hero':evilness>=60?'villain':'neutral';
      // Filter events by alignment: heroes avoid villain-leaning, villains avoid hero-leaning
      const neutralEvents=EVENTS.slice(0,5);
      const heroEvents=EVENTS.slice(5,9);
      const villainEvents=EVENTS.slice(9,13);
      let pool=neutralEvents;
      if(al==='hero')pool=[...neutralEvents,...neutralEvents,...heroEvents];// hero gets hero events more often
      else if(al==='villain')pool=[...neutralEvents,...neutralEvents,...villainEvents];
      else pool=[...neutralEvents,...heroEvents.slice(0,2),...villainEvents.slice(0,2)];
      setCurEvent(pick(pool));setScreen('event');
    }
    else if(node.type==='rest'){const h=Math.floor(player?.maxHp*0.3||12);const al=evilness<=40?'hero':evilness>=60?'villain':'neutral';audio.playJingle('rest',al);setRestPopup({hp:h});}
  },[audio,hexMap,curNodeId,heroes,player,relics,healPlayer,ngPlus,evilness]);

  const handleEvent=useCallback(opt=>{
    const cp=deck.filter(c=>c.copiedFrom);
    if(opt.fx==='upgrade'){if(cp.length>0){const t=[...cp].sort((a,b)=>a.value-b.value)[0];setDeck(p=>p.map(x=>x.id===t.id?{...x,value:Math.floor(x.value*1.3),name:x.name+'+'}:x));}}
    else if(opt.fx==='remove'){const b=deck.filter(c=>!c.copiedFrom&&c.tier===0);if(b.length>0)setDeck(p=>p.filter(x=>x.id!==b[0].id));}
    else if(opt.fx==='heal')healPlayer(opt.v);
    else if(opt.fx==='gold')setGold(p=>p+opt.v);
    else if(opt.fx==='maxEn'){setMaxEnergy(p=>Math.min(5,p+1));setPlayer(p=>p?{...p,maxHp:Math.max(20,p.maxHp-15),hp:Math.max(1,p.hp-15)}:p);}
    else if(opt.fx==='dupe'){if(cp.length>0){const b=[...cp].sort((a,b)=>b.value-a.value)[0];setDeck(p=>[...p,{...b,id:uid()}]);}}
    else if(opt.fx==='upWeak'){if(cp.length>0){const w=[...cp].sort((a,b)=>a.value-b.value)[0];setDeck(p=>p.map(x=>x.id===w.id?{...x,value:Math.floor(x.value*1.4),name:x.name+'+'}:x));}}
    if(opt.evil)setEvilness(p=>clamp(p+opt.evil,0,100));
    setScreen('map');
  },[deck,healPlayer,setEvilness]);

  const pickRewardRelic=useCallback(r=>{if(r)applyRelic(r);if(hexMap&&curFloor>=hexMap.length-1){setScreen('victory');return;}setScreen('map');},[hexMap,curFloor,applyRelic]);

  // Keyword badge with tooltip — click to show, auto-dismiss after 3s
  const showTip=useCallback((info)=>{setTooltip(info);setTimeout(()=>setTooltip(p=>p===info?null:p),3000);},[]);
  const KW=({k})=>{if(!k)return null;const info=KW_INFO[k];if(!info)return null;
    return <span onClick={(e)=>{e.stopPropagation();showTip(info);}} onMouseEnter={()=>showTip(info)} onMouseLeave={()=>setTooltip(null)}
      style={{fontSize:9,padding:'0.5px 4px',lineHeight:1,borderRadius:2,background:`${info.color}22`,color:info.color,border:`1px solid ${info.color}44`,fontFamily:FD,letterSpacing:0.5,cursor:'help'}}>{info.name}</span>;};

  const HpBar=({hp,max,color,h=13})=> <div style={{position:'relative',height:h,background:'#1a1a2a',borderRadius:h/2,overflow:'hidden',border:'1px solid #333',minWidth:80}}><div style={{height:'100%',width:`${clamp(hp/max*100,0,100)}%`,background:`linear-gradient(90deg,${color}88,${color})`,borderRadius:h/2,transition:'width 0.4s'}}/><div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:h*0.6,fontFamily:FB,fontWeight:700,color:'#fff',textShadow:'0 1px 2px #000'}}>{hp}/{max}</div></div>;

  const IntentBox=({intent,val,weak,compact=false,card=null})=>{
    const nm=card?(card.name?.split("'s ")[1]||card.name):null;
    const cfg={attack:{i:card?.icon||'⚔️',c:'#ff4455',t:`${Math.max(1,(val||0)-(weak||0))} dmg`},magic:{i:card?.icon||'✨',c:'#bb55ff',t:`${val} magic`},channel:{i:card?.icon||'✨',c:'#bb55ff',t:`${val} pierce`},defend:{i:card?.icon||'🛡️',c:'#4499ff',t:`+${val} Blk`},buff:{i:'💪',c:'#ffcc33',t:`+${val||0} ATK`},poison:{i:card?.icon||'☠️',c:'#44dd66',t:`${val} poison`},corrode:{i:'☠️',c:'#44dd66',t:`${val} corrode`},heal:{i:card?.icon||'💚',c:'#55ddbb',t:`heal ${val}`},shieldbash:{i:'🏰',c:'#55aaff',t:`bash ${val}`},catalyze:{i:'💀',c:'#88ff44',t:`cat. ${val}`}}[intent]||{i:'?',c:'#888',t:''};
    return <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:compact?5:6,padding:compact?'4px 6px':'3px 6px',background:`${cfg.c}18`,border:`1px solid ${cfg.c}44`,borderRadius:5,marginTop:compact?0:2,lineHeight:1,maxWidth:'94%'}}>
      <span style={{fontSize:compact?18:20}}>{cfg.i}</span>
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:1}}>
        {nm&&<span style={{color:'#eee',fontFamily:FD,fontSize:compact?10:11,lineHeight:1.1}}>{nm.length>14?nm.slice(0,12)+'…':nm}</span>}
        <span style={{color:cfg.c,fontFamily:FB,fontSize:compact?10:11,fontWeight:700}}>{cfg.t}</span>
      </div>
    </div>;};

  const Card=({card,onClick,sel,price,dis,projDmg})=>{const kInfo=KW_INFO[card.keyword];const tc=kInfo?.color||TC[card.type]||'#888';
    return <div onClick={()=>!dis&&onClick?.(card)} style={{width:122,minWidth:122,height:178,borderRadius:8,overflow:'hidden',cursor:dis?'default':'pointer',background:bg2,border:`2px solid ${sel?'#fff':tc}`,boxShadow:sel?`0 0 18px ${tc}66`:`0 3px 8px #00000088`,transform:sel?'translateY(-10px) scale(1.05)':'scale(1)',transition:'all 0.2s',flexShrink:0,opacity:dis?0.3:1}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'3px 6px',background:`${tc}18`}}>
        <div style={{width:20,height:20,borderRadius:'50%',background:card.keyword==='blood'?'#ff3333':card.keyword==='frenzy'?'#ff55aa':tc,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:FD,fontSize:11,color:'#000',fontWeight:700}}>{card.keyword==='blood'?'♥'+(hasR('bloodCheap')?3:card.bloodCost):card.keyword==='frenzy'?'0':card.cost}</div>
        <div style={{fontSize:10,fontFamily:FD,color:tc,letterSpacing:1}}>{card.type.toUpperCase()}</div>
        {card.charge&&<div style={{fontSize:10,color:'#ffaa33',fontFamily:FD}}>⏳</div>}
      </div>
      <div style={{height:28,display:'flex',alignItems:'center',justifyContent:'center',background:`radial-gradient(circle,${card.color}15,transparent)`,fontSize:20}}>{card.icon}</div>
      <div style={{padding:'3px 6px',flex:1}}>
        <div style={{fontFamily:FD,fontSize:10,color:'#fff',lineHeight:1.2,marginBottom:2}}>{card.name}</div>
        <div style={{display:'flex', justifyContent:'center',marginBottom:2}}><KW k={card.keyword}/></div>
        <div style={{fontFamily:FB,fontSize:10,color:'#aaa',lineHeight:1.3}}>{card.desc}</div>
      </div>
      <div style={{padding:'2px 6px 4px',borderTop:'1px solid #ffffff06'}}>
        {price!=null?<span style={{fontFamily:FD,fontSize:11,color:gold>=price?'#ffd700':'#ff4455'}}>💰{price}</span>:
         projDmg!=null?<span style={{fontFamily:FD,fontSize:10,color:projDmg.color,fontWeight:700}}>{projDmg.label}</span>:
          <span style={{fontSize:10,color:card.copiedFrom?tc:'#444',fontFamily:FB}}>{card.copiedFrom?'🔓'+card.heroName:'Basic'}</span>}
      </div>
    </div>;};

  const Relic=({relic,onClick,price,dis})=>{const sc=KW_INFO[relic.syn?.toLowerCase()]?.color||'#ffaa33';
    return <div onClick={()=>!dis&&onClick?.(relic)} style={{width:140,padding:'8px 10px',background:bg2,border:`1.5px solid ${sc}33`,borderRadius:8,cursor:dis?'default':'pointer',opacity:dis?0.3:1,transition:'all 0.2s'}}
      onMouseEnter={e=>{if(!dis){e.currentTarget.style.borderColor=sc;e.currentTarget.style.transform='translateY(-3px)';}}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=`${sc}33`;e.currentTarget.style.transform='';}}>
      <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:3}}><span style={{fontSize:18}}>{relic.icon}</span><div><div style={{fontFamily:FD,fontSize:11,color:'#fff'}}>{relic.name}</div><div style={{fontSize:10,color:sc,fontFamily:FD}}>AMP · {relic.syn==='any'?'UNIVERSAL':relic.syn}</div></div></div>
      <div style={{fontFamily:FB,fontSize:10,color:'#999',lineHeight:1.3}}>{relic.desc}</div>
      {price!=null&&<div style={{fontFamily:FD,fontSize:11,color:gold>=price?'#ffd700':'#ff4455',marginTop:3}}>💰{price}</div>}
    </div>;};

  const CSS=`@import url('${FURL}');@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes shakeAnim{0%,100%{transform:translate(0)}15%{transform:translate(-5px,2px)}35%{transform:translate(4px,-3px)}55%{transform:translate(-3px,4px)}75%{transform:translate(5px,-2px)}}@keyframes floatDmg{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-80px) scale(1.5)}}@keyframes enterCard{0%{opacity:0;transform:translateY(70px) scale(0.75) rotate(-6deg)}60%{opacity:1;transform:translateY(-6px) scale(1.04) rotate(1deg)}100%{opacity:1;transform:translateY(0) scale(1) rotate(0deg)}}@keyframes chargeGlow{0%,100%{box-shadow:inset 0 0 8px #ffaa3322}50%{box-shadow:inset 0 0 16px #ffaa3366}}@keyframes dmgFlash{0%{opacity:0.55}100%{opacity:0}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes shimmer{0%,100%{opacity:0.7}50%{opacity:1}}@keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}`;

  // ═══ ALIGNMENT TIER NOTIFICATION ═══
  const AlignNotif=()=>{if(!alignNotif)return null;
    return <div style={{position:'fixed',top:60,left:'50%',transform:'translateX(-50%)',zIndex:210,background:'#111e',border:`2px solid ${alignNotif.color}`,borderRadius:10,padding:'10px 20px',textAlign:'center',boxShadow:`0 0 30px ${alignNotif.color}55`,animation:'fadeUp 0.3s ease both',pointerEvents:'none',minWidth:220}}>
      <div style={{fontFamily:FD,fontSize:16,color:alignNotif.color,letterSpacing:2}}>{alignNotif.label}</div>
      <div style={{fontFamily:FB,fontSize:11,color:'#aaa',marginTop:3}}>{alignNotif.sub}</div>
    </div>;};

  // ═══ TOOLTIP OVERLAY — click anywhere to dismiss ═══
  const TooltipOverlay=()=>{if(!tooltip)return null;
    return <div onClick={()=>setTooltip(null)} style={{position:'fixed',bottom:10,left:'50%',transform:'translateX(-50%)',zIndex:200,background:'#111e',border:`2px solid ${tooltip.color}`,borderRadius:8,padding:'8px 14px',maxWidth:300,boxShadow:`0 0 20px ${tooltip.color}44`,cursor:'pointer',backdropFilter:'blur(4px)'}}>
      <div style={{fontFamily:FD,fontSize:14,color:tooltip.color,marginBottom:3}}>{tooltip.name}</div>
      <div style={{fontFamily:FB,fontSize:11,color:'#ccc',lineHeight:1.4}}>{tooltip.desc}</div>
      <div style={{fontSize:8,color:'#555',marginTop:4,textAlign:'right'}}>tap to dismiss</div>
    </div>;};

  // ═══ TITLE ═══
  if(screen==='title')return (
    <div style={{minHeight:'100vh',background:'#05010f',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:FD,color:'#fff',overflow:'hidden',position:'relative'}}>
      <style>{CSS}</style>
      {/* deep radial atmosphere */}
      <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 90% 70% at 50% 45%,#200840 0%,#0a0118 55%,#000 100%)',pointerEvents:'none'}}/>
      {/* dot halftone overlay */}
      <div style={{position:'absolute',inset:0,backgroundImage:'radial-gradient(circle,#ffffff07 1px,transparent 1px)',backgroundSize:'28px 28px',pointerEvents:'none'}}/>
      {/* slow scanline sweep */}
      <div style={{position:'absolute',left:0,right:0,height:80,background:'linear-gradient(180deg,transparent,#ffffff04,transparent)',animation:'scanline 8s linear infinite',pointerEvents:'none'}}/>
      {/* outer conic ring */}
      <div style={{position:'absolute',width:760,height:760,background:'conic-gradient(from 0deg,transparent 0deg,#ff660009 12deg,transparent 24deg,#aa33ff09 36deg,transparent 48deg)',borderRadius:'50%',animation:'spin 35s linear infinite',pointerEvents:'none'}}/>
      {/* inner glow ring */}
      <div style={{position:'absolute',width:420,height:420,border:'1px solid #ff880022',borderRadius:'50%',boxShadow:'0 0 80px #ff440018,inset 0 0 80px #aa33ff0c',animation:'pulse 5s ease-in-out infinite',pointerEvents:'none'}}/>

      {/* ── main content ── */}
      <div style={{position:'relative',zIndex:1,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center'}}>

        {/* build tag */}
        <div style={{fontFamily:FB,fontSize:10,letterSpacing:8,color:'#ffaa3388',animation:'fadeUp 0.4s ease both',marginBottom:20,textTransform:'uppercase'}}>Hackathon Build · 2026</div>

        {/* POTENTIAL */}
        <div style={{fontSize:'clamp(58px,11vw,112px)',lineHeight:0.88,fontFamily:FD,letterSpacing:6,
          background:'linear-gradient(170deg,#fff 0%,#ffe580 35%,#ff9900 70%,#ff5500 100%)',
          WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',
          filter:'drop-shadow(0 0 28px #ff880060) drop-shadow(3px 5px 0 #000)',
          animation:'fadeUp 0.5s 0.1s ease both'}}>
          POTENTIAL
        </div>

        {/* MAN */}
        <div style={{fontSize:'clamp(58px,11vw,112px)',lineHeight:0.88,fontFamily:FD,letterSpacing:22,
          background:'linear-gradient(170deg,#fff 0%,#ffe580 35%,#ff9900 70%,#ff5500 100%)',
          WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',
          filter:'drop-shadow(0 0 28px #ff880060) drop-shadow(3px 5px 0 #000)',
          animation:'fadeUp 0.5s 0.18s ease both,pulse 5s 0.7s ease-in-out infinite'}}>
          MAN
        </div>

        {/* subtitle rule */}
        <div style={{display:'flex',alignItems:'center',gap:12,margin:'18px 0 14px',animation:'fadeUp 0.5s 0.28s ease both',opacity:0}}>
          <div style={{width:60,height:1,background:'linear-gradient(90deg,transparent,#ffaa3388)'}}/>
          <span style={{fontFamily:FB,fontSize:11,letterSpacing:5,color:'#ffaa3399',textTransform:'uppercase'}}>A Comic City Story</span>
          <div style={{width:60,height:1,background:'linear-gradient(270deg,transparent,#ffaa3388)'}}/>
        </div>

        {/* tagline */}
        <div style={{fontFamily:FB,fontSize:13,color:'#7766aa',letterSpacing:2,marginBottom:28,animation:'fadeUp 0.5s 0.34s ease both',opacity:0}}>
          Place · Resolve · Evolve
        </div>

        {/* keyword pills */}
        <div style={{display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center',maxWidth:460,marginBottom:36,animation:'fadeUp 0.5s 0.42s ease both',opacity:0}}>
          {[['Combo','#ff4455'],['Channel','#bb55ff'],['Momentum','#33ddff'],['Blood','#ff7722'],['Corrode','#44dd66'],['Fortify','#4499ff'],['Echo','#dd88ff'],['Frenzy','#ff55aa']].map(([kw,col])=>
            <span key={kw} style={{fontFamily:FD,fontSize:10,padding:'3px 11px',background:`${col}14`,border:`1px solid ${col}44`,borderRadius:20,color:col,letterSpacing:1}}>{kw.toUpperCase()}</span>
          )}
        </div>

        {/* CTA buttons */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,animation:'fadeUp 0.5s 0.5s ease both',opacity:0}}>
          <button onClick={startGame} style={{fontFamily:FD,fontSize:22,padding:'15px 72px',
            background:'linear-gradient(135deg,#ff9900,#ff4400)',
            border:'none',borderRadius:3,color:'#fff',cursor:'pointer',
            letterSpacing:6,textTransform:'uppercase',
            textShadow:'1px 2px 0 #00000088',
            boxShadow:'0 0 48px #ff660044,0 5px 0 #882200,0 10px 30px #00000066',
            animation:'float 3s 1s ease-in-out infinite'}}>
            NEW GAME
          </button>
          <button onClick={()=>{setTutStep(0);setScreen('tutorial');}} style={{fontFamily:FD,fontSize:14,padding:'10px 48px',
            background:'transparent',border:'1px solid #ffaa3344',borderRadius:3,
            color:'#ffaa3388',cursor:'pointer',letterSpacing:4,textTransform:'uppercase'}}>
            TUTORIAL
          </button>
        </div>

        {/* version footer */}
        <div style={{marginTop:28,fontFamily:FB,fontSize:10,color:'#333',letterSpacing:3,animation:'fadeUp 0.5s 0.6s ease both',opacity:0}}>
          v0.9-alpha
        </div>
      </div>
    </div>);

  // ═══ OPENING CINEMATIC ═══
  if(screen==='openingCinematic')return (
    <div style={{minHeight:'200vh',background:'#05010f',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',fontFamily:FB,color:'#fff',padding:'60px 16px 40px',position:'relative',overflow:'hidden'}}>
      <style>{CSS}</style>
      <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at center,#ffffff12 0%,#000000c0 70%,#000 100%)',pointerEvents:'none'}}/>
      <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:760,display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
        <div style={{fontFamily:FD,fontSize:'clamp(24px,4vw,34px)',color:'#ffd46b',letterSpacing:3,textShadow:'0 2px 0 #000,0 0 18px #ffbb5566',textAlign:'center'}}>ORIGIN AWAKENING</div>
        <img src="/assets/background_with_sprite.png" alt="Potential Man cinematic" style={{width:'100%',maxWidth:640,aspectRatio:'1 / 1',objectFit:'cover',borderRadius:10,border:'2px solid #ffd46b66',boxShadow:'0 0 38px #7d55ff55,0 0 20px #ffbb5544',imageRendering:'pixelated'}}/>
        <div style={{fontFamily:FB,fontSize:12,color:'#c9c2e8',textAlign:'center',maxWidth:640,lineHeight:1.6,padding:'0 8px'}}>
          Potential Man escapes a hidden lab and stumbles into a city he has never seen.
          Build momentum, channel power, and survive the streets ahead.
        </div>
        <div ref={cinematicBtnRef} style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}}>
          <button onClick={()=>setScreen('map')} style={{fontFamily:FD,fontSize:14,padding:'8px 24px',background:'linear-gradient(135deg,#ff9900,#ff5500)',border:'2px solid #fff',borderRadius:6,color:'#fff',cursor:'pointer',letterSpacing:2,textShadow:'1px 1px 0 #000'}}>ENTER THE CITY</button>
          <button onClick={()=>setScreen('map')} style={{fontFamily:FD,fontSize:12,padding:'8px 16px',background:'#1b1b2b',border:'1px solid #5b5b7a',borderRadius:6,color:'#c7c7d8',cursor:'pointer'}}>SKIP</button>
        </div>
      </div>
    </div>);

  // ═══ MAP ═══
  if(screen==='map')return (
    <div style={{minHeight:'100vh',background:bg1,padding:12,fontFamily:FB,color:'#fff'}}>
      <style>{CSS}</style><TooltipOverlay/><AlignNotif/>
      {restPopup&&<div style={{position:'fixed',inset:0,background:'#000b',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{background:'#0d1a0d',border:'2px solid #66bb66',borderRadius:12,padding:'24px 32px',textAlign:'center',boxShadow:'0 0 40px #66bb6644'}}>
          <div style={{fontSize:36,marginBottom:8}}>🏕️</div>
          <div style={{fontFamily:FD,fontSize:18,color:'#66bb66',marginBottom:4}}>REST SITE</div>
          <div style={{fontFamily:FB,fontSize:13,color:'#aaa',marginBottom:16}}>You recover <span style={{color:'#66ff66',fontWeight:700}}>+{restPopup.hp} HP</span></div>
          <button onClick={()=>{healPlayer(restPopup.hp);setMapLog(p=>[...p,`🏕 +${restPopup.hp} HP`]);setRestPopup(null);}} style={{fontFamily:FD,fontSize:13,padding:'7px 28px',background:'linear-gradient(135deg,#336633,#55aa55)',border:'2px solid #66bb66',borderRadius:7,color:'#fff',cursor:'pointer'}}>
            Rest →
          </button>
        </div>
      </div>}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 10px',background:'#00000066',borderRadius:8,border:`1px solid ${accent}22`,marginBottom:6,flexWrap:'wrap',gap:4}}>
        <div><span style={{fontFamily:FD,fontSize:13,color:accent}}>⚡ Potential Man</span> <span style={{fontSize:8,color:'#555'}}>Lv.{potLv}</span></div>
        <div style={{display:'flex',gap:8,fontSize:10,alignItems:'center',flexWrap:'wrap'}}>
          <span>❤️{player?.hp}/{player?.maxHp}</span><span>💰{gold}</span><span>⚡{maxEnergy}</span><span>📖{deck.length} powers</span>
          <span style={{display:'flex',alignItems:'center',gap:3}}>
            <span style={{fontFamily:FD,fontSize:8,color:alignColor}}>{alignment==='hero'?'⚔️':'💀'}</span>
            <div style={{width:48,height:6,background:'#1a1a2a',borderRadius:3,overflow:'hidden',border:'1px solid #333'}}>
              <div style={{height:'100%',width:`${evilness}%`,background:`linear-gradient(90deg,#33aaff,${evilness<50?'#33aaff':'#ff3366'})`,borderRadius:3,transition:'width 0.5s'}}/>
            </div>
            <span style={{fontFamily:FD,fontSize:10,color:alignColor}}>{alignLabel}</span>
          </span>
          {relics.length>0&&<span title="Amps">{relics.map(r=>r.icon).join('')}</span>}
          <button onClick={(e)=>{e.stopPropagation();setTooltip(null);setShowCodex(p=>!p);}} style={{fontFamily:FD,fontSize:11,padding:'2px 6px',background:`${accent}22`,border:`1px solid ${accent}44`,borderRadius:3,color:accent,cursor:'pointer'}}>📋</button>
        </div>
      </div>
      {showCodex&&<div style={{position:'fixed',inset:0,background:'#000c',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:12}} onClick={()=>{setShowCodex(false);setTooltip(null);}}>
        <div style={{background:bg2,border:`2px solid ${accent}44`,borderRadius:12,padding:16,maxWidth:460,maxHeight:'80vh',overflow:'auto',width:'100%'}} onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',gap:4,marginBottom:10,borderBottom:`1px solid ${accent}22`,paddingBottom:6}}>
            {['powers','stats'].map(tab=><button key={tab} onClick={()=>setCodexTab(tab)} style={{fontFamily:FD,fontSize:10,padding:'3px 12px',background:codexTab===tab?`${accent}33`:'#1a1a2a',border:`1px solid ${codexTab===tab?accent:`${accent}33`}`,borderRadius:4,color:codexTab===tab?accent:'#555',cursor:'pointer',textTransform:'uppercase'}}>{tab==='powers'?'⚡ Superpowers':'📊 Stats'}</button>)}
          </div>
          {codexTab==='powers'&&<>
            {copiedAbilities.length===0&&<div style={{fontSize:11,color:'#444',fontFamily:FB}}>No superpowers acquired yet.</div>}
            {copiedAbilities.map((a,i)=> <div key={i} style={{fontSize:11,color:'#aaa',padding:'3px 0'}}>{a.icon} {a.sig} <KW k={a.kw}/> · {a.name}</div>)}
            {relics.length>0&&<div style={{marginTop:8,borderTop:'1px solid #333',paddingTop:5}}><div style={{fontFamily:FD,fontSize:11,color:'#ffaa33',marginBottom:3}}>AMPS</div>{relics.map((r,i)=> <div key={i} style={{fontSize:11,color:'#888',padding:'2px 0'}}>{r.icon} {r.name}: {r.desc}</div>)}</div>}
          </>}
          {codexTab==='stats'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 12px'}}>
            {[['❤️ HP',`${player?.hp} / ${player?.maxHp}`],['⚡ Max Energy',maxEnergy],['💰 Gold',gold],['🎯 Crit Chance',`${player?.critChance||10}%`],['📖 Deck Size',deck.length],['🏆 Floor',curFloor],['⚔️ Level',potLv],['✨ Superpowers',copiedAbilities.length],['🎒 Amps',relics.length]].map(([k,v])=>
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #1a1a2a'}}>
                <span style={{fontFamily:FB,fontSize:11,color:'#666'}}>{k}</span>
                <span style={{fontFamily:FD,fontSize:11,color:accent}}>{v}</span>
              </div>)}
          </div>}
          <button onClick={()=>setShowCodex(false)} style={{marginTop:10,fontFamily:FD,fontSize:11,padding:'3px 14px',background:'#333',border:`1px solid ${accent}`,borderRadius:4,color:'#fff',cursor:'pointer'}}>CLOSE</button>
        </div>
      </div>}
      {mapLog.length>0&&<div style={{maxWidth:500,margin:'0 auto 6px',padding:'4px 12px',background:`${accent}08`,border:`1px solid ${accent}22`,borderRadius:5,fontSize:11,textAlign:'center',color:'#aaa'}}>{mapLog[mapLog.length-1]}</div>}
      <h3 style={{fontFamily:FD,fontSize:14,textAlign:'center',color:accent,margin:'0 0 6px',letterSpacing:2}}>Floor {curFloor}</h3>
      <div style={{maxWidth:500,margin:'0 auto',display:'flex',flexDirection:'column-reverse',gap:0}}>
        {hexMap?.map((fn,fi)=>{
          const[cf]=(curNodeId||'0-0').split('-').map(Number);
          const co=curNodeId?hexMap[cf]?.find(n=>n.id===curNodeId):null;
          const isMerge=fn.length===1&&fi>0&&fi<(hexMap?.length||1)-1&&fi!==13&&fi!==14;
          const nextFloor=hexMap[fi+1];
          // Connector strip: shows which nodes in the NEXT floor each current-floor node connects to
          const connectorRow=nextFloor&&<div key={`conn-${fi}`} style={{display:'flex',justifyContent:'center',gap:8,alignItems:'center',height:10,marginLeft:24}}>
            {nextFloor.map((nxt,ni)=>{
              const isCurPath=co?.conns?.includes(nxt.id);
              const anyPath=fn.some(n=>n.conns?.includes(nxt.id));
              const nc=NC[nxt.type]||'#555';
              return <div key={ni} style={{width:50,height:6,borderRadius:3,
                background:isCurPath?`${nc}cc`:anyPath?`${nc}22`:'#1a1a2a22',
                boxShadow:isCurPath?`0 0 8px ${nc}88`:undefined,
                transition:'background 0.3s',
              }}/>;
            })}
          </div>;
          const floorRow=<div key={fi} style={{display:'flex',justifyContent:'center',gap:8,alignItems:'center',marginBottom:3}}>
            <div style={{width:20,fontSize:10,color:isMerge?accent:'#333',fontFamily:FD,textAlign:'right'}}>{isMerge?'◆':fi}</div>
            {fn.map(node=>{const reach=co?.conns?.includes(node.id);const isCur=node.id===curNodeId;const nc=NC[node.type]||'#555';
              return <div key={node.id} onClick={()=>reach?selectNode(node.id):null} style={{
                width:50,height:50,borderRadius:6,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                background:isCur?`${nc}28`:node.visited?'#1a1a2a':reach?`${nc}10`:'#0a0a12',
                border:`2px solid ${isCur?nc:reach?nc:node.visited?'#333':'#1a1a22'}`,
                cursor:reach?'pointer':'default',
                opacity:!reach&&!node.visited&&!isCur?0.15:1,
                transition:'all 0.2s',
              }} onMouseEnter={e=>{if(reach){e.currentTarget.style.transform='scale(1.15)';e.currentTarget.style.boxShadow=`0 0 14px ${nc}88`;}}}
                 onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
                <div style={{fontSize:16}}>{NI[node.type]}</div>
                <div style={{fontSize:9,color:isCur||reach?nc:'#444',fontFamily:FD,letterSpacing:0.5}}>{node.type.toUpperCase()}</div>
                {reach&&<div style={{fontSize:8,color:nc,fontFamily:FD}}>TAP</div>}
              </div>;})}
          </div>;
          // In column-reverse layout: connector appears between this floor (below) and next floor (above)
          return [floorRow, connectorRow].filter(Boolean);
        })}
      </div>
      <details style={{maxWidth:500,margin:'10px auto 0'}}><summary style={{cursor:'pointer',fontFamily:FD,color:accent,fontSize:10}}>📖 Superpowers ({deck.length})</summary>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:6,justifyContent:'center'}}>{deck.map(c=> <Card key={c.id} card={c}/>)}</div></details>
      {pendingBattle&&(()=>{const en=pendingBattle.en;const ec=en.color;const isVillain=en.isVillain==='True';
        const statKeys=[['PWR',en.Power],['STR',en.Strength],['MAG',en.Magic],['INT',en.Intelligence],['SPD',en.Speed],['DEF',en.Defense],['POI',en.Poison]];
        const maxStat=Math.max(...statKeys.map(([,v])=>parseInt(v)||0),1);
        return <div style={{position:'fixed',inset:0,background:'#000e',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:12}}>
        <div style={{background:bg2,border:`3px solid ${ec}`,borderRadius:14,padding:20,maxWidth:440,width:'100%',animation:'fadeUp 0.3s',boxShadow:`0 0 40px ${ec}44`}}>
          {/* VS header */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{textAlign:'center',flex:1}}>
              <div style={{fontFamily:FD,fontSize:11,color:accent,letterSpacing:2}}>⚡ YOU</div>
              <div style={{fontFamily:FD,fontSize:14,color:'#fff'}}>Potential Man</div>
              <div style={{fontFamily:FB,fontSize:11,color:'#888'}}>Lv.{potLv} · {player?.hp}/{player?.maxHp} HP · {player?.def||2} DEF</div>
            </div>
            <div style={{fontFamily:FD,fontSize:22,color:'#ff336688',padding:'0 10px'}}>VS</div>
            <div style={{textAlign:'center',flex:1}}>
              <div style={{fontFamily:FD,fontSize:11,color:ec,letterSpacing:2}}>{isVillain?'💀 VILLAIN':'⚔️ HERO'}</div>
              <div style={{fontFamily:FD,fontSize:14,color:ec}}>{en.Name}</div>
              <div style={{fontFamily:FB,fontSize:11,color:'#888'}}>{en.effectiveClass?.toUpperCase()} · {en.gameHp} HP</div>
            </div>
          </div>
          <HpBar hp={en.gameHp} max={en.gameMaxHp} color={ec} h={10}/>
          {/* Enemy stats grid */}
          <div style={{margin:'10px 0',display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
            {statKeys.map(([label,rawVal])=>{const v=parseInt(rawVal)||0;const pct=v/maxStat;
              return <div key={label} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                <div style={{width:8,height:40,background:'#1a1a2a',borderRadius:4,overflow:'hidden',border:'1px solid #333',position:'relative'}}>
                  <div style={{position:'absolute',bottom:0,width:'100%',height:`${pct*100}%`,background:pct>0.7?ec:pct>0.4?`${ec}88`:`${ec}44`,borderRadius:4,transition:'height 0.4s'}}/>
                </div>
                <span style={{fontFamily:FD,fontSize:9,color:'#666'}}>{label}</span>
                <span style={{fontFamily:FD,fontSize:10,color:pct>0.6?ec:'#555'}}>{v}</span>
              </div>;})}
          </div>
          {/* Signature card teaser */}
          <div style={{padding:'6px 8px',background:`${ec}10`,border:`1px solid ${ec}33`,borderRadius:6,marginBottom:10}}>
            <div style={{fontFamily:FD,fontSize:11,color:'#555',letterSpacing:1,marginBottom:4}}>🔓 DEFEAT TO UNLOCK:</div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontSize:20}}>{en.signature.icon}</span>
              <div><div style={{fontFamily:FD,fontSize:11,color:'#fff'}}>{en.signature.name} <KW k={en.signature.keyword}/>{en.signature.charge&&<span style={{color:'#ffaa33',fontSize:10}}> ⏳</span>}</div>
                <div style={{fontSize:11,color:'#aaa'}}>{en.signature.desc}</div></div>
            </div>
          </div>
          <div style={{display:'flex',gap:6,justifyContent:'center'}}>
            <button onClick={commitBattle} style={{fontFamily:FD,fontSize:15,padding:'7px 30px',background:`linear-gradient(135deg,${ec},${isVillain?'#880022':'#0044aa'})`,border:'2px solid #fff',borderRadius:8,color:'#fff',cursor:'pointer',boxShadow:`0 0 20px ${ec}44`}}>FIGHT</button>
            <button onClick={()=>setPendingBattle(null)} style={{fontFamily:FD,fontSize:11,padding:'7px 14px',background:'#222',border:'1px solid #444',borderRadius:8,color:'#888',cursor:'pointer'}}>BACK</button>
          </div>
        </div>
      </div>;})()}
    </div>);

  // ═══ BATTLE WIN SCREEN ═══
  if(screen==='battleWin'){
    const en=battle.enemy;
    const isBoss=en?.isBoss;const isElite=en?.isElite;
    const ec=en?.color||accent;
    const typeLabel=isBoss?'👑 BOSS DEFEATED':isElite?'💀 ELITE DEFEATED':'⚔️ VICTORY!';
    const typeColor=isBoss?'#ffd700':isElite?'#ff3366':accent;
    const totalPending=Object.values(pendingAttrs).reduce((a,b)=>a+b,0);
    const remaining=attrPoints-totalPending;
    const addAttr=k=>{if(remaining<=0)return;setPendingAttrs(p=>({...p,[k]:p[k]+1}));};
    const subAttr=k=>{if((pendingAttrs[k]||0)<=0)return;setPendingAttrs(p=>({...p,[k]:Math.max(0,p[k]-1)}));};
    const handleClaim=()=>{
      setPlayer(p=>{
        if(!p)return p;
        const cur=p.attrs||{};
        const newAttrs={};ATTR_INFO.forEach(({key})=>{newAttrs[key]=(cur[key]||0)+(pendingAttrs[key]||0);});
        const vitHp=(pendingAttrs.Vitality||0)*8;
        const defBonus=(pendingAttrs.Defense||0);
        // Grow actual CSV stats on the player object
        const csvDelta={};
        ['Strength','Magic','Defense','Speed','Poison','Rage','Power'].forEach(k=>{if(pendingAttrs[k])csvDelta[k]=(p[k]||40)+(pendingAttrs[k]||0);});
        return{...p,...csvDelta,attrs:newAttrs,maxHp:p.maxHp+vitHp,hp:Math.min(p.maxHp+vitHp,p.hp+vitHp),def:(p.def||2)+defBonus};
      });
      setAttrPoints(0);setPendingAttrs({Strength:0,Magic:0,Defense:0,Speed:0,Vitality:0,Poison:0,Rage:0,Power:0});
      setScreen('reward');
    };
    const goldEarned=15+curFloor*3+(isBoss?50:isElite?20:0);
    return (
      <div style={{minHeight:'100vh',background:bg1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',fontFamily:FB,color:'#fff',padding:'16px 12px',boxSizing:'border-box',overflowY:'auto'}}>
        <style>{CSS}</style>
        {/* Header */}
        <div style={{textAlign:'center',marginBottom:12,marginTop:8}}>
          <div style={{fontFamily:FD,fontSize:32,color:typeColor,textShadow:`3px 3px 0 #000`,letterSpacing:2}}>{typeLabel}</div>
          {en&&<div style={{fontFamily:FD,fontSize:15,color:ec,marginTop:2,letterSpacing:1}}>{en.Name}</div>}
          <div style={{fontSize:11,color:'#666',marginTop:4}}>Lv.{potLv} · {player?.hp}/{player?.maxHp} HP · 💰 +{goldEarned} gold</div>
        </div>
        {/* Superpower unlocked */}
        {en&&<div style={{width:'100%',maxWidth:360,background:'#ffffff08',border:`1px solid ${ec}44`,borderRadius:8,padding:'8px 12px',marginBottom:10,textAlign:'center',boxSizing:'border-box'}}>
          <div style={{fontFamily:FD,fontSize:10,color:'#555',letterSpacing:2,marginBottom:4}}>SUPERPOWER UNLOCKED</div>
          <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
            <span style={{fontSize:24}}>{en.signature.icon}</span>
            <div style={{textAlign:'left'}}>
              <div style={{fontFamily:FD,fontSize:12,color:'#fff'}}>{en.signature.name}</div>
              <div style={{fontSize:10,color:'#aaa'}}>{en.signature.desc}</div>
            </div>
          </div>
        </div>}
        {/* Attribute allocation */}
        <div style={{width:'100%',maxWidth:360,background:'#ffffff06',border:'1px solid #ffffff22',borderRadius:8,padding:'10px 12px',marginBottom:10,boxSizing:'border-box'}}>
          <div style={{textAlign:'center',marginBottom:8}}>
            <div style={{fontFamily:FD,fontSize:14,color:'#ffd700'}}>LEVEL UP · Lv.{potLv}</div>
            <div style={{fontSize:11,color:remaining>0?'#ffcc33':'#55ddbb',marginTop:2}}>
              {remaining>0?`${remaining} point${remaining!==1?'s':''} to spend`:'All points spent ✓'}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
            {ATTR_INFO.map(({key,icon,color,desc})=>{
              const cur=key==='Vitality'?(player?.attrs?.Vitality||0):(player?.[key]||40);const pend=(pendingAttrs[key]||0);const total=cur+pend;
              return(
                <div key={key} style={{background:'#00000033',border:`1px solid ${color}33`,borderRadius:6,padding:'5px 7px',display:'flex',flexDirection:'column',gap:2}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{fontFamily:FD,fontSize:11,color}}>{icon} {key}</span>
                    <span style={{fontFamily:FD,fontSize:13,color:'#fff'}}>{total}{pend>0&&<span style={{color:'#ffd700',fontSize:10}}> +{pend}</span>}</span>
                  </div>
                  <div style={{fontSize:8,color:'#555',marginBottom:2,lineHeight:1.2}}>{desc}</div>
                  <div style={{display:'flex',gap:3,justifyContent:'center'}}>
                    <button onClick={()=>subAttr(key)} disabled={pend<=0} style={{fontFamily:FD,fontSize:13,width:24,height:20,background:'transparent',border:`1px solid ${pend>0?'#ff4444':'#333'}`,borderRadius:3,color:pend>0?'#ff4444':'#333',cursor:pend>0?'pointer':'default',padding:0,lineHeight:1}}>−</button>
                    <button onClick={()=>addAttr(key)} disabled={remaining<=0} style={{fontFamily:FD,fontSize:13,width:24,height:20,background:'transparent',border:`1px solid ${remaining>0?color:'#333'}`,borderRadius:3,color:remaining>0?color:'#333',cursor:remaining>0?'pointer':'default',padding:0,lineHeight:1}}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Claim button */}
        <div style={{width:'100%',maxWidth:360,textAlign:'center'}}>
          <button onClick={handleClaim} style={{fontFamily:FD,fontSize:16,padding:'9px 32px',background:`linear-gradient(135deg,${ec}cc,${isBoss?'#cc6600':isElite?'#660033':accent}cc)`,border:`2px solid ${remaining>0?'#ffcc33':ec}`,borderRadius:8,color:'#fff',cursor:'pointer',width:'100%'}}>
            {remaining>0?`CLAIM REWARDS (${remaining} pts unspent)`:'CLAIM REWARDS →'}
          </button>
        </div>
      </div>
    );
  }

  // ═══ BATTLE ═══
  if(screen==='battle'){
    const selCard=battle.hand.find(c=>c.id===selectedCardId);
    const validSet=selCard?getValid(battle.page,selCard):new Set();
    const en=battle.enemy;const isP=battle.phase==='player'&&!animPhase;
    const visibleEnemyPanels=getIntentVisibility(player?.Speed||40);
    const queuedCardCount=battle.queuedPages.reduce((sum,p)=>sum+(p.cardCount||p.cards?.length||0),0);
    const totalPlacedCount=queuedCardCount+battle.placedCards.length;
    const totalPageCount=battle.queuedPages.length+(battle.placedCards.length>0?1:0);
    const momT=hasR('momDown')?2:3;
    const canPlay=c=>{if(!isP)return false;if(c.keyword==='blood'){const rageCostReduce=Math.floor(((player?.attrs?.Rage||0))/12);return(player?.hp||0)>Math.max(1,(hasR('bloodCheap')?3:c.bloodCost)-rageCostReduce);}
      if(c.keyword==='frenzy')return getValid(battle.page,c).size>0;
      if(battle.momentum>=momT&&!battle.momentumUsed)return true;return battle.energy>=c.cost;};

    // Find all cards currently on the page (placed + pendingCharges + activeCharges)
    const allPageCards=[...battle.placedCards,...battle.pendingCharges,...battle.activeCharges];

    return (
      <div style={{minHeight:'100vh',background:bg1,padding:10,fontFamily:FB,color:'#fff',display:'flex',flexDirection:'column',animation:shake?'shakeAnim 0.35s':undefined,zoom:0.9}}>
        <style>{CSS}</style><TooltipOverlay/><AlignNotif/>
        {slatePreview!==null&&(()=>{
          const{cards,variant}=slatePreview;
          const previewCards=(cards||[]).slice(0,4);
          const panelCount=clamp(previewCards.length,1,4);
          const preferredKey=`${variant}_${panelCount}`;
          const fallbackVariant=loadedSlateRef.current.has(preferredKey)?variant:
            loadedSlateRef.current.has(`Bubble_${panelCount}`)?'Bubble':
            loadedSlateRef.current.has(`Brutal_${panelCount}`)?'Brutal':'Action';
          const slateImg=`/assets/${fallbackVariant}_Comic_Slate_${panelCount}.png`;
          const glow=variant==='Action'?'#ff5533aa':variant==='Brutal'?'#ff2255aa':'#44aaffaa';
          const FLASH={attack:{c:'#ff2244',label:'ATTACK!'},magic:{c:'#aa33ff',label:'MAGIC!'},defend:{c:'#2266ff',label:'DEFEND!'},poison:{c:'#22cc44',label:'POISON!'},rage:{c:'#ff5500',label:'RAGE!'},heal:{c:'#22ccaa',label:'HEAL!'},draw:{c:'#11ccff',label:'DRAW!'}};
          const sortedCards=[...previewCards].sort((a,b)=>((a.row??0)*COLS+(a.col??0))-((b.row??0)*COLS+(b.col??0)));
          const rowBuckets=[[],[]],colBuckets=[[],[]];
          sortedCards.forEach(c=>{
            const rr=clamp(c.row??0,0,1),cc=clamp(c.col??0,0,1);
            rowBuckets[rr].push(c);colBuckets[cc].push(c);
          });
          const half='49%';
          const slots=[];
          if(sortedCards.length===1){
            slots.push({card:sortedCards[0],style:{top:0,left:0,width:'100%',height:'100%'}});
          }else if(sortedCards.length===2){
            const verticalPair=[...sortedCards].sort((x,y)=>(x.row??0)-(y.row??0));
            slots.push({card:verticalPair[0],style:{top:0,left:0,width:'100%',height:half}});
            slots.push({card:verticalPair[1],style:{top:'51%',left:0,width:'100%',height:half}});
          }else if(sortedCards.length===3){
            const topCount=rowBuckets[0].length,bottomCount=rowBuckets[1].length;
            const leftCount=colBuckets[0].length,rightCount=colBuckets[1].length;
            if(topCount===2||bottomCount===2){
              const twoRow=topCount===2?0:1;
              const singleRow=twoRow===0?1:0;
              const two=rowBuckets[twoRow].sort((x,y)=>(x.col??0)-(y.col??0));
              const one=rowBuckets[singleRow][0];
              if(twoRow===0){
                slots.push({card:two[0],style:{top:0,left:0,width:half,height:half}});
                slots.push({card:two[1],style:{top:0,left:'51%',width:half,height:half}});
                slots.push({card:one,style:{top:'51%',left:0,width:'100%',height:half}});
              }else{
                slots.push({card:one,style:{top:0,left:0,width:'100%',height:half}});
                slots.push({card:two[0],style:{top:'51%',left:0,width:half,height:half}});
                slots.push({card:two[1],style:{top:'51%',left:'51%',width:half,height:half}});
              }
            }else if(leftCount===2||rightCount===2){
              const twoCol=leftCount===2?0:1;
              const singleCol=twoCol===0?1:0;
              const two=colBuckets[twoCol].sort((x,y)=>(x.row??0)-(y.row??0));
              const one=colBuckets[singleCol][0];
              if(twoCol===0){
                slots.push({card:two[0],style:{top:0,left:0,width:half,height:half}});
                slots.push({card:two[1],style:{top:'51%',left:0,width:half,height:half}});
                slots.push({card:one,style:{top:0,left:'51%',width:half,height:'100%'}});
              }else{
                slots.push({card:one,style:{top:0,left:0,width:half,height:'100%'}});
                slots.push({card:two[0],style:{top:0,left:'51%',width:half,height:half}});
                slots.push({card:two[1],style:{top:'51%',left:'51%',width:half,height:half}});
              }
            }else{
              slots.push({card:sortedCards[0],style:{top:0,left:0,width:half,height:half}});
              slots.push({card:sortedCards[1],style:{top:0,left:'51%',width:half,height:half}});
              slots.push({card:sortedCards[2],style:{top:'51%',left:0,width:'100%',height:half}});
            }
          }else{
            const cellMap=[
              {top:0,left:0,width:half,height:half},
              {top:0,left:'51%',width:half,height:half},
              {top:'51%',left:0,width:half,height:half},
              {top:'51%',left:'51%',width:half,height:half},
            ];
            sortedCards.forEach((card,idx)=>slots.push({card,style:cellMap[idx]}));
          }
          return <div style={{position:'fixed',inset:0,background:'#000d',zIndex:180,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
            <div style={{position:'relative',width:290,height:390,borderRadius:10,boxShadow:`0 0 24px ${glow}, 0 0 48px ${glow}`}}>
              <div style={{position:'absolute',inset:0}}>
                {slots.map((slot,i)=>{
                  const card=slot.card;
                  const cfg=card?(FLASH[card.type]||FLASH.attack):{c:'#111',label:''};
                  return <div key={i} style={{position:'absolute',...slot.style,background:cfg.c,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,overflow:'hidden'}}>
                    {card&&<><span style={{fontSize:36,lineHeight:1,filter:'drop-shadow(0 2px 8px #0009)'}}>{card.icon||'⚡'}</span>
                    <span style={{fontFamily:FD,fontSize:11,color:'#fff',letterSpacing:2,textShadow:'0 0 8px #000,0 2px 3px #000',fontWeight:700}}>{cfg.label}</span></>}
                  </div>;
                })}
              </div>
              <img key={`${slateImg}-${slateReadyTick}`} src={slateImg} loading="eager" decoding="sync" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'fill',mixBlendMode:'multiply',pointerEvents:'none'}}/>
            </div>
          </div>;
        })()}
        {floaters.map(f=> <div key={f.id} style={{position:'fixed',left:`${f.x}%`,top:`${f.y}%`,pointerEvents:'none',zIndex:100,fontFamily:FD,fontSize:18,color:f.color,textShadow:'2px 2px 0 #000',animation:'floatDmg 1.4s ease-out forwards'}}>{f.text}</div>)}
        {damageFlash&&<div style={{position:'fixed',inset:0,background:'#ff0000',pointerEvents:'none',zIndex:160,animation:'dmgFlash 0.5s ease-out forwards',boxShadow:'inset 0 0 80px #ff0000'}}/>}
        {/* Combatants */}
        <div style={{display:'flex',justifyContent:'space-between',gap:8,marginBottom:5,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:150,padding:'5px 8px',background:'#00000066',borderRadius:8,border:`1px solid ${accent}22`}}>
            <div style={{fontFamily:FD,fontSize:12,color:accent}}>⚡ Potential Man <span style={{fontSize:8,color:'#555'}}>Lv.{potLv}</span></div>
            <HpBar hp={player?.hp||0} max={player?.maxHp||1} color="#ff4455"/>
            <div style={{display:'flex',gap:5,marginTop:4,fontSize:11,flexWrap:'wrap',alignItems:'center'}}>
              <div style={{display:'flex',gap:2}}>{Array(battle.maxEnergy).fill(0).map((_,i)=> <div key={i} style={{width:13,height:13,borderRadius:'50%',background:i<battle.energy?'linear-gradient(135deg,#ffcc33,#ff8800)':'#222',border:`1px solid ${i<battle.energy?'#ffdd55':'#333'}`}}/>)}</div>
              {(player?.def||0)>0&&<span style={{color:'#aaaaff',fontSize:11}}>🔰{player.def}</span>}
              {battle.playerBlock>0&&<span style={{color:'#4499ff'}}>🛡️{battle.playerBlock}</span>}
              {battle.momentum>0&&<span style={{color:'#33ddff'}}>⚡{battle.momentum}{battle.momentum>=momT&&!battle.momentumUsed?' FREE!':''}</span>}
              {battle.channelStacks>0&&<span style={{color:'#bb55ff'}}>✨{battle.channelStacks}</span>}
              {battle.comboCount>0&&<span style={{color:'#ff4455'}}>⚔×{battle.comboCount}</span>}
              {(battle.playerPoison||0)>0&&<span style={{color:'#44dd66'}}>☠{battle.playerPoison}{(battle.playerCorrode||0)>0?'⊛':''}</span>}
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><div style={{fontFamily:FD,fontSize:16,color:'#ff336666'}}>VS</div><div style={{fontSize:11,color:'#555',fontFamily:FD}}>T{battle.turn}</div></div>
          {en&&<div style={{flex:1,minWidth:150,padding:'5px 8px',background:'#00000066',borderRadius:8,border:`1px solid ${en.color}22`}}>
            <div style={{fontFamily:FD,fontSize:12,color:en.color}}>
              {en.effectiveClass==='boss'?'👑 ':en.effectiveClass==='elite'?'💀 ':'⚔️ '}{en.Name}
              {en.effectiveClass!=='normal'&&<span style={{fontSize:7,color:'#888',fontFamily:FB,marginLeft:4}}>[{en.effectiveClass?.toUpperCase()}]</span>}
            </div>
            <HpBar hp={en.gameHp} max={en.gameMaxHp} color={en.color}/>
            <div style={{display:'flex',gap:4,marginTop:2,justifyContent:'flex-end',fontSize:8}}>
              {en.block>0&&<span style={{color:'#4499ff'}}>🛡️{en.block}</span>}
              {en.poisonStacks>0&&<span style={{color:'#44dd66'}}>☠{en.poisonStacks}{en.corrodeStacks>0?'⊛':''}</span>}
              {(en.weakened||0)>0&&<span style={{color:'#bb55ff'}}>💫-{en.weakened}</span>}
            </div>
          </div>}
        </div>

        {/* PLAYER + ENEMY PANELS (2x2 each) + LOG */}
        <div style={{display:'flex',gap:8,justifyContent:'center',alignItems:'flex-start',flexWrap:'wrap',marginBottom:4}}>
        <div style={{background:'#f5f0e8',borderRadius:8,padding:6,flex:1,maxWidth:280,minWidth:200,border:'3px solid #111',boxShadow:'3px 3px 0 #000',position:'relative'}}>
          <div style={{position:'absolute',inset:0,borderRadius:4,opacity:0.03,backgroundImage:'radial-gradient(circle,#000 0.5px,transparent 0.5px)',backgroundSize:'6px 6px',pointerEvents:'none'}}/>
          <div style={{fontFamily:FD,fontSize:11,color:'#888',textAlign:'center',marginBottom:4,letterSpacing:1}}>
            {totalPlacedCount>0?`${totalPlacedCount} cards · ${totalPageCount} page${totalPageCount===1?'':'s'} · END TURN ↘`:
              battle.activeCharges.length>0?`⏳ ${battle.activeCharges.length} charge(s) ready`:
              '★ CREATE YOUR PANEL ★'}
          </div>
          <div style={{display:'grid',gridTemplateColumns:`repeat(${COLS},1fr)`,gridTemplateRows:`repeat(${ROWS},64px)`,gap:4}}>
            {battle.page.map((row,ri)=>row.map((cell,ci)=>{
              const key=`${ri}-${ci}`;const isV=validSet.has(key);
              const pl=cell?allPageCards.find(c=>c.id===cell):null;
              const isCharging=pl&&(battle.pendingCharges.some(c=>c.id===cell)||battle.activeCharges.some(c=>c.id===cell));
              const isActive=pl&&battle.activeCharges.some(c=>c.id===cell);
              const kInfo=pl?KW_INFO[pl.keyword]:null;
              const tc=kInfo?.color||TC[pl?.type]||'#ccc';
              const order=ri*COLS+ci+1;
              const shortName=pl?(pl.name.split("'s ")[1]||pl.name):'';
              const cardDesc=pl?({attack:`${pl.value} dmg`,magic:pl.keyword==='channel'||pl.keyword==='overchannel'?`${pl.value} pierce`:`${pl.value} magic`,defend:`+${pl.value} blk`,poison:pl.keyword==='corrode'?`${pl.value} corrode`:`${pl.value} poison`,heal:`heal ${pl.value}`,rage:pl.keyword==='blood'?`${pl.value} rage!`:`${pl.value} rage`,draw:`draw +${pl.value}`}[pl.type]||`${pl.value}`):'';
              return <div key={key} onClick={()=>isV&&selCard?placeCard(selCard,ri,ci):null} style={{
                backgroundColor:isV?'#fffbe6':'#faf8f2',
                border:`2px solid ${isV?'#ddaa33':'#e0ddd6'}`,borderRadius:4,
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                cursor:isV?'pointer':'default',transition:'all 0.15s',position:'relative',
                animation:isCharging?'chargeGlow 2s ease-in-out infinite':undefined,
                overflow:'hidden',
              }}>
                <div style={{position:'absolute',top:2,left:4,fontSize:10,color:'#ccc',fontFamily:FD}}>{order}</div>
                {pl?(<div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'4px 6px',background:`${isCharging?'#ffaa33':tc}18`,border:`1px solid ${isCharging?'#ffaa33':tc}44`,borderRadius:5,lineHeight:1,maxWidth:'94%'}}>
                  <span style={{fontSize:18,filter:isCharging?'drop-shadow(0 0 4px #ffaa33)':undefined}}>{pl.icon}</span>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:1}}>
                    <span style={{color:'#555',fontFamily:FD,fontSize:8,lineHeight:1.1}}>{shortName.length>12?shortName.slice(0,10)+'…':shortName}</span>
                    <span style={{color:isCharging?'#cc7700':tc,fontFamily:FB,fontSize:10,fontWeight:700}}>{cardDesc}{isActive?' ⏳':isCharging?' …':''}</span>
                  </div>
                </div>)
                :isV?<div style={{fontSize:10,color:'#bb8833',fontFamily:FD}}>✦</div>:null}
              </div>;}))}
          </div>
        </div>

        <div style={{background:'#101017',borderRadius:8,padding:6,flex:1,maxWidth:280,minWidth:200,border:'3px solid #111',boxShadow:'3px 3px 0 #000',position:'relative'}}>
          <div style={{fontFamily:FD,fontSize:11,color:'#888',textAlign:'center',marginBottom:4,letterSpacing:1}}>
            ENEMY PLAN · Panel {battle.enemyPlanIdx+1} acts · {visibleEnemyPanels}/{battle.enemyPlan.length} revealed
          </div>
          <div style={{display:'grid',gridTemplateColumns:`repeat(${COLS},1fr)`,gridTemplateRows:`repeat(${ROWS},64px)`,gap:4}}>
            {battle.enemyPlan.map((intentCard,idx)=>{
              const reveal=idx<visibleEnemyPanels;
              const isNow=idx===battle.enemyPlanIdx;
              const intentBg={attack:'#200808',magic:'#120820',channel:'#0e0620',defend:'#080e1a',buff:'#111108',poison:'#081408',corrode:'#060f04',heal:'#062010',shieldbash:'#080e20',catalyze:'#0d1400'}[intentCard.intent]||'#111';
              return <div key={`intent-${idx}`} style={{
                border:`2px solid ${isNow?'#ff5544':reveal?'#555':'#2a2a2a'}`,
                boxShadow:isNow?'0 0 8px #ff554466':undefined,
                borderRadius:4,
                position:'relative',
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                backgroundColor:reveal?intentBg:'#090909',
                overflow:'hidden',
              }}>
                <div style={{position:'absolute',top:2,left:4,fontSize:10,color:isNow?'#ff5544':'#aaa',fontFamily:FD}}>{isNow?'▶':''}{ idx+1}</div>
                {reveal?<IntentBox intent={intentCard.intent} val={intentCard.intentVal} weak={en.weakened} compact card={intentCard}/>:<div style={{fontSize:11,color:'#666',fontFamily:FD}}>??</div>}
              </div>;
            })}
          </div>
        </div>

        </div>

        {/* Intent legend */}
        <div style={{display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap',marginBottom:4,padding:'2px 6px',background:'#00000033',borderRadius:4}}>
          {[{i:'attack',ic:'⚔️',c:'#ff4455'},{i:'magic',ic:'✨',c:'#bb55ff'},{i:'channel',ic:'✨',c:'#aa44ee'},{i:'defend',ic:'🛡️',c:'#4499ff'},{i:'poison',ic:'☠️',c:'#44dd66'},{i:'corrode',ic:'☠️',c:'#22aa44'},{i:'heal',ic:'💚',c:'#55ddbb'},{i:'buff',ic:'💪',c:'#ffcc33'}].map(({i,ic,c})=>
            <span key={i} style={{fontFamily:FD,fontSize:10,color:c,whiteSpace:'nowrap'}}>{ic} {i}</span>)}
        </div>

        {showLog&&<div onClick={()=>setShowLog(false)} style={{position:'fixed',inset:0,background:'#000c',zIndex:190,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#111',border:'2px solid #333',borderRadius:8,padding:'10px 14px',width:360,maxHeight:'75vh',overflowY:'auto',fontFamily:FB,fontSize:11,color:'#555',lineHeight:1.8}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <span style={{fontFamily:FD,fontSize:10,color:'#888',letterSpacing:2}}>FULL COMBAT LOG</span>
              <button onClick={()=>setShowLog(false)} style={{background:'none',border:'none',color:'#555',fontSize:14,cursor:'pointer',lineHeight:1}}>✕</button>
            </div>
            {[...battle.log].reverse().map((m,i)=><div key={i} style={{color:i===0?'#ccc':'#555',borderBottom:'1px solid #1a1a1a',paddingBottom:2,marginBottom:2}}>{m}</div>)}
          </div>
        </div>}
        {/* Per-turn log strip */}
        {battle.log.slice(battle.turnLogStart).length>0&&<div style={{marginBottom:4,padding:'4px 10px',background:'#00000044',borderRadius:4,fontSize:11,color:'#555',fontFamily:FB,lineHeight:1.6,display:'flex',flexWrap:'wrap',gap:'0 10px',alignItems:'center',justifyContent:'center',textAlign:'center'}}>
          <span style={{fontFamily:FD,fontSize:10,color:'#555',letterSpacing:1,marginRight:4}}>T{battle.turn}</span>
          {battle.log.slice(battle.turnLogStart).map((m,i,arr)=><span key={i} style={{color:i===arr.length-1?'#ccc':'#555'}}>{m}</span>)}
        </div>}
        <div style={{marginBottom:4}}>
          <div style={{fontFamily:FD,fontSize:13,color:selCard?'#ffcc33':'#888',textAlign:'center',marginBottom:3,letterSpacing:1}}>
            {!isP?'⏳ Resolving...':selCard?`${panelSpanForCard(selCard)} panel${panelSpanForCard(selCard)>1?'s':''} ${selCard.charge?'· ⏳ charges next turn':''} · click golden panel`:'SELECT A SUPERPOWER'}
          </div>
          <div style={{display:'flex',gap:4,justifyContent:'center',flexWrap:'wrap',minHeight:40}}>
            {battle.hand.map((c,i)=> <div key={c.id} style={{animation:`enterCard 0.35s ${i*0.07}s cubic-bezier(0.22,1,0.36,1) both`,opacity:0}}><Card card={c} sel={c.id===selectedCardId} dis={!canPlay(c)} onClick={card=>{const nextId=card.id===selectedCardId?null:card.id;if(nextId){audio.unlock();audio.playSelect();if(card.type==='draw'){audio.playDraw();}}setSelectedCardId(nextId);}} projDmg={calcProjectedDmg(c,battle,relics,en)}/></div>)}
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'center',gap:10,alignItems:'center'}}>
          <button onClick={()=>setShowLog(true)} style={{fontFamily:FD,fontSize:11,padding:'4px 12px',background:'#1a1a1a',border:'1px solid #333',borderRadius:4,color:'#666',cursor:'pointer',letterSpacing:1}}>📋 LOG</button>
          <button onClick={endTurn} disabled={!isP} style={{fontFamily:FD,fontSize:15,padding:'5px 28px',background:isP?(battle.placedCards.length+battle.activeCharges.length>0?'linear-gradient(135deg,#ff3366,#ff6600)':'#444'):'#222',border:`2px solid ${isP?'#fff':'#333'}`,borderRadius:7,color:isP?'#fff':'#555',cursor:isP?'pointer':'not-allowed'}}>
            {battle.activeCharges.length>0&&battle.placedCards.length===0?`FIRE ${battle.activeCharges.length} CHARGE(S)`:
              battle.placedCards.length>0?`RESOLVE ${battle.placedCards.length}${battle.activeCharges.length>0?'+'+battle.activeCharges.length+'⏳':''}`:
              'END TURN'}
          </button>
          <div style={{fontSize:11,color:'#444'}}>📥{battle.drawPile.length} 📤{battle.discardPile.length}</div>
        </div>
      </div>);
  }

  // ═══ REWARD ═══
  if(screen==='reward'){
    if(rewardPhase==='absorb'){
      const MAX_ABSORB=3;
      const enName=battle.enemy?.Name||'Enemy';
      const enColor=battle.enemy?.color||accent;
      const availableCards=rewardCards.filter(c=>!absorbedCardIds.includes(c.id));
      const canAbsorb=absorbedCardIds.length<MAX_ABSORB;
      const doAbsorbAdd=()=>{
        if(!selectedAbsorbCard||!canAbsorb)return;
        setDeck(p=>[...p,{...selectedAbsorbCard,id:uid()}]);
        setAbsorbedCardIds(p=>[...p,selectedAbsorbCard.id]);
        setSelectedAbsorbCard(null);};
      const doAbsorbSwap=deckCard=>{
        if(!selectedAbsorbCard||!canAbsorb)return;
        setDeck(p=>[...p.filter(x=>x.id!==deckCard.id),{...selectedAbsorbCard,id:uid()}]);
        setAbsorbedCardIds(p=>[...p,selectedAbsorbCard.id]);
        setSelectedAbsorbCard(null);};
      const doAbsorbDone=()=>{setSelectedAbsorbCard(null);setRewardPhase('relic');};
      return (
      <div style={{minHeight:'100vh',background:bg1,padding:'12px 16px',fontFamily:FB,color:'#fff',overflowY:'auto'}}>
        <style>{CSS}</style><TooltipOverlay/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <h2 style={{fontFamily:FD,fontSize:18,color:'#ffd700',margin:0}}>🏆 {enName} Defeated!</h2>
          <button onClick={doAbsorbDone} style={{fontFamily:FD,fontSize:11,padding:'5px 14px',background:'linear-gradient(135deg,#ffaa33,#ff6600)',border:'2px solid #fff',borderRadius:6,color:'#fff',cursor:'pointer'}}>
            Done → Amp
          </button>
        </div>
        <div style={{fontFamily:FD,fontSize:9,color:enColor,marginBottom:8}}>
          {!canAbsorb?`Max absorbs reached (${MAX_ABSORB}/3). Click Done to continue.`:absorbedCardIds.length>0?`${absorbedCardIds.length}/${MAX_ABSORB} absorbed. Keep going or click Done.`:`Browse their deck. Select up to ${MAX_ABSORB} cards to absorb into your build.`}
        </div>

        {/* Three-column swap layout */}
        <div style={{display:'flex',gap:10,alignItems:'flex-start',flexWrap:'wrap'}}>

          {/* Col 1: Enemy deck */}
          <div style={{flex:1,minWidth:280}}>
            <div style={{fontFamily:FD,fontSize:11,color:'#666',letterSpacing:1,marginBottom:8}}>
              {enName.toUpperCase()}'S DECK ({availableCards.length} · {absorbedCardIds.length} absorbed)
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
              {rewardCards.map((c,i)=>{
                const taken=absorbedCardIds.includes(c.id);
                const isSel=selectedAbsorbCard?.id===c.id;
                const isSig=i===0;
                return <div key={c.id} style={{position:'relative',width:'max-content',justifySelf:'center',opacity:taken?0.3:1,transition:'opacity 0.3s',borderRadius:8,boxShadow:isSig&&!taken?'0 0 0 2px #ffd700aa, 0 0 16px #ffd70088':'none'}}>
                  {taken&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:2,fontFamily:FD,fontSize:20,pointerEvents:'none'}}>✓</div>}
                  <Card card={c} sel={isSel} dis={taken} onClick={taken?undefined:()=>setSelectedAbsorbCard(isSel?null:c)}/>
                </div>;})}
            </div>
          </div>

          {/* Col 2: Action panel */}
          <div style={{flexShrink:0,width:150}}>
            <div style={{fontFamily:FD,fontSize:11,color:'#666',letterSpacing:1,marginBottom:8}}>ACTION</div>
            {selectedAbsorbCard
              ? <div style={{padding:'8px 10px',background:`${enColor}0d`,border:`1px solid ${enColor}33`,borderRadius:6}}>
                  <div style={{fontFamily:FD,fontSize:9,color:enColor,marginBottom:6}}>{selectedAbsorbCard.name}</div>
                  <Card card={selectedAbsorbCard}/>
                  <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:8}}>
                    <button onClick={doAbsorbAdd} disabled={!canAbsorb} style={{fontFamily:FD,fontSize:9,padding:'5px 0',background:canAbsorb?`${enColor}33`:'#222',border:`1px solid ${canAbsorb?enColor:'#444'}`,borderRadius:5,color:canAbsorb?'#fff':'#555',cursor:canAbsorb?'pointer':'not-allowed'}}>
                      ✚ Add to deck
                    </button>
                    <button onClick={()=>setSelectedAbsorbCard(null)} style={{fontFamily:FD,fontSize:9,padding:'5px 0',background:'#1a1a2a',border:'1px solid #333',borderRadius:5,color:'#666',cursor:'pointer'}}>
                      ✕ Cancel
                    </button>
                  </div>
                  {canAbsorb&&<div style={{fontFamily:FD,fontSize:7,color:'#444',marginTop:8,letterSpacing:1,textAlign:'center'}}>or click a card in Your Deck to swap</div>}
                  {!canAbsorb&&<div style={{fontFamily:FD,fontSize:7,color:'#ff4455',marginTop:6,letterSpacing:1}}>Absorb limit reached ({MAX_ABSORB}/3)</div>}
                </div>
              : <div style={{fontFamily:FD,fontSize:8,color:'#333',padding:'10px 0'}}>← select a card</div>}
          </div>

          {/* Col 3: Your deck */}
          <div style={{flex:1,minWidth:280}}>
            <div style={{fontFamily:FD,fontSize:11,color:'#666',letterSpacing:1,marginBottom:8}}>
              YOUR DECK ({deck.length})
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
              {deck.map(c=><Card key={c.id} card={c} onClick={selectedAbsorbCard&&canAbsorb?()=>doAbsorbSwap(c):undefined} dis={!selectedAbsorbCard||!canAbsorb}/>)}
            </div>
          </div>

        </div>
      </div>);}

    if(rewardPhase==='relic')return (
      <div style={{minHeight:'100vh',background:bg1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:16,fontFamily:FB,color:'#fff'}}>
        <style>{CSS}</style><TooltipOverlay/>
        <h2 style={{fontFamily:FD,fontSize:18,color:'#ffaa33',marginBottom:8}}>🎁 PICK AN AMP (1 of 3)</h2>
        <div style={{display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap',marginBottom:10}}>
          {rewardRelics.map((r,i)=> <div key={r.id} style={{animation:`fadeUp 0.3s ${i*0.1}s ease both`,opacity:0}}><Relic relic={r} onClick={rel=>pickRewardRelic(rel)}/></div>)}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:'center'}}>
          <button onClick={()=>pickRewardRelic(null)} style={{fontFamily:FD,fontSize:11,padding:'5px 16px',background:'#222',border:'1px solid #444',borderRadius:5,color:'#666',cursor:'pointer'}}>Skip →</button>
          <button onClick={()=>{setGold(p=>p+15);pickRewardRelic(null);}} style={{fontFamily:FD,fontSize:11,padding:'5px 16px',background:'#111',border:'1px solid #555',borderRadius:5,color:'#ffd700',cursor:'pointer'}}>Skip for 💰+15</button>
        </div>
      </div>);
  }

  if(screen==='shop')return (
    <div style={{minHeight:'100vh',background:bg1,padding:16,fontFamily:FB,color:'#fff'}}><style>{CSS}</style><TooltipOverlay/>
    <h2 style={{fontFamily:FD,fontSize:22,textAlign:'center',color:'#ffd700'}}>🛒 SHOP</h2>
    <div style={{textAlign:'center',fontFamily:FD,fontSize:14,color:'#ffd700',marginBottom:10}}>💰{gold}</div>
    <div style={{fontFamily:FD,fontSize:12,color:'#777',textAlign:'center',marginBottom:6}}>SUPERPOWERS</div>
    <div style={{display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap',marginBottom:12}}>{shopItems.map(i=> <Card key={i.id} card={i} onClick={()=>{if(gold>=i.price){setGold(p=>p-i.price);setDeck(p=>[...p,{...i,id:uid()}]);setShopItems(p=>p.filter(x=>x.id!==i.id));}}} price={i.price} dis={gold<i.price}/>)}</div>
    <div style={{fontFamily:FD,fontSize:12,color:'#777',textAlign:'center',marginBottom:6}}>AMPS</div>
    <div style={{display:'flex',gap:5,justifyContent:'center',flexWrap:'wrap',marginBottom:10}}>{shopRelics.map(r=> <Relic key={r.id} relic={r} onClick={()=>{if(gold>=r.price){setGold(p=>p-r.price);applyRelic(r);setShopRelics(p=>p.filter(x=>x.id!==r.id));}}} price={r.price} dis={gold<r.price}/>)}</div>
    {maxEnergy<5&&<><div style={{fontFamily:FD,fontSize:12,color:'#777',textAlign:'center',marginBottom:6}}>POWER UPGRADES</div>
    <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
      <div style={{padding:'10px 16px',background:'#ffaa3311',border:`2px solid ${gold>=90?'#ffaa33':'#555'}`,borderRadius:10,textAlign:'center',maxWidth:220}}>
        <div style={{fontSize:28,marginBottom:4}}>⚡</div>
        <div style={{fontFamily:FD,fontSize:14,color:'#ffaa33',marginBottom:2}}>+1 MAX ENERGY</div>
        <div style={{fontFamily:'Courier Prime,monospace',fontSize:10,color:'#888',marginBottom:8,lineHeight:1.4}}>Permanently gain 1 energy per turn. Rare and powerful. Use wisely.</div>
        <div style={{fontFamily:FD,fontSize:16,color:gold>=90?'#ffd700':'#ff4455',marginBottom:6}}>💰 90</div>
        <button onClick={()=>{if(gold>=90){setGold(p=>p-90);setMaxEnergy(p=>Math.min(5,p+1));}}} disabled={gold<90} style={{fontFamily:FD,fontSize:12,padding:'5px 18px',background:gold>=90?'linear-gradient(135deg,#ffaa33,#ff8800)':'#222',border:`1px solid ${gold>=90?'#ffcc55':'#444'}`,borderRadius:6,color:gold>=90?'#fff':'#555',cursor:gold>=90?'pointer':'not-allowed'}}>
          {gold>=90?'BUY':'Need 💰90'}
        </button>
      </div>
    </div></>}
    <div style={{textAlign:'center'}}><button onClick={()=>setScreen('map')} style={{fontFamily:FD,fontSize:12,padding:'5px 18px',background:'#222',border:`1px solid ${accent}`,borderRadius:6,color:'#fff',cursor:'pointer'}}>LEAVE →</button></div>
  </div>);

  if(screen==='event'&&curEvent){
    const cp=deck.filter(c=>c.copiedFrom);
    const basics=deck.filter(c=>!c.copiedFrom&&c.tier===0);
    const loCard=cp.length>0?[...cp].sort((a,b)=>a.value-b.value)[0]:null;
    const hiCard=cp.length>0?[...cp].sort((a,b)=>b.value-a.value)[0]:null;
    const rmCard=basics.length>0?basics[0]:null;
    const evBtnText=(o)=>{
      if(o.fx==='upgrade'&&loCard)return`💪 Upgrade "${loCard.name}": ${loCard.value} → ${Math.floor(loCard.value*1.3)}`;
      if(o.fx==='upWeak'&&loCard)return`🔄 Upgrade "${loCard.name}": ${loCard.value} → ${Math.floor(loCard.value*1.4)}`;
      if(o.fx==='dupe'&&hiCard)return`🪞 Duplicate "${hiCard.name}" (value ${hiCard.value}). Adds a copy to your deck`;
      if(o.fx==='remove'&&rmCard)return`🗑️ Remove "${rmCard.name}" from your deck forever`;
      if(o.fx==='remove'&&!rmCard)return`🗑️ Remove a basic superpower (none available)`;
      return o.text;};
    return (
    <div style={{minHeight:'100vh',background:bg1,display:'flex',alignItems:'center',justifyContent:'center',padding:16,fontFamily:FB,color:'#fff'}}><style>{CSS}</style>
    <div style={{maxWidth:360,background:bg2,border:`1.5px solid ${accent}44`,borderRadius:10,padding:18,textAlign:'center',animation:'fadeUp 0.3s'}}>
      <div style={{fontSize:24,marginBottom:3}}>❓</div>
      <h2 style={{fontFamily:FD,fontSize:18,color:accent,marginBottom:8}}>{curEvent.title}</h2>
      {curEvent.opts.map((o,i)=> <button key={i} onClick={()=>handleEvent(o)} style={{display:'block',width:'100%',fontFamily:FB,fontWeight:700,fontSize:10,padding:'7px 10px',marginBottom:4,background:'#00000044',border:`1px solid ${accent}33`,borderRadius:6,color:'#ddd',cursor:'pointer',textAlign:'left',transition:'all 0.2s'}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=accent;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=`${accent}33`;}}>{evBtnText(o)}</button>)}
    </div>
  </div>);}

  // ═══ TUTORIAL ═══
  if(screen==='tutorial'){
    const TUT_STEPS=[
      {
        title:'Welcome, Potential Man',
        visual:(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
            <div style={{fontSize:64,animation:'float 3s ease-in-out infinite'}}>⚡</div>
            <div style={{fontFamily:FD,fontSize:22,color:'#ffaa33',letterSpacing:4}}>POTENTIAL MAN</div>
            <div style={{fontFamily:FB,fontSize:12,color:'#888',maxWidth:300,textAlign:'center',lineHeight:1.7}}>
              A hero of pure potential. Average in every stat, but with the power to become anything.
            </div>
          </div>
        ),
        desc:'You will fight your way through the Comic City, a sprawling world of villains and heroes whose powers you can copy. Each victory makes you stronger. Each defeat ends your run.',
      },
      {
        title:'The Comic Page Grid',
        visual:(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,width:160,height:160}}>
              {['top-left','top-right','bottom-left','bottom-right'].map((pos,i)=>(
                <div key={pos} style={{background:'#1a1a2a',border:'2px solid #ffaa3344',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:2}}>
                  <div style={{fontFamily:FB,fontSize:9,color:'#ffaa3366'}}>Panel {i+1}</div>
                </div>
              ))}
            </div>
            <div style={{fontFamily:FB,fontSize:10,color:'#555',letterSpacing:2}}>2 × 2 COMIC PAGE</div>
          </div>
        ),
        desc:'Each turn you arrange cards on a 2×2 comic panel grid. Small cards (cost 1) fill one panel. Larger cards span multiple panels. When you hit END TURN, all cards resolve.',
      },
      {
        title:'Reading Order Resolution',
        visual:(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,width:160,height:160}}>
              {[['1','#ff4455','COMBO'],['2','#bb55ff','CHANNEL'],['3','#4499ff','DEFEND'],['4','#44dd66','POISON']].map(([n,col,label])=>(
                <div key={n} style={{background:`${col}18`,border:`2px solid ${col}55`,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:1}}>
                  <div style={{fontFamily:FD,fontSize:20,color:col}}>{n}</div>
                  <div style={{fontFamily:FB,fontSize:8,color:`${col}99`}}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontFamily:FD,fontSize:10,color:'#666'}}>→</span>
              <span style={{fontFamily:FB,fontSize:10,color:'#888'}}>Left to Right, Top to Bottom</span>
            </div>
          </div>
        ),
        desc:'Cards resolve in reading order: top-left, top-right, bottom-left, bottom-right. Order matters. A CHANNEL card stacks damage before a release, and a COMBO card buffs what follows it.',
      },
      {
        title:'Energy & Card Costs',
        visual:(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
            <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
              {[{cost:1,col:'#ff4455',name:'Strike',icon:'⚔️'},{cost:2,col:'#bb55ff',name:'Blast',icon:'✨'},{cost:3,col:'#4499ff',name:'Bulwark',icon:'🛡️'}].map(c=>(
                <div key={c.name} style={{background:'#1a1a2a',border:`2px solid ${c.col}55`,borderRadius:6,padding:'8px 10px',textAlign:'center',width:70}}>
                  <div style={{fontSize:20}}>{c.icon}</div>
                  <div style={{fontFamily:FD,fontSize:11,color:c.col,marginTop:2}}>{c.name}</div>
                  <div style={{marginTop:4,background:`${c.col}33`,border:`1px solid ${c.col}88`,borderRadius:3,padding:'2px 0',fontFamily:FD,fontSize:12,color:c.col}}>⚡{c.cost}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:4}}>
              {[1,2,3].map(i=><div key={i} style={{width:22,height:22,borderRadius:'50%',background:'linear-gradient(135deg,#ffaa33,#ff6600)',border:'2px solid #fff',boxShadow:'0 0 8px #ffaa3388'}}/>)}
            </div>
            <div style={{fontFamily:FD,fontSize:11,color:'#ffaa33',letterSpacing:2}}>3 ENERGY PER TURN</div>
          </div>
        ),
        desc:'You start each turn with 3 energy. Cards cost ⚡ to play. A cost-1 card fits anywhere; a cost-3 card may span the whole page. Blood cards cost HP instead of energy. High risk, high reward.',
      },
      {
        title:'Card Types & Keywords',
        visual:(
          <div style={{display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center',maxWidth:320}}>
            {[['⚔️ Attack','#ff4455','Deal damage'],['🛡️ Defend','#4499ff','Gain Block'],['✨ Magic','#bb55ff','Channel power'],['☠️ Poison','#44dd66','Corrode enemies'],['🔥 Rage','#ff7722','Blood-fuelled strikes'],['💚 Heal','#22ccaa','Restore HP']].map(([name,col,tip])=>(
              <div key={name} style={{background:`${col}14`,border:`1px solid ${col}44`,borderRadius:6,padding:'6px 10px',textAlign:'center',minWidth:88}}>
                <div style={{fontFamily:FD,fontSize:11,color:col}}>{name}</div>
                <div style={{fontFamily:FB,fontSize:9,color:'#555',marginTop:2}}>{tip}</div>
              </div>
            ))}
          </div>
        ),
        desc:'Cards come in six types. Keywords add special behaviour: COMBO chains bonus damage, CHANNEL holds magic until turn end (pierces block), MOMENTUM rewards playing many cards in a row, CORRODE stacks poison permanently.',
      },
      {
        title:'Momentum',
        visual:(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {[1,2,3].map(i=>(
                <div key={i} style={{width:36,height:36,borderRadius:'50%',background:i<=2?'#33ddff33':'linear-gradient(135deg,#33ddff,#0088cc)',border:`2px solid ${i<=2?'#33ddff55':'#33ddff'}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:FD,fontSize:16,color:i<=2?'#33ddff88':'#fff',boxShadow:i===3?'0 0 16px #33ddff88':undefined}}>
                  {i}
                </div>
              ))}
              <div style={{fontFamily:FD,fontSize:20,color:'#33ddff',marginLeft:4}}>→</div>
              <div style={{background:'#33ddff22',border:'2px solid #33ddff',borderRadius:6,padding:'6px 12px',fontFamily:FD,fontSize:12,color:'#33ddff',letterSpacing:1}}>FREE CARD</div>
            </div>
            <div style={{fontFamily:FB,fontSize:10,color:'#555',letterSpacing:2,textAlign:'center'}}>PLAY 3 MOMENTUM CARDS → NEXT IS FREE</div>
          </div>
        ),
        desc:'Cards with the MOMENTUM keyword build a counter. At 3 stacks, your next card costs zero energy. Chain momentum cards to play more cards than your energy allows. Speed stat increases how many cards you draw each turn.',
      },
      {
        title:'The Map & Progression',
        visual:(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              {[['⚔️','Battle','#ff4455'],['💀','Elite','#ff3366'],['🏕️','Rest','#44dd66'],['🛒','Shop','#ffd700'],['👑','Boss','#ffd700']].map(([icon,label,col])=>(
                <div key={label} style={{textAlign:'center'}}>
                  <div style={{fontSize:22,marginBottom:2}}>{icon}</div>
                  <div style={{fontFamily:FB,fontSize:9,color:col,letterSpacing:1}}>{label.toUpperCase()}</div>
                </div>
              ))}
            </div>
            <div style={{width:200,height:1,background:'linear-gradient(90deg,transparent,#ffaa3344,transparent)',margin:'4px 0'}}/>
            <div style={{fontFamily:FB,fontSize:10,color:'#555',textAlign:'center',maxWidth:260}}>Choose your path through each floor</div>
          </div>
        ),
        desc:'The City is a branching map. Battles give gold and unlock superpowers. Elites are tough but drop rare Amps. Rest sites heal HP. Shops let you buy cards and relics. Each floor ends in a Boss.',
      },
      {
        title:'Attributes & Growth',
        visual:(
          <div style={{display:'flex',flexWrap:'wrap',gap:5,justifyContent:'center',maxWidth:300}}>
            {ATTR_INFO.map(({key,icon,color})=>(
              <div key={key} style={{background:`${color}14`,border:`1px solid ${color}33`,borderRadius:6,padding:'5px 10px',display:'flex',alignItems:'center',gap:5}}>
                <span style={{fontSize:14}}>{icon}</span>
                <span style={{fontFamily:FD,fontSize:10,color}}>{key.toUpperCase()}</span>
              </div>
            ))}
          </div>
        ),
        desc:'After every victory, earn 8 attribute points. Spend them to grow your stats. Strength boosts attack, Magic amplifies spells, Speed draws more cards, Vitality adds max HP, and more. Your build is yours to shape.',
      },
      {
        title:"You're Ready",
        visual:(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
            <div style={{fontSize:64,animation:'float 3s ease-in-out infinite'}}>⚡</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center',maxWidth:280}}>
              {['Place','Resolve','Evolve'].map(w=>(
                <div key={w} style={{fontFamily:FD,fontSize:16,color:'#ffaa33',padding:'4px 14px',border:'1px solid #ffaa3344',borderRadius:3,letterSpacing:3}}>{w.toUpperCase()}</div>
              ))}
            </div>
          </div>
        ),
        desc:'That is everything you need to know. The rest you will learn by doing. Trust your instincts, build your deck, and take back the City. Potential Man has no limits. Only the ones you accept.',
      },
    ];
    const step=TUT_STEPS[tutStep];
    const isLast=tutStep===TUT_STEPS.length-1;
    const isFirst=tutStep===0;
    return (
      <div style={{minHeight:'100vh',background:'#05010f',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:FD,color:'#fff',overflow:'hidden',position:'relative',padding:20,boxSizing:'border-box'}}>
        <style>{CSS}</style>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 80% 60% at 50% 40%,#1a0840 0%,#060110 55%,#000 100%)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',inset:0,backgroundImage:'radial-gradient(circle,#ffffff06 1px,transparent 1px)',backgroundSize:'28px 28px',pointerEvents:'none'}}/>

        {/* progress dots */}
        <div style={{position:'relative',zIndex:1,display:'flex',gap:6,marginBottom:24}}>
          {TUT_STEPS.map((_,i)=>(
            <div key={i} onClick={()=>setTutStep(i)} style={{width:i===tutStep?20:6,height:6,borderRadius:3,background:i===tutStep?'#ffaa33':i<tutStep?'#ffaa3366':'#333',transition:'all 0.3s',cursor:'pointer'}}/>
          ))}
        </div>

        {/* card */}
        <div key={tutStep} style={{position:'relative',zIndex:1,background:'#0d0820',border:'1px solid #ffaa3322',borderRadius:12,padding:'28px 32px',maxWidth:480,width:'100%',boxSizing:'border-box',boxShadow:'0 0 60px #ffaa3308',animation:'fadeUp 0.3s ease both',textAlign:'center'}}>
          {/* step label */}
          <div style={{fontFamily:FB,fontSize:10,color:'#ffaa3355',letterSpacing:4,textTransform:'uppercase',marginBottom:10}}>
            Step {tutStep+1} of {TUT_STEPS.length}
          </div>

          {/* title */}
          <div style={{fontFamily:FD,fontSize:22,color:'#fff',letterSpacing:2,marginBottom:20,textShadow:'0 0 20px #ffaa3344'}}>
            {step.title}
          </div>

          {/* visual */}
          <div style={{minHeight:160,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20,background:'#ffffff04',borderRadius:8,padding:16,border:'1px solid #ffffff08'}}>
            {step.visual}
          </div>

          {/* description */}
          <div style={{fontFamily:FB,fontSize:13,color:'#999',lineHeight:1.75,marginBottom:24}}>
            {step.desc}
          </div>

          {/* nav buttons */}
          <div style={{display:'flex',gap:10,justifyContent:'center',alignItems:'center'}}>
            {!isFirst&&(
              <button onClick={()=>setTutStep(p=>p-1)} style={{fontFamily:FD,fontSize:13,padding:'9px 22px',background:'transparent',border:'1px solid #ffaa3333',borderRadius:3,color:'#ffaa3377',cursor:'pointer',letterSpacing:3}}>
                ← BACK
              </button>
            )}
            {!isLast&&(
              <button onClick={()=>setTutStep(p=>p+1)} style={{fontFamily:FD,fontSize:15,padding:'11px 36px',background:'linear-gradient(135deg,#ff9900,#ff4400)',border:'none',borderRadius:3,color:'#fff',cursor:'pointer',letterSpacing:4,boxShadow:'0 0 28px #ff660033,0 4px 0 #882200'}}>
                NEXT →
              </button>
            )}
            {isLast&&(
              <button onClick={()=>setScreen('title')} style={{fontFamily:FD,fontSize:15,padding:'11px 36px',background:'linear-gradient(135deg,#ff9900,#ff4400)',border:'none',borderRadius:3,color:'#fff',cursor:'pointer',letterSpacing:3,boxShadow:'0 0 28px #ff660033,0 4px 0 #882200'}}>
                BACK TO MENU
              </button>
            )}
          </div>
        </div>

        {/* skip link */}
        <div style={{position:'relative',zIndex:1,marginTop:16}}>
          <button onClick={()=>setScreen('title')} style={{fontFamily:FB,fontSize:11,color:'#333',background:'none',border:'none',cursor:'pointer',letterSpacing:2,textDecoration:'underline'}}>
            skip tutorial
          </button>
        </div>
      </div>
    );
  }

  if(screen==='gameOver')return (
    <div style={{minHeight:'100vh',background:'#02000a',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:FD,color:'#fff',overflow:'hidden',position:'relative'}}>
      <style>{CSS}</style>
      {/* atmosphere */}
      <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 80% 60% at 50% 40%,#3a000a 0%,#0a0008 55%,#000 100%)',pointerEvents:'none'}}/>
      <div style={{position:'absolute',inset:0,backgroundImage:'radial-gradient(circle,#ffffff05 1px,transparent 1px)',backgroundSize:'28px 28px',pointerEvents:'none'}}/>
      <div style={{position:'absolute',left:0,right:0,height:80,background:'linear-gradient(180deg,transparent,#ff000006,transparent)',animation:'scanline 6s linear infinite',pointerEvents:'none'}}/>
      <div style={{position:'absolute',width:600,height:600,border:'1px solid #ff110022',borderRadius:'50%',boxShadow:'0 0 100px #cc000022,inset 0 0 100px #88000014',animation:'pulse 4s ease-in-out infinite',pointerEvents:'none'}}/>

      {/* content */}
      <div style={{position:'relative',zIndex:1,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center'}}>

        {/* skull */}
        <div style={{fontSize:72,marginBottom:16,filter:'drop-shadow(0 0 24px #ff220088)',animation:'float 4s ease-in-out infinite'}}>💀</div>

        {/* GAME OVER */}
        <div style={{fontSize:'clamp(52px,10vw,96px)',lineHeight:0.9,fontFamily:FD,letterSpacing:8,
          background:'linear-gradient(170deg,#fff 0%,#ff8888 30%,#cc0000 70%,#660000 100%)',
          WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',
          filter:'drop-shadow(0 0 24px #ff000055) drop-shadow(3px 5px 0 #000)',
          animation:'fadeUp 0.5s ease both,pulse 5s 0.5s ease-in-out infinite',
          marginBottom:4}}>
          GAME
        </div>
        <div style={{fontSize:'clamp(52px,10vw,96px)',lineHeight:0.9,fontFamily:FD,letterSpacing:8,
          background:'linear-gradient(170deg,#fff 0%,#ff8888 30%,#cc0000 70%,#660000 100%)',
          WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',
          filter:'drop-shadow(0 0 24px #ff000055) drop-shadow(3px 5px 0 #000)',
          animation:'fadeUp 0.5s 0.08s ease both',
          marginBottom:20}}>
          OVER
        </div>

        {/* divider */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16,animation:'fadeUp 0.4s 0.2s ease both',opacity:0}}>
          <div style={{width:50,height:1,background:'linear-gradient(90deg,transparent,#ff333366)'}}/>
          <span style={{fontFamily:FB,fontSize:10,letterSpacing:5,color:'#ff333366',textTransform:'uppercase'}}>Potential Lost</span>
          <div style={{width:50,height:1,background:'linear-gradient(270deg,transparent,#ff333366)'}}/>
        </div>

        {/* run stats */}
        <div style={{display:'flex',gap:24,marginBottom:8,animation:'fadeUp 0.4s 0.28s ease both',opacity:0}}>
          {[['🏢','Floor',curFloor],['⚡','Powers',copiedAbilities.length],['🎒','Amps',relics.length],['⚔️','Level',potLv]].map(([icon,label,val])=>
            <div key={label} style={{textAlign:'center'}}>
              <div style={{fontSize:18}}>{icon}</div>
              <div style={{fontFamily:FD,fontSize:20,color:'#fff'}}>{val}</div>
              <div style={{fontFamily:FB,fontSize:10,color:'#555',letterSpacing:2,textTransform:'uppercase'}}>{label}</div>
            </div>
          )}
        </div>

        {/* alignment */}
        <div style={{fontFamily:FB,fontSize:12,color:alignColor,marginBottom:32,letterSpacing:2,animation:'fadeUp 0.4s 0.34s ease both',opacity:0}}>
          Fell as {alignLabel}
        </div>

        {/* buttons */}
        <div style={{display:'flex',gap:12,animation:'fadeUp 0.4s 0.42s ease both',opacity:0}}>
          <button onClick={startGame} style={{fontFamily:FD,fontSize:18,padding:'13px 40px',
            background:'linear-gradient(135deg,#cc2200,#880000)',
            border:'none',borderRadius:3,color:'#fff',cursor:'pointer',
            letterSpacing:4,textTransform:'uppercase',
            boxShadow:'0 0 32px #cc000044,0 4px 0 #440000,0 8px 20px #00000066',
            animation:'float 3s 0.8s ease-in-out infinite'}}>
            TRY AGAIN
          </button>
          <button onClick={()=>setScreen('title')} style={{fontFamily:FD,fontSize:14,padding:'13px 28px',
            background:'transparent',
            border:'1px solid #ff333344',borderRadius:3,color:'#ff3333aa',cursor:'pointer',
            letterSpacing:3,textTransform:'uppercase'}}>
            MENU
          </button>
        </div>
      </div>
    </div>);

  if(screen==='victory')return (
    <div style={{minHeight:'100vh',background:`radial-gradient(ellipse at 50% 40%,${bg2},#000)`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:FD,color:'#fff',padding:16,textAlign:'center'}}><style>{CSS}</style>
    <div style={{fontSize:64,marginBottom:8,animation:'float 3s ease-in-out infinite'}}>🏆</div>
    <h1 style={{fontSize:40,color:'#ffd700',textShadow:`4px 4px 0 ${accent},8px 8px 0 #000`,animation:'pulse 2s ease-in-out infinite',margin:'0 0 4px'}}>POTENTIAL REALIZED</h1>
    {ngPlus>0&&<div style={{fontFamily:FD,fontSize:13,color:'#ffaa33',marginBottom:4}}>ASCENSION {ngPlus} CLEARED</div>}
    <p style={{fontFamily:'Courier Prime,monospace',fontSize:13,color:'#aaa',marginBottom:4}}>{copiedAbilities.length} superpowers · {relics.length} Amps · Lv.{potLv}</p>
    <p style={{fontFamily:FD,fontSize:13,color:alignColor,marginBottom:16}}>Victory as {alignLabel}</p>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
      {maxEnergy<5&&<button onClick={()=>startNewGamePlus(ngPlus)} style={{fontFamily:FD,fontSize:15,padding:'10px 28px',background:`linear-gradient(135deg,#aa44ff,#ff3366)`,border:'3px solid #fff',borderRadius:8,color:'#fff',cursor:'pointer',boxShadow:'0 0 30px #aa44ff55'}}>⚡ ASCEND ({ngPlus+1}+)<br/><span style={{fontSize:10,opacity:0.8}}>Keep build · +{Math.round((ngPlus+1)*35)}% enemy scaling</span></button>}
      <button onClick={()=>setScreen('title')} style={{fontFamily:FD,fontSize:14,padding:'10px 28px',background:`linear-gradient(135deg,#ffd700,${accent})`,border:'2px solid #fff',borderRadius:8,color:'#000',cursor:'pointer'}}>NEW RUN</button>
    </div>
  </div>);

  return null;
}
