import {createServer} from 'node:http';
import {readFile, realpath} from 'node:fs/promises';
import {resolve, dirname, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '../docs'));
const args = process.argv.slice(2);
const index = args.indexOf('--port');
const port = index >= 0 ? Number(args[index + 1]) : 4202;
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Use a valid documentation port.');
const types = {'.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.md':'text/plain; charset=utf-8', '.svg':'image/svg+xml', '.webp':'image/webp', '.jpg':'image/jpeg', '.png':'image/png'};
const server = createServer(async (request, response) => {
  if (!['GET','HEAD'].includes(request.method)) {response.writeHead(405); response.end(); return;}
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const path = decodeURIComponent(url.pathname);
    const candidate = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!candidate.startsWith(root + sep)) throw new Error('Invalid documentation path.');
    const actual = await realpath(candidate);
    if (!actual.startsWith(root + sep)) throw new Error('Invalid documentation path.');
    const bytes = await readFile(actual);
    response.writeHead(200, {'Content-Type':types[extname(actual)] || 'application/octet-stream', 'Content-Length':bytes.length, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'});
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch {response.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); response.end('Documentation page not found.');}
});
server.on('error', error => {console.error(error.message); process.exitCode = 1;});
server.listen(port, '127.0.0.1', () => {console.log('GENESIS documentation: http://127.0.0.1:' + server.address().port);});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
