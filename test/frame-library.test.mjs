import test from 'node:test';
import assert from 'node:assert/strict';
import {createGenesisProject,GenesisHost,MemoryGenesisStorage} from '../dist/index.js';
import {createGenesisState,applyGenesisTransition,genesisView} from '../dist/genesisCore.js';
import {createExperienceSessionState} from '../dist/experienceSessionCore.js';
import {settleGenesisJob,tickGenesis} from '../dist/genesisRuntime.js';

const source='function onEvent(){return {}}';
const image='https://storage.googleapis.com/example/frame.png';
function setup(){const p=createGenesisProject('decisions');p.definition.genesis.controller='custom';p.controllerSource=source;p.definition.genesis.capabilities=['image.request','live.direction'];const state=createExperienceSessionState(p.definition,'v1',1,1000);state.genesis=createGenesisState(p.definition,image);return {p,def:p.definition,state};}
const prepare=(key,priority=50,extra={})=>({id:'plan:'+key,type:'frame.prepare',frame:{key,fingerprint:key+':v1',ttlMs:30000,priority},anchorId:'start',intent:'Scene-only checkpoint: '+key,maxCostUsd:.05,...extra});
const reduce=(def,state,effects,id='plan',now=1000)=>({...state,genesis:applyGenesisTransition(def,state.genesis,{id,type:'plan',data:{},now},{effects})});

test('a wishlist serializes images by priority alongside a live action and preserves presentation',async()=>{
 const {def,state}=setup();state.genesis.stage.mode='playing';state.genesis.stage.videoUrl='existing';
 let next=reduce(def,state,[prepare('fainted',30),prepare('battle',95),prepare('sendout',70),{id:'move',type:'live.direction',intent:'One accepted move'}]);
 assert.equal(next.genesis.jobs.length,2);assert.equal(next.genesis.jobs.find(j=>j.effect.frame).effect.frame.key,'battle');
 assert.equal(next.genesis.reservedCostUsd,.05);assert.deepEqual(next.genesis.stage,state.genesis.stage);
 assert.equal(genesisView(def,next.genesis,'a','player').jobs.some(j=>j.type==='image.request'),false);
 const first=next.genesis.jobs.find(j=>j.effect.frame);
 next=await settleGenesisJob(def,next,source,first.id,{imageUrl:image},1001);
 assert.equal(next.genesis.frameLibrary.battle.status,'ready');
 assert.equal(next.genesis.jobs.filter(j=>['queued','running'].includes(j.status)&&j.effect.type==='image.request').length,1);
 assert.equal(next.genesis.jobs.find(j=>j.status==='queued'&&j.effect.frame).effect.frame.key,'sendout');
 assert.deepEqual(next.genesis.stage,state.genesis.stage);
});

test('only an exact ready frame can reanchor; missing preparation keeps the action linked',async()=>{
 const {def,state}=setup();let next=reduce(def,state,[prepare('faint')]);const job=next.genesis.jobs[0];
 next=await settleGenesisJob(def,next,source,job.id,{imageUrl:image},1001);
 assert.deepEqual(next.genesis.public,state.genesis.public,'Prediction never applies a game outcome');
 for(const [key,fingerprint,continuity]of[['faint','faint:v1','reanchor'],['faint','faint:v2','linked'],['absent','missing','linked']]){
  const selected=reduce(def,next,[{id:'use:'+fingerprint,type:'live.direction',intent:'Continue the accepted state',frameRef:{key,fingerprint}}],'use:'+fingerprint,1002);
  assert.equal(selected.genesis.jobs.at(-1).effect.continuity,continuity);
  if(continuity==='reanchor')assert.equal(selected.genesis.jobs.at(-1).effect.anchorId,job.result?.anchorId || 'anchor:'+job.id);
 }
});

test('a replacement forecast discards the older in-flight result and starts the current one',async()=>{
 const {def,state}=setup();let next=reduce(def,state,[prepare('cast')]);const first=next.genesis.jobs[0];
 next.genesis.jobs[0].status='running';
 next=reduce(def,next,[prepare('cast',90,{id:'changed',frame:{key:'cast',fingerprint:'new-cast',priority:90,ttlMs:30000}})],'changed',1001);
 next=await settleGenesisJob(def,next,source,first.id,{imageUrl:image},1002);
 assert.equal(next.genesis.jobs.find(j=>j.id===first.id).status,'cancelled');
 assert.equal(next.genesis.anchors['anchor:'+first.id],undefined);
 assert.equal(next.genesis.frameLibrary.cast.status,'preparing');assert.equal(next.genesis.frameLibrary.cast.fingerprint,'new-cast');
 assert.equal(next.genesis.jobs.filter(j=>j.status==='queued').length,1);
});

test('TTL refresh retains the decision window and reserves no work beyond the session budget',async()=>{
 const {def,state}=setup();def.genesis.limits.maxSessionCostUsd=.1;
 let next=reduce(def,state,[prepare('cast')]);const job=next.genesis.jobs[0];
 next=await settleGenesisJob(def,next,source,job.id,{imageUrl:image},1001);
 const window=structuredClone(next.genesis.window);
 next=await tickGenesis(def,next,source,31002);
 assert.deepEqual(next.genesis.window,window);assert.equal(next.genesis.frameLibrary.cast.status,'preparing');
 next=await settleGenesisJob(def,next,source,next.genesis.frameLibrary.cast.jobId,{imageUrl:image},31003);
 next=await tickGenesis(def,next,source,62000);
 assert.equal(next.genesis.frameLibrary.cast.status,'pending');assert.equal(next.genesis.jobs.filter(j=>['queued','running'].includes(j.status)).length,0);
 assert.equal(next.genesis.reservedCostUsd,.1);
});

test('a shared cached result keeps its original expiry and releases this session reservation',async()=>{
 const {def,state}=setup();let next=reduce(def,state,[prepare('cached')]);const job=next.genesis.jobs[0];
 next=await settleGenesisJob(def,next,source,job.id,{imageUrl:image,reused:true,frameExpiresAtMs:1500},1001);
 assert.equal(next.genesis.reservedCostUsd,0);assert.equal(next.genesis.frameLibrary.cached.expiresAtMs,1500);
});

test('invalidation, grants, bounded requests and anchor compaction protect the library',async()=>{
 const {def,state}=setup();assert.throws(()=>reduce(def,state,[prepare('__proto__')]),/frame key/);
 assert.throws(()=>reduce(def,state,[prepare('bad',999)]),/priority/);
 assert.throws(()=>reduce(def,state,[prepare('bad',50,{maxCostUsd:9})]),/spending/);
 const denied=structuredClone(def);denied.genesis.capabilities=[];assert.throws(()=>reduce(denied,state,[prepare('bad')]),/grant/);
 let next=reduce(def,state,[prepare('retained')]);next=await settleGenesisJob(def,next,source,next.genesis.jobs[0].id,{imageUrl:image},1001);
 const anchor=next.genesis.frameLibrary.retained.anchorId;
 for(let i=0;i<15;i++)next=reduce(def,next,[],'noop:'+i,1002+i);
 assert.ok(next.genesis.anchors[anchor]);
 next=reduce(def,next,[{id:'invalidate',type:'frame.invalidate',frameKey:'retained'}],'invalidate',1020);
 assert.equal(next.genesis.frameLibrary.retained.status,'stale');
});

test('reference host prepares frames automatically through its authorized provider and persists them',async()=>{
 const {p}=setup();p.controllerSource=`function onEvent({event}){return event.type==='participant.joined'?{effects:[${JSON.stringify(prepare('auto'))}]}:{}}`;
 const storage=new MemoryGenesisStorage();let starts=0;
 const provider={id:'fixture',paid:false,capabilities:['image.request'],async start(){starts++;return{id:'saved'}},async poll(){return{status:'ready',result:{imageUrl:image}}}};
 const host=await new GenesisHost('frame-auto',p,{storage,providers:[provider]}).initialize();await host.join('player','Player');
 await host.tick();await host.tick();
 assert.equal(starts,1);assert.equal(host.diagnostics().state.genesis.frameLibrary.auto.status,'ready');
 const restored=await new GenesisHost('frame-auto',p,{storage,providers:[provider]}).initialize();
 assert.equal(restored.diagnostics().state.genesis.frameLibrary.auto.status,'ready');
});

test('required frames gate dispatch and survive later urgent preemption',async()=>{
 const {def,state}=setup();
 const direction=(id,key)=>({id,type:'live.direction',intent:'Accepted action',delivery:{priority:'urgent',replaceable:false},frameMode:'new-frame',frameRef:{key,fingerprint:key+':v1',required:true}});
 let next=reduce(def,state,[prepare('first'),direction('first-action','first')]);
 const imageJob=next.genesis.jobs.find(j=>j.effect.frame);assert.ok(imageJob);
 assert.equal(next.genesis.jobs.find(j=>j.id==='first-action').effect.anchorId,undefined,'No stale stage anchor is substituted');
 imageJob.status='running';
 next=reduce(def,next,[prepare('second'),direction('second-action','second')],'second',1001);
 assert.equal(next.genesis.jobs.find(j=>j.id===imageJob.id).status,'running','A later urgent cannot cancel an earlier required image');
 next=await settleGenesisJob(def,next,source,imageJob.id,{imageUrl:image},1002);
 assert.equal(next.genesis.frameLibrary.first.status,'ready');
 assert.ok(next.genesis.jobs.some(j=>j.effect.frame?.key==='second'),'The next required image can prepare alongside the queued first action');
 assert.throws(()=>reduce(def,next,[direction('unknown','absent')],'missing-reference'),/Prepare the exact required frame/);
 assert.throws(()=>reduce(def,next,[{...direction('invalid','first'),frameRef:{key:'first',fingerprint:'first:v1',required:'yes'}}],'invalid-reference'),/prepared frame/);
});
