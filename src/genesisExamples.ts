import type { ExperienceDefinition, ExperienceInputBinding, GenesisAction } from './experienceDefinition.js';
import { llmArenaController } from './llmArenaExample.js';
import { questController, questInterface } from './questExample.js';

const document = (body: string, script: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;background:transparent;color:#fafafa;font:14px system-ui}*{box-sizing:border-box}.panel{position:absolute;bottom:16px;left:16px;right:16px;background:#111113ed;border:1px solid #3f3f46;border-radius:18px;padding:16px}button{font:inherit;cursor:pointer;border-radius:999px;border:1px solid #52525b;background:#fafafa;color:#09090b;padding:10px 18px}button:disabled{opacity:.45;cursor:default}.choices{display:flex;gap:8px;flex-wrap:wrap}.note{color:#a1a1aa;font-size:12px;margin:8px 0}.meter{height:16px;background:#3f3f46;border-radius:20px;position:relative;overflow:hidden;margin:16px 0}.needle{width:4px;background:#fafafa;height:100%;position:absolute}input{accent-color:#fafafa;width:100%}.hidden{display:none}</style></head><body>${body}<script>${script}</script></body></html>`;
const explorationController = `function onEvent({state,event,stage,participants}) {
  const open=()=>({id:'explore:'+event.id,mode:'individual',actionIds:['explore']});
  if(event.type==='session.started')return {public:{visits:0},window:open()};
  if(event.type==='action')return {public:{...state.public,visits:Number(state.public.visits||0)+1},window:null,effects:[{id:'move:'+event.id,type:'scene.request',anchorId:stage.anchorId,intent:'Move naturally toward the point at normalized image coordinates ('+event.data.x+', '+event.data.y+'). Preserve scene identity and end at a stable destination view.'}]};
  if(event.type==='job.ready')return {window:null,effects:[{id:'play:'+event.id,type:'stage.play',videoUrl:event.data.videoUrl}]};
  if(event.type==='playback.completed'||event.type==='job.skipped')return {window:open(),effects:[{id:'hold:'+event.id,type:'stage.restore',anchorId:event.data.anchorId||stage.anchorId}]};
  return {};
}`;
const shootoutController = `function onEvent({state,event,participants,stage}) {
  const roster=participants.filter(p=>p.role==='player');
  const turn=Number(state.public.turn||0), actor=roster[turn%Math.max(1,roster.length)];
  const challenge='shot:'+turn;
  const open=()=>({id:challenge+':'+event.id,mode:'individual',actionIds:['shot'],actorIds:actor?[actor.id]:[]});
  if(event.type==='session.started')return {public:{turn:0,scores:{},challengeId:'shot:0'},window:open()};
  if(['participant.joined','participant.left'].includes(event.type)&&stage.mode==='holding')return {window:open()};
  if(event.type==='action'){
    if(event.data.challengeId!==challenge)throw new Error('This timing challenge changed.');
    const quality=Math.max(0,1-Math.abs(event.data.timingOffsetMs)/900);
    const goal=Math.abs(event.data.aimX)<.92&&quality>.6&&event.data.power>.25&&event.data.power<.96;
    const scores={...state.public.scores,[event.actorId]:Number((state.public.scores||{})[event.actorId]||0)+(goal?1:0)};
    const outcome={result:goal?'goal':'miss',angle:event.data.aimX,power:event.data.power,quality};
    return {public:{...state.public,scores,lastResult:outcome.result,turn:turn+1,challengeId:'shot:'+(turn+1)},window:null,effects:[{id:'shot-scene:'+event.id,type:'scene.request',anchorId:'start',intent:'The shooter takes the penalty at the recorded angle and power. Show the recorded goal or miss clearly, with a natural goalkeeper reaction.',requiredOutcome:outcome}]};
  }
  if(event.type==='job.ready')return {effects:[{id:'shot-play:'+event.id,type:'stage.play',videoUrl:event.data.videoUrl}]};
  if(event.type==='playback.completed'||event.type==='job.skipped')return {window:open(),effects:[{id:'reset:'+event.id,type:'stage.restore',anchorId:'start'}]};
  return {};
}`;
const decisionsController = `function onEvent({state,event,participants,config}) {
  const players=participants.filter(p=>p.role==='player'), turn=Number(state.public.turn||0);
  const team=turn%2, collective=config.participation.mode==='group';
  const eligible=collective?participants.filter((p,i)=>i%2===team).map(p=>p.id):players.length?[players[turn%players.length].id]:[];
  const options=[{id:'attack',label:'Attack'},{id:'defend',label:'Defend'},{id:'special',label:'Special move'},{id:'recover',label:'Recover'}];
  const open=()=>({id:'decision:'+turn+':'+event.now,mode:collective?'collective':'individual',actionIds:['choose'],actorIds:eligible,options,...(collective?{deadline:event.now+Number(config.settings.voteSeconds||config.roundSeconds)*1000}:{})});
  if(event.type==='session.started')return {public:{turn:0,team:0,options},window:open()};
  if(['participant.joined','participant.left'].includes(event.type)&&state.window&&!state.window.closed)return {window:{...state.window,actorIds:eligible}};
  if(event.type==='action'||event.type==='vote.resolved'){
    const id=event.type==='action'?event.data.optionId:event.data.id;
    if(!options.some(o=>o.id===id))throw new Error('Choose one of the current moves.');
    const next=turn+1, nextTeam=next%2;
    return {public:{...state.public,turn:next,team:nextTeam,lastChoice:id,options},window:{...open(),id:'decision:'+next+':'+event.now,actorIds:collective?participants.filter((p,i)=>i%2===nextTeam).map(p=>p.id):players.length?[players[next%players.length].id]:[]}};
  }
  if(event.type==='vote.empty')return {window:open()};
  return {};
}`;
const explorationUI = document('<div class="panel"><strong>Explore this scene</strong><p id="note" class="note">Click a spot to move toward it.</p><button id="center">Move forward</button></div>', `const note=document.getElementById('note'),button=document.getElementById('center');let enabled=false;
Genesis.on('state',view=>{enabled=!!Genesis.actions.get('explore').canSubmit;button.disabled=!enabled;note.textContent=enabled?'Click a spot to move toward it.':'Preparing the next scene…';document.querySelector('.panel').style.opacity=view.genesis?.stage.overlays?'1':'0';});
document.body.addEventListener('click',event=>{if(event.target.closest('.panel')||!enabled)return;const point=Genesis.stage.point(event,document.body);if(point)Genesis.action('explore',point).catch(e=>note.textContent=e.message);});
button.onclick=()=>{const stage=Genesis.stage.get();Genesis.action('explore',{x:.5,y:.5,anchorId:stage.anchor.id,sceneRevision:stage.anchor.revision}).catch(e=>note.textContent=e.message);};`);
const shootoutUI = document('<div class="panel"><strong>Time your shot</strong><div id="score" class="note"></div><label>Aim<input id="aim" type="range" min="-1" max="1" step=".01" value=".65"></label><div class="meter"><div id="needle" class="needle"></div></div><button id="shoot">Start timing</button><p id="note" class="note">Stop the marker near the center.</p></div>', `const button=document.getElementById('shoot'),needle=document.getElementById('needle'),note=document.getElementById('note');let running=false,start=0,marker=.5,challenge='';const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
function animate(now){if(running){marker=(now-start)%1800/1800;needle.style.left=(marker*100)+'%';}requestAnimationFrame(animate);}requestAnimationFrame(animate);
Genesis.on('state',view=>{const data=view.genesis?.state||{};challenge=data.challengeId;button.disabled=!Genesis.actions.get('shot').canSubmit;document.getElementById('score').textContent=(view.participants||[]).filter(p=>p.role==='player').map(p=>p.name+': '+((data.scores||{})[p.id]||0)).join(' · ')+' · '+(data.lastResult||'Ready');document.querySelector('.panel').style.transition='opacity .2s';document.querySelector('.panel').style.opacity=view.genesis?.stage.overlays?'1':'0';if(button.disabled)running=false;});
if(reducedMotion){button.textContent='Shoot';note.textContent='Choose your aim, then shoot. Timing is assisted.';}button.onclick=()=>{if(!running&&!reducedMotion){running=true;start=performance.now();button.textContent='Shoot';return;}running=false;button.textContent='Start timing';Genesis.action('shot',{challengeId:challenge,aimX:Number(document.getElementById('aim').value),power:.75,timingOffsetMs:reducedMotion?0:Math.round((marker-.5)*1800)}).catch(e=>note.textContent=e.message);};`);
const decisionsUI = document('<div class="panel"><strong id="turn">Choose a move</strong><div id="options" class="choices"></div><p id="note" class="note"></p></div>', `Genesis.on('state',view=>{const state=view.genesis?.state||{},window=view.genesis?.window;document.getElementById('turn').textContent='Side '+((state.team||0)+1)+' chooses';const options=document.getElementById('options');options.replaceChildren();for(const option of window?.options||state.options||[]){const button=document.createElement('button');button.textContent=option.label+(view.genesis?.votedOptionId===option.id?' ✓':'');button.disabled=!Genesis.actions.get('choose').canSubmit;button.onclick=()=>Genesis.action('choose',{optionId:option.id}).catch(e=>document.getElementById('note').textContent=e.message);options.appendChild(button);}document.getElementById('note').textContent=window?.mode==='collective'?'Votes received: '+view.genesis.voteCount+' · '+Math.max(0,Math.ceil(((window?.deadline||Date.now())-Date.now())/1000))+'s left':'Players take turns.';});`);
const arenaController = `function onEvent({state,event,participants,participation,stage,config}) {
  const seats=participation?.seats||[], roster=seats.filter(s=>s.actorId), old=state.public;
  const options=[{id:'attack',label:'Attack'},{id:'defend',label:'Defend'},{id:'special',label:'Special'},{id:'recover',label:'Recover'}];
  const open=(turn=Number(old.turn||0))=>roster.length===2?{id:'battle:'+event.id,mode:'individual',actionIds:['choose'],actorIds:[roster[turn%2].actorId],options}:null;
  if(event.type==='session.started')return {public:{turn:0,fighters:{},options},window:null};
  if(event.type==='seat.claimed'){
    const fighters={...old.fighters};fighters[event.actorId]={health:100,inventory:['attack','defend','special','recover'],creature:['Ember','Tide','Moss'][event.actorId.length%3]};
    return {public:{...old,fighters},window:stage.mode==='holding'?open():null};
  }
  if(event.type==='seat.released'||event.type==='participant.left'){
    const fighters={...old.fighters};delete fighters[event.actorId];return {public:{...old,fighters},window:stage.mode==='holding'?open():null};
  }
  if(event.type==='action'){
    const move=event.data.optionId, actor=roster.find(s=>s.actorId===event.actorId), opponent=roster.find(s=>s.actorId!==event.actorId);
    if(!actor||!opponent||!options.some(o=>o.id===move))throw new Error('Choose an available battle move.');
    const fighters=JSON.parse(JSON.stringify(old.fighters)), self=fighters[event.actorId], enemy=fighters[opponent.actorId];
    if(!self||!enemy)throw new Error('Wait for both fighters.');
    const damage=move==='special'?40:move==='attack'?25:0;
    enemy.health=Math.max(0,enemy.health-(enemy.defending?Math.ceil(damage/2):damage));enemy.defending=false;
    if(move==='recover')self.health=Math.min(100,self.health+15);self.defending=move==='defend';
    const defeated=enemy.health===0, turn=Number(old.turn||0)+1, effects=[];
    const result={move,damage,defeated,actorId:event.actorId,opponentId:opponent.actorId,remainingHealth:enemy.health};
    if(defeated)effects.push({id:'release:'+event.id,type:'players.release',seatId:opponent.id,expectedActorId:opponent.actorId,cooldownMs:Number(config.settings.rejoinSeconds||5)*1000});
    if(config.settings.animate)effects.push({id:'scene:'+event.id,type:'scene.request',anchorId:stage.anchorId,intent:'Realistic creature battle with a classic handheld game aesthetic. Show the committed move and damage. '+JSON.stringify(result),requiredOutcome:result});
    return {public:{...old,fighters,turn,lastResult:result},window:config.settings.animate||defeated?null:open(turn),effects};
  }
  if(event.type==='job.ready')return {window:null,effects:[{id:'play:'+event.id,type:'stage.play',videoUrl:event.data.videoUrl}]};
  if(event.type==='playback.completed'||event.type==='job.skipped')return {window:open(),effects:[{id:'hold:'+event.id,type:'stage.restore',anchorId:stage.anchorId}]};
  return {};
}`;
const arenaUI = document('<div class="panel"><strong>Creature arena</strong><div id="players" class="choices"></div><p id="fighters" class="note"></p><div id="moves" class="choices"></div><p id="note" class="note"></p></div>', `
const note=document.getElementById('note');const run=fn=>fn().catch(e=>note.textContent=e.message);
Genesis.on('state',view=>{
  const seats=Genesis.players.get(),players=document.getElementById('players'),moves=document.getElementById('moves');players.replaceChildren();moves.replaceChildren();
  for(const seat of seats?.seats||[]){const b=document.createElement('button');b.textContent=seat.canRelease?'Leave '+seat.label:seat.actorId?seat.label+': occupied':'Join '+seat.label;b.disabled=!seat.canClaim&&!seat.canRelease;b.onclick=()=>run(()=>seat.canRelease?Genesis.players.leave(seat.id):Genesis.players.claim(seat.id));players.append(b);}
  if(seats?.queueEnabled){const b=document.createElement('button');b.textContent=seats.queuePosition?'Leave queue (#'+seats.queuePosition+')':'Join queue';b.disabled=!seats.queuePosition&&!seats.canQueue;b.onclick=()=>run(()=>seats.queuePosition?Genesis.players.leaveQueue():Genesis.players.joinQueue());players.append(b);}
  const state=Genesis.state.get();document.getElementById('fighters').textContent=Object.entries(state.fighters||{}).map(([id,f])=>(view.participants.find(p=>p.id===id)?.name||'Player')+' · '+f.creature+' · HP '+f.health).join(' / ');
  for(const option of state.options||[]){const b=document.createElement('button');b.textContent=option.label;b.disabled=!Genesis.actions.get('choose').canSubmit;b.onclick=()=>run(()=>Genesis.action('choose',{optionId:option.id}));moves.append(b);}
  note.textContent=seats?.cooldownUntil>Date.now()?'Rejoin in '+Math.ceil((seats.cooldownUntil-Date.now())/1000)+'s':view.status==='waiting_players'?'Join two seats to begin.':view.genesis.state.status==='Preparing four moves'?'Preparing four moves…':Genesis.actions.get('choose').canSubmit?'Your turn.':'Waiting for the other player.';
});`);

function setup(value: ExperienceDefinition, kind: ExperienceInputBinding['kind'], actions: GenesisAction[], participation: 'single' | 'multiplayer' = 'single'): ExperienceDefinition {
  const id = kind === 'click' ? 'exploration_target' : kind === 'game' ? 'game_controls' : 'audience_choice';
  const input: ExperienceInputBinding = { id, kind, purpose: kind === 'click' ? 'navigation' : kind === 'game' ? 'game_command' : 'vote', scope: kind === 'vote' ? 'world' : 'player', lifetime: 'one_action', activePhases: ['action'], required: false, maxLength: 1200, advanceBehavior: 'submit_readiness' };
  return { ...value, genesis: { ...value.genesis!, controller: 'custom' as const, capabilities: kind === 'vote' ? [] : ['scene.request'], ...(kind === 'vote' ? { configSchema: { voteSeconds: { type: 'number' as const, label: 'Voting duration', description: 'Seconds available for each group decision.', default: 20, min: 5, max: 120 } }, config: { voteSeconds: 20 } } : { configSchema: {}, config: {} }), actions: actions.map(a => ({ ...a, inputBindingId: id })) }, inputs: [input], gameBindings: [], characters: { ...value.characters, allowPhoto: false }, participation: { ...value.participation, mode: participation, minPlayers: participation === 'single' ? 1 : 2, maxPlayers: participation === 'single' ? 1 : 2, turnPolicy: 'sequential' as const }, worldVideo: { ...value.worldVideo, enabled: kind !== 'vote', pacing: 'input_gated' as const, source: 'generated' as const }, interface: { ...value.interface, mode: 'custom' as const, placement: kind === 'vote' ? 'panel' as const : 'overlay' as const, handledInputBindingIds: [id], controls: [{ id: `control_${id}`, inputBindingId: id, component: 'auto' as const, label: '' }] }, flow: { entryPhase: 'action', phases: [{ id: 'action', title: 'Interact', inputBindingIds: [id], next: 'action', completion: 'manual' as const }] } };
}
export const GENESIS_EXAMPLES: Array<{ id: string; label: string; controllerSource: string; interfaceSource: string; startImageUrl?: string; definition: (value: ExperienceDefinition) => ExperienceDefinition }> = [
  { id: 'quest', label: 'Mosslight: Lantern Run', controllerSource: questController, interfaceSource: questInterface, startImageUrl: '', definition: value => {
    const def = setup(value, 'game', [{ id: 'choose', inputBindingId: '', label: 'Choose your next move', fields: { optionId: { type: 'string', required: true, maxLength: 40 } } }]);
    def.worldVideo.enabled = false; def.genesis!.capabilities = []; def.interface.placement = 'panel';
    def.genesis!.configSchema = {
      worldName: { type: 'string', label: 'World name', default: 'Mosslight', maxLength: 40 },
      lanternTurns: { type: 'number', label: 'Starting lantern light', default: 10, min: 6, max: 24 },
      difficulty: { type: 'string', label: 'Sentinel difficulty', default: 'normal', options: [{ value: 'normal', label: 'Normal' }, { value: 'hard', label: 'Hard' }] },
    };
    def.genesis!.config = { worldName: 'Mosslight', lanternTurns: 10, difficulty: 'normal' };
    return def;
  } },
  { id: 'arena-llm', label: 'Vintage arena with LLM moves', controllerSource: llmArenaController, interfaceSource: arenaUI.replace(/color:#fafafa/g, 'color:#27281f').replace('#111113ed', '#f1ebd8f5').replace(/border-radius:[0-9]+px/g, 'border-radius:0').replace('font:14px system-ui', 'font:14px ui-monospace,monospace;image-rendering:pixelated').replace(/#a1a1aa/g, '#525648').replace('color:#09090b', 'color:#27281f').replace('background:#fafafa', 'background:#ded8c5').replace('Creature arena', 'GENESIS / CREATURE ARENA').replace('</style>', '.panel{top:8px;bottom:8px;left:8px;right:8px;padding:12px;overflow:auto;box-shadow:4px 4px 0 #746d54}.choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px}button{min-width:0;padding:8px;font-size:12px}.note{font-size:11px;line-height:1.35}</style>'), definition: (value: ExperienceDefinition) => {
    const def = setup(value, 'game', [{ id: 'choose', inputBindingId: '', label: 'Choose', fields: { optionId: { type: 'string', required: true, maxLength: 80 } } }], 'multiplayer');
    def.participation = { ...def.participation, spectators: true, joinPolicy: 'drop_in', room: 'shared', seats: { version: 1, slots: [{ id: 'left', label: 'Ember creature' }, { id: 'right', label: 'Tide creature' }], queue: true, maxSeatsPerIdentity: 1 } };
    def.interface.stageAspectRatio = 1; def.worldVideo.enabled = false; def.genesis!.capabilities = ['tool.llm.generate', 'scene.request'];
    def.genesis!.configSchema = { animate: { type: 'boolean', label: 'Animate battle outcomes', default: false }, rejoinSeconds: { type: 'number', label: 'Defeat cooldown', default: 5, min: 0, max: 60 } }; def.genesis!.config = { animate: false, rejoinSeconds: 5 };
    return def;
  } },
  { id: 'exploration', label: 'Point and click exploration', interfaceSource: explorationUI, controllerSource: explorationController, definition: (value: ExperienceDefinition) => setup(value, 'click', [{ id: 'explore', inputBindingId: '', label: 'Explore', fields: { x: { type: 'number', required: true, min: 0, max: 1 }, y: { type: 'number', required: true, min: 0, max: 1 }, anchorId: { type: 'string', required: true }, sceneRevision: { type: 'number', required: true, min: 0 } } }]) },
  { id: 'timing', label: 'Timed challenge with visual reset', interfaceSource: shootoutUI, controllerSource: shootoutController, definition: (value: ExperienceDefinition) => setup(value, 'game', [{ id: 'shot', inputBindingId: '', label: 'Shoot', fields: { challengeId: { type: 'string', required: true }, aimX: { type: 'number', required: true, min: -1, max: 1 }, power: { type: 'number', required: true, min: 0, max: 1 }, timingOffsetMs: { type: 'number', required: true, min: -2000, max: 2000 } } }], 'multiplayer') },
  { id: 'decisions', label: 'Turn based choices and group voting', interfaceSource: decisionsUI, controllerSource: decisionsController, definition: (value: ExperienceDefinition) => setup(value, 'vote', [{ id: 'choose', inputBindingId: '', label: 'Choose', fields: { optionId: { type: 'string', required: true, maxLength: 80 } } }], 'multiplayer') },
  { id: 'arena', label: 'Shared multiplayer arena', interfaceSource: arenaUI, controllerSource: arenaController, definition: (value: ExperienceDefinition) => {
    const def = setup(value, 'game', [{ id: 'choose', inputBindingId: '', label: 'Choose', fields: { optionId: { type: 'string', required: true, maxLength: 80 } } }], 'multiplayer');
    def.participation = { ...def.participation, spectators: true, joinPolicy: 'drop_in', room: 'shared', seats: { version: 1, slots: [{ id: 'left', label: 'Player 1' }, { id: 'right', label: 'Player 2' }], queue: true, maxSeatsPerIdentity: 1 } };
    def.worldVideo.enabled = false;
    def.genesis!.configSchema = { animate: { type: 'boolean', label: 'Animate battle outcomes', default: false }, rejoinSeconds: { type: 'number', label: 'Defeat cooldown', default: 5, min: 0, max: 60 } }; def.genesis!.config = { animate: false, rejoinSeconds: 5 };
    return def;
  } },
];
