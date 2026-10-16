import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { GenesisHost } from './host.js';
import { FileGenesisStorage } from './storage.js';
import { createCachedProvider } from './cachedProvider.js';
import { createLlmProvider } from './llm.js';
import { defaultGenesisHostPolicy } from './policy.js';
import { loadGenesisProject } from './projectFiles.js';
import { publicExperienceDefinition } from './experienceDefinition.js';
import { genesisParticipantRole } from './participation.js';
const runtimeDirectory = dirname(fileURLToPath(import.meta.url));
const css = `*{box-sizing:border-box}body{margin:0;background:#101c18;color:#e9eddf;font:14px system-ui}button,select,input{font:inherit;color:inherit;background:#23352b;border:1px solid #516350;border-radius:6px;padding:10px 14px}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}.preview-header{display:flex;align-items:center;gap:16px;max-width:1060px;margin:auto;padding:20px}.preview-brand{color:#9daa91;font-size:11px;letter-spacing:2px}.preview-heading{flex:1}h1{font-size:20px;margin:4px 0 0}main{max-width:1060px;margin:auto;padding:0 20px 32px}.genesis-player{border:1px solid #4a5b47;background:#f4efdf;overflow:hidden}.genesis-stage{position:relative;aspect-ratio:16/9;background:#172a21}.genesis-stage img,.genesis-stage video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.genesis-overlay{position:absolute;inset:0;transition:opacity .2s}.genesis-overlay iframe{height:100%;width:100%;border:0;background:transparent}.genesis-panel iframe{display:block;width:100%;height:730px;border:0}.genesis-controls{display:flex;gap:8px;flex-wrap:wrap;padding:12px;background:#17291f}.genesis-controls:empty{display:none}.genesis-status{margin:0;padding:12px 16px;color:#475c45}.genesis-status:empty{display:none}.note{color:#a2af96;font-size:12px;line-height:1.6}.preview-note{margin:12px 0 20px}.help{border:1px solid #3d5140;padding:14px 18px;margin-top:12px}.help summary{font-weight:600;cursor:pointer}.help p{line-height:1.6}.help dl{display:grid;grid-template-columns:max-content 1fr;gap:10px 22px;font-size:13px}.help dd{margin:0;color:#a2af96}.diagnostics{display:grid;grid-template-columns:1fr 1fr;gap:24px}pre{font:11px ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;color:#a2af96}[hidden]{display:none!important}@media(max-width:620px){.preview-header{padding:16px;flex-wrap:wrap;gap:10px}.preview-heading{min-width:180px}h1{font-size:17px}main{padding:0 10px 24px}.genesis-panel iframe{height:820px}.help dl,.diagnostics{grid-template-columns:1fr}.help dd{margin-bottom:6px}.preview-brand{font-size:10px}}`;
/** Author preview only. Loopback binding, issued participant tokens, and strict same-origin writes. */
export async function startGenesisDevServer(directory: string, port = 4173) {
  directory = await realpath(directory);
  const project = await loadGenesisProject(directory);
  const fixture = JSON.parse(await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../examples/fixtures/arena-moves.json'), 'utf8'));
  const makeHost = (storageDirectory: string) => new GenesisHost('local-preview', project, { storage: new FileGenesisStorage(storageDirectory), policy: { ...defaultGenesisHostPolicy, capabilities: [...defaultGenesisHostPolicy.capabilities, 'tool.llm.generate'] }, providers: [createLlmProvider({ id: 'prepared-llm-fixture', generate: async () => fixture }), createCachedProvider([{ imageUrl: '/assets/__genesis_fixture/end.jpg', videoUrl: '/assets/__genesis_fixture/scene.mp4' }], { simulateLiveDirections: true })] }).initialize();
  let host: GenesisHost;
  try { host = await makeHost(resolve(directory, '.genesis')); }
  catch (error: any) {
    if (!String(error.message).includes('pins a different project version')) throw error;
    const version = createHash('sha256').update(JSON.stringify(project)).digest('hex');
    host = await makeHost(resolve(directory, '.genesis', 'versions', version));
  }
  const tokens = new Map<string, string>();
  const actors = host.diagnostics().state.participants;
  if (!actors.length) for (let i = 0; i < Math.min(project.definition.participation.maxPlayers + (project.definition.participation.seats ? 1 : 0), project.definition.participation.mode === 'group' ? 4 : project.definition.participation.seats ? 3 : 2); i++) await host.join(`player_${i}`, `Player ${i + 1}`);
  for (const actor of host.diagnostics().state.participants) tokens.set(randomUUID(), actor.id);
  const body = async (req: IncomingMessage) => { let text = ''; for await (const data of req) { text += data.toString(); if (Buffer.byteLength(text) > 20000) throw new Error('Request too large.'); } return JSON.parse(text || '{}'); };
  const server = createServer(async (req, res) => {
    const json = (status: number, data: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
    try {
      const address = server.address() as any, origin = `http://127.0.0.1:${address.port}`;
      if (req.headers.host !== `127.0.0.1:${address.port}` && req.headers.host !== `localhost:${address.port}`) return json(403, { error: 'Open the loopback preview URL.' });
      const url = new URL(req.url || '/', origin);
      if (url.pathname === '/' && req.method === 'GET') {
        const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Genesis local playground</title><style>${css}</style></head><body><header class="preview-header"><div class="preview-heading"><span class="preview-brand">GENESIS / LOCAL PLAYGROUND</span><h1 id="title">Your world is ready</h1></div><select id="actor" aria-label="Preview player"></select><button id="refresh">Refresh</button></header><main><div id="player"></div><p class="note preview-note" id="preview-note">Local preview. Prepared media, no generation charges.</p><p class="note" id="player-help" hidden>For multiplayer, switch the preview player above to fill each seat.</p><details class="help"><summary>Make this game yours</summary><p>Edit your project, restart the preview command, and this page reconnects. Previous versions keep their saved progress.</p><dl><dt>genesis.json</dt><dd>Change the world name, settings and difficulty.</dd><dt>interface.html</dt><dd>Change the look, controls and animations.</dd><dt>controller.js</dt><dd>Change the shared rules, inventory and outcomes.</dd></dl></details><details class="help" id="developer-tools"><summary>Developer tools</summary><p class="note">Media and LLM tools use local fixtures. Live generation needs a connected provider.</p><div class="diagnostics"><section><h2>Event timeline</h2><pre id="timeline"></pre></section><section><h2>Public state</h2><pre id="state"></pre></section></div></details></main><script type="module" src="/browser/devClient.js"></script></body></html>`;
        res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store', 'Content-Security-Policy': "frame-ancestors 'none'; frame-src 'self'; object-src 'none'; base-uri 'none'" }); return res.end(html);
      }
      if (url.pathname === '/project' && req.method === 'GET') return json(200, { project: { ...project, definition: publicExperienceDefinition(project.definition), controllerSource: '' }, actors: [...tokens].map(([token, id]) => ({ token, id, name: host.diagnostics().state.participants.find(p => p.id === id)?.name || id })) });
      if (url.pathname.startsWith('/api/')) {
        if (req.method === 'POST' && req.headers.origin !== origin && req.headers.origin !== `http://localhost:${address.port}`) return json(403, { error: 'Use a same-origin preview request.' });
        const token = String(req.headers.authorization || '').replace(/^Bearer /, ''), actorId = tokens.get(token);
        if (!actorId) return json(401, { error: 'Choose a local preview player.' });
        if (url.pathname === '/api/view' && req.method === 'GET') return json(200, await host.read(actorId));
        if (url.pathname === '/api/diagnostics' && req.method === 'GET') { const d = host.diagnostics(); return json(200, { timeline: d.timeline, state: d.state.genesis!.public }); }
        if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
        const input = await body(req);
        const result = url.pathname === '/api/players' ? await host.players(actorId, input) : url.pathname === '/api/action' ? await host.action(actorId, input.eventId, input.actionId, input.data, input.revision) : url.pathname === '/api/playback' ? await host.playback(actorId, input.playbackId) : url.pathname === '/api/run' ? await host.runJob(actorId, input.jobId) : url.pathname === '/api/skip' ? await host.skip(actorId, input.jobId) : url.pathname === '/api/retry' ? await host.retry(actorId, input.jobId) : null;
        if (url.pathname === '/api/players' && result?.actorId) tokens.set(token, result.actorId);
        return result ? json(200, result) : json(404, { error: 'Unknown preview route.' });
      }
      if (req.method !== 'GET') return json(405, { error: 'Use GET.' });
      let file: string | undefined;
      if (url.pathname === '/assets/__genesis_fixture/end.jpg') file = resolve(runtimeDirectory, '../examples/assets/end.jpg');
      else if (url.pathname === '/assets/__genesis_fixture/scene.mp4') file = resolve(runtimeDirectory, '../examples/assets/scene.mp4');
      else if (url.pathname === '/dev-client.js') file = resolve(runtimeDirectory, 'browser/devClient.js');
      else if (url.pathname.startsWith('/browser/') && /^\/browser\/[A-Za-z]+\.js$/.test(url.pathname)) file = resolve(runtimeDirectory, url.pathname.slice(1));
      else if (url.pathname.startsWith('/assets/')) {
        const base = resolve(directory, 'assets'), candidate = await realpath(resolve(directory, '.' + decodeURIComponent(url.pathname)));
        if (!candidate.startsWith(base + sep)) return json(403, { error: 'Choose a project asset.' });
        if (!['.svg', '.png', '.jpg', '.jpeg', '.webp', '.mp4', '.webm', '.mp3', '.wav'].includes(extname(candidate))) return json(403, { error: 'Unsupported asset type.' });
        file = candidate;
      }
      if (!file) return json(404, { error: 'Not found.' });
      const bytes = await readFile(file), type = ({ '.js': 'text/javascript', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png', '.webm': 'video/webm' } as any)[extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': bytes.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', ...(extname(file) === '.svg' ? { 'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'" } : {}) }); res.end(bytes);
    } catch (error: any) { json(400, { error: String(error.message || 'Preview request failed.').slice(0, 240) }); }
  });
  await new Promise<void>((done, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.off('error', reject); done(); });
  });
  let ticking = false; const timer = setInterval(async () => { if (ticking) return; ticking = true; try {
    for (const actor of host.diagnostics().state.participants) await host.read(actor.id);
    const state = host.diagnostics().state, actor = state.participants.find(p => genesisParticipantRole(state, p) === 'player');
    const job = state.genesis!.jobs.find(j => j.status === 'queued' && ['scene.request', 'image.request', 'live.direction', 'tool.llm.generate'].includes(j.effect.type === 'tool.request' ? j.effect.toolId || '' : j.effect.type));
    if (actor && job) await host.runJob(actor.id, job.id);
    await host.tick();
  } catch {} finally { ticking = false; } }, 500);
  const url = `http://127.0.0.1:${(server.address() as any).port}`;
  return { url, host, close: async () => { clearInterval(timer); server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); } };
}
