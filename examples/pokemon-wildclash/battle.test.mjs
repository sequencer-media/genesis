import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./controller.js',import.meta.url),'utf8');
const onEvent=vm.runInNewContext(source+';onEvent');
function fixture({animate=true,red=3,blue=1,seed=12345,turnSeconds=60,opening=false,classicDamage=false}={}){
 let time=1_000_000,seq=0,state={public:{},server:{}};const effects=[];
 const config={worldPrompt:'Woodland',video:{pacing:'continuous',chunkIntervalSeconds:124/24},settings:{animateBattles:animate,visualContext:false,turnSeconds,...(classicDamage?{damageMultiplier:1,maxHitHpFraction:1}:{})}};
 const seats=[{id:'trainer_red',actorId:'red'},{id:'trainer_blue',actorId:'blue'}];
 const send=(type,extra={})=>{const t=onEvent({state,event:{id:'event'+seq++,type,data:{},now:time,...extra},participants:[{id:'red',name:'Red'},{id:'blue',name:'Blue'}],participation:{seats},stage:{mode:'holding',anchorId:'start'},config,jobs:[]});for(const k of ['public','server'])if(t[k])state[k]=t[k];effects.push(...(t.effects||[]));return t;};
 const act=(actorId,actionId,data)=>send('action',{actorId,actionId,data});
 const complete=()=>{const jobId=(state.server.pending||state.server.opening||state.server.ending)?.jobId;if(jobId)send('job.ready',{data:{jobId,data:{playbackCompleted:true}}});};
 const play=()=>send('playback.started',{data:{jobId:state.server.pending.jobId}});
 const impact=()=>{time+=1801;send('timer',{data:{kind:'impact',jobId:state.server.pending.jobId}});};
 send('session.started');send('seat.claimed');state.server.seed=seed;
 act('red','ready_battle',{pokemonIndex:red});act('blue','ready_battle',{pokemonIndex:blue});if(!opening)complete();
 return {get state(){return state;},effects,act,send,complete,play,impact,time:ms=>time+=ms};
}
test('both trainers keep their send-out choreography, including the action that starts battle',()=>{
 const f=fixture();const directions=f.effects.filter(e=>e.type==='live.direction');
 const red=directions.find(e=>e.requiredOutcome.kind==='pokemon.selected').requiredOutcome;
 const blue=directions.find(e=>e.requiredOutcome.kind==='battle.start').requiredOutcome;
 for(const [outcome,side,name]of [[red,'trainer_red','Pikachu'],[blue,'trainer_blue','Blastoise']]){
  assert.equal(outcome.trainerDialogue.side,side);assert.equal(outcome.trainerDialogue.line,name+', I choose you!');
  assert.match(outcome.visualAction,/throws one red-and-white Poké Ball/);assert.match(outcome.visualAction,/already present in the starting frame/);
  assert.match(outcome.visualAction,/Keep the opposite side unchanged/);assert.equal(outcome.delivery.showOnce,true);
 }
 assert.match(blue.visualAction,/battle is starting/);assert.equal(f.state.public.phase,'battle');
});
test('battle begins is announced only after observed opening completion, with urgent send-outs kept in order',()=>{
 const f=fixture({opening:true,turnSeconds:5});
 const opening=f.state.server.opening.jobId;
 const sendouts=f.effects.filter(e=>['pokemon.selected','battle.start'].includes(e.requiredOutcome?.kind));
 assert.equal(sendouts.length,2);
 assert.ok(sendouts.every(e=>e.delivery.priority==='urgent'&&!e.delivery.replaceable&&e.delivery.targetLatencyMs===5000));
 assert.equal(sendouts[0].guard.value,sendouts[1].guard.value,'The second send-out cannot invalidate the earlier urgent action');
 const begins=()=>f.state.public.announcements.filter(n=>n.kind==='battle.start').length;
 assert.equal(begins(),0);assert.equal(f.state.public.deadline,0);
 f.send('job.ready',{data:{jobId:opening}});assert.equal(begins(),0,'Generation readiness is not playback completion');
 f.send('playback.started',{data:{jobId:opening}});assert.equal(begins(),0);
 f.send('playback.completed',{data:{jobId:sendouts[0].id}});assert.equal(begins(),0);
 f.send('playback.completed',{data:{jobId:opening}});assert.equal(begins(),1);
 assert.equal(f.state.public.deadline,1_005_000);
 f.send('playback.completed',{data:{jobId:opening}});assert.equal(begins(),1);
});
test('attack delivery keeps the trainer selection timestamp through simultaneous lock-in',()=>{
 const f=fixture();f.act('red','battle_move',{moveIndex:3});f.time(2500);
 const effect=f.act('blue','battle_move',{moveIndex:0}).effects.find(e=>e.type==='live.direction');
 assert.equal(effect.delivery.priority,'urgent');assert.equal(effect.delivery.selectedAtMs,1_000_000);
 assert.equal(effect.delivery.replaceable,false);assert.equal(effect.frameMode,'continue','Missing cached frames never delay accepted attacks');
});
test('accepted moves carry one command from their acting trainer, while fainting uses the defeated trainer after impact',()=>{
 const f=fixture();f.act('red','battle_move',{moveIndex:0});
 const move=f.act('blue','battle_move',{moveIndex:0}).effects.find(e=>e.type==='live.direction').requiredOutcome;
 assert.equal(move.trainerDialogue.line,'Pikachu, use Thunderbolt!');assert.equal(move.trainerDialogue.side,'trainer_red');assert.equal(move.trainerDialogue.cue,'opening');
 assert.doesNotMatch(move.visualAction,/silent|mouth closed/);
 assert.match(move.visualAction,/Explosive acceleration/);assert.match(move.visualAction,/beautiful volumetric light/);assert.match(move.visualAction,/at most two total/);
 const k=fixture({red:6,blue:3});k.state.public.fighters.red.hp=1;
 k.act('red','battle_move',{moveIndex:0});
 const knockout=k.act('blue','battle_move',{moveIndex:3}).effects.find(e=>e.type==='live.direction').requiredOutcome;
 assert.equal(knockout.trainerDialogue.side,'trainer_red');assert.equal(knockout.trainerDialogue.cue,'after_impact');assert.equal(knockout.trainerDialogue.line,'Gyarados, you did great!');
 assert.match(knockout.visualAction,/After the accepted impact, Gyarados on trainer_red wobbles/);assert.match(knockout.visualAction,/kneels beside it on the same side/);
 assert.equal(knockout.fighters.find(f=>f.side==='trainer_red').hp,0);assert.equal(knockout.result.pokemon,'Pikachu');
});
test('a knockout lingers, completes a linked Poké Ball recall, then releases the defeated trainer',()=>{
 const f=fixture({red:6,blue:3});f.state.public.fighters.red.hp=1;
 f.act('red','battle_move',{moveIndex:0});f.act('blue','battle_move',{moveIndex:3});
 assert.equal(f.effects.some(e=>e.type==='players.release'),false);
 f.complete();
 const hold=f.effects.find(e=>e.requiredOutcome?.kind==='battle.fainted_hold');assert.ok(hold);
 assert.equal(hold.requiredOutcome.delivery.chunkDurationSeconds,124/24);
 assert.match(hold.requiredOutcome.visualAction,/entire 5.17-second shot/);
 assert.match(hold.requiredOutcome.visualAction,/gentle|gently breathes/);
 assert.equal(f.effects.some(e=>e.requiredOutcome?.kind==='battle.recall'),false);
 f.send('job.ready',{data:{jobId:hold.id,data:{playbackCompleted:false}}});
 assert.equal(f.state.server.ending.jobId,hold.id,'Preparing a shot cannot count as observed playback');
 f.complete();
 const recall=f.effects.find(e=>e.requiredOutcome?.kind==='battle.recall');assert.ok(recall);
 assert.equal(recall.continuity,'linked');assert.equal(recall.frameRef,undefined);
 assert.match(recall.requiredOutcome.visualAction,/First two seconds/);assert.match(recall.requiredOutcome.visualAction,/flows|flowing completely into the ball/);
 assert.match(recall.requiredOutcome.visualAction,/Final second: the ball closes/);
 assert.deepEqual(Array.from(recall.requiredOutcome.recalledSides),['trainer_red']);
 assert.equal(f.effects.some(e=>e.type==='players.release'),false);
 f.send('timer',{data:{kind:'result-release',jobId:hold.id}});
 assert.equal(f.state.server.ending.jobId,recall.id,'An old hold timeout cannot interrupt recall');
 f.complete();
 assert.deepEqual(Array.from(f.effects.filter(e=>e.type==='players.release'),e=>e.seatId),['trainer_red']);
 assert.equal(f.state.server.ending.step,2);
});
test('failed or timed-out ending shots have a bounded path to the next challenger',()=>{
 for(const failure of ['job.failed','job.skipped','job.cancelled','timeout']){
  const f=fixture({red:6,blue:3});f.state.public.fighters.red.hp=1;
  f.act('red','battle_move',{moveIndex:0});f.act('blue','battle_move',{moveIndex:3});f.complete();
  const hold=f.state.server.ending.jobId;
  if(failure==='timeout'){f.time(90001);f.send('timer',{data:{kind:'result-release',jobId:hold}});}else f.send(failure,{data:{jobId:hold}});
  assert.equal(f.state.public.videoQueue.kind,'battle.recall');assert.equal(f.effects.some(e=>e.type==='players.release'),false);
  const recall=f.state.server.ending.jobId;f.time(90001);f.send('timer',{data:{kind:'result-release',jobId:recall}});
  assert.equal(f.effects.filter(e=>e.type==='players.release').length,1);
  f.send('timer',{data:{kind:'result-release',jobId:recall}});f.send('job.ready',{data:{jobId:hold,data:{playbackCompleted:true}}});
  assert.equal(f.effects.filter(e=>e.type==='players.release').length,1,'Late completions cannot replay the ending or release twice');
 }
});
test('battle shots and setup settings retain an elevated downward camera and opposite quadrants',()=>{
 const f=fixture();
 for(const effect of f.effects.filter(e=>e.type==='live.direction')){
  assert.match(effect.intent,/downward 65 degrees/);assert.match(effect.intent,/LOWER-LEFT/);assert.match(effect.intent,/UPPER-RIGHT/);
 }
 const manifest=JSON.parse(fs.readFileSync(new URL('./genesis.json',import.meta.url),'utf8'));
 for(const key of ['battleCamera','setupImagePrompt']){
  const setting=manifest.definition.genesis.config[key];assert.match(setting,/downward 65 degrees/);
  assert.match(setting,/x25%, y70%/);assert.match(setting,/x76%, y32%/);
  assert.equal(manifest.definition.genesis.configSchema[key].default,setting);
 }
});
test('both sent-out Pokémon open untimed commands immediately and scored attacks reduce HP after a long wait',()=>{
 const f=fixture({turnSeconds:0});assert.equal(f.state.public.phase,'battle');assert.equal(f.state.public.deadline,0);
 const before=f.state.public.fighters.blue.hp;
 f.time(180000);f.send('timer',{data:{kind:'watch'}});assert.equal(f.state.public.phase,'battle');
 f.act('red','battle_move',{moveIndex:0});f.act('blue','battle_move',{moveIndex:0});
 assert.ok(f.state.public.fighters.blue.hp<before);assert.equal(f.state.public.fighters.red.moves[0].pp,14);
 assert.equal(f.state.public.practiceCount,0);
});
test('stats and moves are stable, commands private, second command resolves by Speed',()=>{
 const f=fixture();assert.equal(f.state.public.round,1);assert.equal(f.state.public.fighters.red.maxHp,110);assert.equal(f.state.public.fighters.red.stats.speed,110);
 f.act('blue','battle_move',{moveIndex:0});assert.equal(f.state.public.turn,0);assert.equal(f.state.public.phase,'battle');
 assert.equal(f.state.public.commandReady.blue,true);assert.equal('commands' in f.state.public,false);
 assert.throws(()=>f.act('blue','battle_move',{moveIndex:0}),/locked/);
 f.act('red','battle_move',{moveIndex:0});assert.equal(f.state.public.lastAction.actorId,'red');assert.equal(f.state.public.lastAction.name,'Thunderbolt');
 assert.equal(f.state.public.fighters.red.moves[0].pp,14);
});
test('full action queue stays private before lock-in and follows actual resolution order',()=>{
 const f=fixture();
 f.act('red','battle_move',{moveIndex:0});
 assert.equal(f.state.public.actionQueue.some(item=>item.label.includes('Thunderbolt')),false);
 f.act('blue','battle_move',{moveIndex:1});
 assert.deepEqual(Array.from(f.state.public.actionQueue,item=>item.label),['Pikachu · Thunderbolt','Blastoise · Surf']);
 assert.equal(f.state.public.actionQueue[1].status,'waiting');
 assert.equal(f.state.public.actionQueue.some(item=>'data' in item||'damage' in item),false);
 f.play();assert.equal(f.state.public.actionQueue[0].status,'playing');
 f.complete();assert.deepEqual(Array.from(f.state.public.actionQueue,item=>item.label),['Blastoise · Surf']);
 f.complete();
 if(f.state.public.lastResult){
  assert.equal(f.state.public.actionQueue[0].kind,'battle.fainted_hold');f.complete();
  assert.equal(f.state.public.actionQueue[0].kind,'battle.recall');f.complete();
 }
 assert.equal(f.state.public.actionQueue.length,0);
});
test('announcements preserve send-out and battle order, and playback cannot duplicate a move notice',()=>{
 const f=fixture();
 assert.deepEqual(Array.from(f.state.public.announcements,item=>item.text),['Sending out Pikachu!','Sending out Blastoise!','Battle begins!']);
 f.act('red','battle_move',{moveIndex:0});f.act('blue','battle_move',{moveIndex:0});
 const count=f.state.public.announcements.length;
 assert.equal(f.state.public.announcements.some(item=>item.kind==='battle.move'),false);
 f.play();assert.equal(f.state.public.announcements.length,count+1);
 assert.equal(f.state.public.announcements.at(-1).text,'Pikachu used Thunderbolt!');
 const id=f.state.public.announcements.at(-1).id;
 f.play();assert.equal(f.state.public.announcements.at(-1).id,id);
 f.impact();assert.equal(f.state.public.announcements.at(-1).id,id);
});
test('priority beats Speed and one-hit KO cancels the defeated command',()=>{
 const f=fixture({blue:4});f.state.public.fighters.blue.hp=1;
 f.act('blue','battle_move',{moveIndex:0});f.act('red','battle_move',{moveIndex:3});
 assert.equal(f.state.public.lastAction.actorId,'red');assert.equal(f.state.public.lastAction.name,'Quick Attack');
 // Ghost immunity is preserved, so use a non-Ghost fast opponent for the knockout.
 const k=fixture({red:6,blue:3});k.state.public.fighters.red.hp=1;
 k.act('red','battle_move',{moveIndex:0});k.act('blue','battle_move',{moveIndex:3});
 assert.equal(k.state.public.lastAction.actorId,'blue');assert.equal(k.state.public.lastResult.winnerId,'blue');assert.equal(k.state.public.turn,1);assert.equal(k.state.public.fighters.red.moves[0].pp,5);
});
test('queued health, result text and history reveal only on observed playback impact',()=>{
 const f=fixture();const hp=f.state.public.fighters.blue.hp;
 f.act('red','battle_move',{moveIndex:0});f.act('blue','battle_move',{moveIndex:0});
 assert.ok(f.state.public.fighters.blue.hp<hp);assert.equal(f.state.public.presentation.fighters.blue.hp,hp);
 assert.equal(f.state.public.presentation.lastAction,null);assert.equal(f.state.public.presentation.battleLog.some(x=>x.includes('lost')),false);
 const job=f.state.server.pending.jobId;f.send('playback.started',{data:{jobId:'stale'}});assert.equal(f.state.server.revealPending.started,false);
 f.play();assert.equal(f.state.public.videoQueue.status,'playing');assert.equal(f.state.public.presentation.fighters.blue.hp,hp);
 f.impact();assert.equal(f.state.public.presentation.fighters.blue.hp,f.state.public.fighters.blue.hp);
 assert.equal(f.state.public.presentation.lastAction.id,f.state.public.lastAction.id);
 const seed=f.state.server.seed;f.play();f.impact();assert.equal(f.state.server.seed,seed,'Playback never rerolls battle results');
 f.complete();assert.equal(f.state.public.lastAction.actorId,'blue');assert.equal(f.state.public.phase,'animating');f.complete();assert.equal(f.state.public.round,2);
});
test('failure and timeout reveal committed HP and continue, stale impact cannot affect a new move',()=>{
 for(const failure of ['job.failed','job.skipped','job.cancelled','timeout']){
  const f=fixture();f.act('red','battle_move',{moveIndex:0});f.act('blue','battle_move',{moveIndex:0});const jobId=f.state.server.pending.jobId;
  if(failure==='timeout'){f.time(120001);f.send('timer',{data:{kind:'watch'}});}else f.send(failure,{data:{jobId}});
  assert.equal(f.state.public.presentation.fighters.blue.hp,f.state.public.fighters.blue.hp);
  const next=f.state.server.revealPending?.jobId;f.send('timer',{data:{kind:'impact',jobId}});assert.equal(f.state.server.revealPending?.jobId,next);
 }
});
test('seeded resolution is reproducible; accuracy, criticals and 39 damage rolls vary across seeds',()=>{
 function hit(seed,move=0,red=3,blue=1){const f=fixture({animate:false,seed,red,blue});f.act('red','battle_move',{moveIndex:move});f.act('blue','battle_move',{moveIndex:0});return f.state.public.battleLog.join('\n');}
 assert.equal(hit(128),hit(128));const logs=Array.from({length:160},(_,i)=>hit(i+1,1));
 assert.ok(logs.some(x=>x.includes('missed')));assert.ok(logs.some(x=>x.includes('critical hit')));
 assert.ok(new Set(logs.map(x=>x.match(/BLASTOISE lost (\d+)/)?.[1]).filter(Boolean)).size>5);
});
test('dual types multiply, immunity deals zero; Struggle works with exhausted PP',()=>{
 const f=fixture({animate:false,blue:6});f.state.public.fighters.blue.types=['Ground'];f.act('red','battle_move',{moveIndex:0});f.act('blue','use_item',{itemIndex:2});assert.equal(f.state.public.fighters.blue.hp,f.state.public.fighters.blue.maxHp);
 assert.match(f.state.public.battleLog.join('\n'),/no effect/);
 const s=fixture({animate:false});s.state.public.fighters.red.moves.forEach(m=>m.pp=0);s.act('red','battle_move',{moveIndex:0});s.act('blue','battle_move',{moveIndex:0});assert.match(s.state.public.battleLog.join('\n'),/STRUGGLE/);
});
test('charging consumes PP once and forces the same move next round',()=>{
 const f=fixture({animate:false,red:2});f.act('red','battle_move',{moveIndex:0});f.act('blue','use_item',{itemIndex:2});
 assert.equal(f.state.public.fighters.red.chargingMove.index,0);assert.equal(f.state.public.fighters.red.moves[0].pp,9);
 f.act('red','battle_move',{moveIndex:2});f.act('blue','use_item',{itemIndex:4});
 assert.equal(f.state.public.fighters.red.moves[0].pp,9);assert.equal(f.state.public.fighters.red.chargingMove,null);
});
test('level, stats, STAB, weakness and integer variance match the expected damage interval',()=>{
 for(let seed=1;seed<=80;seed++){
  const f=fixture({seed,classicDamage:true});f.act('red','battle_move',{moveIndex:0});f.act('blue','use_item',{itemIndex:2});
  f.complete();const action=f.state.public.lastAction;
  assert.equal(action.actorId,'red');assert.equal(action.effectiveness,2);
  if(action.criticalHit)assert.ok(action.damage>=139&&action.damage<=154,JSON.stringify(action));
  else assert.ok(action.damage>=73&&action.damage<=86,JSON.stringify(action));
 }
});
test('same-Speed rounds use a random tie break; paralysis changes order',()=>{
 const first=new Set();for(let seed=1;seed<=60;seed++){
  const f=fixture({blue:3,seed:seed*1000});f.act('red','battle_move',{moveIndex:3});f.act('blue','battle_move',{moveIndex:3});first.add(f.state.public.lastAction.actorId);
 }
 assert.equal(first.size,2);
 const f=fixture();f.state.public.fighters.red.status='paralysis';f.act('red','battle_move',{moveIndex:0});f.act('blue','battle_move',{moveIndex:1});assert.equal(f.state.public.lastAction.actorId,'blue');
});

test('accepted battle direction uses the exact configured chunk duration',()=>{
 const f=fixture();f.act('red','battle_move',{moveIndex:0});
 const transition=f.act('blue','battle_move',{moveIndex:0});
 const direction=transition.effects.find(effect=>effect.type==='live.direction');
 assert.equal(direction.requiredOutcome.delivery.chunkDurationSeconds,124/24);
 assert.equal(direction.requiredOutcome.delivery.expectedDelaySeconds,undefined);
});


test('each battle opening is a new live direction, and queued commands preserve its full playback',()=>{
 const f=fixture({opening:true});
 const opening=f.state.server.opening.jobId;
 assert.equal(f.state.public.battleIntro.status,'preparing');
 assert.equal(f.state.public.battleIntro.videoUrl,undefined);
 f.act('red','battle_move',{moveIndex:0});f.act('blue','battle_move',{moveIndex:0});
 assert.equal(f.state.public.lastAction,null,'An early attack cannot replace the generated opening');
 assert.equal(f.state.public.videoQueue.id,opening);
 assert.equal(f.state.server.roundQueue.length,2);
 f.send('playback.started',{data:{jobId:opening}});
 assert.equal(f.state.public.battleIntro.status,'playing');
 f.complete();assert.equal(f.state.public.battleIntro.status,'complete');
 assert.equal(f.state.public.lastAction.name,'Thunderbolt');
 assert.equal(f.state.server.roundQueue.length,1);
});
test('opening failure and timeout release queued commands without replaying the opening',()=>{
 for(const failure of ['job.failed','timeout']){
  const f=fixture({opening:true}),jobId=f.state.server.opening.jobId;
  f.act('red','battle_move',{moveIndex:0});f.act('blue','battle_move',{moveIndex:0});
  if(failure==='timeout')f.send('timer',{data:{kind:'opening-timeout',jobId}});else f.send(failure,{data:{jobId}});
  assert.equal(f.state.server.opening,null);assert.equal(f.state.public.battleIntro.status,'unavailable');
  assert.ok(f.state.public.lastAction);const action=f.state.public.lastAction.id;
  f.send('job.ready',{data:{jobId}});assert.equal(f.state.public.lastAction.id,action);
 }
});
test('all available species and moves come from the original generation, with realistic appearance hints',()=>{
 const f=fixture();assert.deepEqual(Array.from(f.state.public.pokemonChoices,p=>p.name),['Charizard','Blastoise','Venusaur','Pikachu','Gengar','Machamp','Gyarados','Alakazam']);
 assert.match(f.state.public.fighters.red.appearance,/realistic fur/);
});
test('default attacks are gentler and a single critical or super-effective hit removes at most 30 percent of full HP',()=>{
 for(let seed=1;seed<=80;seed++){
  const f=fixture({seed}),classic=fixture({seed,classicDamage:true});
  for(const battle of [f,classic]){battle.act('red','battle_move',{moveIndex:0});battle.act('blue','use_item',{itemIndex:2});battle.complete();}
  const move=f.state.public.lastAction,old=classic.state.public.lastAction;
  assert.equal(move.effectiveness,old.effectiveness);assert.equal(move.criticalHit,old.criticalHit);
  assert.ok(move.damage<=Math.floor(f.state.public.fighters.blue.maxHp*.3));
  assert.ok(move.damage<=Math.max(1,Math.floor(old.damage*.4)));
  assert.ok(f.state.public.fighters.blue.hp>0);
 }
});

test('five-second selection starts after opening playback and automatically locks available moves',()=>{
 const f=fixture({turnSeconds:5,opening:true});assert.equal(f.state.public.deadline,0);
 f.time(20000);f.complete();assert.equal(f.state.public.deadline,1025000);
 f.act('red','preview_move',{moveIndex:3});assert.equal(f.state.server.previews.red,3);assert.equal(f.state.public.fighters.red.selectedMoveIndex,0);
 const timer=f.effects.findLast(e=>e.data?.kind==='command-timeout');assert.equal(timer.delayMs,5000);
 f.time(4999);f.send('timer',{data:{kind:'command-timeout'}});assert.equal(f.state.public.phase,'battle');
 f.time(1);f.send('timer',{data:{kind:'command-timeout'}});assert.equal(f.state.public.phase,'animating');assert.equal(f.state.public.lastAction.name,'Quick Attack');assert.equal(f.state.server.roundQueue[0].actorId,'blue');
 f.play();f.complete();f.play();f.complete();assert.equal(f.state.public.phase,'battle');assert.equal(f.state.public.deadline,1030000);
});
test('timeout preserves a submitted command and falls back when the selected move has no PP',()=>{
 const f=fixture({turnSeconds:5});f.act('red','battle_move',{moveIndex:3});f.act('blue','preview_move',{moveIndex:0});f.state.public.fighters.blue.moves[0].pp=0;
 f.time(5000);f.send('timer',{data:{kind:'command-timeout'}});assert.equal(f.state.public.lastAction.name,'Quick Attack');assert.equal(f.state.server.roundQueue[0].data.moveIndex,1);assert.equal(f.state.public.phase,'animating');
});
