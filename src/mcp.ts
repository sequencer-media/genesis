import {createHash} from 'node:crypto';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import type {GenesisHost} from './host.js';
import {genesisActions, type GenesisEffect} from './genesisCore.js';

const id=z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/).refine(v=>!['__proto__','constructor','prototype'].includes(v));
const operatorId=id.refine(v=>v.length<=100);
const revision=z.number().int().nonnegative();
const text=z.string().min(1).max(4000);
const frame=z.object({key:id.refine(v=>v.length<=64),fingerprint:z.string().min(1).max(512),ttlMs:z.number().int().min(30000).max(86400000).optional(),priority:z.number().int().min(0).max(100).optional(),refresh:z.boolean().optional()}).strict();
const reference=z.object({key:frame.shape.key,fingerprint:frame.shape.fingerprint}).strict();
const guard=z.object({key:id,value:z.union([z.string().max(128),z.number().finite(),z.boolean()])}).strict();
const json=z.unknown().refine(v=>JSON.stringify(v??null).length<=12000,'Keep data below 12 KB.');
const common={id:operatorId,guard:guard.optional()};
const display={label:z.string().min(1).max(100).optional(),displayPrompt:z.string().max(2000).optional()};
const generated={...common,...display,intent:text,anchorId:id.optional(),maxCostUsd:z.number().min(.01).max(5).optional(),modelId:z.string().min(1).max(160).optional(),requiredOutcome:json.optional()};
const effects=z.discriminatedUnion('type',[
 z.object({...generated,type:z.literal('image.request'),presentation:z.literal('background').optional(),referenceAnchorIds:z.array(id).max(4).optional()}).strict(),
 z.object({...generated,type:z.literal('scene.request'),referenceAnchorIds:z.array(id).max(4).optional(),duration:z.number().int().min(2).max(10).optional(),continuity:z.enum(['linked','reanchor']).optional(),useStartFrame:z.boolean().optional(),frameRef:reference.optional()}).strict(),
 z.object({...common,...display,type:z.literal('live.direction'),queue:z.boolean().optional(),intent:text,requiredOutcome:json.optional(),anchorId:id.optional(),continuity:z.enum(['linked','reanchor']).optional(),frameRef:reference.optional()}).strict(),
 z.object({...generated,type:z.literal('frame.prepare'),frame,referenceAnchorIds:z.array(id).max(4).optional()}).strict(),
 z.object({...common,type:z.literal('frame.invalidate'),frameKey:frame.shape.key}).strict(),
 z.object({...common,type:z.literal('tool.request'),toolId:z.string().regex(/^tool\.[A-Za-z][A-Za-z0-9_.-]{0,79}$/),data:z.record(z.unknown()).refine(v=>JSON.stringify(v).length<=12000),maxCostUsd:z.number().min(.01).max(5).optional()}).strict(),
 z.object({...common,type:z.literal('stage.restore'),anchorId:id}).strict(),
 z.object({...common,type:z.literal('stage.show'),anchorId:id,presentation:z.literal('preview').optional()}).strict(),
 z.object({...common,type:z.literal('stage.play'),videoUrl:z.string().min(1).max(4096),anchorId:id.optional()}).strict(),
 z.object({...common,type:z.literal('timer.set'),delayMs:z.number().int().min(1000).max(120000),data:z.record(z.unknown()).optional()}).strict(),
]);

/** MCP exposes one authoritative host through discoverable tools. */
export function createGenesisMcpServer(host:GenesisHost,options:{actorId:string;operator?:boolean}) {
 const server=new McpServer({name:'genesis',version:'0.1.0'});
 let actorId=options.actorId;
 const register=(name:string,description:string,schema:z.ZodRawShape,readOnly:boolean,run:(args:any)=>Promise<unknown>|unknown)=>server.registerTool(name,{description,inputSchema:z.object(schema).strict(),annotations:{readOnlyHint:readOnly,destructiveHint:false,idempotentHint:readOnly,openWorldHint:!readOnly}},async(args:any)=>{
  try{const value=await run(args);return{content:[{type:'text' as const,text:JSON.stringify(value)}]};}
  catch(error){return{content:[{type:'text' as const,text:JSON.stringify({error:error instanceof Error?error.message:'The command failed.'})}],isError:true};}
 });
 const actions=genesisActions(host.project.definition);
 const actionNames=actions.map(a=>{const raw='genesis_action_'+a.id;return /^[A-Za-z0-9_-]{1,64}$/.test(raw)?raw:'genesis_action_'+a.id.replace(/[^A-Za-z0-9_-]/g,'_').slice(0,35)+'_'+createHash('sha256').update(a.id).digest('hex').slice(0,8);});
 register('genesis_read_world','Read this actor’s public world state, own private inputs, available actions and current revision.',{},true,()=>host.read(actorId));
 register('genesis_read_queue','Read the current ordered action queue, public prompts, display labels and estimated timing without the full world state.',{},true,async()=>(await host.read(actorId)).genesis.queue);
 register('genesis_catalog','Discover declared game actions and host controls. Each callable tool has its full input schema in MCP tools/list. Availability and budgets still come from the host.',{},true,()=>({
  actions:actions.map((a,i)=>({...a,tool:actionNames[i],canSubmit:host.view(actorId).genesis.actions.find(v=>v.id===a.id)?.canSubmit||false})),
  queue:host.view(actorId).genesis.queue,operator:!!options.operator,controllerOnly:['players.release'],
  ...(options.operator?{host:host.operatorView()}:{}),
 }));
 register('genesis_players','Claim or leave a seat, switch to another owned seat, or enter or leave the waiting queue. Identity comes from this server.',{operation:z.enum(['claim','release','queue.join','queue.leave']),seatId:id.optional()},false,async args=>{const next=await host.players(actorId,args);actorId=next.actorId;return next;});
 actions.forEach((action,index)=>{
  const fields:Record<string,z.ZodTypeAny>=Object.create(null);
  for(const [name,f]of Object.entries(action.fields)){
   let value:z.ZodTypeAny;
   if(f.type==='number'){let n=z.number().finite();if(f.min!==undefined)n=n.min(f.min);if(f.max!==undefined)n=n.max(f.max);value=n;}
   else if(f.type==='boolean')value=z.boolean();
   else value=z.string().max(f.maxLength??12000);
   fields[name]=f.required?value:value.optional();
  }
  register(actionNames[index],action.label+' Submit only when canSubmit is true, using the current revision. Outcomes are resolved by the game controller.',{eventId:id,expectedRevision:revision,data:z.object(fields).strict(),windowId:id.optional()},false,args=>host.action(actorId,args.eventId,action.id,{...args.data,...(args.windowId?{windowId:args.windowId}:{})},args.expectedRevision));
 });
 for(const operation of ['run','retry','skip'] as const)register('genesis_'+operation+'_job',operation+' an allowed queued or failed job. The host enforces permissions, provider authorization and spending limits.',{jobId:id},false,args=>operation==='run'?host.runJob(actorId,args.jobId):host[operation](actorId,args.jobId));
 register('genesis_observe_playback','Report an actually observed completed playback ID. Never use this to skip unseen video.',{playbackId:id},false,args=>host.playback(actorId,args.playbackId));
 if(options.operator){
  register('genesis_apply_effect','Operator: request an image, scene, live action, prepared frame, tool, stage operation or timer. This uses the engine’s normal validation, grants, budgets and job queue. It changes presentation, not canonical game results. Read genesis_catalog first.',{expectedRevision:revision,effect:effects},false,args=>host.applyOperatorEffect(args.effect as GenesisEffect,args.expectedRevision));
  for(const [name,type,description]of [
   ['genesis_prepare_frame','frame.prepare','Operator: generate and cache a scene-only future start frame in the background. This queues preparation within the existing provider grants and budget; readiness leaves game state unchanged.'],
   ['genesis_invalidate_frame','frame.invalidate','Operator: retire an obsolete prepared image by its frame key.'],
   ['genesis_direct_scene','live.direction','Operator: queue one new visual direction through the running stream after accepted playback finishes. Use a declared game action for changes to game results.'],
  ] as const){
   const schema=effects.options.find(s=>s.shape.type.value===type)!;
   const {type:unusedType,id:unusedId,...shape}=schema.shape;
   register(name,description,{requestId:operatorId,expectedRevision:revision,...shape},false,args=>{const{requestId,expectedRevision,...data}=args;return host.applyOperatorEffect({...data,id:requestId,type} as GenesisEffect,expectedRevision);});
  }
  register('genesis_cache_image','Operator: cache an existing saved image URL under an exact frame key and fingerprint. This registers a reference without downloading or generating media. It leaves the displayed scene unchanged. Expired imported images require an explicit replacement.',{requestId:operatorId,expectedRevision:revision,frame,imageUrl:z.string().min(1).max(4096)},false,args=>host.cacheOperatorImage(args.requestId,args.expectedRevision,args.frame,args.imageUrl));
  register('genesis_use_frame','Operator: change the next live start frame to an exact ready cached image. Wait for the current canonical action to finish first. A stale revision or unavailable frame is rejected. The stream inserts the accepted anchor at its next boundary.',{requestId:operatorId,expectedRevision:revision,frame:reference,intent:text},false,args=>host.applyOperatorEffect({id:args.requestId,type:'live.direction',frameRef:args.frame,intent:args.intent,continuity:'reanchor'},args.expectedRevision));
 }
 return server;
}
