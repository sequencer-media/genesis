function onEvent({state,event,participants,config}) {
  const previous=state.public, owner=participants.find(p=>p.role==='player');
  const open=s=>({id:'quest:'+s.turn+':'+event.id,mode:'individual',actionIds:['choose'],actorIds:owner?[owner.id]:[]});
  const fresh=()=>({title:String(config.settings.worldName||'Mosslight'),room:0,turn:0,health:6,maxHealth:6,light:Number(config.settings.lanternTurns||10),maxLight:Number(config.settings.lanternTurns||10),stars:0,coins:2,berries:0,fox:false,ward:false,enemy:config.settings.difficulty==='hard'?10:7,status:'playing',wins:Number(previous.wins||0),message:'Three stars are missing from the village lantern. Find them, outwit the thorn sentinel, and bring the light home.'});
  const choices=s=>{
    if(s.status!=='playing')return [{id:'restart',label:'Play again',hint:'Keep your wins and try another route.'}];
    if(s.room===0)return [{id:'listen',label:'Befriend the fox',hint:'A patient friend may know a shortcut.'},{id:'search',label:'Search the thorns',hint:'Find a star and 2 coins. Lose 1 heart.'},{id:'rush',label:'Race the fireflies',hint:'Find a star quickly. Use 2 lantern light.'}];
    if(s.room===1)return [...(s.fox?[{id:'fox',label:'Follow your fox',hint:'A safe crossing that saves lantern light.'}]:[]),...(s.coins>=2?[{id:'bridge',label:'Pay the bridge keeper',hint:'Spend 2 coins for a safe crossing.'}]:[]),{id:'ford',label:'Wade across',hint:'Find a star and 1 coin. Lose 2 hearts.'}];
    if(s.room===2)return [...(s.coins>=2?[{id:'ward',label:'Buy a moon shield',hint:'2 coins. Absorb the next sentinel hit.'}]:[]),...(s.coins>=1?[{id:'berry',label:'Buy a moonberry',hint:'1 coin. Restore 3 hearts during the fight.'}]:[]),{id:'pass',label:'Keep moving',hint:'Save your coins for a lantern spark.'}];
    return [{id:'strike',label:'Strike the sentinel',hint:'Deal 3 damage. It hits back if still standing.'},...(s.coins>=1?[{id:'spark',label:'Cast a lantern spark',hint:'1 coin and 2 light. Deal 4 damage.'}]:[]),...(s.berries?[{id:'mend',label:'Eat a moonberry',hint:'Restore 3 hearts. Use 1 light.'}]:[{id:'guard',label:'Raise a light shield',hint:'Use 1 light to absorb the next hit.'}])];
  };
  const describe=s=>{
    const rooms=[['Whispering grove','A silver star glints in the brambles. A little fox watches from the path.'],['Silverbrook','The second star is on the far bank. Choose how to cross.'],['Moon market','One small purchase could decide your encounter with the sentinel.'],['Thorn sentinel','The final star is tangled in its crown. Balance your hearts and lantern light.'],['Lantern gate','The village lantern is bright again. The forest remembers your kindness.']];
    const room=rooms[s.room]||rooms[0];
    return {...s,location:room[0],description:room[1],options:choices(s)};
  };
  if(event.type==='session.started'){const s=describe(fresh());return {public:s,window:open(s)}}
  if(event.type==='participant.joined'||event.type==='participant.left')return {window:open(previous)};
  if(event.type!=='action')return {};
  const id=event.data.optionId;
  if(!choices(previous).some(choice=>choice.id===id))throw new Error('Choose an available move.');
  if(id==='restart'){const s=describe(fresh());return {public:s,window:open(s)}}
  const s={...previous,turn:previous.turn+1};let cost=1;
  if(s.room===0){
    s.stars++;s.room=1;
    if(id==='listen'){s.fox=true;s.message='You share a quiet moment. The fox retrieves the first star and offers to guide you.';}
    if(id==='search'){s.health--;s.coins+=2;s.message='You brave the thorns for a star and two coins. A scratch costs one heart.';}
    if(id==='rush'){cost=2;s.message='You catch a firefly star. The sprint burns extra lantern light.';}
  }else if(s.room===1){
    s.stars++;s.room=2;
    if(id==='fox'){cost=0;s.message='Your fox reveals a hidden stepping-stone path. The second star is yours.';}
    if(id==='bridge'){s.coins-=2;s.message='The bridge keeper accepts two coins and lets you collect the second star.';}
    if(id==='ford'){s.health-=2;s.coins++;s.message='The current is rough. You gain a star and a coin, but lose two hearts.';}
  }else if(s.room===2){
    s.room=3;
    if(id==='ward'){s.coins-=2;s.ward=true;s.message='A moon shield settles around you. It will absorb the next sentinel hit.';}
    if(id==='berry'){s.coins--;s.berries++;s.message='A moonberry goes into your pack. Save it for a difficult moment.';}
    if(id==='pass')s.message='You keep your coins. The thorn sentinel steps onto the path.';
  }else if(s.room===3){
    if(id==='mend'){s.berries--;s.health=Math.min(s.maxHealth,s.health+3);s.message='The moonberry restores three hearts. Your lantern keeps burning.';}
    else if(id==='guard'){s.ward=true;s.message='You gather lantern light into a shield. Your next attack is protected.';}
    else{
      const damage=id==='spark'?4:3;s.enemy=Math.max(0,s.enemy-damage);
      if(id==='spark'){s.coins--;cost=2;}
      if(s.enemy===0){s.stars++;s.room=4;s.message='The thorn crown opens. You free the final star and return to the lantern gate.';}
      else{const hit=s.ward?0:config.settings.difficulty==='hard'?3:2;s.health-=hit;s.ward=false;s.message=(id==='spark'?'Your spark':'Your strike')+' deals '+damage+' damage. '+(hit?'The sentinel takes '+hit+' hearts.':'Your shield absorbs its reply.');}
    }
  }
  s.light=Math.max(0,s.light-cost);s.health=Math.max(0,s.health);
  if(s.health===0){s.status='lost';s.message='The sentinel sends you home to rest. Try a shield, a moonberry, or a kinder route.';}
  else if(s.light===0){s.status='lost';s.message='Your lantern runs out of light. The fox knows a shortcut for your next run.';}
  else if(s.room===4){s.status='won';s.wins++;}
  const next=describe(s);return {public:next,window:open(next)};
}