function onEvent({state,event,participants,stage}) {
  const roster=participants.filter(p=>p.role==='player');
  const turn=Number(state.public.turn||0), actor=roster[turn%Math.max(1,roster.length)];
  const challenge='shot:'+turn;
  const open=()=>({id:challenge+':'+event.id,mode:'individual',actionIds:['shot'],actorIds:actor?[actor.id]:[]});
  if(event.type==='session.started')return {public:{turn:0,scores:{},challengeId:'shot:0'},window:open()};
  if(['participant.joined','participant.left'].includes(event.type)&&stage.mode==='holding')return {window:open()};
  if(event.type==='action'){
    if(event.data.challengeId!==challenge)throw new Error('This timing challenge changed.');
    const quality=Math.max(0,1-Math.abs(event.data.timingOffsetMs)/900);
    const goal=Math.abs(event.data.aimX)<.92&&quality>.6&&event.data.power>.25&&event.data.power<.96;
    const scores={...state.public.scores,[event.actorId]:Number((state.public.scores||{})[event.actorId]||0)+(goal?1:0)};
    const outcome={result:goal?'goal':'miss',angle:event.data.aimX,power:event.data.power,quality};
    return {public:{...state.public,scores,lastResult:outcome.result,turn:turn+1,challengeId:'shot:'+(turn+1)},window:null,effects:[{id:'shot-scene:'+event.id,type:'scene.request',anchorId:'start',intent:'The shooter takes the penalty at the recorded angle and power. Show the recorded goal or miss clearly, with a natural goalkeeper reaction.',requiredOutcome:outcome}]};
  }
  if(event.type==='job.ready')return {effects:[{id:'shot-play:'+event.id,type:'stage.play',videoUrl:event.data.videoUrl}]};
  if(event.type==='playback.completed'||event.type==='job.skipped')return {window:open(),effects:[{id:'reset:'+event.id,type:'stage.restore',anchorId:'start'}]};
  return {};
}