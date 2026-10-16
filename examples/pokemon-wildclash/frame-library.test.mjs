import test from 'node:test';import assert from 'node:assert/strict';
import {GenesisHost} from '../../dist/host.js';
import {loadGenesisProject} from '../../dist/projectFiles.js';

test('matchup and fainting checkpoints prepare before battle and a knockout frame waits for observed completion',async()=>{
 const project=await loadGenesisProject(new URL('.',import.meta.url).pathname),submitted=[];
 let holdKnockout=false;
 const provider={id:'checkpoint-fixture',paid:false,capabilities:['image.request','live.direction'],
  async start({job}){submitted.push(structuredClone(job.effect));return{id:job.id}},
  async poll(id,job){if(holdKnockout&&job.effect.requiredOutcome?.reason==='fainted')return{status:'running'};
   return{status:'ready',result:job.effect.type==='image.request'?{imageUrl:'https://storage.googleapis.com/example/'+id.replaceAll(':','-')+'.png'}:{data:{playbackCompleted:true}}}}};
 const host=await new GenesisHost('checkpoint-battle',project,{providers:[provider]}).initialize();
 await host.join('red','Red');await host.join('blue','Blue');
 const state=()=>host.diagnostics().state.genesis;
 const action=(who,id,data)=>host.action(who,crypto.randomUUID(),id,data,host.view(who).genesis.revision);
 const drain=async(limit=15)=>{for(let i=0;i<limit;i++){const queued=state().jobs.find(j=>j.status==='queued'&&j.effect.type==='live.direction');if(queued){const actor=host.diagnostics().state.participation.seats.find(s=>s.actorId)?.actorId;if(actor)await host.runJob(actor,queued.id);}await host.tick();if(!state().jobs.some(j=>['queued','running'].includes(j.status)))break;}};
 await host.players('red',{operation:'claim',seatId:'trainer_red'});await host.players('blue',{operation:'claim',seatId:'trainer_blue'});await drain();
 const library=state().frameLibrary;
 assert.equal(library['kanto:0:1:ready'].status,'ready');assert.equal(library['kanto:0:1:red-fainted'].status,'ready');assert.equal(library['kanto:0:1:blue-fainted'].status,'ready');
 assert.equal(state().public.battleNumber,0,'Forecasts do not start the battle');
 await action('red','ready_battle',{pokemonIndex:0});await drain();await action('blue','ready_battle',{pokemonIndex:1});await drain();
 assert.ok(submitted.some(e=>e.requiredOutcome?.kind==='battle.start'),'Opening remains responsive while its new frame prepares');
 assert.ok(submitted.some(e=>e.requiredOutcome?.kind==='lineup.ready'&&e.continuity==='reanchor'),'The new battle frame cuts in once ready');
 holdKnockout=true;
 for(let round=0;round<30&&state().public.phase!=='animating';round++){
  for(const who of ['red','blue'])await action(who,'battle_move',{moveIndex:Math.max(0,state().public.fighters[who].moves.findIndex(m=>m.pp>0))});await drain();
 }
 assert.equal(state().public.phase,'animating');
 const active=state().jobs.find(j=>j.status==='running'&&j.effect.requiredOutcome?.reason==='fainted');assert.ok(active);
 assert.ok(!submitted.some(e=>e.frameRef?.key.endsWith('-fainted')),'Fainted frames cannot precede the accepted knockout playback');
 holdKnockout=false;await drain();
 const checkpoint=submitted.find(e=>e.frameRef?.key.endsWith('-fainted'));assert.ok(checkpoint,'The ready aftermath frame is inserted after completion');assert.equal(checkpoint.continuity,'reanchor');
 const images=submitted.filter(e=>e.type==='image.request'&&e.frame?.key.startsWith('kanto:0:1:'));
 assert.equal(images.filter(e=>e.frame.key.endsWith('-fainted')).length,2,'Faint forecasts remain reusable');
 const ready=images.filter(e=>e.frame.key.endsWith(':ready'));
 assert.ok(new Set(ready.map(e=>e.frame.fingerprint)).size>=2,'Lobby and battle start get separate fresh frames');
 assert.ok(ready.every(e=>e.frame.ttlMs===30000));
 assert.ok(ready.every(e=>e.requiredOutcome.fighters.length===2));
 assert.equal(new Set(ready.map(e=>e.intent)).size,ready.length,'Fresh round fingerprints also produce distinct generation prompts');
});

test('idle frames regenerate after 30 seconds and each accepted anchor cuts in once',async()=>{
 const realNow=Date.now;let now=1_000_000;Date.now=()=>now;
 try{
  const project=await loadGenesisProject(new URL('.',import.meta.url).pathname),submitted=[];
  const provider={id:'fresh-frame-fixture',paid:false,capabilities:['image.request','live.direction'],
   async start({job}){submitted.push(structuredClone(job.effect));return{id:job.id}},
   async poll(id,job){return{status:'ready',result:job.effect.type==='image.request'?{imageUrl:'https://storage.googleapis.com/example/'+id.replaceAll(':','-')+'.png'}:{data:{playbackCompleted:true}}}}};
  const host=await new GenesisHost('fresh-frames',project,{providers:[provider]}).initialize();
  await host.join('red','Red');await host.players('red',{operation:'claim',seatId:'trainer_red'});
  const state=()=>host.diagnostics().state.genesis;
  const drain=async()=>{for(let i=0;i<12;i++){for(const j of state().jobs.filter(j=>j.status==='queued'&&j.effect.type==='live.direction'))await host.runJob('red',j.id);await host.tick(now);if(!state().jobs.some(j=>['queued','running'].includes(j.status)))break;}};
  await drain();
  const images=()=>submitted.filter(e=>e.type==='image.request');
  const cuts=()=>submitted.filter(e=>e.requiredOutcome?.kind==='lineup.ready');
  assert.equal(images().length,1);assert.equal(cuts().length,1);
  const first=images()[0];await host.tick(now);await drain();assert.equal(cuts().length,1);
  now+=31000;await host.tick(now);await drain();
  assert.equal(images().length,2);assert.equal(cuts().length,2);
  assert.notEqual(images()[1].frame.fingerprint,first.frame.fingerprint);
  assert.notEqual(images()[1].intent,first.intent,'Provider input changes so the image cache cannot replay the old frame');
  assert.equal(state().public.fighters.red.hp,state().public.fighters.red.maxHp,'Refresh changes no battle stats');
  await host.tick(now);await drain();assert.equal(cuts().length,2,'A settled anchor is never cut in twice');
  await host.join('blue','Blue');await host.players('blue',{operation:'claim',seatId:'trainer_blue'});await drain();
  const action=(who,id,data)=>host.action(who,crypto.randomUUID(),id,data,host.view(who).genesis.revision);
  await action('red','ready_battle',{pokemonIndex:0});await drain();await action('blue','ready_battle',{pokemonIndex:1});await drain();
  const opening=images().filter(e=>e.frame.key.endsWith(':ready')).at(-1);
  await action('red','use_item',{itemIndex:2});await action('blue','use_item',{itemIndex:2});await drain();
  assert.equal(state().public.round,2,'Non-damaging items safely advance a complete round');
  const nextRound=images().filter(e=>e.frame.key.endsWith(':ready')).at(-1);
  assert.notEqual(nextRound.frame.fingerprint,opening.frame.fingerprint);
  assert.notEqual(nextRound.intent,opening.intent,'Each new round renders a fresh provider input even within the same 30-second window');

 }finally{Date.now=realNow;}
});
