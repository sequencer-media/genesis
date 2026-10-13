import test from 'node:test';
import assert from 'node:assert/strict';
import {SequencerClient, createGenesisProject, attachGenesisAssets, detachGenesisAssets, downloadGenesisAssetFiles, GenesisHost, createLlmProvider, defaultGenesisHostPolicy} from '../dist/index.js';
const reply = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
test('one server key saves assets once, pins a draft and restores a complete portable bundle', async () => {
  const calls = [], bytes = new Uint8Array([1,2,3]); let saved;
  const fetcher = async (url, options) => {
    calls.push({url, options});
    if (url.startsWith('https://assets.test/')) {assert.equal(options.headers, undefined); return new Response(bytes);}
    assert.equal(options.headers['x-api-key'], 'sk_test'); assert.equal(options.redirect, 'error');
    if (url.endsWith('/upload')) return reply({mediaId:'owned',url:'https://assets.test/image.png'});
    if (url.endsWith('/world-experiences')) {saved = JSON.parse(options.body); return reply({versionId:'one'});}
    return reply({project: saved.project,interfaceSource:saved.interfaceSource,controllerSource:saved.controllerSource,interfaceAssetSources:Object.fromEntries(saved.interfaceAssets.map(a=>[a.id,'https://assets.test/image.png'])),versionId:'one'});
  };
  const client = new SequencerClient({apiKey:'sk_test',fetch:fetcher}), project = createGenesisProject();
  project.assets = [{path:'assets/start.png',mimeType:'image/png',sizeBytes:3}];project.startImageUrl='/assets/start.png';project.interfaceSource='<img src="assets/start.png">';
  await client.save('workspace',project,{assetFiles:{'assets/start.png':bytes}});await client.save('workspace',project,{assetFiles:{'assets/start.png':bytes},expectedVersionId:'one'});
  assert.equal(calls.filter(c=>c.url.endsWith('/upload')).length,1);assert.equal(saved.expectedVersionId,'one');assert.equal(saved.interfaceAssets[0].portablePath,'assets/start.png');assert.match(saved.interfaceSource,/asset:\/\/g_/);
  const restored = await client.load('workspace','world');assert.equal(restored.project.startImageUrl,'/assets/start.png');assert.equal(restored.project.interfaceSource,'<img src="assets/start.png">');assert.deepEqual(restored.assetFiles['assets/start.png'],bytes);
});
test('creator credentials cannot be redirected and oversized attachment downloads are rejected', async () => {
  assert.throws(()=>new SequencerClient({apiKey:'sk_test',baseUrl:'http://unsafe.test'}));
  const client = new SequencerClient({apiKey:'sk_test',fetch:async()=>reply({})});await assert.rejects(client.request('//attacker.test'));
  const project = createGenesisProject();project.startImageUrl='assets/a.png';project.assets=[{path:'assets/a.png',mimeType:'image/png',sizeBytes:1}];
  const attached=await attachGenesisAssets(project,{'assets/a.png':new Uint8Array([1])},async()=>({mediaId:'one',url:'https://assets.test/a.png'}));
  await assert.rejects(downloadGenesisAssetFiles(attached.project,attached.sources,async()=>new Response(new Uint8Array([1,2]))),/exceeded/);
});
test('media and stream helpers preserve one credential, duration quotes and playback acknowledgments', async () => {
  const calls=[],client=new SequencerClient({apiKey:'sk_test',fetch:async(url,options)=>{calls.push({url,body:options.body&&JSON.parse(options.body)});assert.equal(options.headers['x-api-key'],'sk_test');return reply(url.includes('/media/')?{media:{id:'media',status:'completed'}}:{});}});
  await client.model('image/model');await client.generate('workspace',{type:'image',model:'image/model',prompt:'Start image',maxCostUsd:.05,idempotencyKey:'start:one'});
  assert.equal((await client.media('workspace','media')).status,'completed');
  await client.streamQuote('workspace','world',30);await client.startStream('workspace','world','session',30);await client.readStream('workspace','world','session',3);await client.stopStream('workspace','world','session');
  assert.match(calls[0].url,/models\/image%2Fmodel$/);assert.equal(calls[1].body.maxCostUsd,.05);assert.equal(calls[1].body.idempotencyKey,'start:one');assert.match(calls[3].url,/quote\?maxSessionSeconds=30$/);assert.equal(calls[4].body.maxSessionSeconds,30);assert.equal(calls[5].body.playbackSequence,3);
});
test('the LLM arena installs four generated moves and resolves accepted attributes on the server', async()=>{
  const moves=['Copper flash','Moon guard','Fern burst','Pebble heal'].map((name,i)=>({name,damage:10+i,heal:i,guard:false}));let calls=0;
  const project=createGenesisProject('arena-llm'), provider=createLlmProvider({generate:async()=>{calls++;return {moves};}});
  const host=await new GenesisHost('llm-arena',project,{providers:[provider],policy:{...defaultGenesisHostPolicy,capabilities:['tool.llm.generate','scene.request']}}).initialize();
  await host.join('one','One');await host.join('two','Two');await host.players('one',{operation:'claim',seatId:'left'});await host.players('two',{operation:'claim',seatId:'right'});
  const job=host.view('one').genesis.jobs.at(-1);assert.equal(job.type,'tool.request');await host.runJob('one',job.id);await host.tick();
  assert.equal(calls,1);assert.equal(host.view('one').genesis.state.options[0].label,'Copper flash');
  await assert.rejects(host.action('two','wrong','choose',{optionId:'move0'},host.view('two').genesis.revision));
  await host.action('one','hit','choose',{optionId:'move0'},host.view('one').genesis.revision);assert.equal(host.view('two').genesis.state.fighters.two.health,90);assert.equal(calls,1);
});
