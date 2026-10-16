import assert from 'node:assert/strict';
import test from 'node:test';
import {createGenesisProject,createGenesisState,applyGenesisTransition,genesisDispatchOrder,genesisQueueView,GenesisHost,settleGenesisJob,settleGenesisFrame} from '../dist/index.js';

const project=()=>{const p=createGenesisProject('decisions');p.definition.genesis.capabilities=['live.direction','scene.request','image.request'];return p;};
const add=(def,state,id,delivery,extra={})=>applyGenesisTransition(def,state,{id:'event:'+id,type:'action',data:{},now:1000+state.revision},{effects:[{id,type:'live.direction',intent:'Show '+id,delivery,...extra}]});
test('urgent delivery removes replaceable work while preserving canonical state, earlier urgent and observed playback',()=>{
 const def=project().definition;let state=createGenesisState(def);
 state=add(def,state,'filler',{priority:'queued',replaceable:true});
 state=add(def,state,'committed',{priority:'queued'});
 state=add(def,state,'first',{priority:'urgent',targetLatencyMs:5000});
 assert.equal(state.jobs.find(j=>j.id==='filler').status,'cancelled');
 state.public.hp=73;state.stage.videoUrl='/assets/idle.mp4';state.stage.mode='playing';
 state.jobs.find(j=>j.id==='first').status='running';state.jobs.find(j=>j.id==='first').playbackStartedAt=900;
 state=add(def,state,'second',{priority:'urgent',targetLatencyMs:5000});
 assert.equal(state.public.hp,73);assert.equal(state.stage.videoUrl,'/assets/idle.mp4');assert.equal(state.stage.mode,'playing');
 assert.deepEqual(genesisDispatchOrder(state).map(j=>j.id),['first','second','committed']);
 const q=genesisQueueView(state,{now:2000,firstStartsAt:20000});
 assert.equal(q.items[1].priority,'urgent');assert.equal(q.items[1].targetStartAt,6003);assert.equal(q.items[1].targetStatus,'at-risk');
 assert.equal(genesisQueueView(state,{now:10000}).items[1].targetStatus,'missed');
});
test('mergeable directions combine compatible intents and preserve immutable source outcomes before dispatch',()=>{
 const def=project().definition;let state=createGenesisState(def);const delivery={priority:'mergeable',mergeKey:'weather'};
 state=add(def,state,'sun',delivery,{requiredOutcome:{sun:true},displayPrompt:'Sunlight'});
 state=add(def,state,'wind',delivery,{requiredOutcome:{wind:true},displayPrompt:'Wind'});
 assert.equal(state.jobs.length,1);assert.deepEqual(state.jobs[0].mergedEffects.map(e=>e.id),['sun','wind']);
 assert.deepEqual(state.jobs[0].effect.requiredOutcome.mergedOutcomes,[{effectId:'sun',requiredOutcome:{sun:true}},{effectId:'wind',requiredOutcome:{wind:true}}]);
 assert.match(state.jobs[0].effect.intent,/Show sun[\s\S]*Show wind/);
 assert.deepEqual(genesisQueueView(state).items[0].mergedEffectIds,['sun','wind']);
 assert.deepEqual(genesisQueueView(state).items[0].mergedActions.map(a=>a.id),['sun','wind']);
 state.queuePlan=[{id:'wind',label:'Wind',queuedAt:1000}];assert.equal(genesisQueueView(state).items.length,1,'Later controller plans still resolve merged source IDs to the shared chunk');
 state=add(def,state,'different-guard',delivery,{guard:{key:'roster',value:2}});assert.equal(state.jobs.length,2);
 state.jobs[0].status='running';state=add(def,state,'later',delivery);assert.equal(state.jobs.length,3);
 const repeated=applyGenesisTransition(def,state,{id:'event:wind',type:'action',data:{},now:9999},{effects:[]});assert.equal(repeated,state);
});
test('urgent batches revise one shared required image and keep submitted videos separate',()=>{
 const def=project().definition;let state=createGenesisState(def);
 const request=(id,fingerprint)=>({id,type:'frame.prepare',frame:{key:'deploy',fingerprint,refresh:true},intent:'Empty positions for accepted send-outs',maxCostUsd:.01});
 const direction=(id,fingerprint)=>({id,type:'live.direction',label:id,intent:'Deploy '+id,frameRef:{key:'deploy',fingerprint,required:true},frameMode:'new-frame',guard:{key:'batch',value:true},delivery:{priority:'urgent',mergeKey:'deploy',mergeFrames:true,replaceable:false}});
 state=applyGenesisTransition(def,state,{id:'one',type:'action',data:{},now:1000},{server:{batch:true},effects:[request('frame1','one'),direction('red','one')]});
 const old=state.jobs.find(j=>j.effect.frame);old.status='running';old.startedAt=1000;
 state=applyGenesisTransition(def,state,{id:'two',type:'action',data:{},now:1001},{effects:[request('frame2','both'),direction('blue','both')]});
 const videos=state.jobs.filter(j=>j.effect.type==='live.direction');assert.equal(videos.length,1);assert.deepEqual(videos[0].mergedEffects.map(e=>e.id),['red','blue']);assert.equal(videos[0].effect.frameRef.fingerprint,'both');
 assert.equal(state.jobs.find(j=>j.id===old.id).status,'cancelled');assert.equal(state.frameLibrary.deploy.fingerprint,'both');
 videos[0].status='running';videos[0].startedAt=1002;
 state=add(def,state,'later',{priority:'urgent',mergeKey:'deploy',mergeFrames:true,replaceable:false},{frameRef:{key:'deploy',fingerprint:'both',required:true},frameMode:'new-frame',guard:{key:'batch',value:true}});
 assert.equal(state.jobs.filter(j=>j.effect.type==='live.direction').length,2);
});
test('queue exposes bounded cancellation notices with public text and the replacing action',()=>{
 const def=project().definition;let state=add(def,createGenesisState(def),'filler',{priority:'mergeable',mergeKey:'idle'},{label:'Leaves in the breeze',intent:'Private instructions',displayPrompt:'Leaves sway'});
 state=add(def,state,'attack',{priority:'urgent'});
 const queue=genesisQueueView(state,{now:1100});assert.equal(queue.cancelledItems.length,1);assert.equal(queue.cancelledItems[0].label,'Leaves in the breeze');assert.equal(queue.cancelledItems[0].supersededBy,'attack');assert.equal(JSON.stringify(queue).includes('Private instructions'),false);
 assert.equal(genesisQueueView(state,{now:14000}).cancelledItems.length,0);
});
test('merge groups and delivery contracts have deterministic bounds',()=>{
 const def=project().definition;let state=createGenesisState(def);
 for(let i=0;i<9;i++)state=add(def,state,'i'+i,{priority:'mergeable',mergeKey:'leaves'});
 assert.deepEqual(state.jobs.map(j=>j.mergedEffects?.length||1),[8,1]);
 let large=createGenesisState(def);const outcome={facts:'x'.repeat(1900)};
 large=add(def,large,'large-one',{priority:'mergeable',mergeKey:'large'},{requiredOutcome:outcome});
 large=add(def,large,'large-two',{priority:'mergeable',mergeKey:'large'},{requiredOutcome:outcome});
 assert.equal(large.jobs.length,2,'Complete outcomes stay in separate jobs when their combined JSON would exceed the prompt budget');
 assert.deepEqual(large.jobs.map(j=>j.effect.requiredOutcome),[outcome,outcome]);
 for(const delivery of [{priority:'urgent',replaceable:true},{priority:'mergeable'},{priority:'queued',mergeKey:'x'},{priority:'queued',targetLatencyMs:999},{priority:'rush'}])assert.throws(()=>add(def,createGenesisState(def),'bad',delivery),/delivery/);
});
test('delivery targets retain the server selection time across a delayed shared lock-in',()=>{
 const def=project().definition;let state=createGenesisState(def);
 state=add(def,state,'selected-earlier',{priority:'urgent',selectedAtMs:100,targetLatencyMs:5000});assert.equal(state.jobs[0].targetPlaybackAt,5100);
 assert.throws(()=>add(def,createGenesisState(def),'future',{priority:'urgent',selectedAtMs:1001}),/delivery/);
 assert.throws(()=>add(def,createGenesisState(def),'fraction',{priority:'urgent',selectedAtMs:1.5}),/delivery/);
});
test('frame modes compile to provider conditioning and preserve a playing stage',()=>{
 const def=project().definition;
 let state=add(def,createGenesisState(def),'fresh',{priority:'urgent'},{frameMode:'new-frame',anchorId:'start'});assert.equal(state.jobs[0].effect.continuity,'reanchor');
 state=add(def,createGenesisState(def),'linked',{priority:'urgent'},{frameMode:'continue'});assert.equal(state.jobs[0].effect.continuity,'linked');
 state=createGenesisState(def);state.stage.mode='playing';state.stage.videoUrl='/assets/idle.mp4';
 state=applyGenesisTransition(def,state,{id:'ttv',type:'timer',data:{},now:1000},{effects:[{id:'ttv',type:'scene.request',intent:'Standalone sky',frameMode:'text-to-video',delivery:{priority:'urgent'},maxCostUsd:.01}]});
 assert.equal(state.jobs[0].effect.useStartFrame,false);assert.equal(state.stage.mode,'playing');
 assert.throws(()=>add(def,createGenesisState(def),'missing',{priority:'urgent'},{frameMode:'new-frame'}),/accepted anchor/);
 assert.throws(()=>add(def,createGenesisState(def),'ttv',{priority:'urgent'},{frameMode:'text-to-video'}),/standalone scene/);
 state=add(def,createGenesisState(def),'not-ready',{priority:'urgent'},{frameMode:'new-frame',frameRef:{key:'arena',fingerprint:'missing'}});
 assert.equal(state.jobs[0].effect.frameMode,'continue');assert.equal(state.jobs[0].effect.frameRef,undefined);assert.equal(state.jobs[0].effect.continuity,'linked');
});

test('urgent work postpones replaceable speculative frame preparation without losing its wishlist entry',()=>{
 const def=project().definition;let state=applyGenesisTransition(def,createGenesisState(def),{id:'prepare',type:'timer',data:{},now:1000},{effects:[{id:'prepare',type:'frame.prepare',frame:{key:'arena',fingerprint:'v1'},intent:'An empty arena.',maxCostUsd:.01}]});
 const prepared=state.jobs[0];assert.equal(prepared.effect.delivery.replaceable,true);assert.equal(state.reservedCostUsd,.01);
 state=add(def,state,'urgent',{priority:'urgent'});assert.equal(state.jobs.find(j=>j.id===prepared.id).status,'cancelled');assert.equal(state.frameLibrary.arena.status,'pending');assert.equal(state.reservedCostUsd,0);
 assert.equal(state.jobs.filter(j=>j.status==='queued').length,1);
});
test('compaction retains cancelled provider tombstones until interruption or terminal disposal is confirmed',()=>{
 const def=project().definition;let state=createGenesisState(def);
 state=add(def,state,'discard',{priority:'queued',replaceable:true});state.jobs[0].status='running';state.jobs[0].startedAt=1000;
 state=add(def,state,'urgent',{priority:'urgent'});
 for(const cancellation of ['pending','unavailable','failed']){
  state.jobs.find(j=>j.id==='discard').providerCancellation=cancellation;
  for(let i=0;i<12;i++)state=applyGenesisTransition(def,state,{id:cancellation+i,type:'timer',data:{},now:2000+i},{effects:[]});
  assert.equal(state.jobs.find(j=>j.id==='discard').status,'cancelled');
 }
});
test('guard cancellation and stale frame completion never leave a wishlist stuck preparing',()=>{
 const def=project().definition;
 const effect={id:'prepare-a',type:'frame.prepare',frame:{key:'arena',fingerprint:'cast-a'},intent:'Accepted cast A',guard:{key:'cast',value:'a'},maxCostUsd:.01};
 let state=applyGenesisTransition(def,createGenesisState(def),{id:'a',type:'timer',data:{},now:1000},{server:{cast:'a'},effects:[effect]});const first=state.jobs[0];
 state=applyGenesisTransition(def,state,{id:'b',type:'timer',data:{},now:1001},{server:{cast:'b'}});assert.equal(state.frameLibrary.arena.status,'stale');assert.equal(state.frameLibrary.arena.jobId,'');
 state=applyGenesisTransition(def,state,{id:'again',type:'timer',data:{},now:1002},{server:{cast:'a'},effects:[{...effect,id:'prepare-a-again'}]});assert.equal(state.frameLibrary.arena.status,'preparing');assert.notEqual(state.frameLibrary.arena.jobId,first.id);
 state.server.cast='b';assert.equal(settleGenesisFrame(state,state.jobs.at(-1),'stale-anchor','',1003),false);assert.equal(state.frameLibrary.arena.status,'stale');
});

const controller=`function onEvent({event}){
 if(event.type==='session.started')return {window:{id:'commands',mode:'individual',actionIds:['choose']}};
 if(event.type==='action'){var urgent=event.data.optionId==='urgent';return {effects:[{id:event.id,type:urgent?'live.direction':'image.request',presentation:urgent?undefined:'background',intent:'Visual '+event.id,maxCostUsd:.01,delivery:{priority:urgent?'urgent':'queued',replaceable:!urgent,targetLatencyMs:5000}}]};}
 if(event.type==='job.ready')return {public:{completed:event.data.jobId,merged:event.data.mergedEffectIds||[]}};
 return {};
}`;
async function hostFixture({paid=false,cancel,ready=false}={}){
 const p=project();p.controllerSource=controller;const starts=[],polls=[];
 const provider={id:'fixture',paid,capabilities:['image.request','live.direction'],start:async({job})=>{starts.push(job.id);return {id:job.id};},poll:async id=>{polls.push(id);return ready?{status:'ready',result:{imageUrl:'/assets/end.jpg'}}:{status:'running'};},...(cancel?{cancel}:{})};
 const host=await new GenesisHost('scheduler',p,{providers:[provider],services:{authorizeTool:async()=>true}}).initialize();await host.join('one','One');await host.join('two','Two');
 const action=async(id,optionId)=>host.action('one',id,'choose',{optionId},host.view('one').genesis.revision);
 return {host,action,starts,polls};
}
test('host cancels stale provider work and immediately dispatches urgent, refunds confirmed reservations once',async()=>{
 let cancelled=0;const f=await hostFixture({paid:true,cancel:async()=>{cancelled++;return {refunded:true};}});
 await f.action('background','ordinary');await f.host.runJob('one','background');assert.equal(f.host.view('one').genesis.reservedCostUsd,.01);
 await f.action('urgent','urgent');assert.deepEqual(f.starts,['background','urgent']);assert.equal(cancelled,1);assert.equal(f.host.view('one').genesis.reservedCostUsd,0);
 await f.host.tick();assert.equal(cancelled,1);assert.deepEqual(f.polls,['urgent']);
 const snapshot=f.host.diagnostics().state;assert.equal(snapshot.genesis.jobs[0].providerCancellation,'confirmed');
 assert.equal(await settleGenesisJob(project().definition,snapshot,'function onEvent(){return {public:{stale:true}}}','background',{imageUrl:'/assets/stale.jpg'}),snapshot);
});
test('providers without interruption still dispatch urgent and ignore old output without promising refunds',async()=>{
 const f=await hostFixture({paid:true});await f.action('background','ordinary');await f.host.runJob('one','background');await f.action('urgent','urgent');
 assert.deepEqual(f.starts,['background','urgent']);assert.equal(f.host.view('one').genesis.reservedCostUsd,.01);
 await f.host.tick();assert.deepEqual(f.polls,['urgent','background']);assert.equal(f.host.diagnostics().state.genesis.jobs[0].providerCancellation,'unavailable');
});
test('uninterruptible completed work retires its tombstone without accepting stale media or refunding spent money',async()=>{
 const f=await hostFixture({paid:true,ready:true});await f.action('background','ordinary');await f.host.runJob('one','background');await f.action('urgent','urgent');await f.host.tick();
 const state=f.host.diagnostics().state.genesis;
 assert.equal(state.jobs.find(j=>j.id==='background').providerCancellation,'completed');assert.equal(state.anchors['anchor:background'],undefined);assert.equal(state.reservedCostUsd,.01);assert.equal(state.public.completed,'urgent');
});
test('two urgent user actions retain FIFO and each advances only after earlier delivery completes',async()=>{
 const f=await hostFixture({ready:true});await f.action('one-urgent','urgent');await f.action('two-urgent','urgent');assert.deepEqual(f.starts,['one-urgent']);
 await f.host.tick();assert.deepEqual(f.starts,['one-urgent','two-urgent']);assert.equal(f.host.view('one').genesis.state.completed,'one-urgent');
});
test('providers receive a merged prompt once and completion identifies every original action',async()=>{
 const p=project();p.controllerSource=`function onEvent({event}){if(event.type==='session.started')return {window:{id:'merge',mode:'individual',actionIds:['choose']}};if(event.type==='action')return {effects:[{id:event.id,type:'live.direction',intent:event.data.optionId,requiredOutcome:{beat:event.data.optionId},delivery:{priority:'mergeable',mergeKey:'ambient'}}]};if(event.type==='job.ready')return {public:{ids:event.data.mergedEffectIds}};return {}}`;
 const submitted=[];const host=await new GenesisHost('merged',p,{providers:[{id:'merge',paid:false,capabilities:['live.direction'],start:async({job})=>{submitted.push(job);return{id:job.id};},poll:async()=>({status:'ready',result:{data:{playbackCompleted:true}}})}]}).initialize();
 await host.join('one','One');await host.join('two','Two');
 for(const id of ['sun','wind'])await host.action('one',id,'choose',{optionId:id},host.view('one').genesis.revision);
 await host.runJob('one','sun');await host.tick();assert.equal(submitted.length,1);assert.deepEqual(submitted[0].effect.requiredOutcome.mergedOutcomes.map(o=>o.effectId),['sun','wind']);assert.deepEqual(host.view('one').genesis.state.ids,['sun','wind']);
});
test('a host resumes its prepared frame after urgent work drains using a new provider generation',async()=>{
 const p=project();p.controllerSource=`function onEvent({event}){if(event.type==='session.started')return {window:{id:'w',mode:'individual',actionIds:['choose']},effects:[{id:'prepare',type:'frame.prepare',frame:{key:'arena',fingerprint:'v1'},intent:'Empty meadow',maxCostUsd:.01}]};if(event.type==='action')return {effects:[{id:event.id,type:'live.direction',intent:'Accepted move',delivery:{priority:'urgent'}}]};return {}}`;
 const starts=[];const host=await new GenesisHost('resume',p,{providers:[{id:'resume',paid:false,capabilities:['image.request','live.direction'],start:async({job})=>{starts.push({id:job.id,type:job.effect.type,generation:job.effect.frameGeneration});return{id:job.id};},poll:async(_id,job)=>job.effect.type==='image.request'?{status:'ready',result:{imageUrl:'/assets/ready.jpg'}}:{status:'ready',result:{data:{playbackCompleted:true}}}}]}).initialize();
 await host.join('one','One');await host.join('two','Two');const old=host.diagnostics().state.genesis.jobs[0];await host.runJob('one',old.id);
 await host.action('one','urgent','choose',{optionId:'attack'},host.view('one').genesis.revision);await host.tick();await host.tick();
 const frame=host.diagnostics().state.genesis.frameLibrary.arena;assert.equal(frame.status,'ready');assert.deepEqual(starts.map(s=>s.type),['image.request','live.direction','image.request']);assert.ok(starts[2].generation>starts[0].generation);assert.notEqual(starts[2].id,old.id);
});

test('urgent replaces playing disposable filler but preserves the urgent already playing',()=>{
 const def=project().definition;let state=add(def,createGenesisState(def),'idle',{priority:'mergeable',mergeKey:'idle'});
 Object.assign(state.jobs[0],{status:'running',startedAt:1000,playbackStartedAt:1000});Object.assign(state.stage,{ownerJobId:'idle',mode:'playing',videoUrl:'/assets/idle.mp4'});
 state=add(def,state,'urgent',{priority:'urgent'});assert.equal(state.jobs.find(j=>j.id==='idle').status,'cancelled');assert.equal(state.stage.mode,'holding');
 Object.assign(state.jobs.find(j=>j.id==='urgent'),{status:'running',playbackStartedAt:1001});
 state=add(def,state,'next',{priority:'urgent'});assert.equal(state.jobs.find(j=>j.id==='urgent').status,'running');assert.deepEqual(genesisDispatchOrder(state).map(j=>j.id),['urgent','next']);
});

test('an important guarded clean frame finishes alongside urgent video instead of restarting on every action',()=>{
 const def=project().definition;let state=applyGenesisTransition(def,createGenesisState(def),{id:'frame',type:'action',data:{},now:1000},{server:{cast:'current'},effects:[{id:'clean',type:'frame.prepare',frame:{key:'clean',fingerprint:'current',priority:95},guard:{key:'cast',value:'current'},intent:'Clean current cast',maxCostUsd:.01}]});
 const frame=state.jobs.find(j=>j.effect.frame);frame.status='running';frame.startedAt=1000;
 state=add(def,state,'attack',{priority:'urgent'});assert.equal(state.jobs.find(j=>j.id===frame.id).status,'running');assert.equal(state.frameLibrary.clean.generation,1);
});
