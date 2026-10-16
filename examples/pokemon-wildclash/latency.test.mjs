import test from 'node:test';import assert from 'node:assert/strict';
import {GenesisHost} from '../../dist/host.js';import {loadGenesisProject} from '../../dist/projectFiles.js';
import {genesisRequiredFrameStatus} from '../../dist/frameLibrary.js';

test('send-outs and every attack wait for unique clean starting images, preserving urgent FIFO',async()=>{
 const project=await loadGenesisProject(new URL('.',import.meta.url).pathname),submitted=[];let imagesReady=false;
 const provider={id:'required-image-fixture',paid:false,capabilities:['image.request','live.direction'],
  async start({job,anchor}){submitted.push({effect:structuredClone(job.effect),anchor:structuredClone(anchor)});return{id:job.id};},
  async poll(id,job){return job.effect.type==='image.request'&&!imagesReady?{status:'running'}:{status:'ready',result:job.effect.type==='image.request'?{imageUrl:'https://storage.googleapis.com/example/'+id.replaceAll(':','-')+'.png'}:{data:{playbackCompleted:true}}};}};
 const host=await new GenesisHost('required-images',project,{providers:[provider]}).initialize();
 const state=()=>host.diagnostics().state.genesis;
 const action=(who,id,data)=>host.action(who,crypto.randomUUID(),id,data,host.view(who).genesis.revision);
 const drain=async(limit=35)=>{for(let n=0;n<limit;n++){const job=state().jobs.find(j=>j.status==='queued'&&j.effect.type==='live.direction'&&genesisRequiredFrameStatus(state(),j)!=='waiting');if(job)await host.runJob('red',job.id);await host.tick();if(!state().jobs.some(j=>['queued','running'].includes(j.status)))break;}};
 await host.join('red','Red');await host.join('blue','Blue');
 await host.players('red',{operation:'claim',seatId:'trainer_red'});await host.players('blue',{operation:'claim',seatId:'trainer_blue'});
 await action('red','ready_battle',{pokemonIndex:0});await action('blue','ready_battle',{pokemonIndex:1});
 for(let n=0;n<3;n++)await host.tick();
 const waiting=state().jobs.filter(j=>j.effect.frameRef?.required&&j.status==='queued');assert.equal(waiting.length,2);
 assert.equal(submitted.filter(x=>['pokemon.selected','battle.start'].includes(x.effect.requiredOutcome?.kind)).length,0,'No send-out video can bypass image generation');
 const frameJob=state().jobs.find(j=>j.effect.frame?.key===waiting[0].effect.frameRef.key&&j.status==='running');assert.ok(frameJob,'The oldest required image runs despite the urgent video queue');
 const view=host.view('red').genesis.queue.items.find(i=>i.jobId===waiting[0].id);assert.equal(view.waitingForFrame,true);assert.equal(view.estimatedStartAt,null);
 imagesReady=true;await drain();
 const sends=submitted.filter(x=>['pokemon.selected','battle.start'].includes(x.effect.requiredOutcome?.kind));assert.equal(sends.length,2);
 assert.deepEqual(sends.map(x=>x.effect.requiredOutcome.side),['trainer_red','trainer_blue']);
 for(const {effect,anchor} of sends){assert.equal(effect.frameMode,'new-frame');assert.equal(effect.continuity,'reanchor');assert.match(anchor.imageUrl,/frame-cut/);const image=submitted.find(x=>x.effect.frame?.key===effect.frameRef.key).effect;assert.equal(image.requiredOutcome.fighters.some(f=>f.side===effect.requiredOutcome.side),false);assert.equal(image.requiredOutcome.pendingSendOut.side,effect.requiredOutcome.side);assert.deepEqual(image.referenceAnchorIds,['start']);assert.equal(image.frame.refresh,true);}
 for(const who of ['red','blue'])await action(who,'battle_move',{moveIndex:0});await drain();
 const attacks=submitted.filter(x=>x.effect.requiredOutcome?.kind==='battle_move');assert.equal(attacks.length,2);
 for(const {effect,anchor} of attacks){assert.equal(effect.frameMode,'new-frame');assert.equal(effect.continuity,'reanchor');const image=submitted.find(x=>x.effect.frame?.key===effect.frameRef.key).effect;assert.deepEqual(image.referenceAnchorIds,['start']);assert.deepEqual(image.requiredOutcome.fighters,effect.requiredOutcome.beforeFighters);assert.match(anchor.imageUrl,/frame-cut/);}
 assert.equal(new Set([...sends,...attacks].map(x=>x.effect.frameRef.fingerprint)).size,4,'Each action uses a newly generated image, even within one round');
});

test('a failed required image retries once and never submits a continuation video',async()=>{
 const project=await loadGenesisProject(new URL('.',import.meta.url).pathname),submitted=[];
 const provider={id:'failed-image-fixture',paid:false,capabilities:['image.request','live.direction'],
  async start({job}){submitted.push(structuredClone(job.effect));return{id:job.id};},
  async poll(id,job){return job.effect.frame?.key.startsWith('cut:')?{status:'failed',result:{error:'Image fixture failure'}}:{status:'ready',result:job.effect.type==='image.request'?{imageUrl:'https://storage.googleapis.com/example/frame.png'}:{data:{playbackCompleted:true}}};}};
 const host=await new GenesisHost('failed-required-image',project,{providers:[provider]}).initialize();await host.join('red','Red');await host.players('red',{operation:'claim',seatId:'trainer_red'});
 await host.action('red','send-red','ready_battle',{pokemonIndex:0},host.view('red').genesis.revision);
 for(let i=0;i<12;i++)await host.tick();
 const state=host.diagnostics().state.genesis,action=state.jobs.find(j=>j.effect.requiredOutcome?.kind==='pokemon.selected');
 assert.equal(action.status,'failed');assert.match(action.error,/required fresh starting frame failed/);
 assert.equal(submitted.filter(e=>e.frame?.key===action.effect.frameRef.key).length,2);
 assert.equal(submitted.some(e=>e.requiredOutcome?.kind==='pokemon.selected'),false);
});

test('a second trainer joining preserves the first trainer\'s pending send-out image and animation',async()=>{
 const project=await loadGenesisProject(new URL('.',import.meta.url).pathname);let ready=false;
 const provider={id:'joining-trainer-fixture',paid:false,capabilities:['image.request','live.direction'],start:async({job})=>({id:job.id}),poll:async(id,job)=>job.effect.type==='image.request'&&!ready?{status:'running'}:{status:'ready',result:job.effect.type==='image.request'?{imageUrl:'https://storage.googleapis.com/example/frame.png'}:{data:{playbackCompleted:true}}}};
 const host=await new GenesisHost('joining-trainer',project,{providers:[provider]}).initialize();await host.join('red','Red');await host.players('red',{operation:'claim',seatId:'trainer_red'});
 await host.action('red','send-red','ready_battle',{pokemonIndex:0},host.view('red').genesis.revision);await host.tick();
 const state=()=>host.diagnostics().state.genesis;
 const send=state().jobs.find(j=>j.effect.requiredOutcome?.kind==='pokemon.selected');
 const image=state().jobs.find(j=>j.effect.frame?.key===send.effect.frameRef.key);assert.ok(image);
 await host.join('blue','Blue');await host.players('blue',{operation:'claim',seatId:'trainer_blue'});
 assert.equal(state().jobs.find(j=>j.id===send.id).status,'queued');assert.equal(state().jobs.find(j=>j.id===image.id).status,'running');
 ready=true;for(let i=0;i<5;i++)await host.tick();
 assert.equal(state().jobs.find(j=>j.id===send.id).status,'ready','The first send-out completes even after the opposite trainer joins');
});
