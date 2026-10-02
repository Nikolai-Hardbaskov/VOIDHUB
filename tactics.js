import {clone,findActor,resolveAttack,attackReport,rollDice,randomDie,clamp,validateRecord,applyEvent} from './core.js';
import {EFFECT_TEMPLATES,effectFromTemplate,physiologyOf,effectiveStat,blocked,activeEffects,addEffect,shieldImpact,applyShieldUses} from './effects.js';
export const ABILITY_TEMPLATES=[
 {id:'warp-bolt',name:'Пси-разряд',kind:'damage',power:'3d10+20',penetration:18,skill:'will',psychic:true,cooldown:1,charges:null,description:'Одна цель. На d100 96–100 — опасность Варпа: 2d10+10 урона самому псайкеру.'},
 {id:'psychic-ward',name:'Пси-защита',kind:'effect',effectId:'ward',power:'1d10',skill:'will',psychic:true,cooldown:2,charges:null},
 {id:'psychic-terror',name:'Пси-ужас',kind:'effect',effectId:'shaken',power:'1d10',skill:'will',psychic:true,resist:'will',cooldown:2,charges:null},
 {id:'living-metal',name:'Восстановление живого металла',kind:'heal',power:'2d10+10',skill:'toughness',targetPhysiology:'mechanical',allowedSpecies:['некрон'],selfOnly:true,cooldown:2,charges:null},
 {id:'reanimation',name:'Протокол реанимации',kind:'reanimate',power:'2d10+20',skill:'toughness',allowedSpecies:['некрон'],selfOnly:true,cooldown:0,charges:null,description:'Один раз за бой для целого, но выведенного из боя некрона. Не восстанавливает полностью уничтоженное тело.'},
 {id:'tyranid-regeneration',name:'Регенерация организма',kind:'heal',power:'2d10+20',skill:'toughness',targetPhysiology:'biological',allowedSpecies:['тиранид'],selfOnly:true,cooldown:2,charges:null,description:'Особенность выбранного организма; не назначается всем тиранидам автоматически.'},
 {id:'warp-form',name:'Восстановление варп-формы',kind:'heal',power:'2d10+15',skill:'will',targetPhysiology:'warp',allowedSpecies:['демон'],selfOnly:true,cooldown:2,charges:3},
 {id:'ork-warcry',name:'Орочий боевой клич',kind:'effect',effectId:'fury',power:'1d10',skill:'will',allowedSpecies:['орк'],cooldown:2,charges:null},
 {id:'battle-focus',name:'Боевая сосредоточенность',kind:'effect',effectId:'focused',power:'1d10',skill:'will',allowedSpecies:['аэльдари','друкари'],selfOnly:true,cooldown:2,charges:null},
 {id:'targeting',name:'Контур прицеливания',kind:'effect',effectId:'focused',power:'1d10',skill:'ranged',allowedSpecies:['тау','вотанн'],selfOnly:true,cooldown:2,charges:3,description:'Требует соответствующего устройства в истории.'},
 {id:'resolve',name:'Взять себя в руки',kind:'cleanse',power:'1d10',skill:'will',cooldown:1,charges:null,selfOnly:true},
 {id:'evasive',name:'Манёвр уклонения',kind:'effect',effectId:'evasive',power:'1d10',skill:'reaction',selfOnly:true,cooldown:1,charges:null},
];
export function abilityFromTemplate(templateId,id){const t=ABILITY_TEMPLATES.find(t=>t.id===templateId);if(!t)throw Error('Неизвестная способность');return validateRecord('abilities',{penetration:0,allowedSpecies:[],targetPhysiology:'any',...clone(t),id,templateId});}
export const participants=state=>[state.player,...state.squad,...state.enemies.filter(a=>a.visible!==false)];
function actorPatch(actors){const patch={squad:[],enemies:[]};for(const a of actors){if(a.id==='player')patch.player=clone(a);else if(a._collection==='squad')patch.squad.push(withoutCollection(a));else patch.enemies.push(withoutCollection(a));}return patch;}
function withoutCollection(a){const copy=clone(a);delete copy._collection;return copy;}
function draftActor(state,id){const a=findActor(state,id);if(!a)throw Error('Неизвестный участник');return {...clone(a),...(id!=='player'?{_collection:state.squad.some(a=>a.id===id)?'squad':'enemies'}:{})};}
function mechanic(id,kind,patch,report,extra={}){return {id,kind,patch,report,...extra};}
export function reportFor(result){return !result.kind||result.kind==='attack'?attackReport(result):result.report;}
export function eventKind(result){return !result.kind||result.kind==='attack'?'attack':'mechanic';}
export function resolveInitiative(state,id,die=randomDie,start=false){
 const actors=participants(state).filter(a=>a.hp>0&&!a.destroyed),previous=start?[]:state.battle.order||[];
 const order=actors.map(a=>{const roll=previous.find(r=>r.actorId===a.id)?.die??die(10),reaction=effectiveStat(a,'reaction');return {actorId:a.id,name:a.name,die:roll,reaction,score:reaction+roll};}).sort((a,b)=>b.score-a.score||b.reaction-a.reaction||a.actorId.localeCompare(b.actorId));
 const patch={battle:{active:true,round:start?1:state.battle.round||1,order,acted:[]}};
 if(start)Object.assign(patch,actorPatch(participants(state).map(a=>({...draftActor(state,a.id),reanimationUsed:false,cooldowns:{}}))));
 return mechanic(id,'initiative',patch,`Инициатива — реакция + d10:\n${order.map((a,i)=>`${i+1}. ${a.name}: ${a.score} (${a.reaction} + ${a.die})`).join('\n')}`);
}
function assertAlive(a){if(a.destroyed)throw Error('Персонаж окончательно погиб или тело уничтожено');if(a.hp<=0)throw Error('Участник выведен из боя');if(blocked(a))throw Error('Участник не может действовать из-за эффекта');}
function check(a,skill,die,bonus=0){const chance=clamp(effectiveStat(a,skill)+bonus,5,95),roll=die(100);return {chance,roll,success:roll<=chance};}
const checkText=c=>`d100 ${c.roll} / ${c.chance}% — ${c.success?'успех':'неудача'}`;
function harm(a,amount,id,name,region='chest'){const key=Object.hasOwn(a.anatomy,region)?region:Object.keys(a.anatomy)[0],damage=Math.min(a.hp,Math.max(0,amount));a.hp=Math.max(0,a.hp-amount);if(amount>0){a.wounds.push({id,region:key,name,severity:amount/a.maxHp>=.25?'Тяжёлое':amount/a.maxHp>=.1?'Серьёзное':'Лёгкое',damage:amount,treated:false,source:id});a.status=a.hp===0?'Выведен из боя':'Повреждён';a.stabilized=false;}return damage;}
function restore(a,amount){const before=a.hp;a.hp=Math.min(a.maxHp,a.hp+amount);if(a.hp>0){a.status=a.wounds.some(w=>!w.treated)?'Повреждён':'Восстанавливается';a.stabilized=false;}return a.hp-before;}
export function availableSupply(state,sourceId,tag){const ally=sourceId==='player'||state.squad.some(a=>a.id===sourceId);return state.inventory.filter(item=>item.tag===tag&&Number(item.amount)>0&&((item.ownerId||'player')===sourceId||item.ownerId==='party'&&ally));}
export function resolveTreatment(state,action,id,die=randomDie){
 const source=draftActor(state,action.actorId||'player'),target=source.id===action.targetId?source:draftActor(state,action.targetId);assertAlive(source);
 if(target.destroyed)throw Error('Лечение не возвращает окончательно погибшего персонажа');
 const kind=action.kind||'heal',physiology=physiologyOf(target),repair=kind==='repair',tag=repair?'repairkit':'medkit';
 if(repair&&!['mechanical','mixed'].includes(physiology)||!repair&&!['biological','mixed'].includes(physiology))throw Error(repair?'Этому телу требуется подходящий вид восстановления':'Обычная медицина не подходит этому телу');
 if(kind==='stabilize'&&target.hp!==0)throw Error('Стабилизация предназначена для участника с HP 0');
 if(kind!=='stabilize'&&target.hp===0&&(state.battle.active||!repair&&!target.stabilized))throw Error('Сначала стабилизируйте пострадавшего; лечение при HP 0 возможно вне боя. Для ремонта в бою нужен протокол реанимации.');
 if(kind!=='stabilize'&&target.hp>=target.maxHp&&!target.wounds.some(w=>!w.treated)&&!activeEffects(target).some(e=>e.templateId==='bleeding'))throw Error('Лечение сейчас не требуется');
 const supply=availableSupply(state,source.id,tag).find(i=>i.id===action.supplyId);if(!supply)throw Error(repair?'Нужен доступный ремонтный комплект':'Нужен доступный медицинский комплект');
 const used={...clone(supply),amount:Number(supply.amount)-1},c=check(source,'will',die,10),before=target.hp;let recovery=null;
 if(c.success){
  target.effects=target.effects.filter(e=>e.templateId!=='bleeding');
  if(kind==='stabilize'){target.stabilized=true;target.status='Стабилизирован · вне боя';}
  else{recovery=rollDice('2d10+10',die);restore(target,recovery.total);const wound=target.wounds.find(w=>w.id===action.woundId)||target.wounds.find(w=>!w.treated);if(wound)wound.treated=true;}
 }
 const title=kind==='stabilize'?'Стабилизация':repair?'Ремонт':'Первая помощь';
 return mechanic(id,'treatment',{...actorPatch(source===target?[target]:[source,target]),inventory:[used]},`${source.name} → ${target.name}: ${title}. ${checkText(c)}.\n${supply.name}: −1, осталось ${used.amount}. ${kind==='stabilize'&&c.success?'Пострадавший стабилизирован; HP остаётся 0.':`HP ${before} → ${target.hp}${recovery?`; ${recovery.expression}: ${recovery.rolls.join(' + ')} + 10`:''}.`}\nОбработка раны не означает полного заживления.`,{actorId:source.id,targetId:target.id,supplyId:supply.id});
}
export function canUseAbility(source,ability){
 if(!source.abilityIds.includes(ability.id))return 'Способность не назначена участнику';
 if(ability.allowedSpecies?.length&&!ability.allowedSpecies.includes(source.species))return 'Способность не подходит выбранной расе';
 if(ability.psychic){if(!source.psychic)return 'Доступ к Варпу не подтверждён';if(['тау','некрон','кустодий','друкари'].includes(source.species)&&!source.psychicOverride)return 'Для этой расы нужно явно подтверждённое исключение из обычного лора';}
 if(ability.charges!==null&&ability.charges<=0)return 'Нет зарядов';return '';
}
export function resolveAbility(state,action,id,die=randomDie){
 const ability=state.abilities.find(a=>a.id===action.abilityId);if(!ability)throw Error('Неизвестная способность');
 const source=draftActor(state,action.actorId||'player'),target=action.targetId===source.id?source:draftActor(state,action.targetId),error=canUseAbility(source,ability);if(error)throw Error(error);
 if(ability.kind!=='reanimate')assertAlive(source);else if(source.destroyed)throw Error('Уничтоженное тело не может реанимироваться');
 if(ability.selfOnly&&target.id!==source.id)throw Error('Эта способность действует только на владельца');
 if(target.destroyed)throw Error('Цель окончательно выведена из игры');
 if(state.battle.active&&(source.cooldowns[ability.id]||0)>(state.battle.round||1))throw Error('Способность ещё восстанавливается');
 if(ability.kind==='reanimate'&&(target.hp!==0||source.species!=='некрон'||target.species!=='некрон'||target.reanimationUsed))throw Error('Протокол возможен для выведенного из боя некрона один раз за бой');
 if(ability.kind!=='reanimate'&&target.hp<=0)throw Error('Для HP 0 требуется стабилизация или протокол реанимации');
 if(ability.kind==='heal'&&ability.targetPhysiology!=='any'&&physiologyOf(target)!==ability.targetPhysiology)throw Error('Тип восстановления не подходит телу цели');
 if(ability.kind==='heal'&&target.hp===target.maxHp)throw Error('HP уже восстановлены');
 const used={...clone(ability),charges:ability.charges===null?null:ability.charges-1},c=check(source,ability.skill,die);source.cooldowns[ability.id]=(state.battle.round||1)+(state.battle.active?ability.cooldown:0);
 if(ability.kind==='reanimate')target.reanimationUsed=true;
 const report=[`${source.name} → ${target.name}: ${ability.name}. ${checkText(c)}.`];
 let accepted=c.success;
 if(accepted&&ability.resist){const save=check(target,ability.resist,die);report.push(`Сопротивление ${target.name}: ${checkText(save)}.`);accepted=!save.success;}
 if(accepted){
  if(ability.kind==='damage'){
   const region=action.region&&Object.hasOwn(target.anatomy,action.region)?action.region:Object.keys(target.anatomy)[die(Object.keys(target.anatomy).length)-1];
   const power=rollDice(ability.power,die),protection=Math.max(0,(target.armor[region]||0)+(target.naturalArmor[region]||0)-ability.penetration),impact=shieldImpact(target,Math.max(0,power.total-protection)),before=target.hp;
   applyShieldUses(target,impact.uses);harm(target,impact.damage,id,ability.psychic?'Пси-повреждение':'Особое повреждение',region);
   report.push(`${target.anatomy[region]}: ${ability.power} = ${power.total}; защита ${protection}, поле ${impact.absorbed}, урон ${impact.damage}. HP ${before} → ${target.hp}.`);
  }else if(['heal','reanimate'].includes(ability.kind)){
   const power=rollDice(ability.power,die),before=target.hp;restore(target,power.total);report.push(`${ability.power} = ${power.total}. HP ${before} → ${target.hp}. Ранения сохраняются.`);
  }else if(ability.kind==='effect'){
   const effect=effectFromTemplate(ability.effectId,id+':effect');if(effect.biological&&!['biological','mixed'].includes(physiologyOf(target)))throw Error('Биологический эффект не подходит цели');
   if(effect.blockAction&&(state.battle.acted||[]).includes(target.id)&&effect.remaining!==null)effect.remaining+=1;
   addEffect(target,effect);report.push(`Эффект: ${effect.name}, срок ${effect.remaining??'до снятия'}.`);
  }else if(ability.kind==='cleanse'){target.effects=target.effects.filter(e=>!['shaken','suppressed'].includes(e.templateId));report.push('Потрясение и подавление сняты.');}
 }
 if(ability.psychic&&c.roll>=96){const backlash=rollDice('2d10+10',die),before=source.hp;harm(source,backlash.total,id+':warp','Опасность Варпа');report.push(`Опасность Варпа: ${backlash.expression} = ${backlash.total}, HP ${before} → ${source.hp}. Броня и поле не защищают от внутреннего срыва; сюжетные последствия описывает ИИ.`);}
 return mechanic(id,'ability',{...actorPatch(source===target?[source]:[source,target]),abilities:[used]},report.join('\n'),{actorId:source.id,targetId:target.id,abilityId:ability.id});
}
export function resolveRound(state,id,die=randomDie){
 const changes=[],reports=[];
 for(const original of participants(state)){
  const a=draftActor(state,original.id),next=[];let changed=false;
  for(const old of a.effects){
   if(typeof old==='string'||!old.templateId){next.push(old);continue;}
   if(old.remaining===0){changed=true;continue;}
   const effect=clone(old);let removed=false;
   if(effect.biological&&!['biological','mixed'].includes(physiologyOf(a))){reports.push(`${a.name}: ${effect.name} снят — не подходит телу.`);changed=true;continue;}
   if(effect.save&&effect.saveBefore&&a.hp>0){const c=check(a,effect.save,die);reports.push(`${a.name}: ${effect.name}, ${checkText(c)}.`);removed=c.success;}
   if(!removed&&effect.dot&&a.hp>0){const roll=rollDice(effect.dot,die),before=a.hp;harm(a,roll.total,id+':'+a.id+':'+effect.id,effect.name);reports.push(`${a.name}: ${effect.name}, ${effect.dot} = ${roll.total}. HP ${before} → ${a.hp}.`);changed=true;}
   if(!removed&&effect.save&&!effect.saveBefore&&a.hp>0){const c=check(a,effect.save,die);reports.push(`${a.name}: прекращение ${effect.name}, ${checkText(c)}.`);removed=c.success;}
   if(effect.remaining!==null&&effect.remaining!==undefined){effect.remaining=Math.max(0,effect.remaining-1);changed=true;if(effect.remaining===0)removed=true;}
   if(!removed)next.push(effect);else{changed=true;reports.push(`${a.name}: ${effect.name} закончился.`);}
  }
  if(changed){a.effects=next;changes.push(a);}
 }
 const round=Number(state.battle.round)||1;
 return mechanic(id,'round',{...actorPatch(changes),battle:{round:round+1}},`Завершён раунд ${round}.\n${reports.join('\n')||'Периодических изменений нет.'}\nСледующий раунд: ${round+1}.`);
}
export function resolveAction(state,action,id,die=randomDie){
 const kind=action.kind||'attack';
 if(kind==='attack')return {...resolveAttack(state,action,id,die),kind:'attack'};
 if(['heal','repair','stabilize'].includes(kind))return resolveTreatment(state,action,id,die);
 if(kind==='ability')return resolveAbility(state,action,id,die);
 if(kind==='round')return resolveRound(state,id,die);
 if(kind==='start'){if(state.battle.active)throw Error('Бой уже идёт; завершите текущий бой по истории');return resolveInitiative(state,id,die,true);}
 if(kind==='end')return mechanic(id,'end',{battle:{active:false,order:[]}},'Бой завершён. Оставшиеся ранения и эффекты сохраняются.');
 if(kind==='wait'){const a=findActor(state,action.actorId||'player');if(!a)throw Error('Неизвестный участник');return mechanic(id,'wait',{},`${a.name} пропускает действие.`,{actorId:a.id});}
 throw Error('Неизвестный тип действия');
}
export function tacticalGuide(){return JSON.stringify({rules:'Одна атака/помощь/способность каждого участника в раунд. Боевое действие пользователя запускает один полный раунд: действия идут по инициативе; невыбранные участники ждут; эффекты обрабатываются один раз в конце. Обычная реплика не двигает время. Начало/конец боя и продвижение времени — только явно выбранное действие. kind: attack|heal|repair|stabilize|ability|wait|start|end|round. Лечение/ремонт: supplyId доступного inventory с tag medkit/repairkit, amount>0, ownerId=actorId или party; проверка воли+10; расход 1 на попытку. При HP0 — сначала стабилизация; она оставляет HP0. Способности только из назначенных abilityIds, без выдуманных сил; psychic должен быть подтверждён. Не рассчитывай кубики, не меняй числовые результаты.',effects:EFFECT_TEMPLATES.map(e=>[e.id,e.name,e.remaining]),abilities:ABILITY_TEMPLATES.map(a=>[a.id,a.name,a.kind])});}
