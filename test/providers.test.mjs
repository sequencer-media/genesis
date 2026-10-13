import test from 'node:test';
import assert from 'node:assert/strict';
import { createReplicateProvider, createGenesisProject, GenesisHost } from '../dist/index.js';
const version = 'a'.repeat(64);
test('Replicate adapter pins registered models, authenticates server requests and polls before checkpoint completion', async () => {
  const requests = []; let complete = false;
  const provider = createReplicateProvider({ token: 'test-token', models: { 'scene.request': { version, maxEstimatedCostUsd: .1, input: (job, anchor) => ({ prompt: job.effect.intent, image: anchor.imageUrl }), result: async output => ({ videoUrl: output[0], imageUrl: '/assets/end.jpg' }) } }, fetch: async (url, init) => { requests.push({ url, init }); return new Response(JSON.stringify(init.method === 'POST' ? { id: 'prediction1', status: 'starting' } : { id: 'prediction1', status: complete ? 'succeeded' : 'processing', output: ['https://example.com/video.mp4'] }), { status: 200 }); } });
  const job = { effect: { type: 'scene.request', intent: 'Move forward.' }, maxCostUsd: .5 };
  assert.equal((await provider.start({ job, anchor: { imageUrl: 'https://example.com/start.jpg' }, idempotencyKey: 'once' })).id, 'prediction1');
  await provider.start({ job, idempotencyKey: 'once' }); assert.equal(requests.length, 1);
  assert.equal(requests[0].init.headers.Authorization, 'Bearer test-token'); assert.equal(JSON.parse(requests[0].init.body).version, version);
  assert.equal((await provider.poll('prediction1', job)).status, 'running'); complete = true;
  assert.equal((await provider.poll('prediction1', job)).result.imageUrl, '/assets/end.jpg');
  await assert.rejects(provider.poll('../secret', job), /valid prediction/);
});
test('Replicate submission failures are not automatically retried or charged twice by polling', async () => {
  let calls = 0; const provider = createReplicateProvider({ token: 'test', models: { 'scene.request': { version, maxEstimatedCostUsd: .1, input: () => ({}), result: async () => ({}) } }, fetch: async () => { calls++; throw new Error('network'); } });
  const request = { job: { effect: { type: 'scene.request' }, maxCostUsd: .5 }, idempotencyKey: 'ambiguous' };
  await assert.rejects(provider.start(request)); await assert.rejects(provider.start(request)); assert.equal(calls, 1);
});
