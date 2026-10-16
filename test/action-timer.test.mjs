import test from 'node:test';
import assert from 'node:assert/strict';
import {GenesisHost,createGenesisProject} from '../dist/index.js';
import {submitGenesisAction} from '../dist/genesisRuntime.js';

async function fixture(changeWindow=false){
 const project=createGenesisProject('decisions');
 project.controllerSource=`function onEvent({event,state}){
  if(event.type==='session.started')return {window:{id:'pick',mode:'individual',actorIds:['one'],actionIds:['choose']},effects:[{id:'prepare',type:'timer.set',delayMs:1000,data:{}}]};
  if(event.type==='timer')return {public:{prepared:true}${changeWindow?",window:{id:'new-pick',mode:'individual',actorIds:['one'],actionIds:['choose']}":''}};
  if(event.type==='action')return {public:{...state.public,selected:event.data.optionId}};
  return {};
 }`;
 const host=await new GenesisHost('timer-race',project).initialize();await host.join('one','One');await host.join('two','Two');
 const state=structuredClone(host.diagnostics().state);state.genesis.timers[0].dueAt=Date.now()-1;
 return {project,state,revision:state.genesis.revision};
}
test('a fresh click survives a due preparation timer in the same decision window',async()=>{
 const {project,state,revision}=await fixture();
 const result=await submitGenesisAction(project.definition,state,project.controllerSource,'one','click','choose',{optionId:'attack'},revision);
 assert.equal(result.genesis.public.prepared,true);assert.equal(result.genesis.public.selected,'attack');assert.equal(result.genesis.timers.length,0);
});
test('timer handling still rejects stale revisions, other actors and changed decision windows',async()=>{
 const {project,state,revision}=await fixture();
 await assert.rejects(submitGenesisAction(project.definition,state,project.controllerSource,'one','stale','choose',{optionId:'attack'},revision-1),/scene changed/);
 await assert.rejects(submitGenesisAction(project.definition,state,project.controllerSource,'two','other','choose',{optionId:'attack'},revision),/another participant/i);
 const changed=await fixture(true);
 await assert.rejects(submitGenesisAction(changed.project.definition,changed.state,changed.project.controllerSource,'one','changed','choose',{optionId:'attack'},changed.revision),/scene changed/);
});
