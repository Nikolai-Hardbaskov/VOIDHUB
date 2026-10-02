// Original tactical effect definitions. Legacy text effects remain descriptive.
const copy=value=>JSON.parse(JSON.stringify(value));
const bounded=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
export const EFFECT_TEMPLATES=[
 {id:'bleeding',name:'Кровотечение',remaining:null,dot:'1d10+3',biological:true,description:'Урон в конце раунда до обработки раны.'},
 {id:'burning',name:'Горение',remaining:3,dot:'2d10+5',save:'toughness',description:'Урон в конце раунда; успешная проверка стойкости гасит огонь после урона.'},
 {id:'poisoned',name:'Отравление',remaining:3,dot:'1d10+2',save:'toughness',saveBefore:true,biological:true,description:'Стойкость перед уроном; успех снимает эффект.'},
 {id:'stunned',name:'Оглушение',remaining:1,blockAction:true,description:'Пропуск действия. Снимается после пропущенного раунда.'},
 {id:'suppressed',name:'Подавление',remaining:2,modifiers:{ranged:-20,reaction:-10},description:'Стрельба −20, инициатива −10.'},
 {id:'shaken',name:'Потрясение',remaining:2,modifiers:{ranged:-10,melee:-10,will:-20},description:'Стрельба и ближний бой −10, воля −20.'},
 {id:'focused',name:'Сосредоточенность',remaining:2,modifiers:{ranged:10,reaction:10},description:'Стрельба +10, инициатива +10.'},
 {id:'fury',name:'Боевой напор',remaining:2,modifiers:{melee:10,strength:10,will:10},description:'Ближний бой, сила и воля +10.'},
 {id:'ward',name:'Защитное поле',remaining:2,shieldPoints:40,description:'Поглощает до 40 урона после брони; остаток расходуется при попаданиях.'},
 {id:'evasive',name:'Манёвр уклонения',remaining:2,incomingModifier:-20,description:'Попадание по владельцу −20 до конца следующего боевого раунда.'},
];
export function physiologyOf(actor){return actor.physiology&&actor.physiology!=='auto'?actor.physiology:actor.species==='некрон'?'mechanical':actor.species==='демон'?'warp':'biological';}
export function effectFromTemplate(templateId,id,overrides={}){const template=EFFECT_TEMPLATES.find(e=>e.id===templateId);if(!template)throw Error('Неизвестный эффект');return normalizeEffect({...copy(template),id,templateId,...overrides});}
export function normalizeEffect(effect){
 if(typeof effect==='string')return effect;
 if(!effect||typeof effect!=='object'||Array.isArray(effect))throw Error('Неверный эффект');
 const template=EFFECT_TEMPLATES.find(e=>e.id===effect.templateId),out={...copy(template||{}),...copy(effect)};
 out.name=typeof out.name==='string'?out.name:'Эффект';out.id=typeof out.id==='string'&&out.id?out.id:'effect:'+(out.templateId||out.name);
 out.remaining=out.remaining===null||out.remaining===undefined?null:Math.floor(bounded(out.remaining,0,1000));
 out.modifiers=Object.fromEntries(Object.entries(out.modifiers||{}).filter(([k])=>['ranged','melee','strength','toughness','reaction','will'].includes(k)).map(([k,v])=>[k,bounded(v,-50,50)]));
 if(out.shieldPoints!==undefined)out.shieldPoints=bounded(out.shieldPoints,0,10000);
 out.incomingModifier=bounded(out.incomingModifier,-50,50);return out;
}
export function activeEffects(actor){return (actor.effects||[]).filter(e=>typeof e==='object'&&e&&(e.remaining===null||e.remaining===undefined||e.remaining>0));}
export function effectiveStat(actor,skill){return bounded((actor.stats[skill]||1)+activeEffects(actor).reduce((s,e)=>s+(e.modifiers?.[skill]||0),0),1,100);}
export function blocked(actor){return activeEffects(actor).some(e=>e.blockAction);}
export function effectModifiers(actor,skill){return activeEffects(actor).filter(e=>e.modifiers?.[skill]).map(e=>({reason:e.name,value:e.modifiers[skill]}));}
export function incomingModifiers(actor){return activeEffects(actor).filter(e=>e.incomingModifier).map(e=>({reason:e.name,value:e.incomingModifier}));}
export function shieldImpact(actor,damage){let remaining=damage;const uses=[];for(const e of activeEffects(actor)){if(!e.shieldPoints)continue;const used=Math.min(remaining,e.shieldPoints);if(used){uses.push({id:e.id,index:actor.effects.indexOf(e),used});remaining-=used;}if(!remaining)break;}return {damage:remaining,absorbed:damage-remaining,uses};}
export function applyShieldUses(actor,uses=[]){for(const use of uses){const effect=actor.effects[use.index]?.id===use.id?actor.effects[use.index]:actor.effects.find(e=>e.id===use.id);if(effect)effect.shieldPoints=Math.max(0,effect.shieldPoints-use.used);}}
export function addEffect(actor,effect){const existing=actor.effects.find(e=>typeof e==='object'&&e.templateId&&e.templateId===effect.templateId);if(existing){existing.remaining=existing.remaining===null||effect.remaining===null?null:Math.max(existing.remaining,effect.remaining);if(effect.shieldPoints!==undefined)existing.shieldPoints=Math.max(existing.shieldPoints||0,effect.shieldPoints);return;}actor.effects.push(copy(effect));}
