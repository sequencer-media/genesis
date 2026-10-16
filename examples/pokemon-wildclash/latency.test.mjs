import test from 'node:test';import assert from 'node:assert/strict';
import {GenesisHost} from '../../dist/host.js';import {loadGenesisProject} from '../../dist/projectFiles.js';
test('a slow lineup image never blocks send-out, practice, or scored battle directions',async()=>{
 const project=await loadGenesisProject(new URL('.',import.meta.url).pathname);let releaseImage=false;const submitted=[];
 const provider={id:'slow-image-fixture',paid:false,capabilities:['image.request','live.direction'],
  async start({job}){submitted.push(job.effect);return{id:job.id};},
  async poll(id,job){return job.effect.type==='image.request'&&!releaseImage?{status:'running'}:{status:'ready',result:job.effect.type==='image.request'?{imageUrl:'https://storage.googleapis.com/example/lineup.png'}:{data:{playbackCompleted:true}}};}};
 const host=await new GenesisHost('latency',project,{providers:[provider]}).initialize();
 await host.join('red','Red','player','red');await host.join('blue','Blue','player','blue');
 const state=()=>host.diagnostics().state.genesis;
 const action=(who,id,data)=>host.action(who,crypto.randomUUID(),id,data,host.view(who).genesis.revision);
 const runDirection=async()=>{const job=state().jobs.find(j=>j.effect.type==='live.direction'&&j.status==='queued');assert.ok(job,'A direction is queued while the image remains running');await host.runJob('red',job.id);await host.tick();};
 await host.players('red',{operation:'claim',seatId:'trainer_red'});await runDirection();
 const image=state().jobs.find(j=>j.effect.type==='image.request'&&j.status==='running');assert.ok(image,'The library starts its background preparation automatically');await host.tick();assert.equal(state().jobs.find(j=>j.id===image.id).status,'running');
 await action('red','ready_battle',{pokemonIndex:3});await runDirection();
 await action('red','practice_move',{moveIndex:0});await runDirection();assert.ok(submitted.some(e=>e.requiredOutcome?.kind==='practice.move'));
 await host.players('blue',{operation:'claim',seatId:'trainer_blue'});await action('blue','ready_battle',{pokemonIndex:1});
 assert.equal(state().public.phase,'battle');
 await action('red','battle_move',{moveIndex:3});await action('blue','battle_move',{moveIndex:3});
 await runDirection();await runDirection();await runDirection();assert.equal(state().public.round,2);
 assert.ok(submitted.filter(e=>e.requiredOutcome?.kind==='battle_move').length===2);
 assert.equal(state().jobs.find(j=>j.id===image.id).status,'running','Slow obsolete image does not hold the battle');
 releaseImage=true;await host.tick();
});
