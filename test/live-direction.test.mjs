import test from 'node:test';
import assert from 'node:assert/strict';
import {createGenesisProject, createGenesisState, applyGenesisTransition, GenesisHost, defaultGenesisHostPolicy} from '../dist/index.js';

test('a newer guarded direction supersedes a running direction without hiding controls or reserving more cost', () => {
  const project=createGenesisProject('decisions'), def=project.definition;
  def.genesis.capabilities=['live.direction'];
  let state=createGenesisState(def);const stage=structuredClone(state.stage);
  state=applyGenesisTransition(def,state,{id:'first',type:'timer',now:1},{server:{selected:'Charizard'},effects:[{id:'old-selection',type:'live.direction',intent:'Show Charizard.',guard:{key:'selected',value:'Charizard'}}]},defaultGenesisHostPolicy);
  state.jobs[0].status='running';
  state=applyGenesisTransition(def,state,{id:'second',type:'timer',now:2},{server:{selected:'Pikachu'},effects:[{id:'new-selection',type:'live.direction',intent:'Show Pikachu.',guard:{key:'selected',value:'Pikachu'}}]},defaultGenesisHostPolicy);
  assert.equal(state.jobs[0].status,'cancelled');assert.equal(state.jobs[1].status,'queued');
  assert.equal(state.reservedCostUsd,0);assert.deepEqual(state.stage,stage);
});

test('continuous directions keep the HUD and stage visible without a second media reservation', () => {
  const project=createGenesisProject('decisions'), def=project.definition;
  def.genesis.capabilities=['live.direction'];
  let state=createGenesisState(def); const stage=structuredClone(state.stage);
  for(let i=0;i<150;i++) {
    state=applyGenesisTransition(def,state,{id:'event:'+i,type:'timer',now:i+1},{effects:[{id:'direction:'+i,type:'live.direction',intent:'Depict this accepted move.'}]},defaultGenesisHostPolicy);
    assert.equal(state.jobs.at(-1).maxCostUsd,0); assert.deepEqual(state.stage,stage);
    state.jobs.at(-1).status='ready';
  }
  assert.equal(state.reservedCostUsd,0); assert.ok(state.jobs.length<128);
});

test('a direction provider completes from playback data without requiring a media checkpoint', async () => {
  const p=createGenesisProject('decisions');p.definition.genesis.capabilities=['live.direction'];
  p.controllerSource="function onEvent({event}){if(event.type==='session.started')return {window:{id:'w',mode:'individual',actionIds:['choose']}};if(event.type==='action')return {window:null,effects:[{id:'move',type:'live.direction',intent:'Accepted attack'}]};if(event.type==='job.ready')return {public:{played:event.data.data.playbackCompleted}};return {}}";
  const provider={id:'stream',paid:false,capabilities:['live.direction'],start:async()=>({id:'stream-move'}),poll:async()=>({status:'ready',result:{data:{playbackCompleted:true}}})};
  const host=await new GenesisHost('continuous',p,{providers:[provider]}).initialize();await host.join('one','One');await host.join('two','Two');
  await host.action('one','move','choose',{optionId:'attack'},host.view('one').genesis.revision);
  assert.equal(host.view('one').genesis.stage.overlays,true);
  await host.runJob('one','move');await host.tick();
  assert.equal(host.view('one').genesis.state.played,true);assert.equal(host.view('one').genesis.jobs.at(-1).status,'ready');
});
