import {blockingThreats,knownThreats,relationFor,withoutProposal} from './world-data.js';
import {clone,uid,hash,findActor,randomDie} from './core.js';
import {JOURNEY_STAGES,CAREER_TYPES,serviceFor,visibleMemories} from './campaign-data.js';
export const CAMPAIGN_ACTIONS=['journey-plan','route-command','journey-request','journey-depart','journey-advance','journey-arrive','journey-cancel','career-request'];
const activeStages=['planned','awaiting_access','underway','interrupted','ready_to_arrive'];
export function activeJourney(state){return state.journeys.find(j=>j.id===state.navigation.journeyId&&activeStages.includes(j.status))||state.journeys.find(j=>activeStages.includes(j.status));}
const result=(id,kind,patch,report,extra={})=>({id,kind,patch,report,...extra});
function travelerPatch(state,ids,location){const patch={squad:[],enemies:[]};for(const id of ids){const a=findActor(state,id);if(!a)throw Error('Неизвестный участник перехода');const next={...clone(a),location};if(id==='player')patch.player={location};else patch[state.squad.some(a=>a.id===id)?'squad':'enemies'].push(next);}return patch;}
function eventMemories(id,ids,text,source,sourceId,location){return ids.map(ownerId=>({id:id+':memory:'+ownerId,ownerId,text,source,sourceId,location,confirmed:true,public:false,sharedWith:[],reliability:'Личное участие'}));}
export function journeyBlockers(state,route){const reasons=[];if(!route.origin||!route.destination||route.origin===route.destination)reasons.push('Нужны разные известные точки отправления и назначения');if(!route.accessGranted)reasons.push('Доступ / билет / разрешение не подтверждены');if(!route.transportConfirmed)reasons.push('Наличие подходящего транспорта или прохода не подтверждено');if(!route.conditionsConfirmed)reasons.push('Условия перехода не подтверждены');if(state.navigation.location!==route.origin)reasons.push('Текущее местонахождение не совпадает с точкой отправления');if(state.battle.active)reasons.push('Сначала завершите текущий бой');if(blockingThreats(state,'blocksTravel').length)reasons.push('Действующее ограничение кампании мешает отправлению');return reasons;}
function voyage(state,action){const j=state.journeys.find(j=>j.id===(action.journeyId||state.navigation.journeyId));if(!j)throw Error('Сначала выберите маршрут');return clone(j);}
export function resolveJourney(state,action,id,die=randomDie){
 const kind=action.kind;
 if(kind==='journey-plan'||kind==='route-command'){
  if(kind==='route-command'&&state.navigation.routeAuthority!==true)throw Error('Право задавать маршрут транспорта не подтверждено');
  if(activeJourney(state))throw Error('Уже есть незавершённый маршрут; продолжите или отмените его');
  const route=state.routes.find(r=>r.id===action.routeId);if(!route)throw Error('Неизвестный маршрут');
  const travelerIds=[...new Set(['player',...(action.travelerIds||[])])];for(const travelerId of travelerIds)if(!findActor(state,travelerId))throw Error('Неизвестный пассажир');
  const journey={id:id+':journey',routeId:route.id,name:route.name,origin:route.origin,destination:route.destination,mode:route.mode,steps:route.steps,progress:0,status:'planned',travelerIds,routeSnapshot:clone(route),complication:null,landingGranted:route.landingGranted===true};
  return result(id,'journey',{journeys:[journey],navigation:{routeId:route.id,journeyId:journey.id,route:route.name}},`Выбран маршрут «${route.name}»: ${route.origin} → ${route.destination}. Это план; местонахождение и права на транспорт не изменились.`,{journeyId:journey.id});
 }
 const journey=voyage(state,action),route=state.routes.find(r=>r.id===journey.routeId)||journey.routeSnapshot;
 if(kind==='journey-request'){if(!['planned','awaiting_access'].includes(journey.status))throw Error('Запрос доступа возможен до отправления');journey.status='awaiting_access';return result(id,'journey',{journeys:[journey]},`{{user}} запрашивает доступ к переходу «${journey.name}». Решение принимает ответственное лицо по истории.`,{journeyId:journey.id});}
 if(kind==='journey-depart'){
  if(!['planned','awaiting_access'].includes(journey.status))throw Error('Переход уже начат или закрыт');
  const blockers=journeyBlockers(state,route);if(blockers.length)throw Error(blockers.join('. '));
  for(const travelerId of journey.travelerIds){const a=findActor(state,travelerId);if(a.destroyed)throw Error('Участник перехода окончательно выведен из игры');if(travelerId!=='player'&&a.location&&a.location!=='Не определено'&&a.location!==route.origin)throw Error(`${a.name} находится в другом месте; участие нужно подтвердить по истории`);}
  journey.routeSnapshot=clone(route);journey.origin=route.origin;journey.destination=route.destination;journey.mode=route.mode;journey.steps=route.steps;journey.landingGranted=route.landingGranted===true;journey.status='underway';const location=`В пути: ${journey.origin} → ${journey.destination}`;
  const text=`Переход «${journey.name}» начат. Участники находятся в пути; прибытие ещё не произошло.`;
  return result(id,'journey',{...travelerPatch(state,journey.travelerIds,location),journeys:[journey],navigation:{location},scene:{location,presentIds:[...journey.travelerIds],confirmed:true},memories:eventMemories(id,journey.travelerIds,text,'journey',journey.id,location)},text,{journeyId:journey.id});
 }
 if(kind==='journey-advance'){
  if(state.battle.active)throw Error('Во время боя переход не продвигается');
  if(journey.status==='interrupted'){if(!journey.complication?.resolved)throw Error('Сначала подтвердите разрешение препятствия по истории');journey.status='underway';journey.complication=null;}
  if(journey.status!=='underway')throw Error('Переход сейчас не находится в пути');
  const risk=journey.routeSnapshot.risk,threshold={safe:5,watch:20,dangerous:40,unknown:20}[risk]??20,roll=die(100);if(!Number.isInteger(roll)||roll<1||roll>100)throw Error('Неверный результат d100');let report;
  if(roll<=threshold){
   journey.status='interrupted';const descriptions={warp:'Нестабильность Варпа нарушает переход. Требуются действия ответственных специалистов.',webway:'Проход в Паутине перекрыт или небезопасен. Нужен обход или подтверждённое решение.',necron:'Транзитная система дала сбой. Требуется восстановить доступ или работу устройства.',bioship:'Условия перехода биокорабля изменились. Решение зависит от флота-улья и положения участников.',surface:'На пути препятствие: обход, проверка доступа или опасный участок.',orbit:'Посадка / орбитальный переход задержан. Требуется устранить причину.',realspace:'Переход задержан помехой, опасным участком или проблемой транспорта.',custom:'Возникло препятствие; характер и допустимое решение уточняются по истории.'};
   journey.complication={id:id+':obstacle',text:descriptions[journey.mode]||descriptions.custom,resolved:false,roll};report=`Переход «${journey.name}»: d100 ${roll}, риск ${threshold}%. ${journey.complication.text} Этап не пройден. Урон и враги не создаются автоматически.`;
  }else{journey.progress=Math.min(journey.steps,journey.progress+1);if(journey.progress>=journey.steps)journey.status='ready_to_arrive';report=`Переход «${journey.name}»: d100 ${roll}, риск ${threshold}%. Пройден этап ${journey.progress}/${journey.steps}.${journey.status==='ready_to_arrive'?' Можно подтвердить прибытие с учётом доступа в точку назначения.':''}`;}
  return result(id,'journey',{journeys:[journey],memories:eventMemories(id,journey.travelerIds,report,'journey',journey.id,state.navigation.location)},report,{journeyId:journey.id,roll});
 }
 if(kind==='journey-arrive'){
  if(journey.status!=='ready_to_arrive')throw Error('Сначала завершите этапы перехода');if(state.battle.active)throw Error('Сначала разрешите текущий бой');
  if(journey.routeSnapshot.landingRequired&&!journey.landingGranted)throw Error('Доступ в точку назначения / посадка не подтверждены');
  journey.status='arrived';const location=journey.destination,report=`Переход «${journey.name}» завершён. Подтверждено прибытие: ${location}. Миссии и служебные полномочия не меняются от перемещения.`;
  return result(id,'journey',{...travelerPatch(state,journey.travelerIds,location),journeys:[journey],navigation:{location,journeyId:null},scene:{location,presentIds:[...journey.travelerIds],confirmed:true},memories:eventMemories(id,journey.travelerIds,report,'journey',journey.id,location)},report,{journeyId:journey.id});
 }
 if(kind==='journey-cancel'){if(!['planned','awaiting_access'].includes(journey.status))throw Error('Переход в пути нельзя отменить с возвращением назад. Нужен новый сюжетный маршрут или ручная правка с основанием.');journey.status='cancelled';return result(id,'journey',{journeys:[journey],navigation:{journeyId:null}},`План «${journey.name}» отменён. Местонахождение не изменилось.`,{journeyId:journey.id});}
 throw Error('Неизвестное действие перехода');
}
export function requestCareer(state,action,id){
 const type=Object.hasOwn(CAREER_TYPES,action.type)?action.type:'appointment';if(!String(action.reason||'').trim())throw Error('Укажите основание / намерение по истории');
 const existing=state.careerEvents.find(e=>e.status==='pending'&&e.type===type);if(existing)throw Error('Такой запрос уже ожидает решения');
 const profile=serviceFor(state.player),event={id:id+':career',type,status:'pending',reason:action.reason,newRank:action.newRank||'',newPosition:action.newPosition||'',newAffiliation:action.newAffiliation||'',exitBasis:action.exitBasis||'',authorityId:action.authorityId||'',knownIds:['player'],serviceProfile:profile.id,before:{affiliation:state.player.affiliation,rank:state.player.rank,position:state.player.position,permissions:clone(state.player.permissions),obligations:state.player.obligations}};
 return result(id,'career',{careerEvents:[event]},`${CAREER_TYPES[type]}: запрос / намерение {{user}} зафиксирован. Основание: ${event.reason}. ${profile.note} Ранг, принадлежность и полномочия пока не изменились.`,{careerEventId:event.id});
}
function authorityAllows(state,event){const a=findActor(state,event.authorityId);if(!a||a.id==='player')return false;const permissions=(a.permissions||[]).map(p=>String(p).toLocaleLowerCase());const needed=['release','contract'].includes(event.type)?['release','освобождение от службы','утверждение освобождения','кадровые назначения']:['appoint','назначение','кадровые назначения','утверждение перевода'];const scope=a.affiliation&&a.affiliation.toLocaleLowerCase()===state.player.affiliation.toLocaleLowerCase();return permissions.some(p=>(scope&&needed.includes(p))||p===(['release','contract'].includes(event.type)?'release_any':'appoint_any'));}
export function confirmCareer(state,input,{manual=false}={}){
 const event={...clone(input),status:'confirmed'};if(!event.reason?.trim())throw Error('Нужно сюжетное основание');
 const profile=serviceFor(state.player),unlawful=['desertion','defection'].includes(event.type);
 if(!unlawful&&!manual&&!authorityAllows(state,event))throw Error('Полномочия подтверждающего лица не установлены');
 if(['release','contract'].includes(event.type)&&!profile.exits.includes(event.exitBasis))throw Error('Это основание выхода не соответствует выбранной службе');
 const player={};if(unlawful){player.serviceStatus='Уход без установленного освобождения';}
 else{
  if(event.newRank)player.rank=event.newRank;if(event.newPosition)player.position=event.newPosition;if(event.newAffiliation)player.affiliation=event.newAffiliation;
  if(Array.isArray(event.permissions))player.permissions=clone(event.permissions);if(typeof event.obligations==='string')player.obligations=event.obligations;
  player.serviceStatus=['release','contract'].includes(event.type)?'Указанные обязательства завершены / освобождение подтверждено':'Изменение службы подтверждено';
 }
 if(event.type==='defection'&&event.newAffiliation)player.affiliation=event.newAffiliation;
 const knownIds=[...new Set(['player',...(event.knownIds||[])])].filter(id=>findActor(state,id));event.knownIds=knownIds;
 const text=`${CAREER_TYPES[event.type]} {{user}} подтверждено по истории. ${event.reason}${event.newRank?' Ранг: '+event.newRank:''}${event.newPosition?' Должность: '+event.newPosition:''}${event.newAffiliation?' Принадлежность: '+event.newAffiliation:''}.`;
 return {player,careerEvents:[event],memories:eventMemories(event.id,knownIds,text,'career',event.id,state.navigation.location)};
}
export function isCampaignAction(action){return CAMPAIGN_ACTIONS.includes(action.kind);}
export function resolveCampaignAction(state,action,id,die=randomDie){return action.kind==='career-request'?requestCareer(state,action,id):resolveJourney(state,action,id,die);}
export function memoryFromVox(message,channel,ownerId){return {id:'vox-memory:'+message.id+':'+ownerId,ownerId,text:`${message.from}: ${message.text}`,source:'vox',sourceId:channel.id+':'+message.id,confirmed:true,public:channel.public===true,sharedWith:[],reliability:'Участник разговора'};}
export function npcKnowledge(state,speaker){const npc=findActor(state,speaker);return {npc,location:npc?.location||'Не определено',memories:visibleMemories(state,speaker),publicFeed:state.feed.filter(f=>f.public===true),relationship:relationFor(state,speaker)||null,threats:knownThreats(state,speaker),offers:state.offers.filter(o=>o.confirmed&&o.providerId===speaker).map(withoutProposal),channels:state.channels.filter(c=>c.public||c.participants.includes(speaker))};}
function proof(chat,entry,path){const index=Number(entry.sourceIndex),message=chat[index],evidence=String(entry.evidence||'').trim();if(!Number.isInteger(index)||!message||!evidence||!String(message.mes).includes(evidence))return null;return {index,message,evidence,sourceId:path[index]};}
export function applyCampaignStory(state,update,chat,path){
 const latest=chat.findLastIndex(m=>!m.is_user),trustedScene=state.scene?.confirmed&&state.scene.location===state.navigation.location;
 const proposedMemories=[];
 for(const record of update.memories||[]){const evidence=proof(chat,record,path),owner=findActor(state,record.ownerId)||[...(update.squad||[]),...(update.enemies||[])].find(a=>a.id===record.ownerId);if(!evidence||!owner)continue;const confirmed=(!evidence.message.is_user&&evidence.message.name===owner.name)||(evidence.index===latest&&trustedScene&&state.scene.presentIds.includes(owner.id));proposedMemories.push({...record,id:'story-memory:'+evidence.sourceId+':'+owner.id+':'+hash(evidence.evidence),source:'scene',sourceId:evidence.sourceId,text:confirmed?evidence.evidence:record.text||evidence.evidence,confirmed,public:false,sharedWith:[],evidence:evidence.evidence});}
 update.memories=proposedMemories;
 for(const route of update.routes||[]){const old=state.routes.find(r=>r.id===route.id),evidence=proof(chat,route,path);for(const field of ['accessGranted','transportConfirmed','conditionsConfirmed','landingGranted'])if(route[field]!==old?.[field]&&(!evidence||evidence.index!==latest))route[field]=old?.[field]??false;}
 if(update.journeys)update.journeys=update.journeys.filter(j=>state.journeys.some(old=>old.id===j.id));
 for(const journey of update.journeys||[]){const old=state.journeys.find(j=>j.id===journey.id);if(!old)continue;const evidence=proof(chat,journey,path);const resolved=journey.complication?.resolved===true&&evidence?.index===latest,landing=journey.landingGranted===true&&evidence?.index===latest;Object.assign(journey,clone(old));if(resolved&&journey.complication)journey.complication.resolved=true;if(landing)journey.landingGranted=true;}
 if(update.navigation&&update.navigation.routeAuthority!==undefined&&update.navigation.routeAuthority!==state.navigation.routeAuthority){const evidence=proof(chat,update.navigation,path);if(!evidence||evidence.index!==latest)delete update.navigation.routeAuthority;}
 // Location and progress are controlled by the selected journey while underway.
 const journey=activeJourney(state);if(journey&&['underway','interrupted','ready_to_arrive'].includes(journey.status)){if(update.navigation)for(const field of ['location','journeyId','routeId','route','routeAuthority','relationship','ship'])delete update.navigation[field];if(update.player)delete update.player.location;for(const c of ['squad','enemies'])for(const a of update[c]||[])if(journey.travelerIds.includes(a.id))a.location=findActor(state,a.id)?.location;}
 // Strip raw career fields first; only a validated event can change an established career.
 if(update.player)for(const key of ['rank','position','permissions','affiliation','serviceStatus','serviceProfile']){const previous=state.player[key],initial=previous===undefined||previous===''||previous==='Не определено'||Array.isArray(previous)&&!previous.length;if(!initial||state.careerEvents.length||[state.player.rank,state.player.position].some(v=>v&&v!=='Не определено'))delete update.player[key];}
 const approved=[];
 for(const event of update.careerEvents||[]){const old=state.careerEvents.find(e=>e.id===event.id);if(!old){event.status='proposal';continue;}if(['confirmed','rejected'].includes(old.status)){Object.assign(event,old);continue;}const evidence=proof(chat,event,path);if(event.status==='confirmed'&&evidence&&evidence.index===latest){try{const knownIds=['player',event.authorityId,...(trustedScene?state.scene.presentIds:[])].filter(id=>findActor(state,id));const patch=confirmCareer(state,{...old,...event,knownIds,evidence:evidence.evidence,sourceId:evidence.sourceId});Object.assign(update.player??={},patch.player);update.memories.push(...patch.memories);Object.assign(event,patch.careerEvents[0]);approved.push(event);}catch{event.status='proposal';}}else if(old.status==='confirmed')Object.assign(event,old);else if(event.status!=='rejected')event.status='proposal';}
 if(update.scene){const ids=(update.scene.presentIds||[]).filter(id=>findActor(state,id));update.scene.confirmed=Boolean(state.scene.confirmed&&update.scene.location===state.scene.location&&JSON.stringify(ids)===JSON.stringify(state.scene.presentIds));update.scene.presentIds=ids;}
 return update;
}
export function campaignGuide(player={}){return JSON.stringify({actions:CAMPAIGN_ACTIONS,rules:'План маршрута не меняет местонахождение. departure требует accessGranted, transportConfirmed, conditionsConfirmed и совпадение origin с текущим местом. routeAuthority — отдельное право, не определяется расой или владением. Прогресс и прибытие считает код. journey-advance может создать препятствие; его разрешение и landingGranted подтверждаются evidence и sourceIndex последнего ответа. Не выдавай корабль, технологии или приказ по расе. Career-request создаёт запрос без повышения. Решение careerEvents.status=confirmed требует authorityId лица с заранее установленными appoint/release, evidence точной цитаты и sourceIndex ответа. Для выхода нужна exitBasis по выбранной службе. Самовольный уход не отменяет клятв и не сообщает факт всей галактике. Личная память: memories:{ownerId,text,evidence,sourceIndex}. Присутствие в сцене подтверждает пользователь; неподтверждённые записи становятся предложениями. Не придумывай свидетелей и не передавай чужие закрытые каналы.',routeFields:{id:'постоянный id',name:'название',origin:'место',destination:'место',mode:'surface|orbit|realspace|warp|webway|necron|bioship|custom',steps:'1–100',risk:'safe|watch|dangerous|unknown',requirements:['условие'],accessGranted:false,transportConfirmed:false,conditionsConfirmed:false,landingRequired:false,landingGranted:false,sourceIndex:'индекс сообщения',evidence:'точная цитата'},service:serviceFor(player)});}
