import test from 'node:test';import assert from 'node:assert/strict';
import {GenesisHost} from '../../dist/host.js';import {loadGenesisProject} from '../../dist/projectFiles.js';
async function fixture(){
 const project=await loadGenesisProject(new URL('.',import.meta.url).pathname),submitted=[],flags={imagesReady:true,videoReady:true,holdKnockout:false};
 project.definition.genesis.config.sequentialTurns=false;
 project.controllerSource=project.controllerSource.replace('Math.floor(Math.random() * 4294967295) || 1','12345');
 const host=await new GenesisHost('fresh-'+crypto.randomUUID(),project,{providers:[{id:'frames',paid:false,capabilities:['image.request','live.direction'],
 async start({job,anchor}){submitted.push({effect:structuredClone(job.effect),anchor:structuredClone(anchor)});return{id:job.id}},
 async poll(id,job){return (job.effect.type==='image.request'?!flags.imagesReady:!flags.videoReady||flags.holdKnockout&&job.effect.requiredOutcome?.reason==='fainted')?{status:'running'}:{status:'ready',result:job.effect.type==='image.request'?{imageUrl:'https://storage.googleapis.com/example/'+id.replaceAll(':','-')+'.png'}:{data:{playbackCompleted:true}}};}}]}).initialize();
 const state=()=>host.diagnostics().state.genesis,act=(who,id,data)=>host.action(who,crypto.randomUUID(),id,data,host.view(who).genesis.revision),drain=async(n=20)=>{for(let i=0;i<n;i++)await host.tick();};
 await host.join('red','Red');await host.join('blue','Blue');return {host,state,act,drain,flags,submitted};
}
test('current lineups get fresh checkpoints without speculative fainting jobs, and recall stays linked',async()=>{
 const f=await fixture();for(const [who,seatId]of[['red','trainer_red'],['blue','trainer_blue']])await f.host.players(who,{operation:'claim',seatId});await f.drain();
 assert.equal(f.state().frameLibrary['kanto:0:1:red-fainted'],undefined,'Unused fainting predictions cannot occupy the image worker');
 await f.act('red','ready_battle',{pokemonIndex:0});await f.drain();await f.act('blue','ready_battle',{pokemonIndex:1});await f.drain();f.flags.holdKnockout=true;
 for(let round=0;round<30&&f.state().public.phase!=='animating';round++){
  for(const who of ['red','blue'])await f.act(who,'battle_move',{moveIndex:Math.max(0,f.state().public.fighters[who].moves.findIndex(m=>m.pp>0))});await f.drain();
 }
 assert.equal(f.state().public.phase,'animating');assert.equal(f.submitted.some(x=>x.effect.requiredOutcome?.kind==='battle.recall'),false);
 f.flags.holdKnockout=false;await f.drain();const recall=f.submitted.find(x=>x.effect.requiredOutcome?.kind==='battle.recall');assert.ok(recall);assert.equal(recall.effect.continuity,'linked');
 const images=f.submitted.filter(x=>x.effect.requiredOutcome?.pose==='ready');assert.ok(images.length>=3);assert.ok(images.every(x=>x.effect.frame.ttlMs===90000));assert.ok(new Set(images.map(x=>x.effect.frame.fingerprint)).size>=3);
 const attacks=f.submitted.filter(x=>x.effect.requiredOutcome?.kind==='battle_move');const fresh=attacks.filter(x=>x.effect.frameMode==='new-frame').length;assert.ok(fresh>=attacks.length-2,`Fresh physical-state checkpoints covered ${fresh}/${attacks.length} attacks, including changing postures`);
});
test('a ready clean image stays available while a slow replacement generates and urgent practice cannot cancel it',async()=>{
 const realNow=Date.now;let now=1_000_000;Date.now=()=>now;
 try{
  const f=await fixture();await f.host.players('red',{operation:'claim',seatId:'trainer_red'});await f.drain();await f.act('red','ready_battle',{pokemonIndex:0});await f.drain();
  const ready=Object.values(f.state().frameLibrary).find(e=>e.status==='ready'&&e.key.includes(':ready')&&e.fingerprint.includes('Charizard'));assert.ok(ready);
  f.flags.imagesReady=false;now+=16000;await f.host.tick();
  const image=f.state().jobs.find(j=>j.status==='running'&&j.effect.frame);assert.ok(image);assert.notEqual(image.effect.frame.key,ready.key);
  assert.equal(f.state().frameLibrary[ready.key].status,'ready');assert.equal(f.state().frameLibrary[ready.key].anchorId,ready.anchorId);
  f.flags.videoReady=false;await f.act('red','practice_move',{moveIndex:0});assert.equal(f.state().jobs.find(j=>j.id===image.id).status,'running');
  const practice=f.submitted.find(x=>x.effect.requiredOutcome?.kind==='practice.move');assert.equal(practice.effect.anchorId,ready.anchorId);
  f.flags.imagesReady=true;await f.host.tick();assert.equal(f.state().frameLibrary[image.effect.frame.key].status,'ready');
  assert.equal(f.state().public.fighters.red.hp,f.state().public.fighters.red.maxHp);
 }finally{Date.now=realNow;}
});
