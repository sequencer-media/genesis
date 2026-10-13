export const llmArenaController = `function onEvent({state,event,participants,participation,stage,config,jobs}) {
  const roster=(participation?.seats||[]).filter(s=>s.actorId), old=state.public, server=state.server;
  const options=old.options||[];
  const open=(turn=Number(old.turn||0))=>roster.length===2&&options.length===4?{id:'battle:'+event.now,mode:'individual',actionIds:['choose'],actorIds:[roster[turn%2].actorId],options}:null;
  const pending=(jobs||[]).some(j=>j.status==='running'||j.status==='queued'&&(!j.guard||j.guard.value===server.battleId));
  const prepare=(fighters=old.fighters)=>{
    const battleId='battle:'+event.now;
    return {public:{...old,turn:0,fighters,options:[],status:'Preparing four moves'},server:{battleId,phase:'naming'},window:null,effects:[{id:'names:'+battleId,type:'tool.request',toolId:'tool.llm.generate',guard:{key:'battleId',value:battleId},maxCostUsd:.01,data:{
      prompt:'Invent exactly four distinct creature battle moves for these fighters. Give each a short evocative name. Make the set tactically varied. Damage is 0 to 40, healing is 0 to 20, guard reduces the next hit. Avoid executable code and keep the battle balanced.',
      context:{fighters,world:config.worldPrompt},
      responseSchema:{type:'object',additionalProperties:false,required:['moves'],properties:{moves:{type:'array',minItems:4,maxItems:4,items:{type:'object',additionalProperties:false,required:['name','damage','heal','guard'],properties:{name:{type:'string',minLength:1,maxLength:40},damage:{type:'integer',minimum:0,maximum:40},heal:{type:'integer',minimum:0,maximum:20},guard:{type:'boolean'}}}}}}
    }}]};
  };
  if(event.type==='session.started')return {public:{turn:0,fighters:{},options:[],status:'Join two seats'},server:{battleId:'lobby',phase:'lobby'},window:null};
  if(event.type==='seat.claimed'){
    const fighters={...old.fighters,[event.actorId]:{health:100,creature:participation.seats.find(s=>s.actorId===event.actorId)?.label||'Creature'}};
    if(roster.length===2&&!pending)return prepare(fighters);
    return {public:{...old,fighters},window:null};
  }
  if(event.type==='seat.released'||event.type==='participant.left'){
    const fighters={...old.fighters};delete fighters[event.actorId];
    return {public:{...old,fighters,options:[],status:'Join two seats'},server:{battleId:'reset:'+event.now,phase:'lobby'},window:null};
  }
  if(event.type==='job.cancelled'&&roster.length===2)return prepare();
  if(event.type==='job.ready'&&server.phase==='naming'){
    const moves=event.data.data?.moves;
    if(!Array.isArray(moves)||moves.length!==4)throw new Error('The move set must contain four validated moves.');
    const choices=moves.map((m,i)=>({id:'move'+i,label:String(m.name).slice(0,40),damage:Math.min(40,Math.max(0,Math.floor(m.damage))),heal:Math.min(20,Math.max(0,Math.floor(m.heal))),guard:m.guard===true}));
    const window=roster.length===2?{id:'battle:'+event.now,mode:'individual',actionIds:['choose'],actorIds:[roster[0].actorId],options:choices.map(m=>({id:m.id,label:m.label}))}:null;
    return {public:{...old,options:choices,status:'Moves ready'},server:{...server,phase:'combat'},window};
  }
  if(event.type==='job.failed')return {public:{...old,status:'The tool failed. Retry or skip from the host controls.'},window:null};
  if(event.type==='action'){
    const move=options.find(m=>m.id===event.data.optionId), enemySeat=roster.find(s=>s.actorId!==event.actorId);
    if(!move||!enemySeat||server.phase!=='combat')throw new Error('Choose a current battle move.');
    const fighters=JSON.parse(JSON.stringify(old.fighters)), self=fighters[event.actorId], enemy=fighters[enemySeat.actorId];
    if(!self||!enemy)throw new Error('Wait for both fighters.');
    const damage=enemy.defending?Math.ceil(move.damage/2):move.damage;
    enemy.health=Math.max(0,enemy.health-damage);enemy.defending=false;self.health=Math.min(100,self.health+move.heal);self.defending=move.guard;
    const turn=Number(old.turn||0)+1, defeated=enemy.health===0, result={move:move.label,damage,heal:move.heal,remainingHealth:enemy.health,defeated}, effects=[];
    if(defeated)effects.push({id:'release:'+event.id,type:'players.release',seatId:enemySeat.id,expectedActorId:enemySeat.actorId,cooldownMs:Number(config.settings.rejoinSeconds||5)*1000});
    if(config.settings.animate&&!defeated)effects.push({id:'scene:'+event.id,type:'scene.request',guard:{key:'battleId',value:server.battleId},anchorId:stage.anchorId,intent:'A vintage creature battle. Depict the committed move and exact outcome. '+JSON.stringify(result),requiredOutcome:result});
    return {public:{...old,fighters,turn,lastResult:result},window:config.settings.animate||defeated?null:open(turn),effects};
  }
  if(event.type==='job.ready'&&event.data.videoUrl)return {window:null,effects:[{id:'play:'+event.id,type:'stage.play',videoUrl:event.data.videoUrl}]};
  if(event.type==='playback.completed'||event.type==='job.skipped')return {window:open(),effects:[{id:'hold:'+event.id,type:'stage.restore',anchorId:stage.anchorId}]};
  return {};
}`;
