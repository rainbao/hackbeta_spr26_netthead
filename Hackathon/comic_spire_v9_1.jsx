import { useState, useEffect, useCallback, useMemo, useRef, useReducer } from "react";

/* ═══════════════════════════════════════════════════════
   COMIC SPIRE v9 — POTENTIAL MAN
   Fixed: charge persist, panel sizes, cross-synergies,
   keyword tooltips, thorough debug
   ═══════════════════════════════════════════════════════ */

const CSV_RAW=`Name,Power,Strength,Magic,Intelligence,Speed,Defense,Poison,Rage,Corrupted,Evilness,Personality,Favorite_Color,Weakness,isVillain
Green X,30,37,76,74,92,89,7,31,24,48,Sarcastic,0x09251b,Fearful,False
Wonder Hulk,92,43,66,78,51,82,0,13,45,0,Sadistic,0x52deff,Soft hearted,False
Dark Daredevil,64,0,40,100,80,11,50,28,42,100,Power hungry,0xa130bb,Prideful,True
Radioactive X,76,51,89,89,63,60,45,82,20,7,Sarcastic,0xe54430,Obsessive,True
Professor Darkness,99,51,90,60,24,45,21,60,84,46,Cold blooded,0xfe059a,Ice weakness,True
Omega Claw,74,23,6,61,24,93,32,48,96,14,Protective,0xdffe22,Soft hearted,True
Wonder Entity,56,86,63,43,90,25,79,14,87,87,Power hungry,0x6de54a,Fire weakness,True
Super Girl,49,12,26,74,94,95,11,10,74,22,Protective,0x6abe4b,Trusting,False
Green Hornet,84,94,65,38,85,9,82,18,70,9,Power hungry,0x4cc1bd,Fearful,False
Ms Daredevil,63,6,7,0,99,80,65,68,0,56,Manipulative,0x22c130,Fearful,True
The Boy,44,75,17,98,18,31,64,88,80,20,Cruel,0x71c4c9,Paranoid,True
Metal Knight,55,91,32,67,22,40,49,2,52,49,Calculating,0xa1ee77,Silver weakness,True
Incredible Shadow,59,6,42,44,85,39,2,100,51,13,Arrogant,0x9c0aea,Stubborn,False
Human Crusader,38,75,98,5,79,61,88,84,38,26,Cunning,0x12cef3,Radiation weak,True
The Crusader,68,84,45,83,46,52,93,51,79,7,Honorable,0xf449d6,Radiation weak,False
Super Lightning,74,29,55,28,52,57,94,10,62,38,Power hungry,0x63c732,Prideful,True
Super Boy,94,0,72,22,94,85,86,17,66,38,Honorable,0x74ce2f,Darkness bound,False
Rocket X,92,24,26,69,62,41,15,41,2,43,Cunning,0x798814,Soft hearted,False
Doctor Master,31,93,52,77,94,100,39,100,37,89,Sarcastic,0x180419,Short sighted,True
Impossible Centurion,98,70,25,57,91,74,95,87,31,72,Stoic,0xd0b4d5,Poison susceptible,True
Masked Girl,56,93,7,3,73,71,86,47,97,27,Ruthless,0x45a1b2,Impulsive,True
Power Entity,91,57,60,6,14,24,21,30,19,58,Clever,0x779c7a,Short sighted,True
Iron Boy,50,27,8,56,91,64,80,13,27,10,Ruthless,0x3571aa,Soft hearted,True
Professor Man,45,85,51,62,100,66,60,93,62,51,Compassionate,0x8b27d1,Guilt ridden,False
Iron Entity,72,90,45,51,25,80,70,20,83,70,Brave,0xf75f0b,Greedy,False
Mr Shadow,32,41,33,24,60,90,45,34,53,88,Calculating,0x0f0600,Obsessive,True
Masked Master,94,65,56,38,39,27,53,14,60,26,Cruel,0x63b56a,Darkness bound,True
Mr Claw,84,70,16,53,20,95,18,36,34,36,Charismatic,0xda658e,Ice weakness,True
Incredible Torch,90,64,2,67,52,66,14,79,44,76,Clever,0x0d2d08,Radiation weak,True
Silver Lightning,18,92,10,71,71,6,89,87,13,81,Sarcastic,0x87dd0d,Soft hearted,True
Ancient Lightning,36,68,12,15,91,93,65,87,39,35,Cruel,0x20bdf6,Sound sensitive,True
Silver Darkness,38,67,82,98,37,28,38,47,69,72,Cold blooded,0x3691a7,Radiation weak,True
Crimson Man,76,70,10,24,22,36,40,100,45,95,Obsessive,0x74267f,Fire weakness,True
Professor Knight,77,44,62,9,78,97,44,67,66,9,Brave,0xbf088c,Lonely,True
Omega Lightning,48,81,97,26,76,49,56,20,43,54,Manipulative,0x317e8b,Hubris,True
Dark Boy,63,78,72,42,23,42,64,17,59,3,Loyal,0xf99ffa,Magic vulnerable,False
Mr Knight,45,72,46,19,50,44,59,53,49,77,Loyal,0x2fb366,Silver weakness,False
The Woman,64,78,87,29,11,29,45,63,30,51,Charismatic,0x1cad05,Stubborn,False
Rocket Claw,65,24,69,34,38,44,78,37,95,4,Ruthless,0x78e124,Naive,False
Doctor Hornet,29,90,73,68,37,10,81,77,92,23,Clever,0x7e835b,Hotheaded,False
Omega Crusader,43,41,19,34,3,57,99,87,86,98,Power hungry,0xfe6de5,Sound sensitive,True
Incredible Surfer,49,1,56,75,66,65,37,84,89,86,Stoic,0x5e9718,Vengeful,True
Super Master,12,77,23,58,51,27,19,8,90,88,Protective,0xfd32ea,Impulsive,False
Metal Shadow,63,57,79,17,21,14,24,54,46,22,Stoic,0xcff2de,Sound sensitive,True
Doctor X,53,7,24,47,25,33,15,17,34,77,Stoic,0xb51a1f,Distrustful,True
Green Phantom,78,13,5,83,99,95,11,53,82,62,Cold blooded,0x5891e7,Poison susceptible,False
Iron Cloak,26,25,9,25,34,27,96,10,92,8,Cold blooded,0x302a7e,Egotistical,False
Wonder Daredevil,9,71,36,71,34,9,36,53,42,63,Sarcastic,0xee751e,Manipulable,True`;

function parseCSV(raw){const ls=raw.trim().split('\n'),hd=ls[0].split(',').map(h=>h.trim());return ls.slice(1).map(l=>{const v=l.split(',').map(s=>s.trim()),o={};hd.forEach((h,i)=>o[h]=v[i]||'');return o;})}
const $=v=>parseInt(v,10)||0,clr=h=>'#'+(h||'888').replace('0x','').padStart(6,'0');
const uid=()=>Math.random().toString(36).slice(2,10),pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v)),shuffle=a=>[...a].sort(()=>Math.random()-0.5);
const SK=['Power','Strength','Magic','Intelligence','Speed','Defense','Poison','Rage'];

const ROWS=2,COLS=3;

// ═══ KEYWORD DEFINITIONS (shown on hover) ═══
const KW_INFO={
  combo:{name:'COMBO',color:'#ff4455',desc:'Each attack this turn adds +3 damage to the next attack.'},
  channel:{name:'CHANNEL',color:'#bb55ff',desc:'Stacks magic damage. Releases at end of turn — pierces ALL block and applies Weaken.'},
  momentum:{name:'MOMENTUM',color:'#33ddff',desc:'Each card played adds +1. At 4: ONE free card.'},
  fortify:{name:'FORTIFY',color:'#4499ff',desc:'50% of your Block carries over to next turn.'},
  corrode:{name:'CORRODE',color:'#44dd66',desc:'Poison that NEVER decays. Stacks permanently.'},
  blood:{name:'BLOOD',color:'#ff7722',desc:'Costs HP instead of energy. Below 30% HP: DOUBLE damage.'},
  charge:{name:'CHARGE',color:'#ffaa33',desc:'Doesn\'t resolve this turn. Fires NEXT turn at +50% power.'},
  echo:{name:'ECHO',color:'#dd88ff',desc:'When resolved, copies the PREVIOUS card\'s effect at 50%.'},
  shieldbash:{name:'SHIELD BASH',color:'#55aaff',desc:'Deals damage equal to your current Block.'},
  catalyze:{name:'CATALYZE',color:'#88ff44',desc:'Deals instant damage equal to enemy\'s total Poison.'},
  overchannel:{name:'OVERCHANNEL',color:'#aa44dd',desc:'Channels damage AND applies Corrode poison.'},
  frenzy:{name:'FRENZY',color:'#ff55aa',desc:'Costs 0 energy but takes 2 panel slots.'},
};

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
  const mk=(nm,d,t,ic,v)=>({id:uid(),name:nm,desc:d,type:t,icon:ic,value:v,cost:1,shape:'s1',panelSize:1,hits:1,debuff:0,keyword:'',bloodCost:0,charge:false,heroName:'Potential Man',color:'#888',tier:0,copiedFrom:null,threat:0,bestStat:null,archetype:''});
  return[mk('Punch','Deal 4','attack','👊',4),mk('Punch','Deal 4','attack','👊',4),mk('Punch','Deal 4','attack','👊',4),mk('Punch','Deal 4','attack','👊',4),
    mk('Guard','Gain 4 Block','defend','🤲',4),mk('Guard','Gain 4 Block','defend','🤲',4),mk('Guard','Gain 4 Block','defend','🤲',4),mk('Guard','Gain 4 Block','defend','🤲',4),
    mk('Spark','Deal 3 magic','magic','🪞',3),mk('Adapt','Heal 4','heal','🔄',4)];
}

function makeEnemy(hero,floor,isBoss,isElite){
  const stats={};SK.forEach(k=>stats[k]=$(hero[k]));const sorted=Object.values(stats).sort((a,b)=>b-a);
  const threat=sorted[0]+sorted[1]+sorted[2];const m=isBoss?2.5:isElite?1.6:1+floor*0.1;
  const hp=Math.floor((28+stats.Defense*0.25+stats.Strength*0.08)*m);
  return{...hero,gameHp:hp,gameMaxHp:hp,block:0,poisonStacks:0,corrodeStacks:0,weakened:0,
    atk:Math.floor(3+(stats.Strength*0.07+stats.Power*0.05)*m+floor*0.4),
    mag:Math.floor(2+(stats.Magic*0.06+stats.Intelligence*0.04)*m+floor*0.3),
    def:Math.floor(stats.Defense*0.12*m+2),color:clr(hero.Favorite_Color),isBoss,isElite,threat,
    intent:null,intentVal:0,signature:getSignature(hero)};
}
function rollIntent(en){const r=Math.random(),ac=0.45+$(en.Rage)/300;
  if(r<ac)return{intent:'attack',intentVal:Math.max(1,en.atk-(en.weakened||0))+Math.floor(Math.random()*3)};
  if(r<ac+0.2)return{intent:'magic',intentVal:Math.max(1,en.mag)+Math.floor(Math.random()*3)};
  if(r<ac+0.35)return{intent:'defend',intentVal:en.def+Math.floor(Math.random()*3)};
  return{intent:'buff',intentVal:Math.floor(en.atk*0.2)+2};}
function pickEnemy(heroes,floor,isBoss,isElite){
  const wt=heroes.map(h=>{const st={};SK.forEach(k=>st[k]=$(h[k]));const s=Object.values(st).sort((a,b)=>b-a);return{hero:h,threat:s[0]+s[1]+s[2]}}).sort((a,b)=>a.threat-b.threat);
  const t=wt.length;let lo,hi;
  if(isBoss){lo=Math.floor(t*0.75);hi=t;}else if(isElite){lo=Math.floor(t*0.5);hi=Math.floor(t*0.85);}
  else{const p=floor/14;lo=Math.floor(t*Math.max(0,p-0.2));hi=Math.floor(t*Math.min(1,p+0.3));}
  return makeEnemy(pick(wt.slice(clamp(lo,0,t-1),clamp(hi,lo+1,t))).hero,floor,isBoss,isElite);}

function makeMap(){
  const struct=[1,3,3,3,1,3,3,3,1,2,2,2,1,1,1];
  const mergeTypes=[null,null,null,null,['shop','rest','event'],null,null,null,['shop','rest','event'],null,null,null,['rest'],['elite'],['boss']];
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
    if(cur.length===1)cur[0].conns=next.map(n=>n.id);
    else if(next.length===1)cur.forEach(n=>{n.conns=[next[0].id];});
    else if(cur.length===next.length)cur.forEach((n,i)=>{n.conns=[next[i].id];});
    else cur.forEach((n,i)=>{n.conns=[next[clamp(i,0,next.length-1)].id];});}
  return map;}

const EVENTS=[
  {title:'Mysterious Stranger',opts:[{text:'💪 Upgrade a card',fx:'upgrade'},{text:'🗑️ Remove a basic card',fx:'remove'},{text:'💚 +10 HP',fx:'heal',v:10}]},
  {title:'Abandoned Lab',opts:[{text:'🔬 +1 energy',fx:'maxEn'},{text:'💰 +25 gold',fx:'gold',v:25},{text:'💚 +5 HP',fx:'heal',v:5}]},
  {title:'The Mirror',opts:[{text:'🪞 Duplicate best card',fx:'dupe'},{text:'🔄 Upgrade weakest',fx:'upWeak'},{text:'💚 +12 HP',fx:'heal',v:12}]},
];

const ALL_RELICS=[
  {id:'r1',name:'Spiked Gauntlets',desc:'COMBO: +4 not +3',icon:'🥊',syn:'COMBO',fx:'comboPow'},
  {id:'r2',name:'First Blood',desc:'1st attack +4',icon:'🩸',syn:'COMBO',fx:'firstStrike'},
  {id:'r3',name:'Focus Crystal',desc:'Channel +30%',icon:'🔮',syn:'CHANNEL',fx:'chanPow'},
  {id:'r4',name:'Mana Siphon',desc:'Channel heals 25%',icon:'💎',syn:'CHANNEL',fx:'chanHeal'},
  {id:'r5',name:'Titanium Shell',desc:'Fortify 65%',icon:'🐢',syn:'FORTIFY',fx:'fortUp'},
  {id:'r6',name:'Regenerator',desc:'+2 HP/turn',icon:'💗',syn:'FORTIFY',fx:'regen'},
  {id:'r7',name:'Lightning Boots',desc:'Momentum at 3',icon:'👟',syn:'MOMENTUM',fx:'momDown'},
  {id:'r8',name:'Afterimage',desc:'+2 Block/card',icon:'👤',syn:'MOMENTUM',fx:'cardBlk'},
  {id:'r9',name:'Plague Mask',desc:'All poison +2',icon:'🎭',syn:'CORRODE',fx:'poisUp'},
  {id:'r10',name:'Blood Ruby',desc:'Blood costs 3',icon:'💎',syn:'BLOOD',fx:'bloodCheap'},
  {id:'r11',name:'Death Wish',desc:'Desperate at 40%',icon:'💀',syn:'BLOOD',fx:'despUp'},
  {id:'r12',name:'Echo Chamber',desc:'Echo copies at 75%',icon:'🔊',syn:'ECHO',fx:'echoUp'},
  {id:'r13',name:'Reactive Armor',desc:'Shield Bash +5',icon:'🛡️',syn:'SHIELD BASH',fx:'bashUp'},
  {id:'r14',name:'Toxic Catalyst',desc:'Catalyze also heals',icon:'💉',syn:'CATALYZE',fx:'catHeal'},
  {id:'r15',name:'Gold Tooth',desc:'+10 gold/fight',icon:'🦷',syn:'any',fx:'goldUp'},
  {id:'r16',name:'Thick Skin',desc:'+8 max HP',icon:'💪',syn:'any',fx:'hpUp'},
  {id:'r17',name:'Energy Cell',desc:'+1 energy',icon:'🔋',syn:'any',fx:'enUp'},
  {id:'r18',name:'Lucky Coin',desc:'+5% crit',icon:'🪙',syn:'any',fx:'critSmall'},
  {id:'r19',name:'Charge Capacitor',desc:'Charge +3 value',icon:'⏳',syn:'CHARGE',fx:'chargePow'},
  {id:'r20',name:'War Paint',desc:'+10% crit',icon:'🎨',syn:'any',fx:'critUp'},
];
const pickRelics=(owned,n=3)=>shuffle(ALL_RELICS.filter(r=>!owned.some(o=>o.id===r.id))).slice(0,n);

const FD="'Bangers','Impact',cursive",FB="'Courier Prime','Courier New',monospace";
const FURL="https://fonts.googleapis.com/css2?family=Bangers&family=Courier+Prime:wght@400;700&display=swap";
const TC={attack:'#ff4455',magic:'#bb55ff',defend:'#4499ff',poison:'#44dd66',rage:'#ff7722',heal:'#55ddbb'};
const NI={start:'★',battle:'⚔',elite:'💀',boss:'👑',shop:'🛒',event:'?',rest:'🏕'};
const NC={start:'#ffcc33',battle:'#ff5555',elite:'#ff3366',boss:'#ffd700',shop:'#55ddbb',event:'#bb88ff',rest:'#66bb66'};

// Panel placement with shapes
function canPlace(grid,r,c,shape){
  const cells=SHAPES[shape]||SHAPES.s1;
  return cells.every(([dr,dc])=>r+dr>=0&&r+dr<ROWS&&c+dc>=0&&c+dc<COLS&&grid[r+dr][c+dc]===null);
}
function doPlace(grid,r,c,shape,id){
  const ng=grid.map(row=>[...row]);
  (SHAPES[shape]||SHAPES.s1).forEach(([dr,dc])=>{ng[r+dr][c+dc]=id;});
  return ng;
}
function getValid(grid,shape){
  const s=new Set();for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(canPlace(grid,r,c,shape))s.add(`${r}-${c}`);return s;
}

// ═══ RESOLVE CARD (called during END_TURN in reading order) ═══
function resolveCard(card,en,st,relics,pHp,pMaxHp,healFn,prevCard){
  const hasR=fx=>relics?.some(r=>r.fx===fx);
  const desperate=pHp<pMaxHp*(hasR('despUp')?0.4:0.3);
  const crit=Math.random()*100<(10+(hasR('critUp')?10:0)+(hasR('critSmall')?5:0));
  const cm=(crit?1.5:1)*(card.keyword==='blood'&&desperate?2:1);
  const chB=card.charge&&hasR('chargePow')?3:0;
  let msg='';

  // ECHO: copy previous card at 50% (or 75% with relic)
  if(card.keyword==='echo'&&prevCard){
    const echoPct=hasR('echoUp')?0.75:0.5;
    const echoVal=Math.floor((prevCard.value||0)*echoPct);
    // Replay previous card's effect at reduced value
    const fakeCard={...prevCard,value:echoVal,keyword:'',charge:false,name:'Echo'};
    const echoMsg=resolveCard(fakeCard,en,st,relics,pHp,pMaxHp,healFn,null);
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
    const chVal=Math.floor((card.value+chB)*cm*pow);
    st.channelStacks+=chVal;
    const poisAmt=Math.ceil(card.value*0.4);
    en.poisonStacks+=poisAmt;en.corrodeStacks=(en.corrodeStacks||0)+poisAmt;
    if(card.debuff)en.weakened=(en.weakened||0)+card.debuff;
    return `🌀 OVERCHANNEL +${chVal} channel + ${poisAmt} corrode`;
  }

  switch(card.type){
    case 'attack':case 'rage':{
      const cb=card.keyword==='combo'?(st.comboCount*(hasR('comboPow')?4:3)):0;
      const fb=st.comboCount===0&&hasR('firstStrike')?4:0;
      let tot=0;for(let h=0;h<card.hits;h++){let d=Math.floor((card.value+cb+fb+chB)*cm/card.hits);const bl=Math.min(en.block,d);en.block-=bl;d-=bl;en.gameHp=Math.max(0,en.gameHp-d);tot+=d;}
      msg=`${card.icon} ${card.name} → ${tot}${crit?' CRIT!':''}${cb>0?' +'+cb:''}${desperate?' 2×':''}`;
      if(card.keyword==='combo'||card.type==='attack')st.comboCount++;
      st.momentum++;break;}
    case 'magic':{
      if(card.keyword==='channel'){
        const pow=hasR('chanPow')?1.3:1;st.channelStacks+=Math.floor((card.value+chB)*cm*pow);
        if(card.debuff)en.weakened=(en.weakened||0)+card.debuff;
        msg=`✨ CHANNEL +${Math.floor((card.value+chB)*cm*pow)} [${st.channelStacks}]`;
      }else{let d=Math.floor((card.value+chB)*cm);const p2=Math.floor(d*0.3),b2=d-p2,bl=Math.min(en.block,b2);en.block-=bl;d=p2+b2-bl;en.gameHp=Math.max(0,en.gameHp-d);
        msg=`${card.icon} ${card.name} → ${d}`;}
      st.momentum++;break;}
    case 'defend':st.playerBlock+=card.value+chB;msg=`🛡️ +${card.value+chB} Block${card.keyword==='fortify'?' [FORTIFY]':''}`;st.momentum++;break;
    case 'poison':{const extra=hasR('poisUp')?2:0;const amt=Math.ceil(card.value||card.override||3)+extra+chB;
      en.poisonStacks+=amt;if(card.keyword==='corrode'){en.corrodeStacks=(en.corrodeStacks||0)+amt;msg=`☠️ CORRODE +${amt} [permanent]`;}else msg=`☠️ +${amt} Poison`;st.momentum++;break;}
    case 'heal':healFn(card.value+chB);msg=`💚 +${card.value+chB} HP`;st.momentum++;break;
  }
  if(hasR('cardBlk'))st.playerBlock+=2;
  return msg;
}

// ═══ BATTLE REDUCER ═══
const INIT_B={hand:[],drawPile:[],discardPile:[],energy:3,maxEnergy:3,playerBlock:0,
  enemy:null,page:Array(ROWS).fill(null).map(()=>Array(COLS).fill(null)),
  placedCards:[],pendingCharges:[],activeCharges:[],// activeCharges = from last turn, visually on page
  turn:1,phase:'player',log:[],victory:false,defeat:false,
  comboCount:0,channelStacks:0,momentum:0,momentumUsed:false};

function bReduce(state,action){
  const s={...state};
  switch(action.type){
    case 'INIT':{
      const{enemy,deck,maxEn,relics}=action;const sh=shuffle(deck),hs=Math.min(5,sh.length);
      const en={...enemy};if(relics?.some(r=>r.fx==='startPois'))en.poisonStacks=2;
      // Carry over activeCharges from previous state if any? No — new battle.
      return{...INIT_B,enemy:en,hand:sh.slice(0,hs),drawPile:sh.slice(hs),maxEnergy:maxEn,energy:maxEn,
        log:[`⚔ ${enemy.Name}!`,`🔓 Win → ${enemy.signature.name} [${enemy.signature.archetype}]`]};}

    case 'PLACE_CARD':{
      const{card,row,col,relics}=action;
      const hasR=fx=>relics?.some(r=>r.fx===fx);
      if(card.keyword==='blood'){const cost=hasR('bloodCheap')?3:card.bloodCost;if(action.playerHp<=cost)return s;action.payBlood(cost);}
      else if(card.keyword==='frenzy'){/* frenzy costs 0 energy */}
      else{let ec=card.cost;const momT=hasR('momDown')?3:4;
        if(s.momentum>=momT&&!s.momentumUsed){ec=0;s.momentumUsed=true;s.log=[...s.log,'⚡ MOMENTUM! Free!'];}
        if(s.energy<ec)return s;s.energy-=ec;}
      // Place on grid using shape
      if(!canPlace(s.page,row,col,card.shape||'s1'))return s;
      s.page=doPlace(s.page,row,col,card.shape||'s1',card.id);
      if(card.charge){
        s.pendingCharges=[...s.pendingCharges,{...card,row,col}];
        s.log=[...s.log,`⏳ ${card.name} CHARGING — fires next turn!`];
      }else{
        s.placedCards=[...s.placedCards,{...card,row,col}];
      }
      s.hand=s.hand.filter(c=>c.id!==card.id);
      s.momentum++;
      return s;}

    case 'END_TURN':{
      if(s.phase!=='player')return s;s.phase='resolving';
      const en={...s.enemy};const{relics,playerHp,playerMaxHp}=action;
      const hasR=fx=>relics?.some(r=>r.fx===fx);
      s.comboCount=0;s.playerBlock=0;

      // Accumulate all healing during resolution so setPlayerHp gets the correct final value
      let totalHeal=0;const localHealFn=amt=>{totalHeal+=Math.max(0,amt);};

      // 1. Resolve ACTIVE CHARGES (from last turn) in reading order
      if(s.activeCharges.length>0){
        s.log=[...s.log,'⏳ Charged cards fire!'];
        const sorted=[...s.activeCharges].sort((a,b)=>(a.row*COLS+a.col)-(b.row*COLS+b.col));
        let prev=null;
        sorted.forEach(card=>{if(en.gameHp<=0)return;const msg=resolveCard(card,en,s,relics,playerHp,playerMaxHp,localHealFn,prev);if(msg)s.log=[...s.log,msg];prev=card;});
      }

      // 2. Resolve THIS turn's placed cards in reading order
      if(s.placedCards.length>0){
        s.log=[...s.log,'📖 Reading page...'];
        const sorted=[...s.placedCards].sort((a,b)=>(a.row*COLS+a.col)-(b.row*COLS+b.col));
        s.comboCount=0;
        let prev=s.activeCharges.length>0?s.activeCharges[s.activeCharges.length-1]:null;
        sorted.forEach(card=>{if(en.gameHp<=0)return;const msg=resolveCard(card,en,s,relics,playerHp,playerMaxHp,localHealFn,prev);if(msg)s.log=[...s.log,msg];prev=card;});
      }

      // 3. Channel burst
      if(s.channelStacks>0){
        en.gameHp=Math.max(0,en.gameHp-s.channelStacks);en.weakened=(en.weakened||0)+2;
        if(hasR('chanHeal'))localHealFn(Math.floor(s.channelStacks*0.25));
        s.log=[...s.log,`✨ BURST! ${s.channelStacks} piercing + Weaken`];s.channelStacks=0;}

      if(hasR('regen'))localHealFn(2);

      // Poison tick
      if(en.poisonStacks>0){en.gameHp=Math.max(0,en.gameHp-en.poisonStacks);
        s.log=[...s.log,`☠ Poison: ${en.poisonStacks}`];
        const corr=en.corrodeStacks||0;en.poisonStacks=corr+Math.max(0,en.poisonStacks-corr-1);}

      if(en.gameHp<=0){s.enemy=en;s.victory=true;s.phase='done';return s;}

      // 4. Enemy acts — pHp accounts for all healing this turn
      let pHp=Math.min(playerMaxHp,playerHp+totalHeal);let pBlk=s.playerBlock;
      switch(en.intent){
        case 'attack':{let d=Math.max(1,en.intentVal-(en.weakened||0));const bl=Math.min(pBlk,d);pBlk-=bl;d-=bl;pHp=Math.max(0,pHp-d);
          s.log=[...s.log,`🔴 ${en.Name}: ${d} dmg${bl>0?' ('+bl+' blk)':''}`];break;}
        case 'magic':{let d=en.intentVal;const p2=Math.floor(d*0.3),b2=d-p2,bl=Math.min(pBlk,b2);pBlk-=bl;d=p2+b2-bl;pHp=Math.max(0,pHp-d);
          s.log=[...s.log,`🟣 ${en.Name}: ${d} magic`];break;}
        case 'defend':en.block+=en.intentVal;s.log=[...s.log,`🔵 ${en.Name}: +${en.intentVal} Blk`];break;
        case 'buff':en.atk+=en.intentVal;s.log=[...s.log,`🟡 ${en.Name}: ATK +${en.intentVal}`];break;}

      // Sync remaining block after enemy consumed some (needed for accurate Fortify carry)
      s.playerBlock=pBlk;
      action.setPlayerHp(pHp);
      if(pHp<=0){s.enemy=en;s.defeat=true;s.phase='done';return s;}
      Object.assign(en,rollIntent(en));s.enemy=en;

      // Fortify carry — uses remaining block after enemy attacks
      const hasFort=[...s.placedCards,...s.activeCharges].some(c=>c.keyword==='fortify');
      const carry=hasFort?Math.floor(s.playerBlock*(hasR('fortUp')?0.65:0.5)):0;

      // Discard: resolved cards (placed + old activeCharges) + unplayed hand
      const disc=[...s.discardPile,...s.hand,...s.placedCards,...s.activeCharges];
      let draw=[...s.drawPile];
      if(draw.length<5){draw=[...draw,...shuffle(disc)];s.discardPile=[];}else{s.discardPile=disc;}
      const hs=Math.min(5,draw.length);s.hand=draw.slice(0,hs);s.drawPile=draw.slice(hs);

      // NEW PAGE: pending charges from THIS turn become active charges (stay on page)
      const newPage=Array(ROWS).fill(null).map(()=>Array(COLS).fill(null));
      // Place activeCharges (from pendingCharges) onto the new page
      const newActive=[...s.pendingCharges];
      newActive.forEach(card=>{
        (SHAPES[card.shape]||SHAPES.s1).forEach(([dr,dc])=>{
          if(card.row+dr<ROWS&&card.col+dc<COLS)newPage[card.row+dr][card.col+dc]=card.id;
        });
      });

      s.page=newPage;s.activeCharges=newActive;s.pendingCharges=[];
      s.placedCards=[];s.energy=s.maxEnergy;s.playerBlock=carry;
      s.comboCount=0;s.momentum=0;s.momentumUsed=false;s.turn++;s.phase='player';
      if(carry>0)s.log=[...s.log,`🛡️ Fortify: ${carry}`];
      if(newActive.length>0)s.log=[...s.log,`⏳ ${newActive.length} charged card(s) ready to fire next turn!`];
      return s;}
    default:return s;
  }
}

// ═══ MAIN ═══
export default function ComicSpire(){
  const heroes=useMemo(()=>parseCSV(CSV_RAW),[]);
  const[screen,setScreen]=useState('title');
  const[player,setPlayer]=useState(null);
  const[deck,setDeck]=useState([]);
  const[gold,setGold]=useState(0);
  const[alignment,setAlignment]=useState('neutral');
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
  const[showCodex,setShowCodex]=useState(false);
  const[pendingBattle,setPendingBattle]=useState(null);
  const[rewardPhase,setRewardPhase]=useState('card');
  const[rewardRelics,setRewardRelics]=useState([]);
  const[rewardCards,setRewardCards]=useState([]); // FIXED: stored in state, not recalculated
  const[tooltip,setTooltip]=useState(null);
  const[battle,dispatch]=useReducer(bReduce,INIT_B);
  const[floaters,setFloaters]=useState([]);
  const[shake,setShake]=useState(false);
  const[animPhase,setAnimPhase]=useState(null);
  const logRef=useRef(null);
  useEffect(()=>{if(logRef.current)logRef.current.scrollTop=9999;},[battle.log]);
  // Clear tooltip and floaters on any screen change
  useEffect(()=>{setTooltip(null);setFloaters([]);},[screen]);
  const addFloat=useCallback((t,c,side='enemy')=>{const id=uid();setFloaters(p=>[...p,{id,text:t,color:c,x:side==='enemy'?60+Math.random()*24:6+Math.random()*24,y:18+Math.random()*22}]);setTimeout(()=>setFloaters(p=>p.filter(f=>f.id!==id)),1400);},[]);
  const doShake=useCallback(()=>{setShake(true);setTimeout(()=>setShake(false),350);},[]);
  const healPlayer=useCallback(amt=>setPlayer(p=>p?{...p,hp:Math.min(p.maxHp,p.hp+amt)}:p),[]);
  const hasR=useCallback(fx=>relics.some(r=>r.fx===fx),[relics]);
  const applyRelic=useCallback(r=>{setRelics(p=>[...p,r]);if(r.fx==='hpUp')setPlayer(p=>({...p,maxHp:p.maxHp+8,hp:p.hp+8}));if(r.fx==='enUp')setMaxEnergy(p=>Math.min(5,p+1));},[]);

  useEffect(()=>{if(battle.victory&&screen==='battle'){
    const en=battle.enemy;setGold(p=>p+15+Math.floor(Math.random()*20)+curFloor*3+(en?.isBoss?50:en?.isElite?20:0)+(hasR('goldUp')?10:0));
    setCopiedAbilities(p=>[...p,{name:en.Name,sig:en.signature.name,arch:en.signature.archetype,icon:en.signature.icon,kw:en.signature.keyword}]);
    setPotLv(p=>p+1);setRewardRelics(pickRelics(relics,3));setRewardPhase('card');
    // Generate reward cards ONCE here, not in render
    const sig=en.signature;
    const alts=shuffle(heroes).slice(0,2).map(h=>getSignature(h));
    setRewardCards([sig,...alts]);
    setTimeout(()=>setScreen('reward'),800);}},[battle.victory]);
  useEffect(()=>{if(battle.defeat&&screen==='battle')setTimeout(()=>setScreen('gameOver'),600);},[battle.defeat]);

  const startGame=useCallback(()=>{
    setPlayer({name:'Potential Man',hp:55,maxHp:55,critChance:10});
    setDeck(makeStarterDeck());setGold(25);setAlignment('neutral');setMaxEnergy(3);
    setPotLv(1);setCopiedAbilities([]);setRelics([]);
    const m=makeMap();m[0][0].visited=true;setHexMap(m);setCurFloor(0);setCurNodeId(m[0][0].id);
    setMapLog(['Choose a path. Branches lock in for 3 floors.']);setScreen('map');
  },[]);

  const commitBattle=useCallback(()=>{if(!pendingBattle)return;const{nodeId,en}=pendingBattle;const[f]=nodeId.split('-').map(Number);
    setHexMap(prev=>prev.map((row,fi)=>fi===f?row.map(n=>n.id===nodeId?{...n,visited:true}:n):row));
    setCurFloor(f);setCurNodeId(nodeId);const enWithIntent={...en,...rollIntent(en)};
    dispatch({type:'INIT',enemy:enWithIntent,deck,maxEn:maxEnergy,relics});setSelectedCardId(null);setPendingBattle(null);setScreen('battle');
  },[pendingBattle,hexMap,deck,maxEnergy,relics]);

  const placeCard=useCallback((card,r,c)=>{
    dispatch({type:'PLACE_CARD',card,row:r,col:c,relics,playerHp:player?.hp||1,payBlood:cost=>setPlayer(p=>p?{...p,hp:Math.max(1,p.hp-cost)}:p)});
    setSelectedCardId(null);
  },[relics,player]);

  const endTurn=useCallback(()=>{
    if(battle.phase!=='player')return;setAnimPhase('r');
    setTimeout(()=>{
      dispatch({type:'END_TURN',relics,playerHp:player?.hp||0,playerMaxHp:player?.maxHp||1,
        getPlayerHp:()=>player?.hp||0,setPlayerHp:hp=>setPlayer(p=>p?{...p,hp}:p),healFn:healPlayer});
      doShake();setAnimPhase(null);
    },400);
  },[battle,player,relics,doShake,healPlayer]);

  const selectNode=useCallback(nodeId=>{
    if(!hexMap)return;const[f,i]=nodeId.split('-').map(Number);
    const[cf,ci]=(curNodeId||'0-0').split('-').map(Number);const cur=hexMap[cf]?.[ci];
    if(!cur?.conns?.includes(nodeId)&&f!==0)return;const node=hexMap[f][i];
    if(['battle','elite','boss'].includes(node.type)){
      setPendingBattle({nodeId,en:pickEnemy(heroes,f,node.type==='boss',node.type==='elite')});return;}
    setHexMap(prev=>prev.map((row,fi)=>fi===f?row.map(n=>n.id===nodeId?{...n,visited:true}:n):row));setCurFloor(f);setCurNodeId(nodeId);
    if(node.type==='shop'){setShopItems(shuffle(heroes).slice(0,4).map(h=>{const s=getSignature(h);s.price=Math.floor(18+s.tier*12+s.value);return s;}));setShopRelics(pickRelics(relics,2).map(r=>({...r,price:r.syn==='any'?30:45})));setScreen('shop');}
    else if(node.type==='event'){setCurEvent(pick(EVENTS));setScreen('event');}
    else if(node.type==='rest'){const h=Math.floor(player?.maxHp*0.3||12);healPlayer(h);setMapLog(p=>[...p,`🏕 +${h} HP`]);}
  },[hexMap,curNodeId,heroes,player,relics,healPlayer]);

  const handleEvent=useCallback(opt=>{
    if(opt.fx==='upgrade'){const c=deck.filter(c=>c.copiedFrom);if(c.length>0){const t=pick(c);setDeck(p=>p.map(x=>x.id===t.id?{...x,value:Math.floor(x.value*1.3),name:x.name+'+'}:x));}}
    else if(opt.fx==='remove'){const b=deck.filter(c=>!c.copiedFrom&&c.tier===0);if(b.length>0)setDeck(p=>p.filter(x=>x.id!==b[0].id));}
    else if(opt.fx==='heal')healPlayer(opt.v);
    else if(opt.fx==='gold')setGold(p=>p+opt.v);
    else if(opt.fx==='maxEn')setMaxEnergy(p=>Math.min(5,p+1));
    else if(opt.fx==='dupe'){const c=deck.filter(c=>c.copiedFrom);if(c.length>0){const b=[...c].sort((a,b)=>b.value-a.value)[0];setDeck(p=>[...p,{...b,id:uid()}]);}}
    else if(opt.fx==='upWeak'){const c=deck.filter(c=>c.copiedFrom);if(c.length>0){const w=[...c].sort((a,b)=>a.value-b.value)[0];setDeck(p=>p.map(x=>x.id===w.id?{...x,value:Math.floor(x.value*1.4),name:x.name+'+'}:x));}}
    setScreen('map');
  },[deck,healPlayer]);

  const pickRewardCard=useCallback(card=>{if(card)setDeck(p=>[...p,card]);setRewardPhase('relic');},[]);
  const pickRewardRelic=useCallback(r=>{if(r)applyRelic(r);if(hexMap&&curFloor>=hexMap.length-1){setScreen('victory');return;}setScreen('map');},[hexMap,curFloor,applyRelic]);

  const accent=alignment==='villain'?'#ff3366':alignment==='hero'?'#33aaff':'#ffaa33';
  const bg1=alignment==='villain'?'#12060f':alignment==='hero'?'#060d18':'#0d0d14';
  const bg2=alignment==='villain'?'#200e1c':alignment==='hero'?'#0c1628':'#14141e';

  // Keyword badge with tooltip — click to show, auto-dismiss after 3s
  const showTip=useCallback((info)=>{setTooltip(info);setTimeout(()=>setTooltip(p=>p===info?null:p),3000);},[]);
  const KW=({k})=>{if(!k)return null;const info=KW_INFO[k];if(!info)return null;
    return <span onClick={(e)=>{e.stopPropagation();showTip(info);}} onMouseEnter={()=>showTip(info)} onMouseLeave={()=>setTooltip(null)}
      style={{fontSize:7,padding:'0 3px',borderRadius:2,background:`${info.color}22`,color:info.color,border:`1px solid ${info.color}44`,fontFamily:FD,letterSpacing:0.5,cursor:'help'}}>{info.name}</span>;};

  const HpBar=({hp,max,color,h=13})=> <div style={{position:'relative',height:h,background:'#1a1a2a',borderRadius:h/2,overflow:'hidden',border:'1px solid #333',minWidth:80}}><div style={{height:'100%',width:`${clamp(hp/max*100,0,100)}%`,background:`linear-gradient(90deg,${color}88,${color})`,borderRadius:h/2,transition:'width 0.4s'}}/><div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:h*0.6,fontFamily:FB,fontWeight:700,color:'#fff',textShadow:'0 1px 2px #000'}}>{hp}/{max}</div></div>;

  const IntentBox=({intent,val,weak})=>{const cfg={attack:{i:'⚔️',c:'#ff4455',t:`${Math.max(1,val-(weak||0))} dmg`},magic:{i:'✨',c:'#bb55ff',t:`${val} magic`},defend:{i:'🛡️',c:'#4499ff',t:`+${val} Blk`},buff:{i:'💪',c:'#ffcc33',t:`+${val} ATK`}}[intent]||{i:'?',c:'#888',t:''};
    return <div style={{display:'flex',alignItems:'center',gap:4,padding:'3px 6px',background:`${cfg.c}10`,border:`1px solid ${cfg.c}33`,borderRadius:5,marginTop:2,fontSize:9}}><span>{cfg.i}</span><span style={{color:'#bbb',fontFamily:FB}}>{cfg.t}</span></div>;};

  const Card=({card,onClick,sel,price,dis})=>{const kInfo=KW_INFO[card.keyword];const tc=kInfo?.color||TC[card.type]||'#888';
    return <div onClick={()=>!dis&&onClick?.(card)} style={{width:118,minWidth:118,height:165,borderRadius:8,overflow:'hidden',cursor:dis?'default':'pointer',background:bg2,border:`2px solid ${sel?'#fff':tc}`,boxShadow:sel?`0 0 18px ${tc}66`:`0 3px 8px #00000088`,transform:sel?'translateY(-10px) scale(1.05)':'scale(1)',transition:'all 0.2s',flexShrink:0,opacity:dis?0.3:1}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'2px 5px',background:`${tc}18`}}>
        <div style={{width:18,height:18,borderRadius:'50%',background:card.keyword==='blood'?'#ff3333':card.keyword==='frenzy'?'#ff55aa':tc,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:FD,fontSize:10,color:'#000',fontWeight:700}}>{card.keyword==='blood'?'♥'+(hasR('bloodCheap')?3:card.bloodCost):card.keyword==='frenzy'?'0':card.cost}</div>
        <div style={{fontSize:6,fontFamily:FD,color:tc,letterSpacing:1}}>{card.type.toUpperCase()}</div>
        {card.charge&&<div style={{fontSize:7,color:'#ffaa33',fontFamily:FD}}>⏳</div>}
        <div style={{fontSize:5,color:'#999',fontFamily:FD}}>{(card.shape||'s1').toUpperCase()}</div>
      </div>
      <div style={{height:26,display:'flex',alignItems:'center',justifyContent:'center',background:`radial-gradient(circle,${card.color}15,transparent)`,fontSize:18}}>{card.icon}</div>
      <div style={{padding:'2px 5px',flex:1}}>
        <div style={{fontFamily:FD,fontSize:9.5,color:'#fff',lineHeight:1.1,marginBottom:1,display:'flex',alignItems:'center',gap:2,flexWrap:'wrap'}}>{card.name} <KW k={card.keyword}/></div>
        <div style={{fontFamily:FB,fontSize:8,color:'#aaa',lineHeight:1.2}}>{card.desc}</div>
      </div>
      <div style={{padding:'1px 5px 3px',borderTop:'1px solid #ffffff06',fontSize:7}}>
        {price!=null?<span style={{fontFamily:FD,fontSize:10,color:gold>=price?'#ffd700':'#ff4455'}}>💰{price}</span>:
          <span style={{color:card.copiedFrom?tc:'#444',fontFamily:FB}}>{card.copiedFrom?'🔓'+card.heroName:'Basic'}</span>}
      </div>
    </div>;};

  const Relic=({relic,onClick,price,dis})=>{const sc=KW_INFO[relic.syn?.toLowerCase()]?.color||'#ffaa33';
    return <div onClick={()=>!dis&&onClick?.(relic)} style={{width:130,padding:'6px 8px',background:bg2,border:`1.5px solid ${sc}33`,borderRadius:8,cursor:dis?'default':'pointer',opacity:dis?0.3:1,transition:'all 0.2s'}}
      onMouseEnter={e=>{if(!dis){e.currentTarget.style.borderColor=sc;e.currentTarget.style.transform='translateY(-3px)';}}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=`${sc}33`;e.currentTarget.style.transform='';}}>
      <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:2}}><span style={{fontSize:16}}>{relic.icon}</span><div><div style={{fontFamily:FD,fontSize:10,color:'#fff'}}>{relic.name}</div><div style={{fontSize:7,color:sc,fontFamily:FD}}>{relic.syn==='any'?'UNIVERSAL':relic.syn}</div></div></div>
      <div style={{fontFamily:FB,fontSize:8,color:'#999',lineHeight:1.2}}>{relic.desc}</div>
      {price!=null&&<div style={{fontFamily:FD,fontSize:10,color:gold>=price?'#ffd700':'#ff4455',marginTop:2}}>💰{price}</div>}
    </div>;};

  const CSS=`@import url('${FURL}');@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes shakeAnim{0%,100%{transform:translate(0)}15%{transform:translate(-5px,2px)}35%{transform:translate(4px,-3px)}55%{transform:translate(-3px,4px)}75%{transform:translate(5px,-2px)}}@keyframes floatDmg{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-80px) scale(1.5)}}@keyframes enterCard{from{opacity:0;transform:translateY(20px) scale(0.9)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes chargeGlow{0%,100%{box-shadow:inset 0 0 8px #ffaa3322}50%{box-shadow:inset 0 0 16px #ffaa3366}}@keyframes spin{to{transform:rotate(360deg)}}`;

  // ═══ TOOLTIP OVERLAY — click anywhere to dismiss ═══
  const TooltipOverlay=()=>{if(!tooltip)return null;
    return <div onClick={()=>setTooltip(null)} style={{position:'fixed',bottom:10,left:'50%',transform:'translateX(-50%)',zIndex:200,background:'#111e',border:`2px solid ${tooltip.color}`,borderRadius:8,padding:'8px 14px',maxWidth:300,boxShadow:`0 0 20px ${tooltip.color}44`,cursor:'pointer',backdropFilter:'blur(4px)'}}>
      <div style={{fontFamily:FD,fontSize:14,color:tooltip.color,marginBottom:3}}>{tooltip.name}</div>
      <div style={{fontFamily:FB,fontSize:11,color:'#ccc',lineHeight:1.4}}>{tooltip.desc}</div>
      <div style={{fontSize:8,color:'#555',marginTop:4,textAlign:'right'}}>tap to dismiss</div>
    </div>;};

  // ═══ TITLE ═══
  if(screen==='title')return (
    <div style={{minHeight:'100vh',background:'radial-gradient(ellipse at 50% 40%,#1a0a2e,#000)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:FD,color:'#fff',padding:20,overflow:'hidden',position:'relative'}}>
      <style>{CSS}</style>
      <div style={{position:'absolute',width:500,height:500,background:'conic-gradient(from 0deg,#ffaa3308 0deg,transparent 15deg,#ffaa3308 30deg,transparent 45deg)',borderRadius:'50%',animation:'spin 25s linear infinite'}}/>
      <div style={{position:'relative',zIndex:1,textAlign:'center'}}>
        <div style={{fontSize:12,letterSpacing:8,color:'#ffaa33',fontFamily:FB,animation:'fadeUp 0.5s ease both'}}>HACKBETA</div>
        <h1 style={{fontSize:'clamp(42px,8vw,72px)',textShadow:'4px 4px 0 #ff6600,8px 8px 0 #000',margin:'8px 0',animation:'pulse 3s ease-in-out infinite',lineHeight:1}}>COMIC SPIRE</h1>
        <div style={{fontSize:18,color:'#ffaa33',textShadow:'2px 2px 0 #000',margin:'6px 0',animation:'fadeUp 0.5s 0.15s ease both',opacity:0}}>POTENTIAL MAN</div>
        <div style={{fontFamily:FB,fontSize:10,color:'#555',maxWidth:420,margin:'10px auto 16px',lineHeight:1.7,animation:'fadeUp 0.5s 0.3s ease both',opacity:0}}>
          Place cards on a comic page panel. They resolve in reading order on END TURN.<br/>
          Bigger cards = bigger panels = harder to fit. Charge cards fire next turn.<br/>
          <span style={{color:'#ff4455'}}>Combo</span> · <span style={{color:'#bb55ff'}}>Channel</span> · <span style={{color:'#33ddff'}}>Momentum</span> · <span style={{color:'#4499ff'}}>Fortify</span> · <span style={{color:'#44dd66'}}>Corrode</span> · <span style={{color:'#ff7722'}}>Blood</span> · <span style={{color:'#dd88ff'}}>Echo</span> · <span style={{color:'#55aaff'}}>Shield Bash</span> · <span style={{color:'#88ff44'}}>Catalyze</span> · <span style={{color:'#aa44dd'}}>Overchannel</span> · <span style={{color:'#ff55aa'}}>Frenzy</span>
        </div>
        <button onClick={startGame} style={{fontFamily:FD,fontSize:24,padding:'12px 44px',background:'linear-gradient(135deg,#ffaa33,#ff6600)',border:'4px solid #fff',borderRadius:12,color:'#fff',cursor:'pointer',textShadow:'2px 2px 0 #000',boxShadow:'0 0 30px #ffaa3344',animation:'float 3s ease-in-out infinite'}}>BEGIN</button>
      </div>
    </div>);

  // ═══ MAP ═══
  if(screen==='map')return (
    <div style={{minHeight:'100vh',background:bg1,padding:12,fontFamily:FB,color:'#fff'}}>
      <style>{CSS}</style><TooltipOverlay/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 10px',background:'#00000066',borderRadius:8,border:`1px solid ${accent}22`,marginBottom:6,flexWrap:'wrap',gap:4}}>
        <div><span style={{fontFamily:FD,fontSize:13,color:accent}}>⚡ Potential Man</span> <span style={{fontSize:8,color:'#555'}}>Lv.{potLv}</span></div>
        <div style={{display:'flex',gap:8,fontSize:10,alignItems:'center',flexWrap:'wrap'}}>
          <span>❤️{player?.hp}/{player?.maxHp}</span><span>💰{gold}</span><span>⚡{maxEnergy}</span><span>🃏{deck.length}</span>
          {relics.length>0&&<span>{relics.map(r=>r.icon).join('')}</span>}
          <button onClick={(e)=>{e.stopPropagation();setTooltip(null);setShowCodex(p=>!p);}} style={{fontFamily:FD,fontSize:8,padding:'1px 5px',background:`${accent}22`,border:`1px solid ${accent}44`,borderRadius:3,color:accent,cursor:'pointer'}}>📋</button>
        </div>
      </div>
      {showCodex&&<div style={{position:'fixed',inset:0,background:'#000c',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:12}} onClick={()=>{setShowCodex(false);setTooltip(null);}}>
        <div style={{background:bg2,border:`2px solid ${accent}44`,borderRadius:12,padding:16,maxWidth:460,maxHeight:'80vh',overflow:'auto',width:'100%'}} onClick={e=>e.stopPropagation()}>
          {copiedAbilities.map((a,i)=> <div key={i} style={{fontSize:9,color:'#aaa',padding:'2px 0'}}>{a.icon} {a.sig} <KW k={a.kw}/> — {a.name}</div>)}
          {relics.length>0&&<div style={{marginTop:6}}>{relics.map((r,i)=> <div key={i} style={{fontSize:9,color:'#888'}}>{r.icon} {r.name}: {r.desc}</div>)}</div>}
          <button onClick={()=>setShowCodex(false)} style={{marginTop:6,fontFamily:FD,fontSize:11,padding:'3px 14px',background:'#333',border:`1px solid ${accent}`,borderRadius:4,color:'#fff',cursor:'pointer'}}>CLOSE</button>
        </div>
      </div>}
      {mapLog.length>0&&<div style={{maxWidth:500,margin:'0 auto 5px',padding:'3px 10px',background:`${accent}08`,border:`1px solid ${accent}22`,borderRadius:5,fontSize:9,textAlign:'center',color:'#999'}}>{mapLog[mapLog.length-1]}</div>}
      <h3 style={{fontFamily:FD,fontSize:14,textAlign:'center',color:accent,margin:'0 0 6px',letterSpacing:2}}>Floor {curFloor}</h3>
      <div style={{maxWidth:500,margin:'0 auto',display:'flex',flexDirection:'column-reverse',gap:3}}>
        {hexMap?.map((fn,fi)=>{const[cf]=(curNodeId||'0-0').split('-').map(Number);const co=curNodeId?hexMap[cf]?.find(n=>n.id===curNodeId):null;
          const isMerge=fn.length===1&&fi>0&&fi<(hexMap?.length||1)-1&&fi!==13&&fi!==14;
          return <div key={fi} style={{display:'flex',justifyContent:'center',gap:8,alignItems:'center'}}>
            <div style={{width:16,fontSize:7,color:isMerge?accent:'#333',fontFamily:FD,textAlign:'right'}}>{isMerge?'◆':fi}</div>
            {fn.map(node=>{const reach=co?.conns?.includes(node.id);const isCur=node.id===curNodeId;const nc=NC[node.type]||'#555';
              return <div key={node.id} onClick={()=>reach?selectNode(node.id):null} style={{
                width:42,height:42,borderRadius:6,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                background:isCur?`${nc}20`:node.visited?'#1a1a2a':reach?`${nc}08`:'#0a0a12',
                border:`2px solid ${isCur?nc:reach?`${nc}88`:node.visited?'#333':'#1a1a22'}`,
                cursor:reach?'pointer':'default',opacity:!reach&&!node.visited&&!isCur?0.15:1,transition:'all 0.2s',
              }} onMouseEnter={e=>{if(reach){e.currentTarget.style.transform='scale(1.15)';e.currentTarget.style.boxShadow=`0 0 12px ${nc}44`;}}}
                 onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
                <div style={{fontSize:14}}>{NI[node.type]}</div><div style={{fontSize:5,color:nc,fontFamily:FD}}>{node.type.toUpperCase()}</div>
              </div>;})}
          </div>;})}
      </div>
      <details style={{maxWidth:500,margin:'10px auto 0'}}><summary style={{cursor:'pointer',fontFamily:FD,color:accent,fontSize:10}}>📖 Deck ({deck.length})</summary>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:6,justifyContent:'center'}}>{deck.map(c=> <Card key={c.id} card={c}/>)}</div></details>
      {pendingBattle&&<div style={{position:'fixed',inset:0,background:'#000d',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:12}}>
        <div style={{background:bg2,border:`2px solid ${pendingBattle.en.color}`,borderRadius:12,padding:20,maxWidth:380,width:'100%',textAlign:'center',animation:'fadeUp 0.3s'}}>
          <h2 style={{fontFamily:FD,fontSize:20,color:pendingBattle.en.color,margin:'4px 0'}}>{pendingBattle.en.Name}</h2>
          <HpBar hp={pendingBattle.en.gameHp} max={pendingBattle.en.gameMaxHp} color={pendingBattle.en.color} h={11}/>
          <div style={{margin:'6px 0',padding:'5px 8px',background:`${accent}08`,border:`1px solid ${accent}33`,borderRadius:6}}>
            <div style={{fontFamily:FD,fontSize:8,color:accent}}>🔓 UNLOCK:</div>
            <div style={{display:'flex',alignItems:'center',gap:4,justifyContent:'center',marginTop:2}}>
              <span style={{fontSize:16}}>{pendingBattle.en.signature.icon}</span>
              <div style={{textAlign:'left'}}><div style={{fontFamily:FD,fontSize:11,color:'#fff'}}>{pendingBattle.en.signature.name} <KW k={pendingBattle.en.signature.keyword}/>{pendingBattle.en.signature.charge&&<span style={{color:'#ffaa33',fontSize:8}}> ⏳</span>}</div>
                <div style={{fontSize:8,color:'#aaa'}}>{pendingBattle.en.signature.desc}</div>
                <div style={{fontSize:7,color:'#666'}}>Shape: {pendingBattle.en.signature.shape} · {'★'.repeat(pendingBattle.en.signature.tier)}</div></div>
            </div>
          </div>
          <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:6}}>
            <button onClick={commitBattle} style={{fontFamily:FD,fontSize:15,padding:'6px 24px',background:'linear-gradient(135deg,#ff3366,#ff6600)',border:'2px solid #fff',borderRadius:8,color:'#fff',cursor:'pointer'}}>FIGHT</button>
            <button onClick={()=>setPendingBattle(null)} style={{fontFamily:FD,fontSize:11,padding:'6px 12px',background:'#222',border:'1px solid #444',borderRadius:8,color:'#888',cursor:'pointer'}}>BACK</button>
          </div>
        </div>
      </div>}
    </div>);

  // ═══ BATTLE ═══
  if(screen==='battle'){
    const selCard=battle.hand.find(c=>c.id===selectedCardId);
    const validSet=selCard?getValid(battle.page,selCard.shape||'s1'):new Set();
    const en=battle.enemy;const isP=battle.phase==='player'&&!animPhase;
    const momT=hasR('momDown')?3:4;
    const canPlay=c=>{if(!isP)return false;if(c.keyword==='blood')return(player?.hp||0)>(hasR('bloodCheap')?3:c.bloodCost);
      if(c.keyword==='frenzy')return getValid(battle.page,c.shape||'h2').size>0;
      if(battle.momentum>=momT&&!battle.momentumUsed)return true;return battle.energy>=c.cost;};

    // Find all cards currently on the page (placed + pendingCharges + activeCharges)
    const allPageCards=[...battle.placedCards,...battle.pendingCharges,...battle.activeCharges];

    return (
      <div style={{minHeight:'100vh',background:bg1,padding:10,fontFamily:FB,color:'#fff',display:'flex',flexDirection:'column',animation:shake?'shakeAnim 0.35s':undefined}}>
        <style>{CSS}</style><TooltipOverlay/>
        {floaters.map(f=> <div key={f.id} style={{position:'fixed',left:`${f.x}%`,top:`${f.y}%`,pointerEvents:'none',zIndex:100,fontFamily:FD,fontSize:18,color:f.color,textShadow:'2px 2px 0 #000',animation:'floatDmg 1.4s ease-out forwards'}}>{f.text}</div>)}
        {/* Combatants */}
        <div style={{display:'flex',justifyContent:'space-between',gap:8,marginBottom:5,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:150,padding:'5px 8px',background:'#00000066',borderRadius:8,border:`1px solid ${accent}22`}}>
            <div style={{fontFamily:FD,fontSize:12,color:accent}}>⚡ Potential Man <span style={{fontSize:8,color:'#555'}}>Lv.{potLv}</span></div>
            <HpBar hp={player?.hp||0} max={player?.maxHp||1} color="#ff4455"/>
            <div style={{display:'flex',gap:4,marginTop:3,fontSize:9,flexWrap:'wrap',alignItems:'center'}}>
              <div style={{display:'flex',gap:1}}>{Array(battle.maxEnergy).fill(0).map((_,i)=> <div key={i} style={{width:12,height:12,borderRadius:'50%',background:i<battle.energy?'linear-gradient(135deg,#ffcc33,#ff8800)':'#222',border:`1px solid ${i<battle.energy?'#ffdd55':'#333'}`}}/>)}</div>
              {battle.playerBlock>0&&<span style={{color:'#4499ff'}}>🛡️{battle.playerBlock}</span>}
              {battle.momentum>0&&<span style={{color:'#33ddff'}}>⚡{battle.momentum}{battle.momentum>=momT&&!battle.momentumUsed?' FREE!':''}</span>}
              {battle.channelStacks>0&&<span style={{color:'#bb55ff'}}>✨{battle.channelStacks}</span>}
              {battle.comboCount>0&&<span style={{color:'#ff4455'}}>⚔×{battle.comboCount}</span>}
              {(player?.hp||0)<(player?.maxHp||1)*(hasR('despUp')?0.4:0.3)&&<span style={{color:'#ff3333',fontFamily:FD}}>🔥2×</span>}
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><div style={{fontFamily:FD,fontSize:16,color:'#ff336666'}}>VS</div><div style={{fontSize:7,color:'#444',fontFamily:FD}}>T{battle.turn}</div></div>
          {en&&<div style={{flex:1,minWidth:150,padding:'5px 8px',background:'#00000066',borderRadius:8,border:`1px solid ${en.color}22`}}>
            <div style={{fontFamily:FD,fontSize:12,color:en.color}}>{en.isBoss?'👑':en.isElite?'💀':''}{en.Name}</div>
            <HpBar hp={en.gameHp} max={en.gameMaxHp} color={en.color}/>
            <div style={{display:'flex',gap:4,marginTop:2,justifyContent:'flex-end',fontSize:8}}>
              {en.block>0&&<span style={{color:'#4499ff'}}>🛡️{en.block}</span>}
              {en.poisonStacks>0&&<span style={{color:'#44dd66'}}>☠{en.poisonStacks}{en.corrodeStacks>0?'⊛':''}</span>}
              {(en.weakened||0)>0&&<span style={{color:'#bb55ff'}}>💫-{en.weakened}</span>}
            </div>
            <IntentBox intent={en.intent} val={en.intentVal} weak={en.weakened}/>
          </div>}
        </div>

        {/* COMIC PAGE 2×3 */}
        <div style={{background:'#f5f0e8',borderRadius:8,padding:6,maxWidth:380,margin:'0 auto 4px',width:'100%',border:'3px solid #111',boxShadow:'3px 3px 0 #000',position:'relative'}}>
          <div style={{position:'absolute',inset:0,borderRadius:4,opacity:0.03,backgroundImage:'radial-gradient(circle,#000 0.5px,transparent 0.5px)',backgroundSize:'6px 6px',pointerEvents:'none'}}/>
          <div style={{fontFamily:FD,fontSize:7,color:'#888',textAlign:'center',marginBottom:3,letterSpacing:2}}>
            {battle.placedCards.length>0?`${battle.placedCards.length} cards queued — END TURN to resolve ↘`:
              battle.activeCharges.length>0?`⏳ ${battle.activeCharges.length} charge(s) ready — will fire on END TURN`:
              '★ PLACE CARDS → resolve in reading order ★'}
          </div>
          <div style={{display:'grid',gridTemplateColumns:`repeat(${COLS},1fr)`,gridTemplateRows:`repeat(${ROWS},70px)`,gap:3}}>
            {battle.page.map((row,ri)=>row.map((cell,ci)=>{
              const key=`${ri}-${ci}`;const isV=validSet.has(key);
              const pl=cell?allPageCards.find(c=>c.id===cell):null;
              const isCharging=pl&&(battle.pendingCharges.some(c=>c.id===cell)||battle.activeCharges.some(c=>c.id===cell));
              const isActive=pl&&battle.activeCharges.some(c=>c.id===cell);
              const kInfo=pl?KW_INFO[pl.keyword]:null;
              const tc=kInfo?.color||TC[pl?.type]||'#ccc';
              const order=ri*COLS+ci+1;
              return <div key={key} onClick={()=>isV&&selCard?placeCard(selCard,ri,ci):null} style={{
                background:pl?(isCharging?`linear-gradient(135deg,#ffaa3315,#fff8ee)`:`linear-gradient(135deg,${pl.color}15,#fff)`):isV?'#fffbe6':'#faf8f2',
                border:`2px solid ${pl?(isCharging?'#ffaa33':tc):isV?'#ddaa33':'#e0ddd6'}`,borderRadius:4,
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                cursor:isV?'pointer':'default',transition:'all 0.15s',position:'relative',
                animation:isCharging?'chargeGlow 2s ease-in-out infinite':undefined,
              }}>
                <div style={{position:'absolute',top:1,left:3,fontSize:7,color:'#ccc',fontFamily:FD}}>{order}</div>
                {isActive&&<div style={{position:'absolute',top:1,right:3,fontSize:7,color:'#ffaa33',fontFamily:FD}}>⏳READY</div>}
                {isCharging&&!isActive&&<div style={{position:'absolute',top:1,right:3,fontSize:7,color:'#ff8800',fontFamily:FD}}>⏳NEXT</div>}
                {pl?(<><div style={{fontSize:16}}>{pl.icon}</div><div style={{fontFamily:FD,fontSize:7,color:isCharging?'#cc8800':'#333',textAlign:'center',lineHeight:1}}>{(pl.name.split("'s ")[1]||pl.name).slice(0,10)}</div><div style={{fontSize:7,color:tc,fontWeight:700}}>{pl.value}</div></>)
                :isV? <div style={{fontSize:10,color:'#bb8833',fontFamily:FD}}>✦</div>:null}
              </div>;}))}
          </div>
        </div>

        <div ref={logRef} style={{maxWidth:380,width:'100%',margin:'0 auto 3px',padding:'2px 6px',background:'#00000044',borderRadius:4,fontSize:7,color:'#555',maxHeight:32,overflowY:'auto',lineHeight:1.4}}>
          {battle.log.slice(-4).map((m,i)=> <div key={i}>{m}</div>)}
        </div>

        <div style={{marginBottom:4}}>
          <div style={{fontFamily:FD,fontSize:7,color:'#444',textAlign:'center',marginBottom:2,letterSpacing:1}}>
            {!isP?'⏳ Resolving...':selCard?`Shape: ${selCard.shape||'s1'} ${selCard.charge?'(⏳ fires NEXT turn)':''}— click golden panel`:'SELECT A CARD'}
          </div>
          <div style={{display:'flex',gap:4,justifyContent:'center',flexWrap:'wrap',minHeight:40}}>
            {battle.hand.map((c,i)=> <div key={c.id} style={{animation:`enterCard 0.2s ${i*0.04}s ease both`,opacity:0}}><Card card={c} sel={c.id===selectedCardId} dis={!canPlay(c)} onClick={card=>setSelectedCardId(card.id===selectedCardId?null:card.id)}/></div>)}
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'center',gap:10,alignItems:'center'}}>
          <button onClick={endTurn} disabled={!isP} style={{fontFamily:FD,fontSize:15,padding:'5px 28px',background:isP?(battle.placedCards.length+battle.activeCharges.length>0?'linear-gradient(135deg,#ff3366,#ff6600)':'#444'):'#222',border:`2px solid ${isP?'#fff':'#333'}`,borderRadius:7,color:isP?'#fff':'#555',cursor:isP?'pointer':'not-allowed'}}>
            {battle.activeCharges.length>0&&battle.placedCards.length===0?`FIRE ${battle.activeCharges.length} CHARGE(S)`:
              battle.placedCards.length>0?`RESOLVE ${battle.placedCards.length}${battle.activeCharges.length>0?'+'+battle.activeCharges.length+'⏳':''}`:
              'END TURN'}
          </button>
          <div style={{fontSize:7,color:'#333'}}>📥{battle.drawPile.length} 📤{battle.discardPile.length}</div>
        </div>
      </div>);
  }

  // ═══ REWARD ═══
  if(screen==='reward'){
    if(rewardPhase==='card')return (
      <div style={{minHeight:'100vh',background:bg1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:16,fontFamily:FB,color:'#fff'}}>
        <style>{CSS}</style><TooltipOverlay/>
        <h2 style={{fontFamily:FD,fontSize:22,color:'#ffd700',marginBottom:2}}>🏆 {battle.enemy?.Name} DEFEATED!</h2>
        <div style={{fontFamily:FD,fontSize:12,color:accent,marginBottom:8}}>🔓 PICK A POWER (1 of 3)</div>
        <div style={{display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap',marginBottom:10}}>
          {rewardCards.map((c,i)=> <div key={c.id} style={{animation:`fadeUp 0.3s ${i*0.1}s ease both`,opacity:0,position:'relative'}}>
            {i===0&&<div style={{position:'absolute',top:-7,left:'50%',transform:'translateX(-50%)',fontFamily:FD,fontSize:6,color:'#ffd700',background:'#000',padding:'0 4px',borderRadius:2,border:'1px solid #ffd70044',zIndex:1}}>SIGNATURE</div>}
            <Card card={c} onClick={card=>pickRewardCard(card)}/></div>)}
        </div>
        <button onClick={()=>pickRewardCard(null)} style={{fontFamily:FD,fontSize:10,padding:'4px 14px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#555',cursor:'pointer'}}>Skip →</button>
      </div>);
    if(rewardPhase==='relic')return (
      <div style={{minHeight:'100vh',background:bg1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:16,fontFamily:FB,color:'#fff'}}>
        <style>{CSS}</style><TooltipOverlay/>
        <h2 style={{fontFamily:FD,fontSize:18,color:'#ffaa33',marginBottom:8}}>🎁 PICK A RELIC (1 of 3)</h2>
        <div style={{display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap',marginBottom:10}}>
          {rewardRelics.map((r,i)=> <div key={r.id} style={{animation:`fadeUp 0.3s ${i*0.1}s ease both`,opacity:0}}><Relic relic={r} onClick={rel=>pickRewardRelic(rel)}/></div>)}
        </div>
        <button onClick={()=>pickRewardRelic(null)} style={{fontFamily:FD,fontSize:10,padding:'4px 14px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#555',cursor:'pointer'}}>Skip →</button>
      </div>);
  }

  if(screen==='shop')return (
    <div style={{minHeight:'100vh',background:bg1,padding:16,fontFamily:FB,color:'#fff'}}><style>{CSS}</style><TooltipOverlay/>
    <h2 style={{fontFamily:FD,fontSize:22,textAlign:'center',color:'#ffd700'}}>🛒 SHOP</h2>
    <div style={{textAlign:'center',fontFamily:FD,fontSize:14,color:'#ffd700',marginBottom:10}}>💰{gold}</div>
    <div style={{fontFamily:FD,fontSize:10,color:'#666',textAlign:'center',marginBottom:4}}>CARDS</div>
    <div style={{display:'flex',gap:5,justifyContent:'center',flexWrap:'wrap',marginBottom:10}}>{shopItems.map(i=> <Card key={i.id} card={i} onClick={()=>{if(gold>=i.price){setGold(p=>p-i.price);setDeck(p=>[...p,{...i,id:uid()}]);setShopItems(p=>p.filter(x=>x.id!==i.id));}}} price={i.price} dis={gold<i.price}/>)}</div>
    <div style={{fontFamily:FD,fontSize:10,color:'#666',textAlign:'center',marginBottom:4}}>RELICS</div>
    <div style={{display:'flex',gap:5,justifyContent:'center',flexWrap:'wrap',marginBottom:10}}>{shopRelics.map(r=> <Relic key={r.id} relic={r} onClick={()=>{if(gold>=r.price){setGold(p=>p-r.price);applyRelic(r);setShopRelics(p=>p.filter(x=>x.id!==r.id));}}} price={r.price} dis={gold<r.price}/>)}</div>
    <div style={{textAlign:'center'}}><button onClick={()=>setScreen('map')} style={{fontFamily:FD,fontSize:12,padding:'5px 18px',background:'#222',border:`1px solid ${accent}`,borderRadius:6,color:'#fff',cursor:'pointer'}}>LEAVE →</button></div>
  </div>);

  if(screen==='event'&&curEvent)return (
    <div style={{minHeight:'100vh',background:bg1,display:'flex',alignItems:'center',justifyContent:'center',padding:16,fontFamily:FB,color:'#fff'}}><style>{CSS}</style>
    <div style={{maxWidth:340,background:bg2,border:`1.5px solid ${accent}44`,borderRadius:10,padding:18,textAlign:'center',animation:'fadeUp 0.3s'}}>
      <div style={{fontSize:24,marginBottom:3}}>❓</div>
      <h2 style={{fontFamily:FD,fontSize:18,color:accent,marginBottom:8}}>{curEvent.title}</h2>
      {curEvent.opts.map((o,i)=> <button key={i} onClick={()=>handleEvent(o)} style={{display:'block',width:'100%',fontFamily:FB,fontWeight:700,fontSize:10,padding:'7px 10px',marginBottom:4,background:'#00000044',border:`1px solid ${accent}33`,borderRadius:6,color:'#ddd',cursor:'pointer',textAlign:'left',transition:'all 0.2s'}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=accent;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=`${accent}33`;}}>{o.text}</button>)}
    </div>
  </div>);

  if(screen==='gameOver')return (
    <div style={{minHeight:'100vh',background:'radial-gradient(ellipse,#1a0000,#000)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:FD,color:'#fff',padding:16}}><style>{CSS}</style>
    <h1 style={{fontSize:40,color:'#ff3333',textShadow:'4px 4px 0 #000'}}>POTENTIAL LOST</h1>
    <p style={{fontFamily:FB,color:'#555',marginBottom:14}}>Floor {curFloor} · {copiedAbilities.length} powers · {relics.length} relics</p>
    <button onClick={()=>setScreen('title')} style={{fontFamily:FD,fontSize:16,padding:'8px 24px',background:'linear-gradient(135deg,#ff3366,#ff6600)',border:'2px solid #fff',borderRadius:8,color:'#fff',cursor:'pointer'}}>RETRY</button>
  </div>);

  if(screen==='victory')return (
    <div style={{minHeight:'100vh',background:'radial-gradient(ellipse,#0a1a0a,#000)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:FD,color:'#fff',padding:16}}><style>{CSS}</style>
    <h1 style={{fontSize:40,color:'#ffd700',textShadow:'4px 4px 0 #ff6600,8px 8px 0 #000',animation:'pulse 2s ease-in-out infinite'}}>POTENTIAL REALIZED</h1>
    <p style={{fontFamily:FB,color:'#aaa',marginBottom:14}}>{copiedAbilities.length} powers · {relics.length} relics · Lv.{potLv}</p>
    <button onClick={()=>setScreen('title')} style={{fontFamily:FD,fontSize:16,padding:'8px 24px',background:'linear-gradient(135deg,#ffd700,#ff6600)',border:'2px solid #fff',borderRadius:8,color:'#000',cursor:'pointer'}}>AGAIN</button>
  </div>);

  return null;
}
