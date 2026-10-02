export const ACQUISITION_METHODS={purchase:'Покупка',issue:'Выдача со склада',barter:'Обмен',trophy:'Трофей',gift:'Подарок',loan:'Временная выдача'};
export const THREAT_TYPES={wanted:'Розыск',cover:'Раскрытие прикрытия',artifact:'Опасный артефакт',contract:'Нарушение договора',warp:'Влияние Варпа',custom:'Своя угроза'};
const array=v=>Array.isArray(v)?v:[];
const number=(v,min,max)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;};
export function normalWorldRecord(c,r){
 if(c==='relationships'){r.npcId=String(r.npcId||'');r.trust=number(r.trust,-100,100);r.suspicion=number(r.suspicion,0,100);r.rivalry=number(r.rivalry,0,100);r.confirmed=r.confirmed===true;for(const key of ['playerDebts','npcDebts','promises'])r[key]=array(r[key]).map(String);r.patronage=String(r.patronage||'');}
 if(c==='offers'){r.name=String(r.name||'Предложение');r.method=Object.hasOwn(ACQUISITION_METHODS,r.method)?r.method:'purchase';r.collection=['weapons','armor','inventory'].includes(r.collection)?r.collection:'inventory';r.item=r.item&&typeof r.item==='object'?r.item:{};r.stock=r.stock===null?null:Math.floor(number(r.stock,0,100000));r.price=number(r.price,0,1000000000);r.minTrust=number(r.minTrust,-100,100);r.exchangeAmount=number(r.exchangeAmount,0,100000);r.confirmed=r.confirmed===true;r.accessGranted=r.accessGranted===true;r.allowedSpecies=array(r.allowedSpecies).map(String);r.requirements=array(r.requirements).map(String);}
 if(c==='transactions'){r.status=r.status==='returned'?'returned':'received';r.itemIds=array(r.itemIds).map(String);}
 if(c==='threats'){r.name=String(r.name||'Угроза');r.type=Object.hasOwn(THREAT_TYPES,r.type)?r.type:'custom';r.status=['active','contained','resolved'].includes(r.status)?r.status:'active';r.severity=number(r.severity,1,3);r.confirmed=r.confirmed===true;r.public=r.public===true;r.affectedIds=array(r.affectedIds).map(String);r.knownIds=array(r.knownIds).map(String);r.blocksTravel=r.blocksTravel===true;r.blocksAcquisition=r.blocksAcquisition===true;}
 if(c==='missions'){r.missionRequirements=array(r.missionRequirements).map(x=>({missionId:String(x.missionId||''),status:x.status==='failed'?'failed':'completed',outcome:String(x.outcome||'')}));r.prerequisiteIds=array(r.prerequisiteIds).map(String);r.approaches=array(r.approaches).map(a=>({id:String(a.id||''),name:String(a.name||''),conditions:String(a.conditions||'')})).filter(a=>a.id&&a.name);r.conditions=array(r.conditions).map(String);r.resolvedThreatIds=array(r.resolvedThreatIds).map(String);r.conditionsConfirmed=r.conditionsConfirmed===true;}
 return r;
}
export function withoutProposal(r){if(!r)return r;const {pending,...value}=r;return value;}
export function relationFor(s,id){return withoutProposal(s.relationships?.find(r=>r.npcId===id&&r.confirmed));}
export function knownThreats(s,viewer='player'){return (s.threats||[]).filter(t=>t.confirmed&&(t.public||t.knownIds.includes(viewer))).map(withoutProposal);}
export function blockingThreats(s,field,actorId='player'){return (s.threats||[]).filter(t=>t.confirmed&&t.status==='active'&&t[field]&&t.affectedIds.includes(actorId)&&(!t.location||t.location===s.navigation.location));}
