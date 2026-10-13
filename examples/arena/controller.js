function onEvent({state,event,participants,participation,stage,config}) {
  const seats=participation?.seats||[], roster=seats.filter(s=>s.actorId), old=state.public;
  const options=[{id:'attack',label:'Attack'},{id:'defend',label:'Defend'},{id:'special',label:'Special'},{id:'recover',label:'Recover'}];
  const open=(turn=Number(old.turn||0))=>roster.length===2?{id:'battle:'+event.id,mode:'individual',actionIds:['choose'],actorIds:[roster[turn%2].actorId],options}:null;
  if(event.type==='session.started')return {public:{turn:0,fighters:{},options},window:null};
  if(event.type==='seat.claimed'){
    const fighters={...old.fighters};fighters[event.actorId]={health:100,inventory:['attack','defend','special','recover'],creature:['Ember','Tide','Moss'][event.actorId.length%3]};
    return {public:{...old,fighters},window:stage.mode==='holding'?open():null};
  }
  if(event.type==='seat.released'||event.type==='participant.left'){
    const fighters={...old.fighters};delete fighters[event.actorId];return {public:{...old,fighters},window:stage.mode==='holding'?open():null};
  }
  if(event.type==='action'){
    const move=event.data.optionId, actor=roster.find(s=>s.actorId===event.actorId), opponent=roster.find(s=>s.actorId!==event.actorId);
    if(!actor||!opponent||!options.some(o=>o.id===move))throw new Error('Choose an available battle move.');
    const fighters=JSON.parse(JSON.stringify(old.fighters)), self=fighters[event.actorId], enemy=fighters[opponent.actorId];
    if(!self||!enemy)throw new Error('Wait for both fighters.');
    const damage=move==='special'?40:move==='attack'?25:0;
    enemy.health=Math.max(0,enemy.health-(enemy.defending?Math.ceil(damage/2):damage));enemy.defending=false;
    if(move==='recover')self.health=Math.min(100,self.health+15);self.defending=move==='defend';
    const defeated=enemy.health===0, turn=Number(old.turn||0)+1, effects=[];
    const result={move,damage,defeated,actorId:event.actorId,opponentId:opponent.actorId,remainingHealth:enemy.health};
    if(defeated)effects.push({id:'release:'+event.id,type:'players.release',seatId:opponent.id,expectedActorId:opponent.actorId,cooldownMs:Number(config.settings.rejoinSeconds||5)*1000});
    if(config.settings.animate)effects.push({id:'scene:'+event.id,type:'scene.request',anchorId:stage.anchorId,intent:'Realistic creature battle with a classic handheld game aesthetic. Show the committed move and damage. '+JSON.stringify(result),requiredOutcome:result});
    return {public:{...old,fighters,turn,lastResult:result},window:config.settings.animate||defeated?null:open(turn),effects};
  }
  if(event.type==='job.ready')return {window:null,effects:[{id:'play:'+event.id,type:'stage.play',videoUrl:event.data.videoUrl}]};
  if(event.type==='playback.completed'||event.type==='job.skipped')return {window:open(),effects:[{id:'hold:'+event.id,type:'stage.restore',anchorId:stage.anchorId}]};
  return {};
}