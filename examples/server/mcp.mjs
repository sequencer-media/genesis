import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createGenesisMcpServer} from '../../dist/mcp.js';
import {startWorldServer} from './server.mjs';

// The browser and MCP share this one room, host, storage writer and worker.
let room,server;
try {
 const actorId=process.env.GENESIS_MCP_ACTOR_ID||'agent';
 const players=process.env.GENESIS_PLAYERS_FILE?JSON.parse(await readFile(resolve(process.env.GENESIS_PLAYERS_FILE),'utf8')):[{id:actorId,name:'World agent',token:randomBytes(24).toString('base64url')}];
 const player=players.find(p=>p.id===actorId);
 if(!player)throw Error('GENESIS_MCP_ACTOR_ID must identify a configured server player.');
 const adapters=process.env.GENESIS_PROVIDER_MODULE?await import(pathToFileURL(resolve(process.env.GENESIS_PROVIDER_MODULE)).href):{};
 if(process.env.GENESIS_PROVIDER_MODULE&&!Array.isArray(adapters.providers))throw Error('The provider module must export a providers array.');
 room=await startWorldServer({directory:process.argv[2]?resolve(process.argv[2]):undefined,port:Number(process.env.PORT??4174),hostname:'127.0.0.1',sessionId:process.env.GENESIS_SESSION_ID||'world',players,providers:adapters.providers,services:adapters.services,policy:adapters.policy,onError:error=>console.error(error.message)});
 await room.host.join(player.id,player.name,room.host.project.definition.participation.seats?'spectator':'player',player.identityKey||player.id);
 server=createGenesisMcpServer(room.host,{actorId:player.id,operator:process.env.GENESIS_MCP_OPERATOR==='1'});
 await server.connect(new StdioServerTransport());
 console.error(`Genesis MCP connected to shared room ${room.url}. ${adapters.providers?'Server providers configured.':'Prepared fixtures; no model calls or charges.'}`);
 const close=async()=>{await server.close();await room.close();};
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await close();process.exit(0);});
 process.stdin.once('end',async()=>{await close();});
} catch(error) {
 console.error(error.message);await room?.close();process.exitCode=1;
}
