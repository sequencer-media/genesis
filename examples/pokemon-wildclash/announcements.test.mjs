import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./interface.html',import.meta.url),'utf8');
function fixture(){
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{hidden:true,dataset:{},classList:{add(){}},pause(){},offsetWidth:100});return elements.get(id);};
 let timer=0;const callbacks=new Map();
 const context={Date,Set,performance,clearTimeout:id=>callbacks.delete(id),setTimeout:fn=>{callbacks.set(++timer,fn);return timer;},el,document:{body:{classList:{add(){},remove(){}}}},window:{matchMedia:()=>({matches:true})},currentGame:{announcements:[],fighters:{}}};
 const a=source.indexOf('    var announcementSeen ='),b=source.indexOf('    function renderActionQueue',a);
 vm.createContext(context);vm.runInContext(source.slice(a,b),context);
 return {context,el,render:()=>context.renderAnnouncements(),dismiss:()=>context.dismissAnnouncement()};
}
const notice=(id,text,kind='pokemon.selected',age=0)=>({id,text,kind,at:Date.now()-age});
test('the first authoritative batch presents both send-outs and battle start in order',()=>{
 const f=fixture();f.render();
 f.context.currentGame.announcements=[notice('1','Sending out Pikachu!'),notice('2','Sending out Blastoise!'),notice('3','Battle begins!','battle.start')];
 f.render();assert.equal(f.el('battleAnnouncementText').textContent,'Sending out Pikachu!');
 f.render();f.dismiss();assert.equal(f.el('battleAnnouncementText').textContent,'Sending out Blastoise!');
 f.dismiss();assert.equal(f.el('battleAnnouncementText').textContent,'Battle begins!');assert.equal(f.el('battleIntro').hidden,true,'Messages never play a cached intro');
 f.dismiss();assert.equal(f.el('battleIntro').hidden,true);assert.equal(f.el('battleAnnouncement').hidden,true);
 f.render();assert.equal(f.el('battleAnnouncement').hidden,true,'Repeated state cannot replay notices');
});
test('a received battle-start notice waits while send-out playback is preparing or playing',()=>{
 const f=fixture();f.context.currentGame.battleIntro={status:'preparing'};
 f.context.currentGame.announcements=[notice('battle','Battle begins!','battle.start')];
 f.render();assert.equal(f.el('battleAnnouncement').hidden,true);
 f.context.currentGame.battleIntro.status='playing';f.render();assert.equal(f.el('battleAnnouncement').hidden,true);
 f.context.currentGame.battleIntro.status='complete';f.render();assert.equal(f.el('battleAnnouncementText').textContent,'Battle begins!');
});
test('slow delivery and trainer switches retain unseen messages while stale reconnect history stays quiet',()=>{
 const f=fixture();f.context.currentGame.announcements=[notice('old','Old battle','battle.start',120000)];f.render();assert.equal(f.el('battleAnnouncement').hidden,true);
 f.context.currentGame.announcements.push(notice('fresh','Sending out Garchomp!','pokemon.selected',30000));f.render();assert.equal(f.el('battleAnnouncementText').textContent,'Sending out Garchomp!');
 f.context.currentGame.announcements.push(notice('second','Sending out Gengar!','pokemon.selected',25000),notice('battle','Battle begins!','battle.start',25000));f.render();f.dismiss();assert.equal(f.el('battleAnnouncementText').textContent,'Sending out Gengar!');f.dismiss();assert.equal(f.el('battleAnnouncementText').textContent,'Battle begins!');
});

test('send-out retries a rejected stale revision after background setup settles, preserving the chosen Pokémon',async()=>{
 const a=source.indexOf('    async function submitSendOut('),b=source.indexOf('    function confirmSelectedMove',a);
 let revision=1,calls=0;const context={Genesis:{get context(){return {revision,actorId:'red'};},state:{get:()=>({phase:'setup'})},action:async(id,data)=>{calls++;assert.equal(id,'ready_battle');assert.equal(data.pokemonIndex,3);if(calls===1)throw Error('The scene changed. Refresh before acting.');}},waitForHost:async predicate=>{revision++;assert.equal(predicate(),true);}};
 vm.createContext(context);vm.runInContext(source.slice(a,b),context);await context.submitSendOut(3,'red');assert.equal(calls,2);
 context.Genesis.action=async()=>{calls++;throw Error('Your trainer is unavailable.');};await assert.rejects(context.submitSendOut(3,'red'),/unavailable/);assert.equal(calls,3,'Other failures never retry');
});

test('matchup banner follows actual fresh opening playback and preparing feedback clears on playback',()=>{
 const f=fixture();f.context.currentGame.battleIntro={id:'match:1',status:'preparing'};
 f.context.currentGame.videoQueue={kind:'battle.start',status:'queued for video'};f.context.renderFreshOpening();
 assert.equal(f.el('battleIntro').hidden,true);assert.equal(f.el('directionWait').hidden,false);
 f.context.currentGame.battleIntro.status='playing';f.context.currentGame.videoQueue.status='playing';f.context.renderFreshOpening();
 assert.equal(f.el('battleIntro').hidden,false);assert.equal(f.el('directionWait').hidden,true);
 f.context.stopBattleIntro();f.context.renderFreshOpening();assert.equal(f.el('battleIntro').hidden,true,'A state refresh does not replay the banner');
 assert.doesNotMatch(source,/battle-intro\.mp4|battleIntroVideo/);
});

test('the queue countdown uses server time and elapsed time, then follows playback and clears',()=>{
 const elements=new Map();
 const node=()=>({dataset:{},children:[],setAttribute(){},appendChild(item){this.children.push(item);},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},querySelectorAll(){return [];}});
 const el=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);};
 let elapsed=1000;
 const queue={version:1,serverNow:10000,items:[{id:'move',label:'Thunderbolt',position:1,status:'preparing',estimatedStartAt:22000}]};
 const Genesis={queue:{get:()=>queue}};
 const context={Date:{now:()=>900000000},Set,performance:{now:()=>elapsed},queueSignature:'',currentGame:{phase:'battle',commandReady:{}},Genesis,window:{Genesis},document:{createElement:node},el};
 const a=source.indexOf('    var queueReceivedAt='),b=source.indexOf('    setInterval(function(){if(window.Genesis',a);
 vm.createContext(context);vm.runInContext(source.slice(a,b),context);
 const status=()=>el('actionQueue').children[0].children[2].textContent;
 context.mySeat={actorId:'red'};context.myFighter={name:'Pikachu'};context.currentGame.deadline=15000;context.renderCommandTimer();assert.equal(el('commandTimer').textContent,'5S');
 context.renderActionQueue(null);assert.equal(status(),'IN ~12S');
 elapsed+=3000;context.renderActionQueue(null);assert.equal(status(),'IN ~9S','Repeated state renders never reset elapsed time');context.renderCommandTimer();assert.equal(el('commandTimer').textContent,'2S');context.currentGame.commandReady.red=true;context.renderCommandTimer();assert.equal(el('commandTimer').textContent,'LOCKED');
 queue.serverNow=13000;context.renderActionQueue(null);assert.equal(status(),'IN ~9S','Fresh server clocks preserve the countdown');
 elapsed+=10000;context.renderActionQueue(null);assert.equal(status(),'PREPARING','A missed forecast does not pretend playback began');
 queue.items[0].status='playing';context.renderActionQueue(null);assert.equal(status(),'PLAYING');
 queue.items=[];context.renderActionQueue(null);assert.equal(el('queueCount').textContent,'0');assert.equal(el('actionQueue').children.length,0);assert.equal(el('queueEmpty').hidden,false);
});


test('sequential command menus follow the active trainer and wait through opening and attack playback',()=>{
 const a=source.indexOf('    function commandMenuVisible('),b=source.indexOf('    function showMoveMenu(',a);
 const context={currentGame:{phase:'battle',sequentialTurns:true,activeTurnActorId:'red',battleIntro:{status:'preparing'}},mySeat:{actorId:'red'},beforeBattle(){return ['waiting','setup'].includes(this.currentGame.phase);}};
 context.beforeBattle=()=>['waiting','setup'].includes(context.currentGame.phase);vm.createContext(context);vm.runInContext(source.slice(a,b),context);
 assert.equal(context.commandMenuVisible(),false);context.currentGame.battleIntro.status='playing';assert.equal(context.commandMenuVisible(),false);
 context.currentGame.battleIntro.status='complete';assert.equal(context.commandMenuVisible(),true);
 context.mySeat.actorId='blue';assert.equal(context.commandMenuVisible(),false);
 context.currentGame.phase='animating';context.currentGame.activeTurnActorId=null;assert.equal(context.commandMenuVisible(),false);
 context.currentGame.phase='battle';context.currentGame.activeTurnActorId='blue';assert.equal(context.commandMenuVisible(),true);
 context.currentGame.phase='setup';assert.equal(context.commandMenuVisible(),true);
});
test('one account follows the next owned trainer only after playback, with one control request',async()=>{
 const a=source.indexOf('    var autoSwitching=false;'),b=source.indexOf('    async function submitSendOut',a);
 let calls=0,finish;
 const context={currentGame:{sequentialTurns:true,phase:'battle',activeTurnActorId:'blue',battleIntro:{status:'complete'}},busy:false,mySeat:{actorId:'red'},playerState:{seats:[{actorId:'blue',id:'trainer_blue',canControl:true}]},handoffControl:()=>{calls++;return new Promise(resolve=>finish=resolve);},request:operation=>operation()};
 vm.createContext(context);vm.runInContext(source.slice(a,b),context);
 context.currentGame.phase='animating';context.followActiveTrainer();assert.equal(calls,0);
 context.currentGame.phase='battle';context.currentGame.battleIntro.status='playing';context.followActiveTrainer();assert.equal(calls,0);
 context.currentGame.battleIntro.status='complete';context.followActiveTrainer();context.followActiveTrainer();assert.equal(calls,1);
 context.mySeat.actorId='blue';finish();await Promise.resolve();context.followActiveTrainer();assert.equal(calls,1);
 context.mySeat.actorId='red';context.playerState.seats[0].canControl=false;context.followActiveTrainer();assert.equal(calls,1,'Another account’s trainer is never claimed');
});
test('the sequential decision timer reaches CHOOSE and never submits an automatic action',()=>{
 const a=source.indexOf('    function renderCommandTimer('),b=source.indexOf('    function renderActionQueue',a),elements=new Map();
 const context={Date,currentGame:{phase:'battle',sequentialTurns:true,deadline:5000},mySeat:{actorId:'red'},myFighter:{name:'Pikachu'},commandMenuVisible:()=>true,serverClock:()=>6000,el:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);}};
 vm.createContext(context);vm.runInContext(source.slice(a,b),context);context.renderCommandTimer();assert.equal(context.el('commandTimer').textContent,'CHOOSE');
});
