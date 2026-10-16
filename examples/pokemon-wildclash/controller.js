function onEvent({state,event,participants,participation,stage,config,jobs,frameLibrary}) {
const POKEMON_ROSTER=[
{"name":"Charizard","gender":"♂","type":"Fire","pool":[{"name":"Flamethrower","type":"Fire","power":95,"accuracy":100,"pp":15,"maxPp":15},{"name":"Fire Blast","type":"Fire","power":120,"accuracy":85,"pp":5,"maxPp":5},{"name":"Slash","type":"Normal","power":70,"accuracy":100,"pp":20,"maxPp":20},{"name":"Wing Attack","type":"Flying","power":35,"accuracy":100,"pp":35,"maxPp":35}]},
{"name":"Blastoise","gender":"♂","type":"Water","pool":[{"name":"Hydro Pump","type":"Water","power":120,"accuracy":80,"pp":5,"maxPp":5},{"name":"Surf","type":"Water","power":95,"accuracy":100,"pp":15,"maxPp":15},{"name":"Ice Beam","type":"Ice","power":95,"accuracy":100,"pp":10,"maxPp":10},{"name":"Skull Bash","type":"Normal","power":100,"accuracy":100,"pp":15,"maxPp":15}]},
{"name":"Venusaur","gender":"♂","type":"Grass","pool":[{"name":"Solar Beam","type":"Grass","power":120,"accuracy":100,"pp":10,"maxPp":10},{"name":"Mega Drain","type":"Grass","power":40,"accuracy":100,"pp":10,"maxPp":10},{"name":"Razor Leaf","type":"Grass","power":55,"accuracy":95,"pp":25,"maxPp":25},{"name":"Body Slam","type":"Normal","power":85,"accuracy":100,"pp":15,"maxPp":15}]},
{"name":"Pikachu","gender":"♂","type":"Electric","pool":[{"name":"Thunderbolt","type":"Electric","power":95,"accuracy":100,"pp":15,"maxPp":15},{"name":"Thunder","type":"Electric","power":120,"accuracy":70,"pp":10,"maxPp":10},{"name":"Slam","type":"Normal","power":80,"accuracy":75,"pp":20,"maxPp":20},{"name":"Quick Attack","type":"Normal","power":40,"accuracy":100,"pp":30,"maxPp":30}]},
{"name":"Gengar","gender":"♂","type":"Ghost","pool":[{"name":"Psychic","type":"Psychic","power":90,"accuracy":100,"pp":10,"maxPp":10},{"name":"Thunderbolt","type":"Electric","power":95,"accuracy":100,"pp":15,"maxPp":15},{"name":"Mega Drain","type":"Grass","power":40,"accuracy":100,"pp":10,"maxPp":10},{"name":"Lick","type":"Ghost","power":20,"accuracy":100,"pp":30,"maxPp":30}]},
{"name":"Machamp","gender":"♂","type":"Fighting","pool":[{"name":"Submission","type":"Fighting","power":80,"accuracy":80,"pp":25,"maxPp":25},{"name":"Rock Slide","type":"Rock","power":75,"accuracy":90,"pp":10,"maxPp":10},{"name":"Earthquake","type":"Ground","power":100,"accuracy":100,"pp":10,"maxPp":10},{"name":"Strength","type":"Normal","power":80,"accuracy":100,"pp":15,"maxPp":15}]},
{"name":"Gyarados","gender":"♂","type":"Water","pool":[{"name":"Hydro Pump","type":"Water","power":120,"accuracy":80,"pp":5,"maxPp":5},{"name":"Ice Beam","type":"Ice","power":95,"accuracy":100,"pp":10,"maxPp":10},{"name":"Hyper Beam","type":"Normal","power":150,"accuracy":90,"pp":5,"maxPp":5},{"name":"Bite","type":"Normal","power":60,"accuracy":100,"pp":25,"maxPp":25}]},
{"name":"Alakazam","gender":"♂","type":"Psychic","pool":[{"name":"Psychic","type":"Psychic","power":90,"accuracy":100,"pp":10,"maxPp":10},{"name":"Psybeam","type":"Psychic","power":65,"accuracy":100,"pp":20,"maxPp":20},{"name":"Thunder Punch","type":"Electric","power":75,"accuracy":100,"pp":15,"maxPp":15},{"name":"Mega Punch","type":"Normal","power":80,"accuracy":85,"pp":20,"maxPp":20}]}
];
const BASE_STATS={"Charizard": [78, 84, 78, 85, 100], "Blastoise": [79, 83, 100, 85, 78], "Venusaur": [80, 82, 83, 100, 80], "Pikachu": [35, 55, 30, 50, 90], "Gengar": [60, 65, 60, 130, 110], "Machamp": [90, 130, 80, 65, 55], "Gyarados": [95, 125, 79, 100, 81], "Alakazam": [55, 50, 45, 135, 120]};
const SPECIAL_TYPES=['Fire','Water','Grass','Electric','Ice','Psychic','Dragon','Dark','Fairy'];
const MOVE_VISUALS={"Wing Attack":"A thunderous wing strike and spiraling leaf vortex","Mega Drain":"Radiant botanical filaments drawing the recorded energy","Submission":"An explosive grappling lunge with recorded recoil","Rock Slide":"A crashing cascade of stones and sunlit dust","Strength":"One powerful braced strike and ground-shaking impact","Hyper Beam":"A brilliant refractive beam, luminous shock front and heat haze","Psybeam":"A vivid prismatic ripple of distorted light","Thunder Punch":"One charging fist strike wrapped in branching lightning","Mega Punch":"A heavy momentum-driven punch and bursting dust","Flamethrower":"A roaring spiral of fire, embers and heat distortion","Fire Blast":"A blazing five-pointed eruption of flame and golden embers","Slash":"One explosive claw sweep with a sharp wind wake","Hydro Pump":"A towering high-pressure water jet with glittering spray","Surf":"A surging translucent wave with curling foam and sparkling spray","Ice Beam":"A brilliant blue beam and expanding crystalline frost","Skull Bash":"A powerful lowered-head charge and single bursting impact","Bite":"A swift forceful jaw lunge and grounded recoil","Solar Beam":"A radiant sunlight charge and sweeping gold-green beam","Razor Leaf":"A whirling fan of emerald leaves and glinting edges","Body Slam":"An explosive full-body lunge and billowing ground dust","Thunderbolt":"A brilliant branching lightning arc with luminous ground reflections","Thunder":"A dramatic thundercloud bolt and brilliant branching discharge","Quick Attack":"An explosive speed burst, one clear contact and dust wake","Slam":"A powerful tail or body strike with a dust shockwave","Lick":"One quick spectral tongue strike and violet shimmer","Earthquake":"A heavy stomp and rolling soil ripple with leaping pebbles","Psychic":"A luminous violet pressure wave and refracted air","Struggle":"One exhausted physical lunge with recorded recoil"};
const SPECIES_VISUALS={"Charizard":"Recognizable orange scaled dragon, cream belly, two horns, two arms, powerful hind legs, teal leathery wings and flame-tipped tail. Photographic reptile skin and translucent wing veins.","Blastoise":"Recognizable stocky blue turtle, ivory belly, weathered brown shell and two steel shoulder cannons. Wet reptile scales and heavy planted limbs.","Venusaur":"Recognizable broad blue-green four-legged amphibian, wide face, giant pink flower with yellow center and veined leaves. Damp skin and substantial botanical weight.","Pikachu":"Recognizable small yellow rodent, black-tipped ears, red cheeks, brown back stripes and lightning-bolt tail. Dense realistic fur, whiskers and dark wet eyes.","Gengar":"Recognizable compact purple ghost, pointed ears, jagged back, red eyes and broad grin. Organic smoky skin and a grounded silhouette.","Machamp":"Recognizable muscular gray-blue creature with four arms, three head ridges and black belt with gold buckle. Real skin pores and weight.","Gyarados":"Recognizable huge blue serpentine dragon, cream belly, ivory fins, barbel whiskers and broad fierce mouth. Wet overlapping scales; compact coils inside its quadrant.","Alakazam":"Recognizable slender yellow-brown psychic creature, angular head, mustache, pointed ears, brown chest plates, long tail and two metal spoons. Natural surfaces."};
const TYPES={"Charizard": ["Fire", "Flying"], "Blastoise": ["Water"], "Venusaur": ["Grass", "Poison"], "Pikachu": ["Electric"], "Gengar": ["Ghost", "Poison"], "Machamp": ["Fighting"], "Gyarados": ["Water", "Flying"], "Alakazam": ["Psychic"]};
const CHART={
Normal: {Rock:.5,Ghost:0,Steel:.5},
Fire: {Fire:.5,Water:.5,Grass:2,Ice:2,Bug:2,Rock:.5,Dragon:.5,Steel:2},
Water: {Fire:2,Water:.5,Grass:.5,Ground:2,Rock:2,Dragon:.5},
Electric: {Water:2,Electric:.5,Grass:.5,Ground:0,Flying:2,Dragon:.5},
Grass: {Fire:.5,Water:2,Grass:.5,Poison:.5,Ground:2,Flying:.5,Bug:.5,Rock:2,Dragon:.5,Steel:.5},
Ice: {Fire:.5,Water:.5,Grass:2,Ice:.5,Ground:2,Flying:2,Dragon:2,Steel:.5},
Fighting: {Normal:2,Ice:2,Poison:.5,Flying:.5,Psychic:.5,Bug:.5,Rock:2,Ghost:0,Dark:2,Steel:2,Fairy:.5},
Poison: {Grass:2,Poison:.5,Ground:.5,Rock:.5,Ghost:.5,Steel:0,Fairy:2},
Ground: {Fire:2,Electric:2,Grass:.5,Poison:2,Flying:0,Bug:.5,Rock:2,Steel:2},
Flying: {Electric:.5,Grass:2,Fighting:2,Bug:2,Rock:.5,Steel:.5},
Psychic: {Fighting:2,Poison:2,Psychic:.5,Dark:0,Steel:.5},
Bug: {Fire:.5,Grass:2,Fighting:.5,Poison:.5,Flying:.5,Psychic:2,Ghost:.5,Dark:2,Steel:.5,Fairy:.5},
Rock: {Fire:2,Ice:2,Fighting:.5,Ground:.5,Flying:2,Bug:2,Steel:.5},
Ghost: {Normal:0,Psychic:2,Ghost:2,Dark:.5},
Dragon: {Dragon:2,Steel:.5,Fairy:0},
Dark: {Fighting:.5,Psychic:2,Ghost:2,Dark:.5,Fairy:.5},
Steel: {Fire:.5,Water:.5,Electric:.5,Ice:2,Rock:2,Steel:.5,Fairy:2},
Fairy: {Fire:.5,Fighting:2,Poison:.5,Dragon:2,Dark:2,Steel:.5}
};
const now=Number(event.now || Date.now());
const seats=participation && participation.seats || [];
const roster=seats.filter(s => s.actorId);
const old=state.public || {};
const game=JSON.parse(JSON.stringify(old));
const server=JSON.parse(JSON.stringify(state.server || {}));
if (server.suppressAnimation && (jobs || []).every(job => !['queued','running'].includes(job.status))) server.suppressAnimation=false;
server.rosterEpoch=server.rosterEpoch||game.rosterKey||'';
const effects=[];
const eventLog=[];
function random() {
server.seed=((Number(server.seed || 1) * 1664525 + 1013904223) >>> 0);
return server.seed / 4294967296;
}
function log(message) { eventLog.push(message); game.battleLog.push(message); game.battleLog=game.battleLog.slice(-48); }
function announce(text, kind, side) {
server.announcementSequence=Number(server.announcementSequence || 0) + 1;
game.announcements=[...(game.announcements || []), {
id:'notice:' + server.announcementSequence, text, kind, side:side || '', at:now
}].slice(-8);
}
function actionQueue() {
const queue=game.videoQueue ? [{...game.videoQueue}] : [];
(server.roundQueue || []).forEach(command => {
const f=game.fighters[command.actorId];
if (!f || f.hp <= 0) return;
const item=command.actionId === 'use_item' && f.inventory[command.data.itemIndex];
const move=command.actionId === 'battle_move' && f.moves[f.chargingMove ? f.chargingMove.index : command.data.moveIndex];
const name=item ? item.name : f.moves.every(m => m.pp <= 0) && !f.chargingMove ? 'Struggle' : move && move.name;
if (name) queue.push({id:'command:' + game.battleNumber + ':' + game.round + ':' + f.seatId,
kind:command.actionId,prompt:f.name+' uses '+name+' once from its assigned side.',label:f.name+' · '+name, side:f.seatId, status:'waiting'});
});
return queue;
}
function indexed(value, maximum) {
if (!Number.isInteger(value) || value < 0 || value >= maximum) throw new Error('Choose a valid selection.');
return value;
}
function career(actorId) { return game.records[actorId] || {wins:0, losses:0, xp:0}; }
function fighter(actorId, seatId, choice) {
const template=POKEMON_ROSTER[choice];
const participant=participants.find(p => p.id === actorId);
const record=career(actorId), level=Math.min(100, 50 + Math.floor(record.xp / 100));
const base=BASE_STATS[template.name];
const stat=value => Math.floor((value + 15) * 2 * level / 100) + 5;
const maxHp=Math.floor((base[0] + 15) * 2 * level / 100) + level + 10;
return {seatId, trainerName:participant ? participant.name : 'Trainer', name:template.name,
pokemonIndex:choice, gender:template.gender, type:template.type, types:TYPES[template.name],
maxHp, hp:maxHp, level, baseSpeed:base[4],
stats:{attack:stat(base[1]),defense:stat(base[2]),special:stat(base[3]),speed:stat(base[4])},
xp:record.xp % 100, wins:record.wins, ready:false, sentOut:false, status:'',
appearance:SPECIES_VISUALS[template.name], moves:template.pool.slice(0,4).map(move => ({...move})), selectedMoveIndex:0,
inventory:[{id:'potion',name:'POTION',count:2,heal:20,tag:'HEAL',desc:'Restores 20 HP'},
{id:'super_potion',name:'SUPER POTION',count:1,heal:50,tag:'HEAL',desc:'Restores 50 HP'},
{id:'x_attack',name:'X ATTACK',count:1,boost:1,tag:'BOOST',desc:'Raises Attack one stage'},
{id:'full_heal',name:'FULL HEAL',count:1,tag:'STATUS',desc:'Cures a status condition'},
{id:'x_defend',name:'X DEFEND',count:1,tag:'BOOST',desc:'Raises Defense one stage'}],
attackBoost:1, attackStage:0, defenseStage:0, specialStage:0, chargingMove:null};
}
function fighterSnapshots() {
return roster.map(s=>{const f=game.fighters[s.actorId];return {actorId:s.actorId,name:f.name,side:s.id,level:f.level,xp:f.xp,trainerName:f.trainerName,
appearance:SPECIES_VISUALS[f.name],posture:f.hp<=0?'fainted':f.hp/f.maxHp<=.25?'slow, weak and exhausted':f.hp/f.maxHp<=.5?'tired and guarded':'alert and energetic',hp:f.hp,maxHp:f.maxHp,status:f.status,attackBoost:f.attackBoost,defenseStage:f.defenseStage,ready:f.ready,sentOut:f.sentOut};});
}
function directionIntent(intent,visualAction) {
return [battleCamera(),visualAction?'VISIBLE ACTION: '+visualAction:'',intent,config.settings.videoActionTiming||'',config.worldPrompt].filter(Boolean).join('\n').slice(0,4000);
}
function battleCamera() {
return config.settings.battleCamera||'Elevated 35mm camera, downward 65 degrees. Near red LOWER-LEFT x25%, y70%; far blue UPPER-RIGHT x76%, y32%. Ground fills the frame. One Pokémon per side, at most two total.';
}
function trainerDialogue(self,line,cue) {
return {side:self.seatId,line,cue:cue||'opening'};
}
function sendOutOutcome(self,previousPokemon,beforeFighters) {
const red=self.seatId==='trainer_red',position=red?'lower-left quadrant, facing upper-right':'upper-right quadrant, facing lower-left';
return {pokemon:self.name,side:self.seatId,previousPokemon,beforeFighters,
trainerDialogue:trainerDialogue(self,self.name+', I choose you!'),
visualAction:'The '+(red?'red':'blue')+'-jacket trainer stays on the '+(red?'left':'right')+' behind their own battle position. '+
(previousPokemon!==self.name?'If '+previousPokemon+' is still visible on this side, recall it with one brief red beam first. ':'')+
'Within the first second the trainer calls out and throws one red-and-white Poké Ball toward their own '+position+' position. The ball opens in a brief white flash; exactly one '+self.name+' emerges, lands by three seconds and takes a confident ready pose. Preserve its canonical anatomy. If it is already present in the starting frame, show the trainer presenting the ball and the Pokémon taking its ready pose instead of summoning a duplicate. Keep the opposite side unchanged. No attack, damage, evolution or camera cut.'};
}
function moveVisual(moveName,result,self,enemy) {
if(result==='charging')return self.name+' gathers energy on its own side. No projectile or contact.';
if(result==='blocked')return self.name+' attempts to move but its recorded '+(self.status||'flinch')+' prevents the attack. Show the brief struggle and return to idle; no projectile or impact.';
const action=(MOVE_VISUALS[moveName]||'One clear '+moveName+' demonstration')+' from '+self.name+' on '+self.seatId+' toward '+(enemy?enemy.name+' on '+enemy.seatId:'one low plain wooden practice post without markings on its own side')+'.';
return 'The '+(self.seatId==='trainer_red'?'red-jacket':'blue-jacket')+' trainer behind '+self.name+' gives one decisive command gesture, staying behind their own Pokémon. '+action+(result==='miss'?' The target evades and the move passes beside it without contact or injury.':result==='immune'?' The move dissipates harmlessly at the immune target.':' Show the recorded contact and reaction.')+(enemy?' Settle both creatures in their original battle positions.':' Settle on its own side; practice has no HP or score.')+' Explosive acceleration, a brilliant elemental crescendo, beautiful volumetric light and particles, weighted recovery. One Pokémon per side, at most two total. Persistent status only when recorded.';
}
function itemVisual(itemId,self,enemy,damage,healed) {
const actor=self.name+' on '+self.seatId, target=enemy.name+' on '+enemy.seatId;
const heal=healed>0?' A gentle healing glow and steadier posture show the recorded '+healed+' HP recovery.':' HP stays at its recorded value.';
if(itemId==='potion'||itemId==='super_potion')return 'The acting trainer steps forward from behind their own Pokémon and applies a recognizable '+(itemId==='super_potion'?'amber Super Potion':'violet Potion')+' spray bottle to '+actor+'. A short fine mist settles into its body.'+heal+' The opponent keeps its position.';
if(itemId==='full_heal')return 'The trainer applies one Full Heal to '+actor+'. Its recorded status clears, and it steadies its posture. No HP recovery or attack.';
if(itemId==='x_defend')return 'The trainer gives one X Defend to '+actor+'. A brief pale-blue shimmer and firmer stance show its raised Defense. No attack or HP change.';
if(itemId==='x_attack')return 'A small X Attack capsule is given to '+actor+'. A brief warm-red energy shimmer and firmer stance show its recorded attack boost. The item is consumed once; this turn contains no attack.';
return 'The trainer uses the accepted item on '+actor+'. Show only the recorded outcome.';
}
function transition(window) {
game.videoPresentation="separate_ui";
game.videoRenderPolicy="continuous";
if (!server.revealPending) reveal();
planBattleFrames();
applyPreparedLineup();
game.actionQueue=actionQueue();
return {queuePlan:game.actionQueue.map(q=>({id:q.id,label:q.label,prompt:q.prompt||'Show '+q.label+' once in the established scene.',actionId:q.kind,status:q.status==='playing'?'playing':'queued'})),public:game, server, ...(window !== undefined ? {window} : {}), effects};
}
function reveal() {
server.revealPending=null;
game.presentation={fighters:JSON.parse(JSON.stringify(game.fighters)),lastAction:game.lastAction,
lastResult:game.lastResult,battleLog:game.battleLog.slice(),revealedAt:game.presentation&&game.presentation.lastAction&&game.lastAction&&game.presentation.lastAction.id===game.lastAction.id?game.presentation.revealedAt:now};
if (game.lastResult && game.lastResult.battleNumber === game.battleNumber && server.announcedResultBattle !== game.battleNumber) {
server.announcedResultBattle=game.battleNumber;
announce(game.lastResult.winnerName ? game.lastResult.winnerName + ' wins!' : 'The battle is a draw!', 'battle.result');
}
}
function beginReveal(jobId) {
if (!server.revealPending || server.revealPending.jobId!==jobId || server.revealPending.started) return;
server.revealPending.started=true;
if (game.videoQueue && game.videoQueue.id===jobId) game.videoQueue.status='playing';
const action=game.lastAction;
if (action) announce(action.actionResult === 'charging' ? action.pokemon + ' is charging!' : action.actionResult === 'blocked' ? action.pokemon + ' cannot move!' : action.pokemon + ' used ' + action.name + '!', 'battle.move', action.side);
effects.push({id:'impact:'+jobId,type:'timer.set',delayMs:1800,data:{kind:'impact',jobId}});
}
function speed(f) { return Math.max(1,Math.floor(f.stats.speed*(f.status==='paralysis'?.25:1))); }
function priority(command) {
if(command.actionId==='use_item')return 6;
const f=game.fighters[command.actorId], move=f.chargingMove?f.moves[f.chargingMove.index]:f.moves[command.data.moveIndex];
return move.name==='Extreme Speed'?2:move.name==='Quick Attack'?1:0;
}
function nextRound() {
roster.forEach(s=>{game.fighters[s.actorId].flinched=false;});
server.commands={};server.roundQueue=[];game.commandReady={};game.round=Number(game.round||0)+1;
game.deadline=0;
return battleWindow(roster.slice().sort((a,b)=>speed(game.fighters[b.actorId])-speed(game.fighters[a.actorId]))[0].actorId);
}
function advanceRound() {
const command=(server.roundQueue||[]).shift();
if(command)return resolveCommand(command);
return transition(nextRound());
}
function setupWindow() {
if (!roster.length) return null;
server.decision=Number(server.decision || 0) + 1;
return {id:'setup:' + server.decision, mode:'individual', actionIds:['select_pokemon','ready_battle','practice_move'],
actorIds:roster.map(s => s.actorId)};
}
function queueVisual(effect, label, keyframe) {
effect.label=label;
const kind=effect.requiredOutcome.kind,urgent=['pokemon.selected','battle.start','battle_move','use_item','practice.move'].includes(kind);
effect.delivery=urgent?{priority:'urgent',replaceable:false,targetLatencyMs:5000,selectedAtMs:effect.requiredOutcome.selectedAtMs||now}:{priority:'mergeable',mergeKey:'arena-idle',replaceable:true};
if(urgent)effect.guard={key:'rosterEpoch',value:server.rosterEpoch||''};
effect.displayPrompt='Show '+label+' once in the established scene.';
const lineupKey=roster.map(s=>s.id+':'+s.actorId+':'+game.fighters[s.actorId].name).join('|');
server.lineupKey=lineupKey;
const needsFrame=config.settings.visualContext&&lineupKey&&lineupKey!==server.acceptedLineupKey;
if(config.video.pacing==='continuous'){
game.videoQueue={id:effect.id,kind:effect.requiredOutcome.kind,label,status:'queued for video'};
const spawn=['pokemon.selected','battle.start'].includes(kind)&&effect.requiredOutcome.pokemon;
const ref=frameIdentity(spawn?(effect.requiredOutcome.side==='trainer_red'?'spawn-red':'spawn-blue'):'ready',effect.requiredOutcome.beforeFighters);
const entry=ref&&(frameLibrary||{})[ref.key],ready=keyframe&&entry?.status==='ready'&&entry.fingerprint===ref.fingerprint&&entry.expiresAtMs>now;
effects.push({...effect,continuity:ready?'reanchor':'linked',frameMode:ready?'new-frame':'continue',...(ready?{frameRef:ref}:{})});
if(keyframe&&ref&&(frameLibrary||{})[ref.key]?.status==='ready'){server.appliedFrameFingerprint=ref.fingerprint;server.appliedFrameAnchorId=frameLibrary[ref.key].anchorId;server.lastFrameAppliedAtMs=now;}
return;
}
if(needsFrame){
const pending=server.frameRequest, sameLineup=pending&&pending.lineupKey===lineupKey;
server.frameRequest={effect,label,lineupKey};
game.videoQueue={id:effect.id,kind:effect.requiredOutcome.kind,label,status:'preparing image'};
if(!sameLineup){
server.imageJobId=null;
server.frameReady=false;server.frameTimerId='frame-wait:'+effect.id;
effects.push({id:server.frameTimerId,type:'timer.set',delayMs:1500,data:{kind:'setup-frame',requestId:server.frameTimerId}});
}
startFrameRequest();
}else if(server.frameRequest&&lineupKey!==server.acceptedLineupKey){
server.frameRequest={...server.frameRequest,effect,label,lineupKey};
game.videoQueue={id:effect.id,kind:effect.requiredOutcome.kind,label,status:'preparing image'};
}else{
server.frameRequest=null;server.frameTimerId=null;server.frameReady=false;
game.videoQueue={id:effect.id,kind:effect.requiredOutcome.kind,label,status:'queued for video'};
effects.push({...effect,continuity:'linked'});
}
}
function frameIdentity(pose,snapshot) {
if(!roster.length)return null;
const cast=seats.map(s=>s.actorId&&game.fighters[s.actorId]?game.fighters[s.actorId].pokemonIndex:'empty').join(':');
const key='kanto:'+cast+':'+pose;
const stamp=pose==='ready'?':'+(snapshot||fighterSnapshots()).map(f=>f.hp+'.'+(f.status||'')).join(':'):pose.startsWith('spawn-')?':'+roster.filter(s=>s.id!==(pose==='spawn-red'?'trainer_red':'trainer_blue')).map(s=>!!game.fighters[s.actorId].sentOut).join(':'):'';
return {key,fingerprint:key+':overhead-v5'+stamp+(pose==='ready'?':'+game.battleNumber+':'+game.round+':'+Math.floor(now/30000):pose.startsWith('spawn-')?':'+Math.floor(now/30000):'')};
}
function desiredFramePose() {
const fallen=roster.filter(s=>game.fighters[s.actorId].hp<=0);
return fallen.length===2?'both-fainted':fallen.length?(fallen[0].id==='trainer_red'?'red-fainted':'blue-fainted'):'ready';
}
function planBattleFrames() {
if(!config.settings.visualContext||config.video.pacing!=='continuous'||!roster.length)return;
const cast=frameIdentity('ready').key;
server.frameCast=cast;
const poses=['ready',...(roster.length===2?['red-fainted','blue-fainted']:[]),...(['waiting','setup'].includes(game.phase)?roster.filter(s=>!game.fighters[s.actorId].sentOut).map(s=>s.id==='trainer_red'?'spawn-red':'spawn-blue'):[])];
if(desiredFramePose()==='both-fainted')poses.push('both-fainted');
for(const pose of poses){
const ref=frameIdentity(pose),entry=(frameLibrary||{})[ref.key];
const faintSide=pose==='red-fainted'?'trainer_red':pose==='blue-fainted'?'trainer_blue':'';
const spawnSide=pose==='spawn-red'?'trainer_red':pose==='spawn-blue'?'trainer_blue':'';
const fighters=fighterSnapshots().filter(f=>!spawnSide||f.side!==spawnSide&&game.fighters[f.actorId].sentOut).map(f=>({name:f.name,side:f.side,appearance:f.appearance,
posture:pose==='both-fainted'||f.side===faintSide?'fainted, lying safely on the ground, eyes closed, gently breathing; trainer kneels beside it':f.posture+', breathing naturally'}));
const atRisk=roster.some(s=>s.id===faintSide&&game.fighters[s.actorId].hp/game.fighters[s.actorId].maxHp<=.35);
const priority=pose===desiredFramePose()?95:spawnSide?90:atRisk?85:30;
if(entry&&entry.fingerprint===ref.fingerprint&&(entry.status==='ready'||['pending','preparing'].includes(entry.status)&&entry.priority>=priority))continue;
const id='prepare:'+ref.fingerprint+':'+priority+':'+Number(server.decision||0)+':'+Math.floor(now/15000);
if(effects.some(e=>e.id===id))continue;
effects.push({id,type:'frame.prepare',frame:{...ref,ttlMs:pose==='ready'||spawnSide?30000:600000,priority},
anchorId:'start',referenceAnchorIds:['start'],modelId:config.settings.imageModel||'p-image-edit',maxCostUsd:.05,
intent:battleCamera()+' Fresh scene cut '+ref.fingerprint+'. Prepare the cast in a hyperrealistic '+pose+' checkpoint from above, preserving anatomy, surfaces, lighting and landmarks. Use the specified poses. scene-only checkpoint. No attack, effects, dialogue, text or UI. Forecast only; game state stays unchanged.',
requiredOutcome:{kind:'battle.start_frame',pose,fighters,...(spawnSide?{pendingSendOut:{side:spawnSide,pokemon:game.fighters[seats.find(s=>s.id===spawnSide).actorId].name}}:{}),emptySides:seats.filter(s=>!s.actorId).map(s=>s.id)},
guard:{key:'frameCast',value:cast}});
}
if(!server.frameCheckId){
server.frameCheckId='frame-check:'+now+':'+Number(server.decision||0);
effects.push({id:server.frameCheckId,type:'timer.set',delayMs:15000,data:{kind:'frame-check',checkId:server.frameCheckId}});
}
}
function applyPreparedLineup() {
if(roster.some(s=>!game.fighters[s.actorId]?.sentOut))return;
if(game.phase==='finished'&&game.lastResult?.reason==='fainted')return;
if(config.video.pacing==='continuous'&&config.settings.visualContext){
if(server.pending||server.opening||game.videoQueue||!roster.length)return;
const ref=frameIdentity(desiredFramePose()),entry=ref&&(frameLibrary||{})[ref.key];
if(!entry||entry.status!=='ready'||entry.fingerprint!==ref.fingerprint||entry.expiresAtMs<=now)return;
if(server.appliedFrameAnchorId===entry.anchorId)return;
server.decision=Number(server.decision||0)+1;
const id='frame-use:'+now+':'+server.decision;server.visualId=id;
server.appliedFrameFingerprint=ref.fingerprint;server.appliedFrameAnchorId=entry?.anchorId;server.lastFrameAppliedAtMs=now;
game.videoQueue={id,kind:'frame.refresh',label:'Refresh battle scene',status:'queued for video'};
effects.push({id,type:'live.direction',frameRef:ref,continuity:'reanchor',frameMode:'new-frame',delivery:{priority:'mergeable',mergeKey:'arena-idle',replaceable:true},
intent:directionIntent('Cut to this fresh overhead frame. Keep fighters, poses and near-left/far-right depth. Subtle breathing and wind; no move, send-out, recovery or speech.'),
requiredOutcome:{kind:'lineup.ready',phase:game.phase,fighters:fighterSnapshots(),visualEventId:id},guard:{key:'visualId',value:id}});
return;
}
if(!server.reanchorPending||server.pending||server.opening||game.videoQueue||!roster.length||server.acceptedLineupKey!==server.lineupKey)return;
server.decision=Number(server.decision||0)+1;
const id='lineup:'+now+':'+server.decision;server.visualId=id;
game.videoQueue={id,kind:'lineup.ready',label:'Settle fighter lineup',status:'queued for video'};
server.reanchorPending=false;
effects.push({id,type:'live.direction',anchorId:server.acceptedAnchorId,continuity:'reanchor',frameMode:'new-frame',delivery:{priority:'mergeable',mergeKey:'arena-idle',replaceable:true},
intent:directionIntent('Continue from this accepted scene-only frame. Hold the current fighters on their assigned sides with subtle breathing. This corrects composition only; do not replay any send-out, move or item.'),
requiredOutcome:{kind:'lineup.ready',phase:game.phase,fighters:fighterSnapshots(),visualEventId:id},guard:{key:'visualId',value:id}});
}
function startFrameRequest() {
if (!server.frameRequest || !server.frameReady || !roster.length) return;
if(server.imageJobId){
const current=(jobs||[]).find(j=>j.id===server.imageJobId);
if(current&&['queued','running'].includes(current.status))return;
server.imageJobId=null;
}
if ((jobs||[]).some(j=>['queued','running'].includes(j.status)&&j.type!=='live.direction'&&!(j.status==='queued'&&j.guard&&server[j.guard.key]!==j.guard.value))) return;
const request=server.frameRequest, effect=request.effect;
server.imageJobId='frame:'+effect.id;
effects.push({id:server.imageJobId,type:'image.request',presentation:'background',anchorId:'start',
referenceAnchorIds:['start'],modelId:config.settings.imageModel||'google-nano-banana-2-1',maxCostUsd:.05,
intent:[config.settings.setupImagePrompt,config.settings.imageGenerationPolicy,'Prepare one scene-only starting frame for the changed fighter lineup. Show the accepted fighters and trainers in settled poses on their assigned sides. Preserve camera, materials, palette, lighting and landmarks. The next video chunk performs the accepted action.'].filter(Boolean).join('\n'),
requiredOutcome:{kind:'lineup.start_frame',lineupKey:request.lineupKey,
fighters:fighterSnapshots().map(f=>({name:f.name,side:f.side,appearance:f.appearance,posture:f.posture,trainerName:f.trainerName})),
emptySides:seats.filter(s=>!s.actorId).map(s=>s.id)},guard:{key:'lineupKey',value:request.lineupKey}});
}
function lobbyDirection(kind, intent, outcome) {
server.decision=Number(server.decision || 0) + 1;
const id='lobby:' + now + ':' + server.decision;
server.visualId=id;
queueVisual({id, type:config.video.pacing==='continuous'?'live.direction':'scene.request',
anchorId:stage.anchorId, intent:directionIntent(intent,outcome.visualAction),
requiredOutcome:{...outcome, kind, phase:game.phase,visualEventId:id,
fighters:fighterSnapshots(),
delivery:{showOnce:true,chunkDurationSeconds:config.video.chunkIntervalSeconds,startActionEarly:true},
emptySides:seats.filter(s=>!s.actorId).map(s=>s.id)},
...(config.video.pacing==='continuous'?{}:{maxCostUsd:.5,duration:5}),
guard:{key:'visualId',value:id}},kind==='pokemon.selected'?'Send out '+outcome.pokemon:kind==='practice.move'?(outcome.pokemon+' · '+outcome.name):kind==='battle.start'?'Battle ready':'Set up the trainers',kind==='pokemon.selected'||kind==='lobby.roster'&&!game.lastResult?.winnerId||kind==='battle.start');
}
function startBattle(opening){
server.ending=null;
server.startRequested=false;game.practiceUntil=0;
game.turn=0;game.battleNumber++;server.battleId='match:'+game.battleNumber;
roster.forEach(s=>{game.fighters[s.actorId].flinched=false;});
server.commands={};server.previews={};server.roundQueue=[];game.commandReady={};game.round=0;
log('BATTLE '+game.battleNumber+' STARTS! Both trainers choose a command.');
game.battleIntro={id:server.battleId,status:config.settings.animateBattles?'preparing':'complete',durationMs:Math.round(config.video.chunkIntervalSeconds*1000)};
if(!config.settings.animateBattles)announce('Battle begins!','battle.start');
lobbyDirection('battle.start','Complete the accepted send-out. Both Pokémon face each other in their fixed quadrants, trainers behind. Ready poses only.',opening?{...opening,visualAction:opening.visualAction+' By three seconds both Pokémon face each other in battle-ready poses in the lower-left and upper-right quadrants. Low wind lifts dust and leaves, natural light catches their realistic surfaces, and they plant their weight with a tense breath. The battle is starting. No attack yet.'}:{visualAction:'Both accepted Pokémon lower into battle-ready stances, facing each other from the lower-left and upper-right quadrants. Their trainers make one confident command gesture. No attack, throw or summoning.'});
if(config.settings.animateBattles){server.opening={jobId:game.videoQueue.id,expiresAt:now+90000};effects.push({id:'opening-timeout:'+server.battleId,type:'timer.set',delayMs:90000,data:{kind:'opening-timeout',jobId:game.videoQueue.id}});}
return transition(nextRound());
}
function battleWindow(actorId) {
server.decision=Number(server.decision || 0) + 1;
game.phase='battle'; game.activeTurnActorId=actorId;
const turnSeconds=Number(config.settings.turnSeconds || 0);
if(!game.deadline&&turnSeconds>0&&!server.opening){game.deadline=now+Math.max(5,Math.min(90,turnSeconds))*1000;commandClock();}
return {id:'battle:' + server.decision, mode:'individual', actorIds:roster.filter(s=>!(server.commands||{})[s.actorId]).map(s=>s.actorId),
actionIds:['battle_move','use_item','preview_move'], ...(game.deadline?{deadline:game.deadline}:{})};
}
function commandClock(){if(server.commandWatchAt>now)return;server.commandWatchAt=game.deadline;effects.push({id:'command:'+game.battleNumber+':'+game.round,type:'timer.set',delayMs:Math.max(1000,game.deadline-now),data:{kind:'command-timeout'}});}
function watchUntil(deadline) {
server.watch=Number(server.watch || 0) + 1;
server.watching=true;
effects.push({id:'watch:' + server.watch, type:'timer.set', delayMs:Math.max(1000,Math.min(120000,deadline-now)), data:{kind:'watch'}});
}
function animate(nextActorId, intent, outcome, finished) {
if (!config.settings.animateBattles || server.suppressAnimation) return false;
server.decision++;
const jobId='scene:' + game.battleNumber + ':' + game.turn + ':' + server.decision;
server.visualId=jobId;
server.pending={jobId, nextActorId, finished:!!finished, expiresAt:now+120000};
game.phase='animating'; game.deadline=0; game.activeTurnActorId=null;
server.revealPending={jobId,started:false};
queueVisual({id:jobId,type:config.video.pacing==='continuous'?'live.direction':'scene.request',anchorId:stage.anchorId,
intent:directionIntent(intent,outcome.visualAction), requiredOutcome:{...outcome,...(outcome.visualAction?{visualAction:'Timing: trainer command gesture and Pokémon windup first, then the accepted contact or item effect around two seconds into this shot. '+outcome.visualAction}:{}),visualEventId:jobId,
fighters:fighterSnapshots(),
delivery:{showOnce:true,chunkDurationSeconds:config.video.chunkIntervalSeconds,startActionEarly:true},result:finished?game.lastResult:null},
...(config.video.pacing==='continuous'?{}:{maxCostUsd:.5,duration:5}),guard:{key:'visualId',value:jobId}},outcome.kind==='battle.start'?'Begin battle':outcome.pokemon&&outcome.name?outcome.pokemon+' · '+outcome.name:finished?'Battle result':'Next battle action',true);
if (!server.watching) watchUntil(server.pending.expiresAt);
return true;
}
function endingShot(recall) {
server.decision=Number(server.decision||0)+1;
const id='ending:'+game.battleNumber+':'+(recall?'recall':'hold')+':'+server.decision;
server.visualId=id;
server.ending={step:recall?1:0,jobId:id};
const fallen=fighterSnapshots().filter(f=>f.hp<=0);
const seconds=config.video.chunkIntervalSeconds;
const cast=fallen.map(f=>f.name+' in the '+(f.side==='trainer_red'?'lower-left':'upper-right')+' quadrant').join(' and ');
const visualAction='Keep the elevated 65-degree downward view and both quadrants fixed. '+cast+'. '+(recall
? 'Fill this '+seconds.toFixed(2)+'-second shot with a slow Poké Ball recall. First two seconds: aim the ball. Then a soft red beam slowly shrinks the resting Pokémon into light flowing completely into the ball. Final second: the ball closes and is held still. Keep the Pokémon inside.'
: 'Linger for this entire '+seconds.toFixed(2)+'-second shot. The fainted Pokémon gently breathes, eyes closed. Its trainer kneels beside it, pauses with a reassuring hand, then reaches for the ball at the end. Keep the Pokémon visible throughout.')+(game.lastResult.winnerId?' The winner waits on its own side.':'')+' No words are spoken.';
const ref=!recall&&config.settings.visualContext?frameIdentity(desiredFramePose()):null;
const entry=ref&&(frameLibrary||{})[ref.key];
const ready=entry&&entry.status==='ready'&&entry.fingerprint===ref.fingerprint&&entry.expiresAtMs>now;
game.videoQueue={id,kind:recall?'battle.recall':'battle.fainted_hold',label:recall?'Return to Poké Ball':'Stay with the fainted Pokémon',status:'queued for video'};
effects.push({id,type:'live.direction',delivery:{priority:'queued',replaceable:false},frameMode:!recall&&ready?'new-frame':'continue',continuity:!recall&&ready?'reanchor':'linked',...(!recall&&ready?{frameRef:ref}:{}),
intent:directionIntent('Complete this ending shot before the next trainer enters.',visualAction),
requiredOutcome:{kind:game.videoQueue.kind,visualAction,visualEventId:id,fighters:fighterSnapshots(),
...(recall?{recalledSides:fallen.map(f=>f.side)}:{}),
delivery:{showOnce:true,chunkDurationSeconds:seconds,startActionEarly:false},result:game.lastResult},
guard:{key:'visualId',value:id}});
effects.push({id:'result-release:'+id,type:'timer.set',delayMs:90000,data:{kind:'result-release',jobId:id}});
}
function settleBattleEnding(jobId) {
if(!server.ending||server.ending.jobId!==jobId)return false;
server.ending={step:server.ending.step+1};game.videoQueue=null;
releaseFinished();return true;
}
function releaseFinished() {
if(config.settings.animateBattles&&config.video.pacing==='continuous'&&game.lastResult?.reason==='fainted'){
const ending=server.ending||{step:0};
if(ending.step<2){if(!ending.jobId)endingShot(ending.step===1);return;}
}
const winnerId=game.lastResult && game.lastResult.winnerId;
const cooldownMs=Math.round(Math.max(2, Math.min(60, Number(config.settings.rejoinCooldownSeconds || 8))) * 1000);
roster.filter(s=>s.actorId!==winnerId).forEach(s=>effects.push({id:'release:'+game.battleNumber+':'+s.id,
type:'players.release',seatId:s.id,expectedActorId:s.actorId,cooldownMs}));
}
function finish(winnerId, reason) {
const winner=game.fighters[winnerId];
if(reason==='fainted'&&game.lastAction){
const fainted=roster.map(s=>game.fighters[s.actorId]).filter(f=>f.hp<=0);
game.lastAction.visualAction+=' After the accepted impact, '+fainted.map(f=>f.name+' on '+f.seatId+' wobbles, lowers gently to the grass and rests with eyes closed, breathing safely. Its '+(f.seatId==='trainer_red'?'red':'blue')+'-jacket trainer reacts with concern and kneels beside it on the same side').join('. ')+'. This is fainting, with no injury or death. '+(winner?winner.name+' stays on its own side and lifts its head in a modest victory pose. ':'')+' Keep the fainted Pokémon visible until the later recall.';
if(fainted.length)game.lastAction.trainerDialogue=trainerDialogue(fainted[0],fainted[0].name+', you did great!','after_impact');
}
game.lastResult={battleNumber:game.battleNumber, winnerId:winnerId || '',
winnerName:winner ? winner.trainerName : '', pokemon:winner ? winner.name : '', reason, at:now};
game.phase='finished'; game.activeTurnActorId=null; game.deadline=0; game.practiceUntil=0; server.pending=null;server.commands={};server.roundQueue=[];game.commandReady={};server.revealPending=null;
if (winner) {
const record=career(winnerId); record.wins++; record.xp += 25;
game.records[winnerId]=record; winner.wins=record.wins; winner.xp=record.xp % 100;
log(winner.trainerName.toUpperCase() + ' WINS! +25 EXP.');
} else log(reason==='timeout'?'Neither trainer chose a command. The battle is a draw.':'Both Pokémon fainted. The battle is a draw.');
roster.filter(s => s.actorId !== winnerId).forEach(s => {
const record=career(s.actorId); record.losses++; game.records[s.actorId]=record;
});
const keys=Object.keys(game.records);
if (keys.length > 40) keys.filter(id => !roster.some(s => s.actorId === id)).slice(0, keys.length - 40).forEach(id => delete game.records[id]);
if (!animate('', 'Depict the accepted final move and battle result once. Contact occurs about two seconds after the shot begins. A timeout ends the battle without inventing an attack.', reason==='timeout'?{kind:'battle.timeout',reason}:{...game.lastAction,reason}, true)) releaseFinished();
return transition(null);
}
function knockouts() {
const alive=roster.filter(s => game.fighters[s.actorId].hp > 0);
return alive.length < 2 ? finish(alive.length === 1 ? alive[0].actorId : '', 'fainted') : null;
}
function damage(target, amount) {
const dealt=Math.min(target.hp, Math.max(0, Math.floor(amount)));
target.hp -= dealt;
return dealt;
}
function heal(target, amount) {
const restored=Math.min(target.maxHp - target.hp, Math.max(0, Math.floor(amount)));
target.hp += restored;
return restored;
}
function inflict(target, status) {
if (target.status || status === 'burn' && target.types.includes('Fire') ||
status === 'poison' && (target.types.includes('Poison') || target.types.includes('Steel')) ||
status === 'freeze' && target.types.includes('Ice') || status === 'paralysis' && target.types.includes('Electric')) return;
target.status=status; log(target.name.toUpperCase() + ' is affected by ' + status.toUpperCase() + '!');
}
if (event.type === 'session.started') {
server.seed=Math.floor(Math.random() * 4294967295) || 1; server.decision=0; server.watch=0; server.watching=false; server.pending=null;server.commands={};server.roundQueue=[];server.revealPending=null;
Object.assign(game, {phase:'waiting', turn:0, battleNumber:0, rosterKey:'', fighters:{}, records:{},
activeTurnActorId:null, deadline:0, lastAction:null, lastResult:null,
pokemonChoices:POKEMON_ROSTER.map((p, index) => ({index,name:p.name,types:TYPES[p.name],maxHp:BASE_STATS[p.name][0]+75,stats:BASE_STATS[p.name]})),
round:0,commandReady:{},announcements:[],actionQueue:[],battleIntro:null,
practiceUntil:0, practiceCount:0,
battleLog:['Claim a seat, choose your Pokémon and practice while a second trainer joins.']});
return transition(null);
}
if (['seat.claimed','seat.released','participant.joined','participant.left'].includes(event.type)) {
const key=seats.map(s => s.actorId || '').join('|');
if (key === game.rosterKey) return {};
game.rosterKey=key;server.rosterEpoch=key;
Object.keys(game.fighters).filter(id => !roster.some(s => s.actorId === id)).forEach(id => delete game.fighters[id]);
roster.forEach(s => {
if (!game.fighters[s.actorId]) {
game.fighters[s.actorId]=fighter(s.actorId, s.id, s.id === 'trainer_red' ? 0 : 1);
log(game.fighters[s.actorId].trainerName.toUpperCase() + ' joined ' + (s.id === 'trainer_red' ? 'RED' : 'BLUE') + '.');
}
if(!['waiting','setup'].includes(game.phase)&&s.actorId!==game.lastResult?.winnerId){game.fighters[s.actorId].ready=false;game.fighters[s.actorId].sentOut=false;}
});
game.phase=roster.length === 2 ? 'setup' : 'waiting';
server.ending=null;
game.activeTurnActorId=null; game.deadline=0; game.practiceUntil=0; server.pending=null;server.commands={};server.roundQueue=[];game.commandReady={};server.revealPending=null;server.startRequested=false;server.opening=null;game.battleIntro=null;
server.visualId='lobby:' + now;
if(!roster.length){server.frameRequest=null;server.frameTimerId=null;server.frameReady=false;server.lineupKey='';game.videoQueue=null;}
server.battleId='lobby:' + Number(server.decision || 0) + ':' + now;
log(roster.length === 2 ? 'Choose your Pokémon. Both trainers must ready up.' : 'Choose your Pokémon and practice while the next trainer joins.');
if (config.video.pacing!=='continuous'&&stage.mode !== 'holding' && stage.anchorId) effects.push({id:'restore:' + now + ':' + server.decision, type:'stage.restore',anchorId:stage.anchorId});
if (roster.length) lobbyDirection('lobby.roster','Keep the winner and trainer visible. Recall empties only the defeated side. Red near-left, blue far-right. One Pokémon per occupied side. Idle only.',{});
return transition(setupWindow());
}
if(event.type==='timer'&&event.data.kind==='setup-frame'){
if(event.data.requestId!==server.frameTimerId||!server.frameRequest)return {};
server.frameTimerId=null;server.frameReady=true;startFrameRequest();return transition();
}
if(event.type==='timer'&&event.data.kind==='frame-check'){
if(event.data.checkId!==server.frameCheckId)return {};
server.frameCheckId=null;
return transition();
}
if(event.type==='timer'&&event.data.kind==='result-release'){
return settleBattleEnding(event.data.jobId)?transition(null):{};
}
if(event.data.frameKey&&['job.ready','job.failed','job.cancelled'].includes(event.type))return transition();
if(event.type==='playback.started'){
if(game.videoQueue&&game.videoQueue.id===event.data.jobId)game.videoQueue.status='playing';
if(server.opening&&server.opening.jobId===event.data.jobId&&game.battleIntro)game.battleIntro.status='playing';
if(server.pending&&server.pending.jobId===event.data.jobId)beginReveal(event.data.jobId);
return transition();
}
if(event.type==='timer'&&event.data.kind==='opening-timeout'){
if(!server.opening||server.opening.jobId!==event.data.jobId)return {};
server.opening=null;if(game.battleIntro)game.battleIntro.status='unavailable';
if(game.videoQueue&&game.videoQueue.id===event.data.jobId)game.videoQueue=null;
server.visualId='opening-expired:'+now;
return (server.roundQueue||[]).length?advanceRound():transition(game.phase==='battle'?battleWindow(game.activeTurnActorId):undefined);
}
if(event.type==='timer'&&event.data.kind==='impact'){
if(server.revealPending&&server.revealPending.jobId===event.data.jobId)reveal();
return transition();
}
if(event.type==='timer'&&['watch','command-timeout'].includes(event.data.kind)){
if(event.data.kind==='command-timeout')server.commandWatchAt=0;
if(event.data.kind==='watch')server.watching=false;
if (game.phase === 'battle' && game.deadline && now >= game.deadline && roster.length === 2) {
roster.filter(s=>!server.commands[s.actorId]).forEach(s=>{const f=game.fighters[s.actorId],choice=(server.previews||{})[s.actorId];const moveIndex=f.chargingMove?f.chargingMove.index:f.moves[choice]?.pp>0?choice:Math.max(0,f.moves.findIndex(m=>m.pp>0));server.commands[s.actorId]={actorId:s.actorId,actionId:'battle_move',data:{moveIndex}};game.commandReady[s.actorId]=true;});
return commitCommands();
}
if(event.data.kind==='command-timeout'){if(game.phase==='battle'&&game.deadline>now)commandClock();return transition();}
if (game.phase === 'animating' && server.pending && now >= server.pending.expiresAt) {
log('The battle animation timed out. Play continues.');
server.suppressAnimation=true;
const pending=server.pending; const next=pending.nextActorId; server.pending=null; server.visualId='expired:' + now;
if(game.videoQueue&&game.videoQueue.id===pending.jobId)game.videoQueue=null;
if(server.frameRequest&&server.frameRequest.effect.id===pending.jobId){server.frameRequest=null;server.frameTimerId=null;server.frameReady=false;server.imageJobId=null;}
if (stage.anchorId) effects.push({id:'recover:' + server.watch,type:'stage.restore',anchorId:stage.anchorId});
if (pending.finished) {reveal();game.phase='finished';releaseFinished();return transition(null);}
reveal();return advanceRound();
}
if (game.phase === 'battle' && game.deadline > now) watchUntil(game.deadline);
else if (game.phase === 'animating' && server.pending) watchUntil(server.pending.expiresAt);
return {server,effects};
}
if (['job.ready','job.failed','job.skipped','job.cancelled'].includes(event.type) && event.data.jobId===server.imageJobId) {
server.imageJobId=null;
const request=server.frameRequest;
if(!request||!roster.length)return transition();
if(event.type==='job.cancelled'){startFrameRequest();return transition();}
server.frameRequest=null;
if(request.background){
if(event.type==='job.ready'&&event.data.anchorId){server.acceptedAnchorId=event.data.anchorId;server.acceptedLineupKey=request.lineupKey;server.reanchorPending=true;}
return transition();
}
if(event.type==='job.ready'&&event.data.anchorId){
effects.push({...request.effect,anchorId:event.data.anchorId,continuity:'reanchor'});
server.acceptedAnchorId=event.data.anchorId;
server.acceptedLineupKey=request.lineupKey;
}else{
log('Setup image unavailable. The battle continues from its current frame.');
effects.push({...request.effect,continuity:'linked'});
}
game.videoQueue={id:request.effect.id,kind:request.effect.requiredOutcome.kind,label:request.label,status:'queued for video'};
return transition(game.phase==='animating'?null:undefined);
}
if (['job.ready','job.failed','job.skipped','job.cancelled','playback.completed'].includes(event.type)) {
if(server.ending?.jobId&&event.data.jobId===server.ending.jobId){
if(event.type==='job.ready'&&!event.data.data?.playbackCompleted)return {};
settleBattleEnding(event.data.jobId);return transition(null);
}
if(event.type==='job.ready'&&config.video.pacing==='continuous'&&!event.data.data?.playbackCompleted)return {};
if(game.videoQueue&&game.videoQueue.id===event.data.jobId){
game.videoQueue=null;
}
if(server.opening&&server.opening.jobId===event.data.jobId){
server.opening=null;const completed=event.type==='job.ready'||event.type==='playback.completed';if(game.battleIntro)game.battleIntro.status=completed?'complete':'unavailable';
if(completed)announce('Battle begins!','battle.start');
return (server.roundQueue||[]).length?advanceRound():transition(game.phase==='battle'?battleWindow(game.activeTurnActorId):undefined);
}
if(server.startRequested&&!game.videoQueue&&roster.length===2&&roster.every(s=>game.fighters[s.actorId].ready))return startBattle();
if(server.frameRequest&&!server.imageJobId){startFrameRequest();if(!server.frameRequest.background)return transition();}
if (game.phase !== 'animating' || !server.pending) return transition();
if (event.data.jobId !== server.pending.jobId) return {};
if (event.type === 'job.ready' && event.data.videoUrl) {
server.pending.expiresAt=now + 30000;beginReveal(server.pending.jobId);
effects.push({id:'play:' + server.decision,type:'stage.play',videoUrl:event.data.videoUrl,
...(event.data.anchorId ? {anchorId:event.data.anchorId} : {})});
return transition(null);
}
const pending=server.pending; const next=pending.nextActorId; server.pending=null;
if (event.type !== 'playback.completed' && !(event.type==='job.ready'&&event.data.data&&event.data.data.playbackCompleted)) log('Animation unavailable. Play continues.');
if (stage.anchorId) effects.push({id:'hold:' + server.decision,type:'stage.restore',anchorId:stage.anchorId});
if (pending.finished) {reveal();game.phase='finished';releaseFinished();return transition(null);}
reveal();return advanceRound();
}
if (event.type !== 'action') return {};
const seat=roster.find(s => s.actorId === event.actorId);
if (!seat) throw new Error('Claim a trainer seat first.');
if (event.actionId === 'select_pokemon') {
if (!['waiting','setup'].includes(game.phase)) throw new Error('Choose your Pokémon before the battle begins.');
const choice=indexed(event.data.pokemonIndex,POKEMON_ROSTER.length);
if (choice===game.fighters[event.actorId].pokemonIndex) return transition();
const previousPokemon=game.fighters[event.actorId].name, beforeFighters=fighterSnapshots();
game.fighters[event.actorId]=fighter(event.actorId,seat.id,choice);game.fighters[event.actorId].sentOut=true;
game.practiceUntil=0;
log(game.fighters[event.actorId].trainerName.toUpperCase()+' chose '+game.fighters[event.actorId].name.toUpperCase()+'.');
announce('Sending out ' + game.fighters[event.actorId].name + '!', 'pokemon.selected', seat.id);
lobbyDirection('pokemon.selected','Send out the selected Pokémon on its assigned side. Preserve the other occupied side. Empty sides remain empty. No attack or damage.',{actorId:event.actorId,...sendOutOutcome(game.fighters[event.actorId],previousPokemon,beforeFighters)});
return transition(setupWindow());
}
if (event.actionId === 'practice_move') {
if (!['waiting','setup'].includes(game.phase)||!game.fighters[event.actorId].sentOut||server.startRequested) throw new Error('Send out your Pokémon to practice before the battle.');
if (game.videoQueue&&game.videoQueue.kind==='practice.move') throw new Error('Your practice move is queued or playing. Wait for it to finish.');
if (now<Number(game.practiceUntil||0)) throw new Error('Your practice move is playing. Try again in a moment.');
const self=game.fighters[event.actorId], index=indexed(event.data.moveIndex,self.moves.length), move=self.moves[index];
self.selectedMoveIndex=index;
game.practiceCount=Number(game.practiceCount||0)+1;
game.practiceUntil=now+14000;
announce(self.name + ', practice ' + move.name + '!', 'practice.move', seat.id);
log(self.name.toUpperCase()+' practiced '+move.name.toUpperCase()+'!');
game.lastAction={id:'practice:'+now+':'+game.practiceCount,actorId:event.actorId,pokemon:self.name,
kind:'practice_move',name:move.name,damage:0,healed:0,summary:self.name.toUpperCase()+' PRACTICED '+move.name.toUpperCase()+'!',at:now};
lobbyDirection('practice.move','Show '+self.name+' demonstrating '+move.name+' toward one low plain wooden practice post without markings on its own '+seat.id+' side. Any other selected Pokémon stays idle on its assigned side. This is a warmup at a practice target, with no opponent damage, HP loss, PP use or battle result.',{...game.lastAction,side:seat.id,target:'practice target',trainerDialogue:trainerDialogue(self,self.name+', use '+move.name+'!'),visualAction:moveVisual(move.name,'practice',self,null)});
return transition(setupWindow());
}
if (event.actionId === 'ready_battle') {
if (!['waiting','setup'].includes(game.phase)) throw new Error('The battle has already begun.');
const choice=indexed(event.data.pokemonIndex,POKEMON_ROSTER.length);
const previous=game.fighters[event.actorId],previousPokemon=previous.name,beforeFighters=fighterSnapshots();
const changed=choice!==previous.pokemonIndex||!previous.sentOut;
if(choice!==previous.pokemonIndex)game.fighters[event.actorId]=fighter(event.actorId,seat.id,choice);
const self=game.fighters[event.actorId];self.ready=true;self.sentOut=true;
if(changed)log(self.trainerName.toUpperCase()+' sent out '+self.name.toUpperCase()+'!');
if(changed)announce('Sending out ' + self.name + '!', 'pokemon.selected', seat.id);
if(roster.length===2&&roster.every(s=>game.fighters[s.actorId].ready)){
return startBattle(changed?{actorId:event.actorId,...sendOutOutcome(self,previousPokemon,beforeFighters)}:null);
}
if(changed)lobbyDirection('pokemon.selected','Send out '+self.name+' on '+seat.id+'. Preserve every other occupied side and keep empty sides empty. No attack or damage.',{actorId:event.actorId,...sendOutOutcome(self,previousPokemon,beforeFighters)});
return transition(setupWindow());
}
if (roster.length !== 2) throw new Error('Two trainers must claim seats to battle.');
if (game.phase !== 'battle' || (server.commands||{})[event.actorId]) throw new Error('Your command is already locked. Wait for the next round.');
const f=game.fighters[event.actorId];
if(event.actionId==='preview_move'){server.previews=server.previews||{};server.previews[event.actorId]=indexed(event.data.moveIndex,f.moves.length);return transition();}
if(event.actionId==='battle_move'){
const index=f.chargingMove?f.chargingMove.index:indexed(event.data.moveIndex,f.moves.length);
if(f.moves.every(m=>m.pp<=0)&&index!==0&&!f.chargingMove)throw new Error('Choose Struggle.');
if(f.moves.some(m=>m.pp>0)&&f.moves[index].pp<=0&&!f.chargingMove)throw new Error('Choose a move with PP remaining.');
}else if(event.actionId==='use_item'){
if(f.chargingMove)throw new Error('Your Pokémon is completing its charged move.');
const item=f.inventory[indexed(event.data.itemIndex,f.inventory.length)];
if(item.count<=0)throw new Error('This item has been used up.');
if(item.heal&&f.hp===f.maxHp)throw new Error('Your Pokémon already has full HP.');
if(item.id==='full_heal'&&!f.status)throw new Error('Your Pokémon has no status to cure.');
if(item.id==='x_attack'&&f.attackStage>=6||item.id==='x_defend'&&f.defenseStage>=6)throw new Error('That stat is already at its maximum.');
}else throw new Error('Choose a declared battle action.');
server.commands=server.commands||{};
server.commands[event.actorId]={actorId:event.actorId,actionId:event.actionId,data:event.data,selectedAtMs:now};
game.commandReady=game.commandReady||{};game.commandReady[event.actorId]=true;
return commitCommands();
function commitCommands(){
const waiting=roster.find(s=>!server.commands[s.actorId]);
if(waiting)return transition(battleWindow(waiting.actorId));
const commands=roster.map(s=>server.commands[s.actorId]);
const difference=priority(commands[1])-priority(commands[0])||speed(game.fighters[commands[1].actorId])-speed(game.fighters[commands[0].actorId]);
if(difference>0||difference===0&&random()<.5)commands.reverse();
server.roundQueue=commands;
if(server.opening)return transition(null);
return advanceRound();
}
function resolveCommand(command) {
const actorId=command.actorId, actionId=command.actionId, data=command.data;
const self=game.fighters[actorId], opponentSeat=roster.find(s => s.actorId !== actorId), enemy=game.fighters[opponentSeat.actorId];
if (!self || !enemy || self.hp <= 0 || enemy.hp <= 0) return knockouts()||advanceRound();
const beforeFighters=fighterSnapshots(), selfHpBefore=self.hp;
let summary='', actualDamage=0, actualHeal=0, moveName='', itemId='', actionResult='used', criticalHit=false, effectiveness=null, recoilDamage=0,residualDamage=0;
if (actionId === 'battle_move') {
const index=self.chargingMove?self.chargingMove.index:indexed(data.moveIndex, self.moves.length);
const struggle=!self.chargingMove&&self.moves.every(m => m.pp <= 0);
if (struggle && index !== 0) throw new Error('Use Struggle while your PP recovers next battle.');
const move=struggle ? {name:'Struggle',type:'Normal',power:50,accuracy:100} : self.moves[index];
if (!struggle && !self.chargingMove && move.pp <= 0) throw new Error('Choose a move with PP remaining.');
self.selectedMoveIndex=index; moveName=move.name;
let canMove=true;
if(self.flinched){self.flinched=false;canMove=false;log(self.name.toUpperCase()+' flinched!');}
if (self.status === 'freeze') { if (random() < .2) {self.status='';log(self.name.toUpperCase() + ' thawed out!');} else {canMove=false;log(self.name.toUpperCase() + ' is frozen!');} }
if (self.status === 'paralysis' && random() < .25) {canMove=false;log(self.name.toUpperCase() + ' is fully paralyzed!');}
if (canMove) {
if (!struggle&&!self.chargingMove) move.pp--;
if (['Solar Beam','Skull Bash'].includes(move.name)&&!self.chargingMove) {self.chargingMove={index};actionResult='charging';log(self.name.toUpperCase()+' is gathering energy!');summary=self.name.toUpperCase()+' IS CHARGING!';}
else {self.chargingMove=null;
log(self.name.toUpperCase() + ' used ' + move.name.toUpperCase() + '!');
if (random() * 100 < move.accuracy) {
const multiplier=struggle ? 1 : enemy.types.reduce((product,type) => product * ((CHART[move.type] || {})[type] === undefined ? 1 : CHART[move.type][type]), 1);
const highCritical=['Slash','Razor Leaf','Stone Edge'].includes(move.name);
const critical=Math.floor(random()*256)<Math.min(255,Math.floor(self.baseSpeed/2)*(highCritical?8:1));
criticalHit=critical;effectiveness=multiplier;actionResult=multiplier===0?'immune':'hit';
const special=SPECIAL_TYPES.includes(move.type), stageFactor=n=>n>=0?(2+n)/2:2/(2-n);
let attack=special?self.stats.special:self.stats.attack;
let defense=special&&move.name!=='Psyshock'?enemy.stats.special:enemy.stats.defense;
if(!critical){attack=Math.floor(attack*stageFactor(special?self.specialStage||0:self.attackStage||0));defense=Math.floor(defense*stageFactor(special&&move.name!=='Psyshock'?enemy.specialStage||0:enemy.defenseStage||0));}
if(!special&&self.status==='burn'&&!critical)attack=Math.floor(attack/2);
const level=critical?self.level*2:self.level;
const power=move.name==='Hex'&&enemy.status?move.power*2:move.power;
let amount=Math.floor(Math.floor((Math.floor(2*level/5)+2)*power*Math.max(1,attack)/Math.max(1,defense))/50)+2;
if(!struggle&&self.types.includes(move.type))amount=Math.floor(amount*1.5);
amount=Math.floor(amount*multiplier);
const randomFactor=217+Math.floor(random()*39);
amount=multiplier===0?0:Math.max(1,Math.floor(amount*randomFactor/255));
const scale=Math.max(.1,Math.min(1,Number(config.settings.damageMultiplier??.4)));
const cap=Math.max(.1,Math.min(1,Number(config.settings.maxHitHpFraction??.3)));
amount=multiplier===0?0:Math.max(1,Math.min(Math.floor(amount*scale),Math.floor(enemy.maxHp*cap)));
actualDamage=damage(enemy,amount);
if (multiplier === 0) log('It had no effect!');
else { if (critical) log('A critical hit!'); if (multiplier > 1) log('It is super effective!'); if (multiplier < 1) log('It is not very effective.'); log(enemy.name.toUpperCase() + ' lost ' + actualDamage + ' HP.'); }
if (['Giga Drain','Mega Drain'].includes(move.name) && actualDamage) {actualHeal=heal(self,actualDamage/2);log(self.name.toUpperCase() + ' restored ' + actualHeal + ' HP.');}
if (move.name === 'Volt Tackle' && actualDamage) {const recoil=damage(self,actualDamage/3);recoilDamage+=recoil;log(self.name.toUpperCase() + ' lost ' + recoil + ' HP from recoil.');}
if (move.name === 'Submission' && actualDamage) {const recoil=damage(self,actualDamage/4);recoilDamage+=recoil;log(self.name.toUpperCase() + ' lost ' + recoil + ' HP from recoil.');}
if (struggle&&actualDamage) {const recoil=damage(self,Math.max(1,actualDamage/2));recoilDamage+=recoil;log(self.name.toUpperCase() + ' lost ' + recoil + ' HP from Struggle.');}
if (move.name === 'Close Combat'&&actualDamage) {self.defenseStage=Math.max(-6,self.defenseStage-1);self.specialStage=Math.max(-6,(self.specialStage||0)-1);log(self.name.toUpperCase()+' DEFENSE and SPECIAL fell!');}
if (enemy.hp > 0 && actualDamage > 0) {
if(['Air Slash','Dark Pulse'].includes(move.name)&&(server.roundQueue||[]).some(c=>c.actorId===opponentSeat.actorId&&c.actionId==='battle_move')&&random()<(move.name==='Air Slash'?.3:.2))enemy.flinched=true;
if(['Psychic','Moonblast','Shadow Ball','Flash Cannon','Sludge Wave','Earth Power','Energy Ball','Focus Blast'].includes(move.name)&&random()<(move.name==='Psychic'?.33:move.name==='Moonblast'?.3:move.name==='Shadow Ball'?.2:.1)){enemy.specialStage=Math.max(-6,(enemy.specialStage||0)-1);log(enemy.name.toUpperCase()+' SPECIAL fell!');}
if(move.name==='Iron Tail'&&random()<.3){enemy.defenseStage=Math.max(-6,enemy.defenseStage-1);log(enemy.name.toUpperCase()+' DEFENSE fell!');}
if (['Flamethrower','Fire Blast','Heat Wave'].includes(move.name) && random() < .1) inflict(enemy,'burn');
if (['Thunderbolt','Thunder','Volt Tackle'].includes(move.name) && random() < .1) inflict(enemy,'paralysis');
if (move.name === 'Ice Beam' && random() < .1) inflict(enemy,'freeze');
if (['Sludge Bomb','Sludge Wave','Lick'].includes(move.name) && random() < (move.name === 'Sludge Wave' ? .1 : .3)) inflict(enemy,move.name === 'Lick' ? 'paralysis' : 'poison');
}
summary=multiplier === 0 ? 'NO EFFECT.' : enemy.name.toUpperCase() + ' -' + actualDamage + ' HP';
} else {actionResult='miss';log('The attack missed!');summary=self.name.toUpperCase() + ' MISSED!';}
}
} else {actionResult='blocked';summary=self.name.toUpperCase() + ' CANNOT MOVE!';}
} else if (actionId === 'use_item') {
const item=self.inventory[indexed(data.itemIndex,self.inventory.length)];
if (!item || item.count <= 0) throw new Error('This item has been used up.');
if (item.heal && self.hp === self.maxHp) throw new Error('Your Pokémon already has full HP.');
item.count--;moveName=item.name;itemId=item.id;log(self.trainerName.toUpperCase() + ' used ' + item.name + '!');
if (item.heal) {actualHeal=heal(self,item.heal);log(self.name.toUpperCase() + ' restored ' + actualHeal + ' HP.');}
else if (item.id==='x_attack') {self.attackStage=Math.min(6,(self.attackStage||0)+1);self.attackBoost=(2+self.attackStage)/2;log(self.name.toUpperCase()+' ATTACK rose!');}
else if(item.id==='x_defend'){self.defenseStage=Math.min(6,self.defenseStage+1);log(self.name.toUpperCase()+' DEFENSE rose!');}
else if(item.id==='full_heal'){self.status='';log(self.name.toUpperCase()+' recovered from its status!');}
summary=actualDamage?enemy.name.toUpperCase()+' -'+actualDamage+' HP':actualHeal?self.name.toUpperCase()+' +'+actualHeal+' HP':item.name+' USED';
} else throw new Error('Choose a declared battle action.');
if (self.hp > 0 && (self.status === 'burn' || self.status === 'poison')) {
const residual=damage(self,Math.max(1,self.maxHp/16));residualDamage=residual;log(self.name.toUpperCase() + ' lost ' + residual + ' HP to ' + self.status.toUpperCase() + '.');
}
game.turn++;
game.lastAction={id:server.battleId+':'+game.turn,actorId:actorId,opponentId:opponentSeat.actorId,selectedAtMs:command.selectedAtMs||now,
pokemon:self.name,target:enemy.name,side:self.seatId,targetSide:enemy.seatId,kind:actionId,name:moveName,itemId,
damage:actualDamage,healed:actualHeal,selfDamage:Math.max(0,selfHpBefore+actualHeal-self.hp),recoilDamage,residualDamage,actionResult,criticalHit,effectiveness,summary,
beforeFighters,visualAction:actionResult==='charging'?self.name+' gathers energy on its own side. No projectile or contact, HP stays unchanged.':actionId==='use_item'?itemVisual(itemId,self,enemy,actualDamage,actualHeal):moveVisual(moveName,actionResult,self,enemy),
...(actionId==='battle_move'?{trainerDialogue:trainerDialogue(self,actionResult==='blocked'?self.name+', hang in there!':self.name+', use '+moveName+'!')}:{}),
events:eventLog,at:now};
const ended=knockouts();if(ended)return ended;
if (animate(opponentSeat.actorId, 'Enact this accepted action once. Show the trainer command first, then contact about two seconds after the shot begins. '+self.name+' used '+moveName+'. '+summary+' Match beforeFighters and the recorded after-state exactly. Include recorded healing, recoil or status. End with both creatures settled in their assigned positions.', game.lastAction, false)) return transition(null);
return advanceRound();
}
}
