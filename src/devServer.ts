import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { GenesisHost } from './host.js';
import { FileGenesisStorage } from './storage.js';
import { createCachedProvider } from './cachedProvider.js';
import { createLlmProvider } from './llm.js';
import { defaultGenesisHostPolicy } from './policy.js';
import { loadGenesisProject } from './projectFiles.js';
import { publicExperienceDefinition } from './experienceDefinition.js';
const runtimeDirectory = dirname(fileURLToPath(import.meta.url));
const css = `*{box-sizing:border-box}body{margin:0;background:#09090b;color:#fafafa;font:14px system-ui}button,select,input{font:inherit;color:inherit;background:#18181b;border:1px solid #3f3f46;border-radius:10px;padding:10px 14px}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}header{display:flex;align-items:center;gap:16px;max-width:1160px;margin:auto;padding:24px 20px}h1{font-size:23px;margin:0;flex:1}main{max-width:1160px;margin:auto;padding:0 20px 32px;display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:16px}.genesis-player,aside{border:1px solid #27272a;border-radius:18px;background:#111113;overflow:hidden}.genesis-stage{position:relative;aspect-ratio:16/9;background:#09090b}.genesis-stage img,.genesis-stage video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.genesis-overlay{position:absolute;inset:0;transition:opacity .2s}.genesis-overlay iframe{height:100%;width:100%;border:0;background:transparent}.genesis-panel iframe{width:100%;height:280px;border:0}.genesis-controls{display:flex;gap:8px;flex-wrap:wrap;padding:12px}.genesis-status{padding:0 14px;color:#a1a1aa}aside{padding:16px}aside h2{font-size:15px;margin:0 0 12px}pre{font:11px ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;color:#a1a1aa}.note{color:#a1a1aa;font-size:12px}[hidden]{display:none!important}@media(max-width:800px){main{grid-template-columns:1fr}header{flex-wrap:wrap}h1{width:100%;flex:auto}}`;
/** Author preview only. Loopback binding, issued participant tokens, and strict same-origin writes. */
export async function startGenesisDevServer(directory: string, port = 4173) {
  const project = await loadGenesisProject(directory);
  const fixture = JSON.parse(await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../examples/fixtures/arena-moves.json'), 'utf8'));
  const host = await new GenesisHost('local-preview', project, { storage: new FileGenesisStorage(resolve(directory, '.genesis')), policy: { ...defaultGenesisHostPolicy, capabilities: [...defaultGenesisHostPolicy.capabilities, 'tool.llm.generate'] }, providers: [createLlmProvider({ id: 'prepared-llm-fixture', generate: async () => fixture }), createCachedProvider([{ imageUrl: '/assets/end.jpg', videoUrl: '/assets/scene.mp4' }])] }).initialize();
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
        const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Genesis local preview</title><style>${css}</style></head><body><header><h1 id="title">Genesis local preview</h1><select id="actor" aria-label="Preview player"></select><button id="refresh">Refresh preview</button></header><main><div id="player"></div><aside><h2>Event timeline</h2><p class="note">Local author preview. Prepared media and LLM JSON fixture, no generation charges.</p><pre id="timeline"></pre><h2>Public state</h2><pre id="state"></pre></aside></main><script type="module" src="/browser/devClient.js"></script></body></html>`;
        res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }); return res.end(html);
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
        return result ? json(200, result) : json(404, { error: 'Unknown preview route.' });
      }
      if (req.method !== 'GET') return json(405, { error: 'Use GET.' });
      let file: string | undefined;
      if (url.pathname === '/dev-client.js') file = resolve(runtimeDirectory, 'browser/devClient.js');
      else if (url.pathname.startsWith('/browser/') && /^\/browser\/[A-Za-z]+\.js$/.test(url.pathname)) file = resolve(runtimeDirectory, url.pathname.slice(1));
      else if (url.pathname.startsWith('/assets/')) {
        const base = await realpath(resolve(directory, 'assets')), candidate = await realpath(resolve(directory, '.' + decodeURIComponent(url.pathname)));
        if (!candidate.startsWith(base + sep)) return json(403, { error: 'Choose a project asset.' });
        if (!['.svg', '.png', '.jpg', '.jpeg', '.webp', '.mp4', '.webm', '.mp3', '.wav'].includes(extname(candidate))) return json(403, { error: 'Unsupported asset type.' });
        file = candidate;
      }
      if (!file) return json(404, { error: 'Not found.' });
      const bytes = await readFile(file), type = ({ '.js': 'text/javascript', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png', '.webm': 'video/webm' } as any)[extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': bytes.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }); res.end(bytes);
    } catch (error: any) { json(400, { error: String(error.message || 'Preview request failed.').slice(0, 240) }); }
  });
  await new Promise<void>(done => server.listen(port, '127.0.0.1', done));
  let ticking = false; const timer = setInterval(async () => { if (ticking) return; ticking = true; try { for (const actor of host.diagnostics().state.participants) await host.read(actor.id); await host.tick(); } catch {} finally { ticking = false; } }, 500);
  const url = `http://127.0.0.1:${(server.address() as any).port}`;
  return { url, host, close: async () => { clearInterval(timer); server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); } };
}
