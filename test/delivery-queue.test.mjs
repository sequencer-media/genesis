import assert from 'node:assert/strict';
import test from 'node:test';
import { createGenesisDefinition } from '../dist/experienceDefinition.js';
import { createGenesisState, applyGenesisTransition, genesisQueueView } from '../dist/genesisCore.js';

test('continuous directions opt into a bounded queue without permitting overlapping scene generation', () => {
  const definition = createGenesisDefinition();
  definition.genesis.capabilities = ['live.direction','image.request'];
  let state = createGenesisState(definition);
  for (let i=0;i<8;i++) state=applyGenesisTransition(definition,state,{id:'event'+i,type:'action',now:1000+i,data:{}},{effects:[{id:'move'+i,type:'live.direction',queue:true,label:'Move '+i,intent:'A single wave.'}]});
  assert.equal(state.jobs.length,8); assert.equal(state.jobs[0].queuedAt,1000); assert.equal(state.reservedCostUsd,0);
  assert.throws(()=>applyGenesisTransition(definition,state,{id:'overflow',type:'action',now:2000,data:{}},{effects:[{id:'overflow',type:'live.direction',queue:true,intent:'Wave'}]}),/queue is full/);
  assert.throws(()=>applyGenesisTransition(definition,state,{id:'image',type:'action',now:2000,data:{}},{effects:[{id:'image',type:'image.request',intent:'New scene'}]}),/active tool/);
  assert.throws(()=>applyGenesisTransition(definition,createGenesisState(definition),{id:'bad',type:'action',now:2000,data:{}},{effects:[{id:'bad',type:'image.request',queue:true,intent:'New scene'}]}),/live directions/);
});
test('queue view exposes ordered labels and estimated clocks without publishing private intents',()=>{
  const definition=createGenesisDefinition();definition.genesis.capabilities=['live.direction'];let state=createGenesisState(definition);
  for(let i=0;i<2;i++)state=applyGenesisTransition(definition,state,{id:'event'+i,type:'action',now:1000+i,data:{}},{effects:[{id:'move'+i,type:'live.direction',queue:true,label:'Selection '+i,intent:'Private audience text'}]});
  const queue=genesisQueueView(state,{now:2000,firstStartsAt:5000,durationMs:10000});
  assert.deepEqual(queue.items.map(i=>[i.position,i.estimatedStartAt]),[[1,5000],[2,25000]]);
  assert(!JSON.stringify(queue).includes('Private audience'));
  assert(genesisQueueView(state,{now:6000,firstStartsAt:5000}).items.every(i=>i.estimatedStartAt===null));
});

test('standard queue merges committed future actions with real jobs and public prompt metadata',()=>{
 const def=createGenesisDefinition();def.genesis.capabilities=['live.direction'];let state=createGenesisState(def);
 state=applyGenesisTransition(def,state,{id:'commit',type:'action',actionId:'battle_move',now:1000,data:{}},{queuePlan:[{id:'first',label:'Thunderbolt',prompt:'Pikachu uses Thunderbolt once.'},{id:'future',label:'Surf',actionId:'battle_move',prompt:'Blastoise uses Surf once.'}],effects:[{id:'first',type:'live.direction',label:'Fallback label',displayPrompt:'Public shot',intent:'PRIVATE CONSTRAINTS AND FUTURE DAMAGE',queue:true}]});
 const q=genesisQueueView(state,{now:2000,durationMs:5000,firstStartsAt:7000,gapMs:0});
 assert.equal(q.version,1);assert.equal(q.revision,state.revision);assert.deepEqual(q.items.map(i=>i.label),['Thunderbolt','Surf']);
 assert.deepEqual(q.items.map(i=>i.estimatedWaitMs),[5000,10000]);assert.equal(q.items[0].prompt,'Pikachu uses Thunderbolt once.');assert.equal(q.items[0].actionId,'battle_move');assert.equal(q.items[1].jobId,null);
 assert.ok(!JSON.stringify(q).includes('PRIVATE'));assert.ok(!JSON.stringify(q).includes('FUTURE DAMAGE'));
 state.jobs[0].status='ready';assert.deepEqual(genesisQueueView(state).items.map(i=>i.id),['future'],'Completed jobs disappear even before a client redraw');
 state=applyGenesisTransition(def,state,{id:'clear',type:'job.ready',now:3000,data:{}},{queuePlan:[]});assert.equal(genesisQueueView(state).items.length,0);
});
test('observed playback drives ETA and overdue or unavailable clocks stay unknown',()=>{
 const def=createGenesisDefinition();def.genesis.capabilities=['live.direction'];let state=createGenesisState(def);
 for(let i=0;i<2;i++)state=applyGenesisTransition(def,state,{id:'e'+i,type:'action',now:1000+i,data:{}},{effects:[{id:'j'+i,type:'live.direction',queue:true,intent:'Secret',displayPrompt:'Visible prompt'}]});
 state.jobs[0].status='running';state.jobs[0].playbackStartedAt=5000;
 let q=genesisQueueView(state,{now:6000,durationMs:5000,gapMs:0});assert.equal(q.items[0].status,'playing');assert.equal(q.items[0].estimatedWaitMs,0);assert.equal(q.items[1].estimatedStartAt,10000);
 q=genesisQueueView(state,{now:12000,durationMs:5000});assert.equal(q.items[0].estimatedEndAt,null);assert.equal(q.items[1].estimatedWaitMs,null);
 state.jobs[0].status='ready';q=genesisQueueView(state,{now:12000,durationMs:5000,firstStartsAt:null});assert.equal(q.items.length,1);assert.equal(q.items[0].estimatedStartAt,null);
});
test('public queue plans reject oversized, duplicate or private payload fields',()=>{
 const def=createGenesisDefinition(),state=createGenesisState(def),event={id:'bad',type:'action',now:1000,data:{}};
 for(const queuePlan of [[{id:'x',label:'A'},{id:'x',label:'B'}],[{id:'x',label:'A',damage:90}],[{id:'x',label:'A',prompt:'x'.repeat(2001)}]])assert.throws(()=>applyGenesisTransition(def,state,event,{queuePlan}),/queue|public|metadata/);
});

test('provider playback forecasts override rough timing and retain observed duration',()=>{
 const def=createGenesisDefinition();def.genesis.capabilities=['live.direction'];let state=createGenesisState(def);
 state=applyGenesisTransition(def,state,{id:'e',type:'action',now:1000,data:{}},{effects:[{id:'j',type:'live.direction',queue:true,intent:'Private'}]});
 Object.assign(state.jobs[0],{estimatedPlaybackAt:7000,playbackDurationMs:5200});
 let q=genesisQueueView(state,{now:3000,durationMs:10000});assert.equal(q.items[0].estimatedStartAt,7000);assert.equal(q.items[0].estimatedWaitMs,4000);assert.equal(q.items[0].durationMs,5200);
 q=genesisQueueView(state,{now:8000,durationMs:10000});assert.equal(q.items[0].estimatedWaitMs,null,'Overdue provider forecasts stay unknown until playback is observed');
});
test('host persists provider timing through reads and only reports playing after observation',async()=>{
 const {GenesisHost,createGenesisProject}=await import('../dist/index.js');const project=createGenesisProject('decisions');project.definition.genesis.controller='custom';project.definition.genesis.capabilities=['live.direction'];
 project.controllerSource='function onEvent({event}){return event.type==="session.started"?{window:{id:"moves",mode:"individual",actionIds:["choose"],options:[{id:"attack",label:"Wave"}]}}:event.type==="action"?{effects:[{id:event.id,type:"live.direction",queue:true,intent:"Wave",displayPrompt:"A public wave"}]}:{}}';
 const expected=Date.now()+20000,started=Date.now()-2000;let playing=false;
 const host=await new GenesisHost('timed',project,{providers:[{id:'timed',paid:false,capabilities:['live.direction'],start:async()=>({id:'timed'}),poll:async()=>({status:'running',result:{data:{estimatedPlaybackAtMs:expected,playbackDurationMs:5200,...(playing?{playbackStartedAtMs:started}:{})}}})}]}).initialize();
 await host.join('one','One');await host.join('two','Two');await host.action('one','move','choose',{optionId:'attack'},host.view('one').genesis.revision);await host.runJob('one','move');await host.tick();
 let q=host.view('one').genesis.queue;assert.equal(q.items[0].status,'preparing');assert.equal(q.items[0].estimatedStartAt,expected);assert.equal(q.items[0].durationMs,5200);
 playing=true;await host.tick();q=host.view('one').genesis.queue;assert.equal(q.items[0].status,'playing');assert.equal(q.items[0].estimatedStartAt,started);assert.equal(q.items[0].estimatedWaitMs,0);
});

test('stream chunks and game actions share a chronological queue without duplicate entries',()=>{
 const def=createGenesisDefinition();def.genesis.capabilities=['live.direction'];let state=createGenesisState(def);
 state=applyGenesisTransition(def,state,{id:'e',type:'action',now:1000,data:{}},{effects:[{id:'move',type:'live.direction',label:'Thunderbolt',displayPrompt:'Public move',intent:'Private'}]});
 const chunks=[{id:'c1',sequence:1,label:'Sunlight through leaves',status:'playing',durationMs:5000,estimatedStartAt:1000},{id:'c2',sequence:2,jobId:'move',label:'Action',status:'queued',durationMs:5000,estimatedStartAt:6000}];
 const q=genesisQueueView(state,{now:2000,chunks});assert.equal(q.items.length,2);assert.equal(q.items[0].source,'genesis');assert.equal(q.items[1].label,'Thunderbolt');assert.equal(q.items[1].estimatedWaitMs,4000);assert.equal(q.items[1].chunkSequence,2);
 assert.throws(()=>genesisQueueView(state,{chunks:[...chunks,chunks[0]]}),/stream chunk/);
});
