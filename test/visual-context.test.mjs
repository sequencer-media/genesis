import test from 'node:test';
import assert from 'node:assert/strict';
import {createGenesisProject} from '../dist/index.js';
import {createGenesisState, applyGenesisTransition} from '../dist/genesisCore.js';
import {createExperienceSessionState} from '../dist/experienceSessionCore.js';
import {settleGenesisJob,retryGenesisJob} from '../dist/genesisRuntime.js';

test('background image jobs preserve stage and accepted references, then settle into an anchor',async()=>{
 const p=createGenesisProject('decisions'),def=p.definition;
 def.genesis.capabilities.push('image.request');
 const state=createGenesisState(def,'https://storage.googleapis.com/example/start.png');
 state.stage.mode='playing';state.stage.videoUrl='https://storage.googleapis.com/example/video.mp4';
 const next=applyGenesisTransition(def,state,{id:'generate',type:'action',data:{},now:1000},{effects:[{id:'image',type:'image.request',intent:'Prepare roster',presentation:'background',referenceAnchorIds:['start'],maxCostUsd:.05}]});
 assert.deepEqual(next.stage,state.stage);
 const session=createExperienceSessionState(def,'v1',1,1000);session.genesis=next;
 const settled=await settleGenesisJob(def,session,'function onEvent(){return {}}','image',{imageUrl:'https://storage.googleapis.com/example/roster.png'},1001);
 assert.deepEqual(settled.genesis.stage,state.stage);
 assert.equal(settled.genesis.anchors['anchor:image'].imageUrl,'https://storage.googleapis.com/example/roster.png');
 const failed=structuredClone(session);failed.genesis.jobs[0].status='failed';
 assert.deepEqual(retryGenesisJob(failed,'image').genesis.stage,state.stage);
});
test('only explicit accepted anchors can reset a stream and references stay bounded',()=>{
 const p=createGenesisProject('decisions'),def=p.definition;def.genesis.capabilities.push('live.direction');
 const state=createGenesisState(def),event={id:'event',type:'action',data:{},now:1000};
 const effect={id:'reset',type:'live.direction',intent:'Accepted roster',continuity:'reanchor'};
 assert.throws(()=>applyGenesisTransition(def,state,event,{effects:[effect]}),/accepted scene anchor/);
 assert.throws(()=>applyGenesisTransition(def,state,event,{effects:[{...effect,anchorId:'unknown'}]}),/existing scene anchor/);
 assert.throws(()=>applyGenesisTransition(def,state,event,{effects:[{...effect,anchorId:'start',referenceAnchorIds:Array(5).fill('start')}]}),/four/);
 const next=applyGenesisTransition(def,state,event,{effects:[{...effect,anchorId:'start'}]});
 assert.equal(next.jobs[0].effect.continuity,'reanchor');
});

test('one background frame and one live direction overlap without admitting a second paid tool',()=>{
 const def=createGenesisProject('decisions').definition;def.genesis.capabilities.push('image.request','live.direction');
 const image={id:'image',type:'image.request',intent:'Prepare lineup',presentation:'background',maxCostUsd:.05};
 const direction={id:'direction',type:'live.direction',intent:'Perform the accepted move now',continuity:'linked'};
 for(const effects of [[image,direction],[direction,image]]){
  const next=applyGenesisTransition(def,createGenesisState(def),{id:'event',type:'action',data:{},now:1000},{effects});
  assert.equal(next.jobs.length,2);assert.equal(next.reservedCostUsd,.05);assert.equal(next.stage.mode,'holding');
  assert.throws(()=>applyGenesisTransition(def,next,{id:'another',type:'action',data:{},now:1001},{effects:[{...image,id:'second-image'}]}),/active tool/);
  assert.throws(()=>applyGenesisTransition(def,next,{id:'another',type:'action',data:{},now:1001},{effects:[{...direction,id:'second-direction'}]}),/active tool/);
 }
});

test('standalone text-to-video explicitly opts out of frame conditioning without accepting conflicting anchors',()=>{
 const def=createGenesisProject('decisions').definition;def.genesis.capabilities.push('scene.request','live.direction');const state=createGenesisState(def),event={id:'fresh',type:'action',data:{},now:1000};
 const effect={id:'intro',type:'scene.request',intent:'Five-second abstract battle intro. No words are spoken.',duration:5,useStartFrame:false};
 const next=applyGenesisTransition(def,state,event,{effects:[effect]});assert.equal(next.jobs[0].effect.useStartFrame,false);
 for(const fields of [{anchorId:'start'},{referenceAnchorIds:['start']},{continuity:'linked'},{type:'live.direction'}])assert.throws(()=>applyGenesisTransition(def,state,event,{effects:[{...effect,...fields}]}),/Text-to-video/);
});
