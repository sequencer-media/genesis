import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {GenesisHost,createGenesisProject} from '../dist/index.js';
import {createGenesisMcpServer} from '../dist/mcp.js';

async function fixture(operator=true,definition={}) {
 const project=createGenesisProject();project.definition.genesis.capabilities=['scene.request','image.request','live.direction'];Object.assign(project.definition.genesis,definition);
 if(definition.actions)project.controllerSource='function onEvent({state,participants}){return {public:state.public,window:{id:"typed-window",mode:"individual",actorIds:participants.map(p=>p.id),actionIds:["choose"]}};}';
 const host=await new GenesisHost('mcp-fixture',project).initialize();await host.join('agent','Agent');
 const server=createGenesisMcpServer(host,{actorId:'agent',operator});
 const client=new Client({name:'genesis-tests',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();
 await server.connect(a);await client.connect(b);
 const call=async(name,args={})=>{const result=await client.callTool({name,arguments:args});let data;try{data=JSON.parse(result.content[0].text);}catch{data={error:result.content[0].text};}return {...result,data};};
 return {host,client,call,close:async()=>{await client.close();await server.close();}};
}

test('MCP discovers real action schemas and rejects extra or out-of-range action data',async()=>{
 const f=await fixture(false,{controller:'custom',actions:[{id:'choose',inputBindingId:'exploration_target',label:'Choose direction',fields:{amount:{type:'number',required:true,min:1,max:3}}}]});
 try{
  const tools=(await f.client.listTools()).tools,action=tools.find(t=>t.name==='genesis_action_choose');assert.ok(action);
  assert.equal(action.inputSchema.properties.data.properties.amount.maximum,3);
  assert.ok(!tools.some(t=>t.name==='genesis_cache_image'||t.name==='genesis_apply_effect'));
  const invalid=await f.call('genesis_action_choose',{eventId:'a',expectedRevision:0,data:{amount:9,actorId:'someone'}});assert.equal(invalid.isError,true);
  const catalog=(await f.call('genesis_catalog')).data;assert.equal(catalog.operator,false);assert.equal(catalog.host,undefined);assert.deepEqual(catalog.controllerOnly,['players.release']);
  const view=(await f.call('genesis_read_world')).data;assert.equal(view.actorId,'agent');assert.equal(view.genesis.server,undefined);assert.equal(view.genesis.private,undefined);
 }finally{await f.close();}
});

test('operator cache and use-frame calls share the host, spend nothing, preserve rules and deduplicate requests',async()=>{
 const f=await fixture();try{
  const before=f.host.view('agent').genesis.state;
  let revision=f.host.operatorView().revision;
  const cached=await f.call('genesis_cache_image',{requestId:'cache-one',expectedRevision:revision,frame:{key:'arena',fingerprint:'two-fighters-v1',ttlMs:30000},imageUrl:'https://example.com/start.png'});
  assert.ok(!cached.isError,cached.content[0].text);assert.equal(cached.data.frames.arena.status,'ready');assert.equal(cached.data.jobs.length,0);assert.equal(cached.data.stage.anchorId,'start');assert.equal(cached.data.limits.reservedCostUsd,0);
  const duplicate=await f.call('genesis_cache_image',{requestId:'cache-one',expectedRevision:revision,frame:{key:'arena',fingerprint:'two-fighters-v1'},imageUrl:'https://example.com/start.png'});assert.equal(duplicate.data.revision,cached.data.revision);
  const stale=await f.call('genesis_use_frame',{requestId:'use-stale',expectedRevision:revision,frame:{key:'arena',fingerprint:'two-fighters-v1'},intent:'Hold the accepted two-fighter lineup.'});assert.equal(stale.isError,true);
  revision=cached.data.revision;
  const used=await f.call('genesis_use_frame',{requestId:'use-one',expectedRevision:revision,frame:{key:'arena',fingerprint:'two-fighters-v1'},intent:'Hold the accepted two-fighter lineup.'});assert.ok(!used.isError,used.content[0].text);
  const job=f.host.diagnostics().state.genesis.jobs.at(-1);assert.equal(job.effect.continuity,'reanchor');assert.equal(job.effect.anchorId,cached.data.frames.arena.anchorId);assert.equal(job.status,'queued');
  assert.deepEqual(f.host.view('agent').genesis.state,before);
  assert.equal((await f.call('genesis_use_frame',{requestId:'use-one',expectedRevision:revision,frame:{key:'arena',fingerprint:'two-fighters-v1'},intent:'Hold the accepted two-fighter lineup.'})).data.jobs.length,1);
  assert.equal((await f.call('genesis_apply_effect',{expectedRevision:used.data.revision,effect:{id:'remove-player',type:'players.release',seatId:'red',expectedActorId:'agent'}})).isError,true);
 }finally{await f.close();}
});

test('imported image expiry and invalidation never silently generate a replacement',async()=>{
 const f=await fixture();try{
  const state=f.host.operatorView();await f.host.cacheOperatorImage('cached',state.revision,{key:'landscape',fingerprint:'v1',ttlMs:30000},'https://example.com/start.png');
  await f.host.tick(Date.now()+31000);
  assert.equal(f.host.operatorView().frames.landscape.status,'stale');assert.equal(f.host.operatorView().jobs.length,0);
  const result=await f.call('genesis_use_frame',{requestId:'expired',expectedRevision:f.host.operatorView().revision,frame:{key:'landscape',fingerprint:'v1'},intent:'Hold the scene.'});assert.equal(result.isError,true);assert.equal(f.host.operatorView().jobs.length,0);
  await assert.rejects(f.host.applyOperatorEffect({id:'escalate',type:'players.release'},f.host.operatorView().revision),/Player release belongs/);
 }finally{await f.close();}
});

test('operator effects enforce host grants, finite budgets, valid media and observed playback boundaries',async()=>{
 const f=await fixture();try{
  let rev=f.host.operatorView().revision;
  assert.equal((await f.call('genesis_cache_image',{requestId:'bad-url',expectedRevision:rev,frame:{key:'bad',fingerprint:'v1'},imageUrl:'file:///private/secret'})).isError,true);
  assert.equal((await f.call('genesis_apply_effect',{expectedRevision:rev,effect:{id:'ungranted',type:'tool.request',toolId:'tool.secret',data:{},maxCostUsd:.01}})).isError,true);
  assert.equal((await f.call('genesis_apply_effect',{expectedRevision:rev,effect:{id:'expensive',type:'image.request',intent:'Empty forest.',maxCostUsd:5}})).isError,true);
  const accepted=await f.call('genesis_apply_effect',{expectedRevision:rev,effect:{id:'direction',type:'live.direction',intent:'Subtle wind only.'}});assert.ok(!accepted.isError,accepted.content[0].text);
  rev=accepted.data.revision;
  assert.equal((await f.call('genesis_apply_effect',{expectedRevision:rev,effect:{id:'interrupt',type:'stage.restore',anchorId:'start'}})).isError,true);
 }finally{await f.close();}
});

test('a discovered game action reaches the authoritative controller through MCP',async()=>{
 const f=await fixture(false);try{
  const view=(await f.call('genesis_read_world')).data;
  const action=await f.call('genesis_action_explore',{eventId:'explore-once',expectedRevision:view.genesis.revision,data:{x:.5,y:.5,anchorId:view.genesis.anchor.id,sceneRevision:view.genesis.anchor.revision}});
  assert.ok(!action.isError,action.content[0].text);assert.equal(action.data.genesis.jobs.length,1);
  const job=f.host.diagnostics().state.genesis.jobs[0];assert.equal(job.effect.type,'scene.request');assert.equal(job.status,'queued');
  const duplicate=await f.call('genesis_action_explore',{eventId:'explore-once',expectedRevision:view.genesis.revision,data:{x:.5,y:.5,anchorId:view.genesis.anchor.id,sceneRevision:view.genesis.anchor.revision}});
  assert.ok(!duplicate.isError,duplicate.content[0].text);assert.equal(duplicate.data.genesis.jobs.length,1);
 }finally{await f.close();}
});

test('the stdio MCP entry and authenticated browser API operate on the same persistent room', {timeout:15000}, async()=>{
 const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join,resolve}=await import('node:path');
 const {unzipSync}=await import('fflate');const {exportGenesisProjectArchive}=await import('../dist/projectArchive.js');const {StdioClientTransport}=await import('@modelcontextprotocol/sdk/client/stdio.js');
 const dir=await mkdtemp(join(tmpdir(),'genesis-mcp-')),projectDir=join(dir,'project');await mkdir(projectDir);
 const project=createGenesisProject();project.definition.genesis.capabilities=['scene.request','image.request','live.direction'];
 for(const [name,bytes]of Object.entries(unzipSync(exportGenesisProjectArchive(project))))await writeFile(join(projectDir,name),bytes);
 const credential=join(dir,'players.json'),token='mcp-shared-room-test-token';await writeFile(credential,JSON.stringify([{id:'agent',name:'Agent',token}]));
 const transport=new StdioClientTransport({command:process.execPath,args:[resolve('examples/server/mcp.mjs'),projectDir],env:{PORT:'0',GENESIS_MCP_OPERATOR:'1',GENESIS_PLAYERS_FILE:credential},stderr:'pipe'});
 let url;const connected=new Promise(done=>transport.stderr.on('data',chunk=>{const match=chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);if(match){url=match[0];done(url);}}));
 const client=new Client({name:'stdio-test',version:'1'});
 try{
  await client.connect(transport);await connected;
  assert.ok((await client.listTools()).tools.some(t=>t.name==='genesis_cache_image'));
  const catalog=JSON.parse((await client.callTool({name:'genesis_catalog',arguments:{}})).content[0].text);
  const cached=await client.callTool({name:'genesis_cache_image',arguments:{requestId:'shared-cache',expectedRevision:catalog.host.revision,frame:{key:'shared',fingerprint:'v1'},imageUrl:'https://example.com/shared.png'}});assert.ok(!cached.isError,cached.content[0].text);
  const response=await fetch(url+'/api/view',{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,200);
  const view=await response.json();assert.equal(view.actorId,'agent');assert.equal(view.genesis.revision,JSON.parse(cached.content[0].text).revision);
  assert.equal((await fetch(url+'/api/operator',{headers:{Authorization:'Bearer '+token}})).status,404,'Operator controls are not exposed through browser routes');
 }finally{await client.close();await rm(dir,{recursive:true,force:true});}
 await assert.rejects(fetch(url+'/health',{signal:AbortSignal.timeout(1000)}),'Closing the MCP client closes its room server');
});

test('named preparation and direction tools expose usable typed operations',async()=>{
 const f=await fixture();try{
  const tools=(await f.client.listTools()).tools;
  assert.ok(tools.find(t=>t.name==='genesis_prepare_frame').inputSchema.properties.frame.properties.fingerprint);
  const prepared=await f.call('genesis_prepare_frame',{requestId:'forecast',expectedRevision:f.host.operatorView().revision,frame:{key:'future',fingerprint:'v1'},intent:'An empty woodland clearing. No text or interface.',maxCostUsd:.05});
  assert.ok(!prepared.isError,prepared.content[0].text);assert.equal(prepared.data.frames.future.status,'preparing');
  const job=f.host.diagnostics().state.genesis.jobs[0];assert.equal(job.effect.type,'image.request');assert.equal(job.effect.presentation,'background');
  const invalidated=await f.call('genesis_invalidate_frame',{requestId:'retire',expectedRevision:prepared.data.revision,frameKey:'future'});assert.ok(!invalidated.isError,invalidated.content[0].text);assert.equal(invalidated.data.frames.future.status,'stale');
  await f.host.skip('agent',job.id);
  const directed=await f.call('genesis_direct_scene',{requestId:'wind',expectedRevision:f.host.operatorView().revision,intent:'Wind stirs the grass around the accepted cast. No new action.'});assert.ok(!directed.isError,directed.content[0].text);
  assert.equal(f.host.diagnostics().state.genesis.jobs.at(-1).effect.type,'live.direction');
 }finally{await f.close();}
});

test('MCP queues labelled public directions in FIFO order and returns the standard queue view',async()=>{
 const f=await fixture();try{
  for(let i=0;i<2;i++){const result=await f.call('genesis_direct_scene',{requestId:'queued-'+i,expectedRevision:f.host.operatorView().revision,queue:true,label:'Action '+i,displayPrompt:'Public action '+i,intent:'PRIVATE model instructions '+i});assert.ok(!result.isError,result.content[0].text);}
  const q=(await f.call('genesis_read_queue')).data;assert.equal(q.version,1);assert.deepEqual(q.items.map(i=>i.label),['Action 0','Action 1']);assert.deepEqual(q.items.map(i=>i.prompt),['Public action 0','Public action 1']);assert.ok(!JSON.stringify(q).includes('PRIVATE'));
  await assert.rejects(f.host.runJob('agent',q.items[1].jobId),/earlier selection/);
 }finally{await f.close();}
});
