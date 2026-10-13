function onEvent({state,event,participants,config}) {
  const players=participants.filter(p=>p.role==='player'), turn=Number(state.public.turn||0);
  const team=turn%2, collective=config.participation.mode==='group';
  const eligible=collective?participants.filter((p,i)=>i%2===team).map(p=>p.id):players.length?[players[turn%players.length].id]:[];
  const options=[{id:'attack',label:'Attack'},{id:'defend',label:'Defend'},{id:'special',label:'Special move'},{id:'recover',label:'Recover'}];
  const open=()=>({id:'decision:'+turn+':'+event.now,mode:collective?'collective':'individual',actionIds:['choose'],actorIds:eligible,options,...(collective?{deadline:event.now+Number(config.settings.voteSeconds||config.roundSeconds)*1000}:{})});
  if(event.type==='session.started')return {public:{turn:0,team:0,options},window:open()};
  if(['participant.joined','participant.left'].includes(event.type)&&state.window&&!state.window.closed)return {window:{...state.window,actorIds:eligible}};
  if(event.type==='action'||event.type==='vote.resolved'){
    const id=event.type==='action'?event.data.optionId:event.data.id;
    if(!options.some(o=>o.id===id))throw new Error('Choose one of the current moves.');
    const next=turn+1, nextTeam=next%2;
    return {public:{...state.public,turn:next,team:nextTeam,lastChoice:id,options},window:{...open(),id:'decision:'+next+':'+event.now,actorIds:collective?participants.filter((p,i)=>i%2===nextTeam).map(p=>p.id):players.length?[players[next%players.length].id]:[]}};
  }
  if(event.type==='vote.empty')return {window:open()};
  return {};
}