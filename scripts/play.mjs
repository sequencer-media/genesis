// A checkout can run its first game before its dependencies or compiled tools exist.
import './prepare.mjs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const child = spawn(process.execPath, [cli, 'play', ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child.kill(signal); });
