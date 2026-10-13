function onEvent({state,event,stage,participants}) {
  const open=()=>({id:'explore:'+event.id,mode:'individual',actionIds:['explore']});
  if(event.type==='session.started')return {public:{visits:0},window:open()};
  if(event.type==='action')return {public:{...state.public,visits:Number(state.public.visits||0)+1},window:null,effects:[{id:'move:'+event.id,type:'scene.request',anchorId:stage.anchorId,intent:'Move naturally toward the point at normalized image coordinates ('+event.data.x+', '+event.data.y+'). Preserve scene identity and end at a stable destination view.'}]};
  if(event.type==='job.ready')return {window:null,effects:[{id:'play:'+event.id,type:'stage.play',videoUrl:event.data.videoUrl}]};
  if(event.type==='playback.completed'||event.type==='job.skipped')return {window:open(),effects:[{id:'hold:'+event.id,type:'stage.restore',anchorId:event.data.anchorId||stage.anchorId}]};
  return {};
}