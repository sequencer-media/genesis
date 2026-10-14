/** Only this host-injected bridge can communicate outside a package sandbox. */
export const EXPERIENCE_BRIDGE_MESSAGE = 'sequencer-experience-bridge';
export function experienceInterfaceBridgeScript(nonce: string, bindingIds: string[]): string {
  const config = JSON.stringify({ nonce, bindingIds }).replace(/</g, '\\u003c');
  return `<script data-sequencer-experience-bridge>(()=>{
    const config=${config}; const pending=new Map(), listeners=new Map(); let view={inputs:[],phaseId:'',round:0}, sequence=0, ready=false;
    const emit=(name,value)=>{ for(const fn of listeners.get(name)||[])try{fn(value)}catch(e){console.error(e)} };
    const send=(op,bindingId,payload)=>new Promise((resolve,reject)=>{
      if(!['select_avatar','genesis_action','players'].includes(op)&&!config.bindingIds.includes(bindingId)){reject(new Error('This input is unavailable to this interface.'));return;}
      const requestId='ui_'+(++sequence); const timeout=setTimeout(()=>{pending.delete(requestId);reject(new Error('The action timed out. Reconnect before retrying.'));},op==='pick_image'?180000:op==='start_voice'?45000:30000);
      pending.set(requestId,{resolve,reject,timeout});
      const msg={type:'${EXPERIENCE_BRIDGE_MESSAGE}',v:1,nonce:config.nonce,requestId,op,bindingId,payload};
      if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(msg));else window.parent.postMessage(msg,'*');
    });
    const receive=data=>{
      if(!data||data.type!=='${EXPERIENCE_BRIDGE_MESSAGE}'||data.v!==1||data.nonce!==config.nonce)return;
      if(data.op==='state'){view=data.view;ready=true;emit('state',view);emit('players',view.participation);emit('phase',{id:view.phaseId,canAct:view.inputs.some(i=>i.canSubmit),round:view.round});return;}
      const request=pending.get(data.requestId);if(!request)return;clearTimeout(request.timeout);pending.delete(data.requestId);if(data.error)request.reject(new Error(data.error));else request.resolve(data.result);
    };
    window.addEventListener('message',event=>{if(event.source===window.parent)receive(event.data)});
    window.__sequencerExperienceReceive=receive;
    const api={get context(){return {roundId:String(view.round),phaseId:view.phaseId,actorId:view.actorId};},
      characters:{get:()=>view.avatars||[],select:id=>send('select_avatar',id,{})},
      inputs:{get:id=>view.inputs.find(i=>i.id===id)||{id,canSubmit:false},submit:(id,payload)=>send('submit',id,payload),pickImage:id=>send('pick_image',id,{}),startVoice:id=>send('start_voice',id,{})},
      action:payload=>{const id=config.bindingIds.find(id=>view.inputs.some(i=>i.id===id&&i.kind==='game'));return send('submit',id,payload)},
      on:(name,fn)=>{const list=listeners.get(name)||new Set();list.add(fn);listeners.set(name,list);if(name==='state'&&ready)fn(view);return()=>list.delete(fn)}
    };
    const genesis={
      get context(){return {...api.context,revision:view.genesis?.revision};},
      assets:{get:path=>view.assetSources?.[String(path).replace(/^[/]/,'').replace('asset://','')]||null},
      state:{get:()=>view.genesis?.state||{},subscribe:fn=>api.on('state',v=>fn(v.genesis?.state||{},v.genesis))},
      actions:{get:id=>view.genesis?.actions.find(a=>a.id===id)||{id,canSubmit:false},list:()=>view.genesis?.actions||[]},
      action:(id,data={})=>send('genesis_action',id,{...data,...(view.genesis?.window?.mode==='collective'?{windowId:view.genesis.window.id}:{})}),
      stage:{get:()=>({...view.genesis?.stage,anchor:view.genesis?.anchor}),point:(event,element)=>{const r=element.getBoundingClientRect();const g=view.stageGeometry||{x:0,y:0,width:1,height:1};const region=view.stageViewport||{x:0,y:0,width:1,height:1};const x=(region.x+(event.clientX-r.left)/r.width*region.width-g.x)/g.width,y=(region.y+(event.clientY-r.top)/r.height*region.height-g.y)/g.height;if(x<0||x>1||y<0||y>1)return null;return {x,y,anchorId:view.genesis?.anchor?.id,sceneRevision:view.genesis?.anchor?.revision};}},
      players:{get:()=>view.participation||null,subscribe:fn=>api.on('state',v=>fn(v.participation||null)),claim:seatId=>send('players','',{operation:'claim',seatId}),leave:seatId=>send('players','',{operation:'release',seatId}),joinQueue:()=>send('players','',{operation:'queue.join'}),leaveQueue:()=>send('players','',{operation:'queue.leave'})},
      inputs:api.inputs,characters:api.characters,on:api.on
    };Object.defineProperty(window,'Genesis',{value:Object.freeze(genesis),writable:false});
    Object.defineProperty(window,'SequencerExperience',{value:Object.freeze(api),writable:false});
  })();</script>`;
}
export function injectExperienceBridge(document: string, nonce: string, bindingIds: string[]) {
  const stripped = document.replace(/<script[^>]+data-sequencer-experience-bridge[^>]*>[\s\S]*?<\/script>\s*/gi, '');
  // An owned prelude precedes every creator byte, including misleading head tags in comments.
  return `<!doctype html><html><head>${experienceInterfaceBridgeScript(nonce, bindingIds)}</head>${stripped}</html>`;
}
