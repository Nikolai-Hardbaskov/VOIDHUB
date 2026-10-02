import {normalWorldRecord,knownThreats,withoutProposal} from './world-data.js';
import {normalCampaignRecord,visibleMemories} from './campaign-data.js';
import {EFFECT_TEMPLATES,normalizeEffect,blocked,effectModifiers,incomingModifiers,effectiveStat,shieldImpact,applyShieldUses} from './effects.js';
// Pure game rules and replay. No SillyTavern or DOM dependencies.
export const VERSION = '0.6.0';
export const STAT_NAMES = {ranged:'Стрельба',melee:'Ближний бой',strength:'Сила',toughness:'Стойкость',reaction:'Реакция',will:'Воля'};
export const REGIONS = {head:'Голова',chest:'Грудная клетка',abdomen:'Живот',rightArm:'Правая рука',leftArm:'Левая рука',rightLeg:'Правая нога',leftLeg:'Левая нога'};
export const COLLECTIONS = ['missions','feed','squad','enemies','weapons','armor','inventory','resources','reputation','archive','channels','abilities','routes','journeys','careerEvents','memories','relationships','offers','transactions','threats'];
export const clone = value => JSON.parse(JSON.stringify(value));
export const uid = () => globalThis.crypto?.randomUUID?.() || `vh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const clamp = (value,min,max) => Math.max(min,Math.min(max,Number(value)));
export function hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
export function actor(overrides={}){
 return {id:'player',name:'{{user}}',species:'человек',affiliation:'',role:'',origin:'Не указано',background:'Не указано',traits:[],start:'',
  hp:100,maxHp:100,status:'В порядке',wounds:[],effects:[],anatomy:clone(REGIONS),stats:Object.fromEntries(Object.keys(STAT_NAMES).map(k=>[k,50])),
  armor:{},naturalArmor:{},weaponIds:[],abilityIds:[],cooldowns:{},physiology:'auto',psychic:false,psychicOverride:false,stabilized:false,destroyed:false,reanimationUsed:false,rank:'Не определено',position:'Не определено',permissions:[],obligations:'',location:'Не определено',serviceProfile:'',serviceStatus:'Не определено',...overrides};
}
export function initialState(){return {player:actor(),missions:[],feed:[],squad:[],enemies:[],weapons:[],armor:[],inventory:[],resources:[],reputation:[],archive:[],channels:[],abilities:[],routes:[],journeys:[],careerEvents:[],memories:[],relationships:[],offers:[],transactions:[],threats:[],scene:{location:'Не определено',presentIds:['player'],confirmed:false},
 navigation:{location:'Не определено',transport:'Не определено',relationship:'Не определено',access:[],route:'',ship:null,routeId:null,journeyId:null,routeAuthority:false},battle:{active:false,round:1,notes:'',order:[]}};}
export function ledger(){return {schema:1,version:VERSION,profileCreated:false,profileStarted:false,base:initialState(),events:[],rolls:{},sequence:0};}
export function messagePath(chat){return chat.map((message,index)=>{
 message.extra ??= {};message.extra.voidhub ??= {};message.extra.voidhub.uid ??= uid();
 return `${message.extra.voidhub.uid}:${hash(`${message.is_user?'user':'assistant'}:${message.name}:${message.mes}`)}`;
});}
export function prefix(parent,path){return parent.length<=path.length&&parent.every((v,i)=>v===path[i]);}
export function activeEvents(book,path){return book.events.filter(e=>prefix(e.path,path)).sort((a,b)=>a.path.length-b.path.length||a.seq-b.seq);}
export function addEvent(book,path,kind,payload,{id=uid(),source='manual'}={}){
 const old=book.events.find(e=>e.id===id&&JSON.stringify(e.path)===JSON.stringify(path));
 const entry={id,path:[...path],kind,payload:clone(payload),source,seq:old?.seq??++book.sequence};
 if(old)book.events[book.events.indexOf(old)]=entry;else book.events.push(entry);
 return entry;
}
const text = (v,fallback='') => typeof v==='string'?v:fallback;
const array = v => Array.isArray(v)?v:[];
function safeValue(value){
 if(value===null||['string','number','boolean'].includes(typeof value))return value;
 if(Array.isArray(value))return value.map(safeValue);
 if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value))if(!['__proto__','prototype','constructor'].includes(k))out[k]=safeValue(v);return out;}
 throw Error('Неподдерживаемое значение данных');
}
export function normalActor(input){
 const base=actor(),out=safeValue({...base,...input});
 out.id=text(out.id)||uid();out.name=text(out.name)||'Без имени';
 out.maxHp=clamp(Number(out.maxHp)||100,1,100000);out.hp=clamp(Number(out.hp)||0,0,out.maxHp);
 out.stats=Object.fromEntries(Object.keys(STAT_NAMES).map(k=>[k,clamp(Number(out.stats?.[k])||50,1,100)]));
 for(const key of ['wounds','effects','traits','permissions','weaponIds','abilityIds'])out[key]=array(out[key]);
 out.effects=out.effects.map(normalizeEffect);out.cooldowns=out.cooldowns&&typeof out.cooldowns==='object'&&!Array.isArray(out.cooldowns)?out.cooldowns:{};
 out.anatomy=out.anatomy&&typeof out.anatomy==='object'&&!Array.isArray(out.anatomy)&&Object.keys(out.anatomy).length?out.anatomy:clone(REGIONS);
 for(const key of ['armor','naturalArmor'])out[key]=out[key]&&typeof out[key]==='object'&&!Array.isArray(out[key])?Object.fromEntries(Object.entries(out[key]).map(([region,value])=>[region,clamp(Number(value)||0,0,10000)])):{};
 return out;
}
export function parseDice(expression){
 const match=/^(\d{1,2})d(\d{1,4})(?:\s*([+-])\s*(\d{1,5}))?$/i.exec(String(expression).trim());
 if(!match)throw Error('Урон: используйте запись вроде 2d10+20');
 const [,n,s,sign,b]=match,count=Number(n),sides=Number(s),bonus=Number(b||0)*(sign==='-'?-1:1);
 if(count<1||count>30||sides<2||sides>1000)throw Error('Недопустимые кубики');
 return {count,sides,bonus};
}
export function randomDie(sides){
 if(!globalThis.crypto?.getRandomValues)throw Error('Недоступен генератор случайных чисел браузера');
 const max=0x100000000,limit=max-max%sides,buffer=new Uint32Array(1);let value;
 do{globalThis.crypto.getRandomValues(buffer);value=buffer[0];}while(value>=limit);
 return value%sides+1;
}
export function rollDice(expression,die=randomDie){const {count,sides,bonus}=parseDice(expression),rolls=Array.from({length:count},()=>die(sides));return {expression,rolls,bonus,total:Math.max(0,rolls.reduce((a,b)=>a+b,0)+bonus)};}
export function findActor(state,id){return id==='player'?state.player:[...state.squad,...state.enemies].find(a=>a.id===id);}
export function validateRecord(collection,input){
 const record=safeValue(input);
 if(!record||typeof record!=='object'||Array.isArray(record))throw Error('Запись должна быть объектом');
 record.id=text(record.id)||uid();
 if(collection==='squad'||collection==='enemies')return normalActor(record);
 if(collection==='weapons'){
  parseDice(record.damage);record.name=text(record.name)||'Оружие';
  record.mode=record.mode==='melee'?'melee':'ranged';record.penetration=clamp(Number(record.penetration)||0,0,10000);
  record.ammo=record.ammo===null?null:clamp(Number(record.ammo)||0,0,100000);
  record.cost=clamp(Number(record.cost)||1,1,1000);record.type=text(record.type)||'кинетический';
 }
 if(collection==='inventory'){record.amount=Math.max(0,Number(record.amount??record.value)||0);record.tag=text(record.tag)||'item';record.ownerId=text(record.ownerId)||'player';}
 if(collection==='abilities'){
  record.name=text(record.name)||'Способность';record.kind=['damage','heal','effect','cleanse','reanimate'].includes(record.kind)?record.kind:'damage';
  if(record.kind==='effect'&&!EFFECT_TEMPLATES.some(e=>e.id===record.effectId))throw Error('Выберите существующий эффект способности');
  record.resist=['will','toughness'].includes(record.resist)?record.resist:'';
  record.skill=Object.hasOwn(STAT_NAMES,record.skill)?record.skill:'will';record.power=text(record.power)||'2d10+20';parseDice(record.power);
  record.penetration=clamp(Number(record.penetration)||0,0,10000);record.charges=record.charges===null?null:clamp(Number(record.charges)||0,0,100000);record.cooldown=Math.floor(clamp(Number(record.cooldown)||0,0,1000));
  record.psychic=Boolean(record.psychic);record.allowedSpecies=array(record.allowedSpecies).map(String);record.targetPhysiology=text(record.targetPhysiology)||'any';
 }
 if(collection==='armor'){record.name=text(record.name)||'Броня';record.protection=clamp(Number(record.protection)||0,0,10000);record.regions=array(record.regions).map(String);}
 if(collection==='missions'){
  if(!['available','active','completed','failed','abandoned','declined'].includes(record.status))record.status='available';
  record.goals=array(record.goals).map(g=>typeof g==='string'?{text:g,done:false}:{text:text(g.text),done:Boolean(g.done),required:g.required!==false});
 }
 if(collection==='channels'){
  record.name=text(record.name)||'Канал';record.participants=array(record.participants).map(String);
  record.messages=array(record.messages).map(m=>({...m,from:text(m.from),text:text(m.text)}));
 }
 return normalWorldRecord(collection,normalCampaignRecord(collection,record));
}
export function validateUpdate(input){
 const change=safeValue(input);if(!change||typeof change!=='object'||Array.isArray(change))throw Error('Обновление должно быть объектом');
 const out={};
 if(change.player)out.player=change.player;
 if(change.navigation)out.navigation=change.navigation;if(change.scene)out.scene=change.scene;
 if(change.battle)out.battle=change.battle;
 for(const c of COLLECTIONS)if(change[c]!==undefined){if(!Array.isArray(change[c]))throw Error(`${c}: ожидается список`);out[c]=change[c].map(r=>validateRecord(c,r));}
 return out;
}
function mergeRecords(existing,incoming){for(const record of incoming){const index=existing.findIndex(r=>r.id===record.id);if(index<0)existing.push(clone(record));else existing[index]={...existing[index],...clone(record)};}}
export function applyEvent(state,event){
 if(event.kind==='update'){
  const change=validateUpdate(event.payload);
  if(change.player)state.player=normalActor({...state.player,...change.player,stats:{...state.player.stats,...change.player.stats}});
  if(change.navigation)Object.assign(state.navigation,change.navigation);if(change.scene)Object.assign(state.scene,change.scene);
  if(change.battle)Object.assign(state.battle,change.battle);
  for(const c of COLLECTIONS)if(change[c])mergeRecords(state[c],change[c]);
 }else if(event.kind==='remove'){
  const {collection,id}=event.payload;if(COLLECTIONS.includes(collection))state[collection]=state[collection].filter(r=>r.id!==id);
 }else if(event.kind==='mechanic'){applyEvent(state,{kind:'update',payload:event.payload.patch});
 }else if(event.kind==='attack'){
  const result=event.payload,source=findActor(state,result.actorId),target=findActor(state,result.targetId),weapon=state.weapons.find(w=>w.id===result.weaponId);
  if(!source||!target||!weapon)return;
  if(weapon.ammo!==null&&weapon.mode==='ranged')weapon.ammo=Math.max(0,weapon.ammo-result.ammoSpent);
  target.hp=Math.max(0,target.hp-result.damage);applyShieldUses(target,result.shieldUses);
  if(result.damage>0){
   target.wounds.push({id:result.id,region:result.region,name:result.woundName,severity:result.severity,damage:result.damage,source:result.id,treated:false});
   target.status=target.hp===0?'Выведен из боя':'Повреждён';
  }
  state.battle.active=true;
 }else if(event.kind==='vox'){
  const channel=state.channels.find(c=>c.id===event.payload.channelId);
  if(channel&&!channel.messages.some(m=>m.id===event.payload.message.id))channel.messages.push(clone(event.payload.message));
 }else if(event.kind==='replace'){
  const replacement=validateState(event.payload);for(const key of Object.keys(state))delete state[key];Object.assign(state,replacement);
 }
 return state;
}
export function replay(book,path){const state=validateState(book.base);for(const event of activeEvents(book,path))applyEvent(state,event);return state;}
export function validateState(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Неверный формат кампании');
 const state=initialState();state.player=normalActor(input.player||state.player);
 for(const c of COLLECTIONS)state[c]=array(input[c]).map(v=>validateRecord(c,v));
 if(input.navigation)Object.assign(state.navigation,safeValue(input.navigation));if(input.scene)Object.assign(state.scene,safeValue(input.scene));
 if(input.battle)Object.assign(state.battle,safeValue(input.battle));
 return state;
}
export function validateLedger(input){
 if(input?.schema!==1||!Array.isArray(input.events))throw Error('Это не экспорт VOIDHUB версии 1');
 const result=ledger();result.base=validateState(input.base);
 const kinds=['update','remove','attack','mechanic','vox','replace'];
 result.events=input.events.map(e=>{
  if(!kinds.includes(e.kind)||!Array.isArray(e.path)||!e.path.every(p=>typeof p==='string'))throw Error('Повреждён журнал событий');
  if(e.kind==='update')validateUpdate(e.payload);if(e.kind==='mechanic')validateUpdate(e.payload.patch);if(e.kind==='replace')validateState(e.payload);
  return safeValue(e);
 });
 result.profileCreated=input.profileCreated===true;result.profileStarted=input.profileStarted===true;
 result.rolls=safeValue(input.rolls||{});result.sequence=Math.max(Number(input.sequence)||0,...result.events.map(e=>Number(e.seq)||0));return result;
}
export function resolveAttack(state,action,id,die=randomDie){
 const source=findActor(state,action.actorId||'player'),target=findActor(state,action.targetId),weapon=state.weapons.find(w=>w.id===action.weaponId);
 if(!source||!target||!weapon)throw Error('Выберите существующего участника, цель и оружие');
 if(blocked(source))throw Error('Эффект не позволяет участнику действовать');
 if(source.destroyed||target.destroyed)throw Error('Участник окончательно выведен из игры');
 if(source.hp<=0||target.hp<=0)throw Error('Участник или цель уже выведены из боя');
 if(weapon.returned||(weapon.custodyId&&weapon.custodyId!==source.id&&weapon.custodyId!=='party'))throw Error('Оружие возвращено или находится у другого владельца');
 if(!source.weaponIds.includes(weapon.id))throw Error('Это оружие не назначено атакующему');
 if(weapon.mode==='ranged'&&weapon.ammo!==null&&weapon.ammo<weapon.cost)throw Error('Недостаточно боеприпасов');
 const modifiers=array(action.modifiers).map(m=>({reason:text(m.reason)||'Модификатор',value:clamp(Number(m.value)||0,-50,50)}));
 const aimed=action.region&&Object.hasOwn(target.anatomy,action.region);
 if(aimed)modifiers.push({reason:'Прицельная атака',value:-20});
 const skill=weapon.mode==='melee'?'melee':'ranged';modifiers.push(...effectModifiers(source,skill),...incomingModifiers(target));
 const chance=clamp(source.stats[skill]+modifiers.reduce((s,m)=>s+m.value,0),5,95),hitRoll=die(100),hit=hitRoll<=chance;
 const regions=Object.keys(target.anatomy),region=aimed?action.region:regions[die(regions.length)-1];
 const damageRoll=hit?rollDice(weapon.damage,die):{expression:weapon.damage,rolls:[],bonus:0,total:0};
 const strengthBonus=hit&&weapon.mode==='melee'?Math.floor(effectiveStat(source,'strength')/10):0;
 const raw=damageRoll.total+strengthBonus;
 const equippedArmor=Math.max(0,Number(target.armor?.[region])||0),naturalArmor=Math.max(0,Number(target.naturalArmor?.[region])||0),armor=equippedArmor+naturalArmor,protection=Math.max(0,armor-weapon.penetration);
 const impact=shieldImpact(target,hit?Math.max(0,raw-protection):0),damage=impact.damage;
 const ratio=damage/target.maxHp,severity=ratio>=.25?'Тяжёлое':ratio>=.1?'Серьёзное':'Лёгкое';
 const woundName=/энерг|огонь|плазм|лазер/i.test(weapon.type)?'Ожог':/реж|клин|меч/i.test(weapon.type)?'Рассечение':'Повреждение';
 return {id,actorId:source.id,targetId:target.id,weaponId:weapon.id,actorName:source.name,targetName:target.name,weaponName:weapon.name,modifiers,chance,hitRoll,hit,region,regionName:target.anatomy[region],damageRoll,strengthBonus,equippedArmor,naturalArmor,penetration:weapon.penetration,protection,shieldAbsorbed:impact.absorbed,shieldUses:impact.uses,damage,hpBefore:target.hp,hpAfter:Math.max(0,target.hp-damage),severity,woundName,ammoSpent:weapon.mode==='ranged'?weapon.cost:0};
}
export function attackReport(result){return `${result.actorName} → ${result.targetName}: ${result.weaponName}\nШанс ${result.chance}%; d100: ${result.hitRoll} — ${result.hit?'попадание':'промах'}. ${result.modifiers.map(m=>`${m.reason}: ${m.value>0?'+':''}${m.value}`).join('; ')}\n${result.hit?`Область: ${result.regionName}. Урон ${result.damageRoll.expression}: ${result.damageRoll.rolls.join(' + ')} ${result.damageRoll.bonus>=0?'+':''}${result.damageRoll.bonus}${result.strengthBonus?` + сила ${result.strengthBonus}`:''}; защита ${result.protection}${result.naturalArmor!==undefined?` (броня ${result.equippedArmor} + природная ${result.naturalArmor} − пробитие ${result.penetration})`:""}; поле ${result.shieldAbsorbed||0}; итог ${result.damage}. Здоровье ${result.hpBefore} → ${result.hpAfter}.`:''}`;}
export function accessibleChannels(state,viewer='player'){return state.channels.filter(c=>c.public||c.participants.includes(viewer)||c.participants.includes(viewer==='player'?'{{user}}':viewer));}
export function contextState(state,viewer='player'){const value=clone(state);value.channels=accessibleChannels(state,viewer);value.enemies=value.enemies.filter(e=>e.visible!==false);value.memories=visibleMemories(state,viewer);value.relationships=value.relationships.filter(r=>r.confirmed&&(viewer==='player'||r.npcId===viewer)).map(withoutProposal);value.offers=value.offers.filter(o=>o.confirmed&&(viewer==='player'||o.providerId===viewer)).map(withoutProposal);value.threats=knownThreats(state,viewer);return value;}
