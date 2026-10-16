import test from 'node:test';import assert from 'node:assert/strict';
import {GenesisHost} from '../../dist/host.js';import {loadGenesisProject} from '../../dist/projectFiles.js';
const project=()=>loadGenesisProject(new URL('.',import.meta.url).pathname);
async function fixture({imagesReady=false,videoReady=true,authorize=true}={}){
 const submitted=[];const flags={imagesReady,videoReady,authorize};
 const provider={id:'latency-fixture',paid:true,capabilities:['image.request','live.direction'],
  async start({job,anchor}){submitted.push({effect:structuredClone(job.effect),anchor:structuredClone(anchor),at:Date.now()});return{id:job.id};},
  async poll(id,job){return (job.effect.type==='image.request'?!flags.imagesReady:!flags.videoReady)?{status:'running'}:{status:'ready',result:job.effect.type==='image.request'?{imageUrl:'https://storage.googleapis.com/example/'+id.replaceAll(':','-')+'.png'}:{data:{playbackCompleted:true}}};}};
 const host=await new GenesisHost('latency-'+crypto.randomUUID(),await project(),{providers:[provider],services:{authorizeTool:async({job})=>job.effect.type==='image.request'||flags.authorize}}).initialize();
 const state=()=>host.diagnostics().state.genesis;
 const action=(who,id,data)=>host.action(who,crypto.randomUUID(),id,data,host.view(who).genesis.revision);
 const drain=async(n=30)=>{for(let i=0;i<n;i++)await host.tick();};
 await host.join('red','Red');await host.join('blue','Blue');
 await host.players('red',{operation:'claim',seatId:'trainer_red'});await host.players('blue',{operation:'claim',seatId:'trainer_blue'});
 return {host,state,action,submitted,flags,drain};
}
test('send-outs require a clean opening, while attacks submit without waiting for another image',async()=>{
 const f=await fixture();
 await f.action('red','ready_battle',{pokemonIndex:0});await f.action('blue','ready_battle',{pokemonIndex:1});
 assert.equal(f.submitted.some(x=>x.effect.type==='live.direction'&&x.effect.delivery?.priority==='urgent'),false);
 const batch=f.state().jobs.find(j=>j.mergedEffects?.length===2);assert.ok(batch);assert.equal(batch.effect.frameRef.required,true);
 f.flags.imagesReady=true;await f.drain();
 f.flags.imagesReady=false;f.flags.videoReady=false;
 const selectedAt=Date.now();for(const who of ['red','blue'])await f.action(who,'battle_move',{moveIndex:0});
 const attack=f.submitted.find(x=>x.effect.requiredOutcome?.kind==='battle_move');assert.ok(attack);assert.ok(attack.at-selectedAt<5000);
 assert.equal(attack.effect.frameMode,'new-frame','The newest ready clean checkpoint is reused while its replacement prepares');
 await f.host.tick();assert.equal(f.submitted.filter(x=>x.effect.requiredOutcome?.kind==='battle_move').length,1,'An urgent attack already running keeps its slot');
 f.flags.videoReady=true;await f.drain();assert.equal(f.submitted.filter(x=>x.effect.requiredOutcome?.kind==='battle_move').length,2);
});
test('ready clean frames are used and new before-action checkpoints prepare while an urgent video is running',async()=>{
 const f=await fixture({imagesReady:true});await f.drain();
 await f.action('red','ready_battle',{pokemonIndex:0});await f.drain();
 const send=f.submitted.find(x=>x.effect.requiredOutcome?.kind==='pokemon.selected');assert.equal(send.effect.frameMode,'new-frame');assert.match(send.anchor.imageUrl,/frame-kanto/);
 await f.action('blue','ready_battle',{pokemonIndex:1});await f.drain();f.flags.videoReady=false;
 for(const who of ['red','blue'])await f.action(who,'battle_move',{moveIndex:0});
 const attack=f.submitted.find(x=>x.effect.requiredOutcome?.kind==='battle_move');assert.equal(attack.effect.frameMode,'new-frame');assert.match(attack.anchor.imageUrl,/frame-kanto/);
 await f.host.tick();
 assert.ok(f.state().jobs.some(j=>j.status==='running'&&j.effect.frame),'A fresh next checkpoint prepares concurrently with the accepted video');
 const ready=f.submitted.filter(x=>x.effect.requiredOutcome?.pose==='ready');assert.ok(ready.length>=2);
 assert.ok(ready.every(x=>x.effect.referenceAnchorIds[0]==='start'));
});
test('two compatible send-outs share one required joint clean opening',async()=>{
 const f=await fixture({authorize:false});
 await f.action('red','ready_battle',{pokemonIndex:0});await f.action('blue','ready_battle',{pokemonIndex:1});
 const batch=f.state().jobs.find(j=>j.mergedEffects?.length===2);assert.ok(batch);assert.equal(batch.effect.frameRef.required,true);
 const frame=f.state().frameLibrary[batch.effect.frameRef.key];assert.deepEqual(frame.request.requiredOutcome.pendingSendOuts.map(r=>r.side),['trainer_red','trainer_blue']);assert.equal(frame.request.requiredOutcome.fighters.length,0);
 const view=f.host.view('red').genesis.queue.items.find(i=>i.jobId===batch.id);assert.equal(view.mergedActions.length,2);assert.equal(view.waitingForFrame,true);
 f.flags.authorize=true;f.flags.imagesReady=true;await f.drain();
 const send=f.submitted.find(x=>x.effect.requiredOutcome?.mergedOutcomes);assert.ok(send);assert.equal(send.effect.frameMode,'new-frame');assert.equal(send.effect.requiredOutcome.mergedOutcomes.length,2);
});
test('a later trainer joining preserves an accepted send-out while its image is still preparing',async()=>{
 const f=await fixture({videoReady:false});await f.host.players('blue',{operation:'release',seatId:'trainer_blue'});await f.action('red','ready_battle',{pokemonIndex:0});
 const send=f.state().jobs.find(j=>j.effect.requiredOutcome?.kind==='pokemon.selected');
 assert.equal(send.status,'queued');assert.equal(send.effect.frameRef.required,true);
 await f.host.join('new-blue','New Blue');await f.host.players('new-blue',{operation:'claim',seatId:'trainer_blue'});assert.equal(f.state().jobs.find(j=>j.id===send.id).status,'queued');
 f.flags.imagesReady=true;f.flags.videoReady=true;await f.drain();assert.equal(f.state().jobs.find(j=>j.id===send.id).status,'ready');
});

test('Pikachu replaces the same-side Venusaur, with its previous body preserved only for the recall',async()=>{
 const f=await fixture({imagesReady:true});await f.action('red','ready_battle',{pokemonIndex:2});await f.drain();
 await f.action('red','select_pokemon',{pokemonIndex:3});
 const job=f.state().jobs.find(j=>j.status==='queued'&&j.effect.requiredOutcome?.pokemon==='Pikachu');assert.ok(job);assert.equal(job.effect.frameRef.required,true);
 const outcome=job.effect.requiredOutcome;assert.equal(outcome.previousPokemon,'Venusaur');assert.equal(outcome.beforeFighters.find(x=>x.side==='trainer_red').name,'Venusaur');assert.match(outcome.beforeFighters.find(x=>x.side==='trainer_red').appearance,/giant pink flower/);
 const image=f.state().frameLibrary[job.effect.frameRef.key].request.requiredOutcome;assert.equal(image.pendingSendOuts[0].previousPokemon,'Venusaur');assert.equal(image.pendingSendOuts[0].pokemon,'Pikachu');assert.equal(image.fighters.find(x=>x.side==='trainer_red').name,'Venusaur');
 await f.drain();assert.equal(f.state().public.fighters.red.name,'Pikachu');assert.equal(Object.keys(f.state().public.fighters).length,2);
});
