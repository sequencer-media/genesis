import {genesisRequiredFrameStatus} from '../../dist/frameLibrary.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {GenesisHost}from'../../dist/host.js';import {loadGenesisProject}from'../../dist/projectFiles.js';
const project=await loadGenesisProject(new URL('.',import.meta.url).pathname);
// These fixtures verify the optional simultaneous command mode.
project.definition.genesis.config.sequentialTurns=false;
project.controllerSource=project.controllerSource.replace('Math.floor(Math.random() * 4294967295) || 1','12345');
async function fixture({sequentialTurns=false}={}){
 const configured=structuredClone(project);configured.definition.genesis.config.sequentialTurns=sequentialTurns;
 const submitted=[];
 const host=await new GenesisHost('trainer-flow-'+Math.floor(Math.random()*1e9),configured,{providers:[{id:'fixtures',paid:false,capabilities:['image.request','live.direction'],start:async({job})=>{submitted.push(structuredClone(job.effect));return{id:job.id}},poll:async(_id,job)=>job.effect.type==='image.request'?{status:'ready',result:{imageUrl:'https://storage.googleapis.com/example/accepted.png'}}:{status:'ready',result:{data:{playbackCompleted:true}}}}]}).initialize();
 await host.join('one','Test trainer','spectator','verified:one');await host.join('watcher','Other trainer','spectator','verified:other');
 const state=()=>host.diagnostics().state.genesis;let seq=0;
 const act=(actor,id,data)=>host.action(actor,'flow-'+seq++,id,data,host.view(actor).genesis.revision);
 async function drain(){for(let i=0;i<40;i++){
  const job=state().jobs.find(j=>j.status==='running'||j.status==='queued'&&genesisRequiredFrameStatus(state(),j)!=='waiting');
  if(job){if(job.status==='queued')await host.runJob(host.diagnostics().state.participation.seats.find(s=>s.actorId).actorId,job.id);await host.tick();continue;}
  const timer=state().timers.find(t=>t.data.kind==='setup-frame');if(timer){await host.tick(timer.dueAt+1);continue;}return;
 }throw Error('Pipeline did not drain');}
 return {host,state,act,drain,submitted};
}
test('send-out works solo, enables harmless practice and preserves readiness when another trainer joins',async()=>{
 const {host,state,act,drain}=await fixture();await host.players('one',{operation:'claim',seatId:'trainer_red'});
 await assert.rejects(act('one','practice_move',{moveIndex:0}),/Send out/);
 await act('one','ready_battle',{pokemonIndex:3});assert.equal(state().public.fighters.one.sentOut,true);assert.equal(state().public.fighters.one.ready,true);assert.equal(state().public.fighters.one.name,'Pikachu');assert.equal(state().public.phase,'waiting');
 await drain();const before=structuredClone(state().public.fighters.one);
 await act('one','practice_move',{moveIndex:0});await drain();assert.equal(state().public.fighters.one.hp,before.hp);assert.equal(state().public.fighters.one.moves[0].pp,before.moves[0].pp);
 await host.players('watcher',{operation:'claim',seatId:'trainer_blue'});assert.equal(state().public.phase,'setup');assert.equal(state().public.fighters.one.sentOut,true);assert.equal(state().public.fighters.one.ready,true);
 const clock=Date.now;try{Date.now=()=>clock()+15000;await host.read('one');await act('one','practice_move',{moveIndex:0});}finally{Date.now=clock;}
 await act('watcher','ready_battle',{pokemonIndex:1});assert.equal(state().server.startRequested,false);assert.equal(state().public.phase,'battle','Both sent-out Pokémon immediately open scored commands, including while practice video is pending');
 assert.equal(host.view('one').genesis.actions.find(a=>a.id==='battle_move').canSubmit,true);
 await drain();assert.equal(state().public.phase,'battle');assert.equal(state().public.round,1);
});
test('one verified account keeps both trainers while switching actors and submitting both commands',async()=>{
 const {host,state,act,drain}=await fixture();let selected=await host.players('one',{operation:'claim',seatId:'trainer_red'});
 await act('one','ready_battle',{pokemonIndex:3});
 selected=await host.players('one',{operation:'claim',seatId:'trainer_blue'});const blue=selected.actorId;
 assert.notEqual(blue,'one');assert.equal(selected.participation.seats.filter(s=>s.actorId).length,2);assert.equal(selected.participation.seats.find(s=>s.id==='trainer_red').canControl,true);
 assert.equal(state().public.fighters.one.ready,true);
 for(const id of ['trainer_red','trainer_blue','trainer_red']){selected=await host.players(selected.actorId,{operation:'claim',seatId:id});assert.equal(selected.participation.seats.filter(s=>s.actorId).length,2);}
 await act(blue,'ready_battle',{pokemonIndex:3});await drain();assert.equal(state().public.phase,'battle');
 await act('one','battle_move',{moveIndex:3});
 assert.equal(host.view(blue).genesis.queue.items.filter(q=>q.label.includes('Quick Attack')).length,0,'A secret command stays hidden until both trainers commit');
 await assert.rejects(act('one','battle_move',{moveIndex:3}));await act(blue,'battle_move',{moveIndex:3});
 const committed=host.view(blue).genesis.queue;assert.equal(committed.version,1);assert.equal(committed.items.filter(q=>q.label.includes('Quick Attack')).length,2);assert.ok(committed.items.every(q=>q.prompt&&q.position>0));assert.doesNotMatch(JSON.stringify(committed),/hpAfter|hpBefore|damageAmount|remainingHp/);
 await drain();assert.equal(host.view(blue).genesis.queue.items.length,0,'The public queue clears after observed playback drains');
 assert.equal(state().public.round,2);assert.equal(state().public.fighters.one.moves[3].pp,29);assert.equal(state().public.fighters[blue].moves[3].pp,29);
 await assert.rejects(host.players('watcher',{operation:'claim',seatId:'trainer_red'}),/occupied/);
 const seats=host.view('one').participation.seats;assert.equal(seats.filter(s=>s.actorId).length,2);assert.equal(seats.find(s=>s.id==='trainer_red').actorId,'one');assert.equal(seats.find(s=>s.id==='trainer_blue').actorId,blue);
});
test('the winner stays sent out and in their seat while only the defeated trainer leaves and a new challenger enters',async()=>{
 const {host,state,act,drain,submitted}=await fixture();
 await host.players('one',{operation:'claim',seatId:'trainer_red'});await act('one','ready_battle',{pokemonIndex:3});
 await host.players('watcher',{operation:'claim',seatId:'trainer_blue'});await act('watcher','ready_battle',{pokemonIndex:1});await drain();
 for(let round=0;round<25&&state().public.phase==='battle';round++){
  for(const who of ['one','watcher'])await act(who,'battle_move',{moveIndex:Math.max(0,state().public.fighters[who].moves.findIndex(m=>m.pp>0))});await drain();
 }
 const game=state().public,winner=game.lastResult?.winnerId;assert.ok(winner);assert.equal(game.phase,'waiting');
 const champion=structuredClone(game.fighters[winner]),seatId=champion.seatId;
 assert.equal(champion.sentOut,true);assert.equal(champion.ready,true);
 assert.equal(host.diagnostics().state.participation.seats.find(s=>s.id===seatId).actorId,winner);
 assert.equal(Object.keys(game.fighters).length,1);
 const recall=submitted.find(e=>e.requiredOutcome?.kind==='battle.recall');assert.ok(recall);assert.ok(!recall.requiredOutcome.recalledSides.includes(seatId));
 const waiting=submitted.filter(e=>e.requiredOutcome?.kind==='lobby.roster').at(-1);assert.equal(waiting.continuity,'linked');assert.match(waiting.intent,/winner and trainer visible/);
 await host.join('next','Next challenger','spectator','verified:next');
 await host.players('next',{operation:'claim',seatId:seatId==='trainer_red'?'trainer_blue':'trainer_red'});await drain();
 assert.equal(state().public.fighters[winner].sentOut,true);assert.equal(state().public.fighters[winner].ready,true);
 assert.equal(state().public.fighters[winner].name,champion.name);assert.equal(state().public.fighters[winner].hp,champion.hp);
 await act('next','ready_battle',{pokemonIndex:2});assert.equal(state().public.phase,'battle','The champion stays ready for the next challenger');
});


test('a verified account retains both seats across sequential playback and active-trainer handoffs',async()=>{
 const {host,state,act,drain}=await fixture({sequentialTurns:true});await host.players('one',{operation:'claim',seatId:'trainer_red'});await act('one','ready_battle',{pokemonIndex:3});
 const selected=await host.players('one',{operation:'claim',seatId:'trainer_blue'}),blue=selected.actorId;
 await act(blue,'ready_battle',{pokemonIndex:1});await drain();
 assert.equal(state().public.activeTurnActorId,'one');await host.players(blue,{operation:'claim',seatId:'trainer_red'});
 await act('one','battle_move',{moveIndex:0});assert.equal(state().public.phase,'animating');await drain();
 assert.equal(state().public.activeTurnActorId,blue);const switched=await host.players('one',{operation:'claim',seatId:'trainer_blue'});
 assert.equal(switched.participation.seats.filter(s=>s.actorId).length,2);assert.equal(switched.actorId,blue);
 await act(blue,'battle_move',{moveIndex:0});await drain();assert.equal(state().public.activeTurnActorId,'one');
});
